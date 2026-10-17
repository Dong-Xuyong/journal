/* Frame and routing. Data comes from JournalData, saves from JournalOps,
   and each tab from JournalViews. Morning, evening, week, and month fields
   stay read-only. */
(function (global) {
  "use strict";

  var TOKEN_KEY = "dong-gh-sync";
  var DEFAULT_REPO = "Dong-Xuyong/progress-sync";
  var PULL_EVERY = 60000;
  var KIND_WORD = { day: "Day", week: "Week", month: "Month", quarter: "Quarter", year: "Year", habits: "Habits" };
  var PERIODS = ["day", "week", "month", "quarter", "year"];
  var STATUS_TEXT = {
    idle: "",
    pending: "Saving soon",
    saving: "Saving\u2026",
    saved: "Saved",
    error: "Could not save",
    offline: "Offline"
  };

  var Data = global.JournalData;
  var Ops = global.JournalOps;
  var UI = global.JournalUI;
  var Views = global.JournalViews = global.JournalViews || {};

  var tabs = document.getElementById("tabs");
  var crumbs = document.getElementById("crumbs");
  var heading = document.getElementById("period-heading");
  var view = document.getElementById("view");
  var prev = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var today = document.getElementById("today");
  var syncLabel = document.getElementById("sync-label");
  var connect = document.getElementById("connect");
  var connectBtn = document.getElementById("btn-connect");
  var route = { kind: "", key: "" };
  var paintedVersion = -1;
  var renderQueued = false;
  var renderWaiting = false;

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  }

  function hasToken() {
    var cfg = readJSON(TOKEN_KEY);
    return !!(cfg && typeof cfg.token === "string" && cfg.token.trim());
  }

  function hasQueue() {
    var raw = readJSON("journal-next-ops");
    return !!(raw && Array.isArray(raw.ops) && raw.ops.length);
  }

  function paintStatus() {
    var state = Ops.status();
    var text = STATUS_TEXT[state] || "";
    if (!hasToken()) text = hasQueue() ? "Saved on this device" : "Not synced";
    if (syncLabel.textContent !== text) syncLabel.textContent = text;
  }

  function readRoute() {
    var hash = location.hash.replace(/^#/, "");
    var cut = hash.indexOf("/");
    var key;
    var kind;
    if (hash === "habits" || hash.indexOf("habits/") === 0) {
      key = "";
      if (hash.indexOf("habits/") === 0) {
        try { key = decodeURIComponent(hash.slice(7)); } catch (e) { key = ""; }
      }
      return { kind: "habits", key: key };
    }
    if (cut < 1) return null;
    kind = hash.slice(0, cut);
    try { key = decodeURIComponent(hash.slice(cut + 1)); } catch (e) { return null; }
    if (PERIODS.indexOf(kind) === -1) return null;
    if (Data.kindOf(key) !== kind) return null;
    return { kind: kind, key: key };
  }

  function tabHref(kind) {
    if (kind === "habits") return "#habits";
    return "#" + kind + "/" + Data.todayKey(kind);
  }

  function paintTabs() {
    tabs.textContent = "";
    ["day", "week", "month", "quarter", "year", "habits"].forEach(function (kind) {
      var link = document.createElement("a");
      link.className = "dx-tab";
      link.href = tabHref(kind);
      link.textContent = KIND_WORD[kind];
      if (kind === route.kind) link.setAttribute("aria-current", "page");
      tabs.appendChild(link);
    });
  }

  function habitLabel(id) {
    var defs = Data.habitDefs();
    var i;
    for (i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i].label;
    return id;
  }

  function paintCrumbs() {
    var list = document.createElement("ol");
    var chain;
    crumbs.textContent = "";
    if (route.kind === "habits") {
      chain = [{ href: "#habits", text: "Habits", current: !route.key }];
      if (route.key) chain.push({ href: "#habits/" + encodeURIComponent(route.key), text: habitLabel(route.key), current: true });
    } else {
      chain = Data.ancestors(route.key).slice().reverse().concat([route.key]).map(function (key, index, all) {
        var kind = Data.kindOf(key);
        return {
          href: "#" + kind + "/" + key,
          text: KIND_WORD[kind] + " \u00b7 " + Data.label(key),
          current: index === all.length - 1
        };
      });
    }
    chain.forEach(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.text;
      if (item.current) link.setAttribute("aria-current", "page");
      li.appendChild(link);
      list.appendChild(li);
    });
    crumbs.appendChild(list);
  }

  function paintNav() {
    var word = route.kind === "habits" ? "" : route.kind;
    var show = route.kind !== "habits";
    prev.hidden = !show;
    today.hidden = !show;
    nextBtn.hidden = !show;
    if (!show) return;
    prev.textContent = "Previous " + word;
    nextBtn.textContent = "Next " + word;
    today.disabled = route.key === Data.todayKey(route.kind);
  }

  function paintConnect() {
    connect.hidden = hasToken();
  }

  function editing() {
    var active = document.activeElement;
    if (!active || !view.contains(active) || !active.value) return false;
    return active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && /^(text|search|)$/.test(active.type || ""));
  }

  function focusKey() {
    var active = document.activeElement;
    var holder = active && active.closest ? active.closest("[data-focus]") : null;
    if (!holder || !view.contains(holder)) return null;
    return {
      key: holder.getAttribute("data-focus"),
      start: typeof active.selectionStart === "number" ? active.selectionStart : null,
      end: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };
  }

  function restoreFocus(saved) {
    var wanted = UI.takeFocus ? UI.takeFocus() : null;
    var key = wanted || (saved && saved.key);
    var target;
    if (!key) return;
    target = view.querySelector('[data-focus="' + key.replace(/["\\]/g, "\\$&") + '"]');
    if (!target) return;
    target.focus({ preventScroll: true });
    if (!wanted && saved && saved.start != null && typeof target.setSelectionRange === "function") {
      try { target.setSelectionRange(saved.start, saved.end); } catch (e) {}
    }
  }

  function render(opts) {
    var title;
    var saved = opts && opts.focus ? null : focusKey();
    var scrollY = global.scrollY;
    opts = opts || {};
    paintTabs();
    paintCrumbs();
    paintNav();
    if (route.kind === "habits") title = route.key ? "Habits \u00b7 " + habitLabel(route.key) : "Habits";
    else title = Data.label(route.key) || KIND_WORD[route.kind];
    heading.textContent = title;
    document.title = title + " \u00b7 Journal";
    document.body.setAttribute("data-kind", route.kind);
    view.textContent = "";
    if (typeof Views[route.kind] === "function") {
      Views[route.kind](view, { key: route.key, today: Data.todayKey("day") });
    } else {
      view.appendChild(UI.el("p", "empty-line", "This part did not load. Reload the page."));
    }
    paintedVersion = Data.version ? Data.version() : paintedVersion;
    paintConnect();
    paintStatus();
    if (opts.focus) heading.focus();
    else {
      restoreFocus(saved);
      if (!opts.scroll) global.scrollTo(0, scrollY);
    }
  }

  function refresh() {
    renderQueued = false;
    if (!readRoute()) return;
    if (Data.version && Data.version() === paintedVersion) return;
    if (editing()) {
      renderWaiting = true;
      return;
    }
    renderWaiting = false;
    render({ focus: false });
  }

  function queueRefresh() {
    paintStatus();
    if (renderQueued) return;
    renderQueued = true;
    global.setTimeout(refresh, 0);
  }

  view.addEventListener("focusout", function () {
    if (renderWaiting) global.setTimeout(refresh, 0);
  });

  function go(delta) {
    var key;
    if (!route.key) return;
    key = Data.shift(route.key, delta);
    if (key) location.hash = "#" + route.kind + "/" + key;
  }

  function showRoute() {
    var next = readRoute();
    var stay;
    if (!next) {
      location.replace("#day/" + Data.todayKey("day"));
      return;
    }
    stay = route.kind === "habits" && next.kind === "habits";
    route = next;
    render({ focus: !stay, scroll: !stay });
    if (!stay) global.scrollTo(0, 0);
  }

  prev.addEventListener("click", function () { go(-1); });
  nextBtn.addEventListener("click", function () { go(1); });
  today.addEventListener("click", function () {
    if (route.kind && route.kind !== "habits") location.hash = "#" + route.kind + "/" + Data.todayKey(route.kind);
  });
  connectBtn.addEventListener("click", function () {
    var token = global.prompt("Paste a GitHub token that can read and write your journal file. It stays in this browser.");
    var cfg;
    if (!token || !String(token).trim()) return;
    cfg = readJSON(TOKEN_KEY) || {};
    cfg.token = String(token).trim();
    if (!cfg.repo) cfg.repo = DEFAULT_REPO;
    localStorage.setItem(TOKEN_KEY, JSON.stringify(cfg));
    paintConnect();
    Ops.pull().then(function () { if (hasQueue()) Ops.flush(); });
  });
  Ops.onChange(queueRefresh);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") Ops.pull();
  });
  global.setInterval(function () {
    if (document.visibilityState !== "hidden") Ops.pull();
  }, PULL_EVERY);
  window.addEventListener("hashchange", showRoute);
  paintStatus();
  showRoute();
})(window);
