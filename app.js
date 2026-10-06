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

  function hhmm() {
    var now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  }

  function readRoute() {
    var hash = location.hash.replace(/^#/, "");
    var cut = hash.indexOf("/");
    var key;
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

  function mountStrip(key) {
    var section = card("📊 Mood & energy");
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
    section.appendChild(strip);
    section.appendChild(node("p", "avg", "Week average · 😊 " + avg(moods) + " mood · ⚡ " + avg(energies) + " energy"));
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

  function render() {
    var route = readRoute();
    var schema, fields, quote, block, review, shown = 0;
    if (!route) return;
    cur = route;
    schema = JournalSchemas[cur.kind];
    fields = fieldMap(store.entries[cur.key]);
    document.body.dataset.kind = cur.kind;

    els.tabs.textContent = "";
    JournalSchemas.order.forEach(function (kind) {
      var tab = button(kind === cur.kind ? "tab active" : "tab", JournalSchemas[kind].icon + " " + JournalSchemas[kind].label);
      tab.addEventListener("click", function () {
        location.hash = "#" + kind + "/" + JournalCore.todayKey(kind, new Date());
      });
      els.tabs.appendChild(tab);
    });
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
    if (schema.moodStrip) els.form.appendChild(mountStrip(cur.key));

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
      els.form.insertBefore(block, els.form.firstChild);
    }
    if (document.fonts) document.fonts.ready.then(fitAll);
  }

  function mergeIn(remote) {
    var key = cur.key;
    var snap = function () { return JSON.stringify({ e: store.entries[key] || null, q: quoteText(key) }); };
    var before = snap();
    store = JournalCore.mergeStores(store, remote);
    persist();
    if (key) {
      if (snap() !== before && !document.activeElement.matches("textarea")) render();
      else {
        paintCompletion();
        paintParent();
      }
    }
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
