(function () {
  "use strict";

  var STORE_KEY = "journal-v1";
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var ENJOY = [["green", "Green"], ["yellow", "Yellow"], ["red", "Red"]];
  var STATUS = [["none", "Not started"], ["progress", "In progress"], ["done", "Done"], ["paused", "Paused"]];

  var els = {
    tabs: document.getElementById("tabs"),
    prev: document.getElementById("prev"),
    next: document.getElementById("next"),
    today: document.getElementById("today"),
    period: document.getElementById("period-label"),
    parent: document.getElementById("parent-line"),
    completion: document.getElementById("completion"),
    form: document.getElementById("form"),
    sync: document.getElementById("sync-label"),
    save: document.getElementById("btn-save"),
    load: document.getElementById("btn-load")
  };

  var store = readStore();
  var cur = { kind: "", key: "" };
  var loading = false;

  function readStore() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (data && data.version === 1 && data.entries && typeof data.entries === "object") return data;
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

  function touch() {
    ensure().updatedAt = new Date().toISOString();
    persist();
    paintParent();
    paintCompletion();
  }

  function isScore(n) {
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
  }

  function isFilled(field, value) {
    var i, list;
    if (field.type === "scale") return isScore(value);
    if (field.type === "enjoy") return value === "green" || value === "yellow" || value === "red";
    if (field.type === "text" || field.type === "area") return String(value == null ? "" : value).trim() !== "";
    if (field.type === "trio") {
      list = Array.isArray(value) ? value : [];
      for (i = 0; i < list.length; i++) {
        if (String(list[i] == null ? "" : list[i]).trim() !== "") return true;
      }
    }
    return false;
  }

  function fieldMap(entry) {
    return entry && entry.fields && typeof entry.fields === "object" ? entry.fields : {};
  }

  function todoList(entry) {
    return entry && Array.isArray(entry.todos) ? entry.todos : [];
  }

  function paintCompletion() {
    var schema = JournalSchemas[cur.kind];
    var entry = store.entries[cur.key];
    var fields = fieldMap(entry);
    var todos = todoList(entry);
    var total = 0;
    var filled = 0;
    var done = 0;
    var s, f, i, field, pct, text, ring;
    for (s = 0; s < schema.sections.length; s++) {
      for (f = 0; f < schema.sections[s].fields.length; f++) {
        field = schema.sections[s].fields[f];
        if (field.type === "todos") continue;
        total += 1;
        if (isFilled(field, fields[field.key])) filled += 1;
      }
    }
    for (i = 0; i < todos.length; i++) if (todos[i].done) done += 1;
    pct = total ? Math.round((filled * 100) / total) : 0;
    text = filled + "/" + total + " \u00b7 " + (todos.length ? done + "/" + todos.length + " to-dos" : "0 to-dos");
    els.completion.textContent = "";
    ring = node("div", "ring");
    ring.style.setProperty("--p", String(pct));
    els.completion.appendChild(ring);
    els.completion.appendChild(node("span", "", text));
  }

  function paintParent() {
    var spec = JournalSchemas[cur.kind].parent;
    var pk, raw, line;
    els.parent.textContent = "";
    if (!spec) return;
    pk = JournalCore.parentKey(cur.key);
    if (!pk) return;
    raw = fieldMap(store.entries[pk])[spec.field];
    line = String(raw == null ? "" : raw).split(/\r?\n/)[0].trim();
    if (!line) return;
    els.parent.textContent = spec.prefix + ": " + line;
  }

  function shortWd(dayKey) {
    return WEEKDAYS[new Date(Date.UTC(+dayKey.slice(0, 4), +dayKey.slice(5, 7) - 1, +dayKey.slice(8, 10))).getUTCDay()];
  }

  function scoreText(n) {
    return isScore(n) ? String(n) : "\u2014";
  }

  function card(title, extra) {
    var section = node("section", extra ? "card " + extra : "card");
    section.appendChild(node("h3", "", title));
    return section;
  }

  function markOn(buttons, active) {
    var i;
    for (i = 0; i < buttons.length; i++) buttons[i].classList.toggle("on", buttons[i] === active);
  }

  function fieldView(field, fields) {
    var wrap = node("label", "field");
    var value = fields[field.key];
    var group, choices, inputs;
    wrap.appendChild(node("span", "lbl", field.label || ""));
    if (field.type === "scale" || field.type === "enjoy") {
      group = node("div", field.type === "scale" ? "scale" : "enjoy");
      choices = field.type === "scale" ? [1, 2, 3, 4, 5] : ENJOY;
      choices.forEach(function (choice) {
        var stored = field.type === "scale" ? choice : choice[0];
        var className = field.type === "scale" ? "opt" : "opt " + choice[0];
        var el;
        if (value === stored) className += " on";
        el = button(className, field.type === "scale" ? String(choice) : choice[1]);
        el.addEventListener("click", function () {
          ensure().fields[field.key] = stored;
          markOn(group.querySelectorAll("button"), el);
          touch();
        });
        group.appendChild(el);
      });
      wrap.appendChild(group);
      return wrap;
    }
    if (field.type === "trio") {
      inputs = [0, 1, 2].map(function (i) {
        var list = Array.isArray(value) ? value : [];
        var input = node("input");
        input.type = "text";
        input.value = list[i] == null ? "" : String(list[i]);
        return input;
      });
      inputs.forEach(function (input) {
        input.addEventListener("input", function () {
          ensure().fields[field.key] = inputs.map(function (item) { return item.value; });
          touch();
        });
        wrap.appendChild(input);
      });
      return wrap;
    }
    group = node(field.type === "area" ? "textarea" : "input");
    if (field.type !== "area") group.type = "text";
    group.value = value == null ? "" : String(value);
    group.addEventListener("input", function () {
      ensure().fields[field.key] = group.value;
      touch();
    });
    wrap.appendChild(group);
    return wrap;
  }

  function todoBlock(todo, withStatus) {
    var block = node("div");
    var row = node("div", "todo");
    var check = node("input");
    var text = node("input");
    var status = null;
    check.type = "checkbox";
    check.checked = !!todo.done;
    text.type = "text";
    text.value = todo.text || "";
    check.addEventListener("change", function () {
      todo.done = check.checked;
      touch();
    });
    text.addEventListener("input", function () {
      todo.text = text.value;
      touch();
    });
    row.appendChild(check);
    row.appendChild(text);
    row.appendChild(button("", "Delete"));
    row.lastChild.addEventListener("click", function () {
      var entry = ensure();
      entry.todos = entry.todos.filter(function (item) { return item !== todo; });
      block.remove();
      touch();
    });
    block.appendChild(row);
    if (withStatus) {
      status = node("div", "status");
      STATUS.forEach(function (pair) {
        var el = button(todo.status === pair[0] ? "on" : "", pair[1]);
        el.addEventListener("click", function () {
          todo.status = pair[0];
          todo.done = pair[0] === "done";
          check.checked = todo.done;
          markOn(status.querySelectorAll("button"), el);
          touch();
        });
        status.appendChild(el);
      });
      block.appendChild(status);
    }
    return block;
  }

  function mountTodos(section, field) {
    var list = node("div");
    var items = todoList(store.entries[cur.key]);
    items.forEach(function (todo) { list.appendChild(todoBlock(todo, !!field.status)); });
    section.appendChild(list);
    if (field.carry) {
      section.appendChild(button("carry", "Bring unfinished from yesterday")).addEventListener("click", function () {
        var prev = store.entries[JournalCore.shift(cur.key, -1)];
        var src = todoList(prev);
        var have = {};
        var added = [];
        todoList(store.entries[cur.key]).forEach(function (todo) {
          var text = String(todo.text || "").trim();
          if (text) have[text] = true;
        });
        src.forEach(function (todo) {
          var text = String(todo.text || "").trim();
          if (todo.done || !text || have[text]) return;
          have[text] = true;
          added.push({ id: uid(), text: text, done: false });
        });
        if (!added.length) return;
        added.forEach(function (todo) {
          ensure().todos.push(todo);
          list.appendChild(todoBlock(todo, false));
        });
        touch();
      });
    }
    section.appendChild(button("add", "Add to-do")).addEventListener("click", function () {
      var todo = { id: uid(), text: "", done: false };
      ensure().todos.push(todo);
      list.appendChild(todoBlock(todo, !!field.status));
      touch();
    });
  }

  function mountStrip(key) {
    var section = card("Mood & energy", "strip");
    var days = JournalCore.weekDays(key);
    var moods = [];
    var energies = [];
    function avg(list) {
      var sum = 0;
      var i;
      for (i = 0; i < list.length; i++) sum += list[i];
      return list.length ? (sum / list.length).toFixed(1) : "\u2014";
    }
    days.forEach(function (dayKey) {
      var fields = fieldMap(store.entries[dayKey]);
      var link = node("a");
      if (isScore(fields.mood)) moods.push(fields.mood);
      if (isScore(fields.energy)) energies.push(fields.energy);
      link.href = "#day/" + dayKey;
      link.textContent = shortWd(dayKey) + " \u00b7 " + scoreText(fields.mood) + " \u00b7 " + scoreText(fields.energy);
      section.appendChild(link);
    });
    section.appendChild(node("p", "", "Week avg " + avg(moods) + " mood · " + avg(energies) + " energy"));
    return section;
  }

  function mountReview(key) {
    var section = card("Last period", "review");
    var items = todoList(store.entries[JournalCore.shift(key, -1)]);
    var ul;
    if (!items.length) {
      section.appendChild(node("p", "", "No to-dos last period."));
      return section;
    }
    ul = node("ul", "review");
    items.forEach(function (todo) {
      var state = todo.done ? "done" : "open";
      ul.appendChild(node("li", "", todo.text ? todo.text + " " + state : state));
    });
    section.appendChild(ul);
    return section;
  }

  function render() {
    var route = readRoute();
    var schema, entry, fields;
    if (!route) return;
    cur = route;
    schema = JournalSchemas[cur.kind];
    entry = store.entries[cur.key];
    fields = fieldMap(entry);
    els.tabs.textContent = "";
    JournalSchemas.order.forEach(function (kind) {
      var tab = button(kind === cur.kind ? "tab active" : "tab", JournalSchemas[kind].label);
      tab.addEventListener("click", function () {
        location.hash = "#" + kind + "/" + JournalCore.todayKey(kind, new Date());
      });
      els.tabs.appendChild(tab);
    });
    els.period.textContent = JournalCore.label(cur.key) || "";
    paintParent();
    paintCompletion();
    els.form.textContent = "";
    if (schema.moodStrip) els.form.appendChild(mountStrip(cur.key));
    schema.sections.forEach(function (section) {
      var box = card(section.title);
      section.fields.forEach(function (field) {
        if (field.type === "todos") mountTodos(box, field);
        else box.appendChild(fieldView(field, fields));
      });
      els.form.appendChild(box);
    });
    if (schema.reviewPrevTodos) els.form.appendChild(mountReview(cur.key));
  }

  function stamp() {
    var now = new Date();
    els.sync.textContent = "Synced " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  }

  function mergeIn(remote) {
    var key = cur.key;
    var before = key ? JSON.stringify(store.entries[key] || null) : "";
    var after;
    store = JournalCore.mergeStores(store, remote);
    persist();
    if (key && store.entries) {
      after = JSON.stringify(store.entries[key] || null);
      if (before !== after) render();
      else {
        paintCompletion();
        paintParent();
      }
    }
    stamp();
  }

  function hasToken() {
    try {
      var cfg = JSON.parse(localStorage.getItem("dong-gh-sync") || "null");
      return !!(cfg && cfg.token);
    } catch (e) {
      return false;
    }
  }

  function fail(err) {
    els.sync.textContent = err && err.message ? err.message : String(err);
  }

  function autoLoad() {
    if (!hasToken()) {
      els.sync.textContent = "Not synced";
      return;
    }
    if (loading) return;
    loading = true;
    GhSync.load("journal", mergeIn).then(function (msg) {
      loading = false;
      if (msg && els.sync.textContent.indexOf("Synced") !== 0) els.sync.textContent = msg;
    }, function (err) {
      loading = false;
      fail(err);
    });
  }

  els.prev.addEventListener("click", function () {
    if (!cur.key) return;
    location.hash = "#" + cur.kind + "/" + JournalCore.shift(cur.key, -1);
  });
  els.next.addEventListener("click", function () {
    if (!cur.key) return;
    location.hash = "#" + cur.kind + "/" + JournalCore.shift(cur.key, 1);
  });
  els.today.addEventListener("click", function () {
    if (!cur.kind) return;
    location.hash = "#" + cur.kind + "/" + JournalCore.todayKey(cur.kind, new Date());
  });
  els.save.addEventListener("click", function () {
    GhSync.save("journal", function () { return store; }, mergeIn).catch(fail);
  });
  els.load.addEventListener("click", function () {
    GhSync.load("journal", mergeIn).catch(fail);
  });
  window.addEventListener("hashchange", function () {
    if (!readRoute()) {
      location.replace("#day/" + JournalCore.todayKey("day", new Date()));
      return;
    }
    render();
  });

  if (!readRoute()) location.replace("#day/" + JournalCore.todayKey("day", new Date()));
  else render();

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") autoLoad();
  });
  setInterval(autoLoad, 60000);
  autoLoad();
})();
