(function () {
  "use strict";

  var STORE_KEY = "journal-v1";
  var SAVE_DELAY = 2500;
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MOOD = ["😞", "😕", "😐", "🙂", "😄"];
  var ENERGY = ["🪫", "😴", "🔋", "💪", "⚡"];
  var ENJOY = { green: "🟢 Great", yellow: "🟡 Okay", red: "🔴 Rough" };
  var STATUS = [["none", "⚪ Not started"], ["progress", "🔵 In progress"], ["done", "✅ Done"], ["paused", "⏸️ Paused"]];

  var els = {
    tabs: document.getElementById("tabs"),
    prev: document.getElementById("prev"),
    next: document.getElementById("next"),
    today: document.getElementById("today"),
    icon: document.getElementById("hero-icon"),
    period: document.getElementById("period-label"),
    parent: document.getElementById("parent-line"),
    completion: document.getElementById("completion"),
    form: document.getElementById("form"),
    sync: document.getElementById("sync-label"),
    connect: document.getElementById("connect"),
    connectBtn: document.getElementById("btn-connect")
  };

  var store = readStore();
  var cur = { kind: "", key: "" };
  var loading = false;
  var saving = false;
  var saveAgain = false;
  var saveTimer = null;
  var retried = false;

  function readStore() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (data && data.version === 1 && data.entries && typeof data.entries === "object") {
        if (!data.quotes || typeof data.quotes !== "object") data.quotes = {};
        return data;
      }
    } catch (e) {}
    return JournalCore.blankStore();
  }

  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function button(className, text) {
    var el = node("button", className, text);
    el.type = "button";
    return el;
  }

  var tipOpen = null;

  function closeTip() {
    if (!tipOpen) return;
    tipOpen.tip.hidden = true;
    tipOpen.btn.setAttribute("aria-expanded", "false");
    tipOpen = null;
  }

  function infoButton(citeKey) {
    var cite = JournalGamify.cite(citeKey);
    var wrap = node("span", "info-wrap");
    var btn = button("info-btn", "\u24D8");
    var tip = node("span", "info-tip");
    btn.setAttribute("aria-label", cite.title + ". " + cite.concept);
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-cite", citeKey);
    tip.hidden = true;
    tip.setAttribute("role", "tooltip");
    tip.appendChild(node("b", "", cite.title));
    tip.appendChild(node("span", "info-by", cite.by));
    tip.appendChild(node("span", "info-concept", cite.concept));
    if (cite.text) tip.appendChild(node("p", "", cite.text));
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var opening = tip.hidden;
      closeTip();
      if (!opening) return;
      if (btn.getBoundingClientRect().left > window.innerWidth * 0.55) tip.classList.add("align-end");
      else tip.classList.remove("align-end");
      tip.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      tipOpen = { tip: tip, btn: btn };
    });
    wrap.appendChild(btn);
    wrap.appendChild(tip);
    return wrap;
  }

  function cardHead(title, citeKey) {
    var head = node("div", "card-head");
    head.appendChild(node("h3", "", title));
    if (citeKey) head.appendChild(infoButton(citeKey));
    return head;
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest(".info-wrap")) return;
    closeTip();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeTip();
  });

  function hhmm() {
    var now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  }

  function readRoute() {
    var hash = location.hash.replace(/^#/, "");
    var cut = hash.indexOf("/");
    var key;
    if (hash === "habits" || hash.indexOf("habits/") === 0) {
      key = "all";
      if (hash.indexOf("habits/") === 0) {
        try { key = decodeURIComponent(hash.slice(7)); } catch (e) { key = "all"; }
        if (!key) key = "all";
      }
      return { kind: "habits", key: key };
    }
    if (cut < 1) return null;
    try {
      key = decodeURIComponent(hash.slice(cut + 1));
    } catch (e) {
      return null;
    }
    var kind = hash.slice(0, cut);
    if (JournalSchemas.order.indexOf(kind) === -1) return null;
    if (JournalCore.kindOf(key) !== kind) return null;
    return { kind: kind, key: key };
  }

  function ensure() {
    if (!store.entries[cur.key]) store.entries[cur.key] = { updatedAt: "", fields: {}, todos: [] };
    var entry = store.entries[cur.key];
    if (!entry.fields || typeof entry.fields !== "object") entry.fields = {};
    if (!Array.isArray(entry.todos)) entry.todos = [];
    return entry;
  }

  function fieldMap(entry) {
    return entry && entry.fields && typeof entry.fields === "object" ? entry.fields : {};
  }

  function todoList(entry) {
    return entry && Array.isArray(entry.todos) ? entry.todos : [];
  }

  function isScore(n) {
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
  }

  function trioLines(value) {
    return (Array.isArray(value) ? value : []).map(function (line) {
      return String(line == null ? "" : line).trim();
    }).filter(Boolean);
  }

  function isFilled(field, value) {
    if (field.type === "scale") return isScore(value);
    if (field.type === "enjoy") return Object.prototype.hasOwnProperty.call(ENJOY, value);
    if (field.type === "trio") return trioLines(value).length > 0;
    return String(value == null ? "" : value).trim() !== "";
  }

  function quoteText(key) {
    var quote = store.quotes && store.quotes[key];
    return quote && typeof quote.text === "string" ? quote.text.trim() : "";
  }

  function touch() {
    ensure().updatedAt = new Date().toISOString();
    persist();
    paintCompletion();
    refreshJournalPlay();
    scheduleSave();
  }

  function paintCompletion() {
    var schema = JournalSchemas[cur.kind];
    var entry = store.entries[cur.key];
    var fields = fieldMap(entry);
    var todos = todoList(entry);
    var total = 0;
    var filled = 0;
    var done = 0;
    var ring;
    schema.sections.forEach(function (section) {
      section.fields.forEach(function (field) {
        if (field.type === "todos") return;
        total += 1;
        if (isFilled(field, fields[field.key])) filled += 1;
      });
    });
    todos.forEach(function (todo) { if (todo.done) done += 1; });
    els.completion.textContent = "";
    ring = node("div", "ring");
    ring.style.setProperty("--p", String(todos.length ? Math.round((done * 100) / todos.length) : 0));
    els.completion.appendChild(ring);
    els.completion.appendChild(node("span", "", "✍️ " + filled + "/" + total + " · ✅ " + done + "/" + todos.length));
  }

  function paintParent() {
    var spec = JournalSchemas[cur.kind].parent;
    var pk, raw;
    els.parent.textContent = "";
    if (!spec) return;
    pk = JournalCore.parentKey(cur.key);
    raw = pk ? fieldMap(store.entries[pk])[spec.field] : "";
    raw = String(raw == null ? "" : raw).split(/\r?\n/)[0].trim();
    if (raw) els.parent.textContent = spec.prefix + ": " + raw;
  }

  function card(title, extra) {
    var section = node("section", extra ? "card " + extra : "card");
    section.appendChild(node("h3", "", title));
    return section;
  }

  function meter(field, value) {
    var faces = field.key === "energy" ? ENERGY : MOOD;
    var box = node("div", "meter");
    var text = node("div");
    var bar = node("span", "bar");
    var fill = node("i");
    box.appendChild(node("span", "emo", faces[value - 1]));
    text.appendChild(node("span", "lbl", field.label));
    text.appendChild(node("b", "", value + "/5"));
    fill.style.setProperty("--v", value * 20 + "%");
    bar.appendChild(fill);
    text.appendChild(bar);
    box.appendChild(text);
    return box;
  }

  function fieldView(field, value) {
    var wrap = node("div", "field");
    var list;
    wrap.appendChild(node("span", "lbl", field.label));
    if (field.type === "enjoy") {
      wrap.appendChild(node("span", "chip", ENJOY[value]));
    } else if (field.type === "trio") {
      list = node("ul", "trio");
      trioLines(value).forEach(function (line) { list.appendChild(node("li", "", line)); });
      wrap.appendChild(list);
    } else {
      var lines = String(value).trim().split(/\r?\n/).filter(function (line) { return line.trim(); });
      if (lines.length > 1 && lines.every(function (line) { return /^\s*[-*•]\s+/.test(line); })) {
        list = node("ul", "bullets");
        lines.forEach(function (line) { list.appendChild(node("li", "", line.replace(/^\s*[-*•]\s+/, ""))); });
        wrap.appendChild(list);
      } else {
        wrap.appendChild(node("p", "val", String(value).trim()));
      }
    }
    return wrap;
  }

  function fit(area) {
    area.style.height = "auto";
    area.style.height = area.scrollHeight + "px";
  }

  function fitAll() {
    Array.prototype.forEach.call(els.form.querySelectorAll(".todo textarea"), fit);
  }

  function todoBlock(todo, withStatus) {
    var block = node("div");
    var row = node("div", todo.done ? "todo done" : "todo");
    var check = node("input");
    var text = node("textarea");
    var del = button("del", "✕");
    var status;
    check.type = "checkbox";
    check.checked = !!todo.done;
    check.setAttribute("aria-label", "Done");
    text.rows = 1;
    text.value = todo.text || "";
    text.placeholder = "New to-do…";
    text.setAttribute("aria-label", "To-do");
    del.setAttribute("aria-label", "Delete to-do");
    function setDone(done) {
      todo.done = done;
      check.checked = done;
      row.classList.toggle("done", done);
    }
    check.addEventListener("change", function () {
      setDone(check.checked);
      if (withStatus) {
        todo.status = check.checked ? "done" : "progress";
        markStatus();
      }
      touch();
    });
    text.addEventListener("input", function () {
      todo.text = text.value.replace(/\n/g, " ");
      if (todo.text !== text.value) text.value = todo.text;
      fit(text);
      touch();
    });
    requestAnimationFrame(function () { fit(text); });
    del.addEventListener("click", function () {
      var entry = ensure();
      entry.todos = entry.todos.filter(function (item) { return item !== todo; });
      block.remove();
      touch();
    });
    row.appendChild(check);
    row.appendChild(text);
    row.appendChild(del);
    block.appendChild(row);
    function markStatus() {
      if (!status) return;
      Array.prototype.forEach.call(status.children, function (el, i) {
        el.classList.toggle("on", STATUS[i][0] === (todo.status || "none"));
      });
    }
    if (withStatus) {
      status = node("div", "status");
      STATUS.forEach(function (pair) {
        var el = button("", pair[1]);
        el.addEventListener("click", function () {
          todo.status = pair[0];
          setDone(pair[0] === "done");
          markStatus();
          touch();
        });
        status.appendChild(el);
      });
      markStatus();
      block.appendChild(status);
    }
    block.focusText = function () { text.focus(); };
    return block;
  }

  function mountTodos(section, field) {
    var list = node("div", "todo-list");
    var actions = node("div", "todo-actions");
    var add = button("add", "➕ Add to-do");
    todoList(store.entries[cur.key]).forEach(function (todo) {
      list.appendChild(todoBlock(todo, !!field.status));
    });
    section.appendChild(list);
    add.addEventListener("click", function () {
      var todo = { id: uid(), text: "", done: false };
      var block;
      if (field.status) todo.status = "none";
      ensure().todos.push(todo);
      block = todoBlock(todo, !!field.status);
      list.appendChild(block);
      block.focusText();
      touch();
    });
    actions.appendChild(add);
    if (field.carry) {
      actions.appendChild(button("carry", "↪️ Bring unfinished from yesterday")).addEventListener("click", function () {
        var have = {};
        var added = [];
        todoList(store.entries[cur.key]).forEach(function (todo) {
          var text = String(todo.text || "").trim();
          if (text) have[text] = true;
        });
        todoList(store.entries[JournalCore.shift(cur.key, -1)]).forEach(function (todo) {
          var text = String(todo.text || "").trim();
          if (todo.done || !text || have[text]) return;
          have[text] = true;
          added.push({ id: uid(), text: text, done: false });
        });
        if (!added.length) {
          els.sync.textContent = "👍 Nothing unfinished yesterday";
          return;
        }
        added.forEach(function (todo) {
          ensure().todos.push(todo);
          list.appendChild(todoBlock(todo, false));
        });
        touch();
      });
    }
    section.appendChild(actions);
  }

  function journalView() {
    return { kind: cur.kind, key: cur.key, today: JournalCore.dayKey(new Date()) };
  }

  function avgText(n) {
    return n == null ? "\u2013" : (Math.round(n * 10) / 10).toFixed(1);
  }

  function badge(text, on, extra) {
    var el = node("span", "badge" + (on ? " on" : ""), text);
    if (extra) {
      Object.keys(extra).forEach(function (key) { el.setAttribute(key, extra[key]); });
    }
    return el;
  }

  function svgEl(name) {
    return document.createElementNS("http://www.w3.org/2000/svg", name);
  }

  function sparkLine(points, prop, className) {
    var group = svgEl("g");
    group.setAttribute("class", className);
    var seg = [];
    function flush() {
      if (!seg.length) return;
      if (seg.length === 1) {
        var dot = svgEl("circle");
        dot.setAttribute("cx", seg[0][0]);
        dot.setAttribute("cy", seg[0][1]);
        dot.setAttribute("r", "1.8");
        group.appendChild(dot);
      } else {
        var line = svgEl("polyline");
        line.setAttribute("points", seg.map(function (pair) { return pair[0] + "," + pair[1]; }).join(" "));
        group.appendChild(line);
      }
      seg = [];
    }
    points.forEach(function (point, index) {
      var value = point[prop];
      if (value == null) {
        flush();
        return;
      }
      var x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      var y = 4 + ((5 - value) / 4) * 28;
      seg.push([x.toFixed(2), y.toFixed(2)]);
    });
    flush();
    return group;
  }

  function spark(span) {
    var svg = svgEl("svg");
    svg.setAttribute("viewBox", "0 0 100 36");
    svg.setAttribute("class", "spark");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Mood and energy");
    var base = svgEl("line");
    base.setAttribute("x1", "0");
    base.setAttribute("x2", "100");
    base.setAttribute("y1", "32");
    base.setAttribute("y2", "32");
    base.setAttribute("class", "spark-base");
    svg.appendChild(base);
    svg.appendChild(sparkLine(span.points, "mood", "spark-mood"));
    svg.appendChild(sparkLine(span.points, "energy", "spark-energy"));
    return svg;
  }

  function sparkLegend() {
    var row = node("div", "spark-legend");
    row.appendChild(node("span", "spark-key mood", "Mood"));
    row.appendChild(node("span", "spark-key energy", "Energy"));
    return row;
  }

  function feelingStat(label, span) {
    var row = node("div", "spark-block");
    row.appendChild(node("span", "spark-label", label));
    row.appendChild(spark(span));
    row.appendChild(node("p", "spark-stat", "\uD83D\uDE42 " + avgText(span.moodAvg) + " mood \u00b7 \u26A1 " + avgText(span.energyAvg) + " energy \u00b7 " + span.logged + " logged"));
    return row;
  }

  function mountFeelings(board) {
    var section = node("section", "card journal-feelings");
    section.setAttribute("data-feelings", board.feelings.badge ? "1" : "0");
    section.appendChild(cardHead("\uD83D\uDCCA Mood & energy", "feelings"));
    section.appendChild(badge("Logged feelings", board.feelings.badge, { "data-logged-feelings": board.feelings.badge ? "1" : "0" }));
    section.appendChild(sparkLegend());
    section.appendChild(feelingStat("7 days", board.feelings.week));
    section.appendChild(feelingStat("30 days", board.feelings.month));
    return section;
  }

  function ratioBadge(label, ratio) {
    var on = ratio.expected > 0 && ratio.done >= ratio.expected;
    return badge(label + " " + ratio.done + "/" + ratio.expected, on);
  }

  function mountJournalCard(board) {
    var section = node("section", "card journal-play");
    var streak = board.streak;
    var level = board.xp.level;
    var period = board.xp.period;
    var bits = [];
    var bar = node("span", "rate-bar");
    var fill = node("i");
    var surprise = node("div", "surprise-row");
    var balance = node("div", "pill-row");
    var reviews = node("div", "pill-row");
    section.setAttribute("data-journal-streak", String(streak.current));
    section.setAttribute("data-journal-best", String(streak.best));
    section.setAttribute("data-journal-level", String(level.level));
    section.setAttribute("data-journal-xp", String(level.xp));
    section.setAttribute("data-gratitude-days", String(board.gratitude.streak));
    section.setAttribute("data-gratitude-items", String(board.gratitude.items));
    section.setAttribute("data-balanced", board.balance.balanced ? "1" : "0");
    section.setAttribute("data-balanced-count", String(board.balance.count));
    section.appendChild(cardHead("\uD83D\uDCD3 Journal streak", "journalStreak"));
    section.appendChild(node("p", "play-streak", streak.current ? streak.current + (streak.current === 1 ? " day in a row" : " days in a row") : "No streak yet"));
    section.appendChild(node("p", "habit-note", "Best " + streak.best));
    var badges = node("div", "badges");
    streak.badges.forEach(function (item) {
      badges.appendChild(badge(String(item.days), item.unlocked, { "data-days": String(item.days), "data-unlocked": item.unlocked ? "1" : "0" }));
    });
    section.appendChild(badges);
    var effort = cardHead("\u26A1 Effort", "effort");
    effort.classList.add("subhead");
    section.appendChild(effort);
    var levelRow = node("div", "level-row");
    levelRow.appendChild(node("b", "", "Level " + level.level));
    levelRow.appendChild(node("span", "", level.xp + " XP"));
    section.appendChild(levelRow);
    fill.style.setProperty("--v", Math.round((level.into / level.need) * 100) + "%");
    bar.appendChild(fill);
    section.appendChild(bar);
    section.appendChild(node("p", "habit-note", level.into + " / " + level.need + " XP to the next level \u00b7 " + JournalGamify.XP_MORNING + " XP for morning or evening. A week is " + JournalGamify.XP_WEEK + ", a month " + JournalGamify.XP_MONTH + ", a quarter " + JournalGamify.XP_QUARTER + "."));
    if (period.morning) bits.push("+" + period.morning + " morning");
    if (period.evening) bits.push("+" + period.evening + " evening");
    if (period.review) bits.push("+" + period.review + " review");
    if (period.surprise) bits.push("+" + period.surprise + " surprise");
    if (bits.length) section.appendChild(node("p", "xp-today", "This entry \u00b7 " + bits.join(" \u00b7 ")));
    surprise.appendChild(node("span", "", "Surprise bonus"));
    surprise.appendChild(infoButton("intermittent"));
    surprise.setAttribute("data-surprise", period.surprise ? "1" : "0");
    if (period.surprise) surprise.appendChild(node("span", "surprise-badge", "\uD83C\uDF81 +" + JournalGamify.XP_JOURNAL_SURPRISE + " XP"));
    section.appendChild(surprise);
    var thanks = cardHead("\uD83D\uDE4F Gratitude", "gratitude");
    thanks.classList.add("subhead");
    section.appendChild(thanks);
    section.appendChild(node("p", "play-streak", (board.gratitude.streak ? board.gratitude.streak + (board.gratitude.streak === 1 ? " day" : " days") : "No gratitude streak") + " \u00b7 " + board.gratitude.items + (board.gratitude.items === 1 ? " item" : " items")));
    if (cur.kind !== "day") section.appendChild(node("p", "habit-note", board.gratitude.period + " in this " + cur.kind));
    var act = cardHead("\u2696\uFE0F Reflect and act", "balance");
    act.classList.add("subhead");
    section.appendChild(act);
    if (cur.kind === "day") {
      balance.appendChild(badge("Reflection", board.balance.reflection));
      balance.appendChild(badge("Action", board.balance.action));
      balance.appendChild(badge("Balanced day", board.balance.balanced, { "data-balanced-badge": board.balance.balanced ? "1" : "0" }));
    } else {
      balance.appendChild(badge(board.balance.count + (board.balance.count === 1 ? " balanced day" : " balanced days"), board.balance.count > 0, { "data-balanced-badge": board.balance.count > 0 ? "1" : "0" }));
    }
    section.appendChild(balance);
    var audit = cardHead("\uD83D\uDD0D Reviews", "reviews");
    audit.classList.add("subhead");
    section.appendChild(audit);
    reviews.appendChild(ratioBadge("Week", board.reviews.week));
    reviews.appendChild(ratioBadge("Weeks", board.reviews.weeks));
    reviews.appendChild(ratioBadge("Month", board.reviews.month));
    reviews.appendChild(ratioBadge("Quarter", board.reviews.quarter));
    reviews.setAttribute("data-review-weeks", board.reviews.weeks.done + "/" + board.reviews.weeks.expected);
    section.appendChild(reviews);
    return section;
  }

  function refreshJournalPlay() {
    var board, play, feel, strip;
    if (!cur || (cur.kind !== "day" && cur.kind !== "week" && cur.kind !== "month")) return;
    if (!els.form.querySelector(".journal-play")) return;
    board = JournalGamify.journalBoard(store, journalView());
    play = els.form.querySelector(".journal-play");
    if (play) play.replaceWith(mountJournalCard(board));
    feel = els.form.querySelector(".journal-feelings");
    if (feel) feel.replaceWith(mountFeelings(board));
    strip = els.form.querySelector(".mood-strip");
    if (strip) strip.replaceWith(mountStrip(cur.key, board));
  }

  function mountStrip(key, board) {
    var section = node("section", "card mood-strip");
    var strip = node("div", "strip");
    var today = JournalCore.dayKey(new Date());
    var moods = [];
    var energies = [];
    function avg(list) {
      var sum = list.reduce(function (a, b) { return a + b; }, 0);
      return list.length ? (sum / list.length).toFixed(1) : "–";
    }
    JournalCore.weekDays(key).forEach(function (dayKey) {
      var fields = fieldMap(store.entries[dayKey]);
      var link = node("a", dayKey === today ? "today" : "");
      var wd = new Date(Date.UTC(+dayKey.slice(0, 4), +dayKey.slice(5, 7) - 1, +dayKey.slice(8, 10))).getUTCDay();
      if (isScore(fields.mood)) moods.push(fields.mood);
      if (isScore(fields.energy)) energies.push(fields.energy);
      link.href = "#day/" + dayKey;
      link.appendChild(node("span", "", WEEKDAYS[wd]));
      link.appendChild(node("span", "emo", isScore(fields.mood) ? MOOD[fields.mood - 1] : "·"));
      link.appendChild(node("span", "", isScore(fields.energy) ? ENERGY[fields.energy - 1] : "·"));
      strip.appendChild(link);
    });
    section.appendChild(cardHead("\uD83D\uDCCA Mood & energy", "feelings"));
    section.appendChild(strip);
    section.appendChild(node("p", "avg", "Week average \u00b7 \uD83D\uDE0A " + avg(moods) + " mood \u00b7 \u26A1 " + avg(energies) + " energy"));
    if (board) {
      section.appendChild(badge("Logged feelings", board.feelings.badge, { "data-logged-feelings": board.feelings.badge ? "1" : "0" }));
      section.appendChild(sparkLegend());
      section.appendChild(feelingStat("7 days", board.feelings.week));
      section.appendChild(feelingStat("30 days", board.feelings.month));
      section.setAttribute("data-feelings", board.feelings.badge ? "1" : "0");
    }
    return section;
  }

  function mountReview(key, title) {
    var items = todoList(store.entries[JournalCore.shift(key, -1)]).filter(function (todo) {
      return String(todo.text || "").trim();
    });
    var section, ul;
    if (!items.length) return null;
    section = card(title);
    ul = node("ul", "review");
    items.forEach(function (todo) {
      ul.appendChild(node("li", todo.done ? "done" : "", (todo.done ? "✅ " : "⭕ ") + todo.text));
    });
    section.appendChild(ul);
    return section;
  }

  function paintTabs() {
    els.tabs.textContent = "";
    JournalSchemas.order.forEach(function (kind) {
      var tab = button(kind === cur.kind ? "tab active" : "tab", JournalSchemas[kind].icon + " " + JournalSchemas[kind].label);
      tab.addEventListener("click", function () {
        location.hash = "#" + kind + "/" + JournalCore.todayKey(kind, new Date());
      });
      els.tabs.appendChild(tab);
    });
    var habitsTab = button(cur.kind === "habits" ? "tab active" : "tab", "🔥 Habits");
    habitsTab.addEventListener("click", function () {
      location.hash = "#habits";
    });
    els.tabs.appendChild(habitsTab);
  }

  function renderHabits() {
    var now = new Date();
    var today = JournalCore.dayKey(now);
    var defs = JournalCore.habitDefsOf(store);
    var play = JournalGamify.play(store, defs, today);
    var onStreak = 0;
    var i;
    var ring;
    var status;
    document.body.dataset.kind = "habits";
    els.prev.hidden = true;
    els.next.hidden = true;
    els.today.hidden = true;
    els.icon.textContent = "🔥";
    els.period.textContent = "Habits";
    for (i = 0; i < defs.length; i++) {
      if (JournalCore.currentStreak(store, defs[i].id, today) > 0) onStreak += 1;
    }
    els.parent.textContent = JournalCore.label(today) + (onStreak ? " · " + onStreak + (onStreak === 1 ? " habit on a streak" : " habits on a streak") : "");
    els.completion.textContent = "";
    ring = node("div", "ring");
    ring.style.setProperty("--p", String(Math.round(Math.min(1, play.done / play.total) * 100)));
    els.completion.appendChild(ring);
    status = !play.logged ? "No log yet" : play.done + "/" + play.total + (play.win ? " · win day" : "");
    els.completion.appendChild(node("span", "", "🔥 " + status));
    els.form.textContent = "";
    JournalHabits.render(els.form, store, {
      now: now,
      today: today,
      selected: cur.key,
      onSelect: function (id) {
        location.hash = id ? "#habits/" + encodeURIComponent(id) : "#habits";
      }
    });
  }

  function render() {
    var route = readRoute();
    var schema, fields, quote, block, review, shown = 0;
    if (!route) return;
    cur = route;
    paintTabs();
    if (cur.kind === "habits") {
      renderHabits();
      return;
    }
    schema = JournalSchemas[cur.kind];
    fields = fieldMap(store.entries[cur.key]);
    document.body.dataset.kind = cur.kind;
    els.prev.hidden = false;
    els.next.hidden = false;
    els.icon.textContent = schema.icon;
    els.period.textContent = JournalCore.label(cur.key) || "";
    els.today.hidden = cur.key === JournalCore.todayKey(cur.kind, new Date());
    paintParent();
    paintCompletion();

    els.form.textContent = "";
    quote = cur.kind === "day" ? quoteText(cur.key) : "";
    if (quote) {
      block = card("💭 Quote of the day", "quote");
      block.appendChild(node("p", "", quote));
      els.form.appendChild(block);
    }
    var playBoard = null;
    if (cur.kind === "day" || cur.kind === "week" || cur.kind === "month") {
      playBoard = JournalGamify.journalBoard(store, journalView());
      els.form.appendChild(mountJournalCard(playBoard));
    }
    if (schema.moodStrip) els.form.appendChild(mountStrip(cur.key, playBoard));
    else if (playBoard) els.form.appendChild(mountFeelings(playBoard));

    schema.sections.forEach(function (section) {
      var box = card(section.title);
      var meters = node("div", "meters");
      var hasTodos = false;
      var count = 0;
      section.fields.forEach(function (field) {
        var value = fields[field.key];
        if (field.type === "todos") {
          mountTodos(box, field);
          hasTodos = true;
          return;
        }
        if (!isFilled(field, value)) return;
        count += 1;
        if (field.type === "scale") {
          meters.appendChild(meter(field, value));
          if (meters.parentNode !== box) box.insertBefore(meters, box.children[1] || null);
        } else {
          box.appendChild(fieldView(field, value));
        }
      });
      shown += count;
      if (count || hasTodos) els.form.appendChild(box);
    });

    if (schema.reviewPrevTodos) {
      review = mountReview(cur.key, schema.reviewPrevTodos);
      if (review) els.form.appendChild(review);
    }
    if (!shown && !quote) {
      block = node("section", "card empty");
      block.appendChild(node("span", "big", "🌱"));
      block.appendChild(node("span", "", "Nothing written for this " + schema.label.toLowerCase() + " yet."));
      var playCard = els.form.querySelector(".journal-play");
      if (playCard && playCard.nextSibling) els.form.insertBefore(block, playCard.nextSibling);
      else if (playCard) els.form.appendChild(block);
      else els.form.insertBefore(block, els.form.firstChild);
    }
    if (document.fonts) document.fonts.ready.then(fitAll);
  }

  function mergeIn(remote) {
    var key = cur.key;
    var habitView = cur.kind === "habits";
    var snap = function () {
      return JSON.stringify(habitView
        ? { d: store.habitDefs || null, e: store.entries }
        : { e: store.entries[key] || null, q: quoteText(key) });
    };
    var before = snap();
    var typing;
    store = JournalCore.mergeStores(store, remote);
    persist();
    if (snap() === before) return;
    typing = document.activeElement && document.activeElement.matches && document.activeElement.matches("textarea");
    if (!habitView && typing) {
      paintCompletion();
      paintParent();
      return;
    }
    render();
  }

  function hasToken() {
    try {
      var cfg = JSON.parse(localStorage.getItem("dong-gh-sync") || "null");
      return !!(cfg && cfg.token);
    } catch (e) {
      return false;
    }
  }

  function showConnect() {
    els.connect.hidden = hasToken();
  }

  function fail(err) {
    els.sync.textContent = "⚠️ " + (err && err.message ? err.message : String(err));
    showConnect();
  }

  function scheduleSave() {
    if (!hasToken()) {
      els.sync.textContent = "💾 Saved on this device";
      return;
    }
    els.sync.textContent = "✏️ Saving soon…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, SAVE_DELAY);
  }

  function pushNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (saving) {
      saveAgain = true;
      return;
    }
    saving = true;
    els.sync.textContent = "☁️ Saving…";
    GhSync.save("journal", function () { return store; }, mergeIn, { quiet: true }).then(function () {
      saving = false;
      retried = false;
      els.sync.textContent = "✅ Saved " + hhmm();
      if (saveAgain) {
        saveAgain = false;
        pushNow();
      }
    }, function (err) {
      saving = false;
      fail(err);
      if (!retried && /another device/.test(String(err && err.message))) {
        retried = true;
        saveTimer = setTimeout(pushNow, 3000);
      }
    });
  }

  function autoLoad() {
    showConnect();
    if (!hasToken()) {
      els.sync.textContent = "📴 Not synced";
      return;
    }
    if (loading || saving || saveTimer) return;
    loading = true;
    GhSync.load("journal", mergeIn).then(function () {
      loading = false;
      els.sync.textContent = "☁️ Synced " + hhmm();
    }, function (err) {
      loading = false;
      fail(err);
    });
  }

  function go(delta) {
    if (!cur.key) return;
    location.hash = "#" + cur.kind + "/" + JournalCore.shift(cur.key, delta);
  }

  els.prev.addEventListener("click", function () { go(-1); });
  els.next.addEventListener("click", function () { go(1); });
  els.today.addEventListener("click", function () {
    if (cur.kind) location.hash = "#" + cur.kind + "/" + JournalCore.todayKey(cur.kind, new Date());
  });
  els.connectBtn.addEventListener("click", function () {
    GhSync.load("journal", mergeIn).then(function () {
      showConnect();
      els.sync.textContent = "☁️ Synced " + hhmm();
    }, fail);
  });
  window.addEventListener("resize", fitAll);
  window.addEventListener("hashchange", function () {
    if (!readRoute()) location.replace("#day/" + JournalCore.todayKey("day", new Date()));
    else render();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && saveTimer) pushNow();
    if (document.visibilityState === "visible") autoLoad();
  });

  if (!readRoute()) location.replace("#day/" + JournalCore.todayKey("day", new Date()));
  else render();
  setInterval(autoLoad, 60000);
  autoLoad();
})();
