(function () {
  "use strict";

  var STORE_KEY = "journal-v1";
  var SAVE_DELAY = 2500;
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MOOD = ["😞", "😕", "😐", "🙂", "😄"];
  var ENERGY = ["🪫", "😴", "🔋", "💪", "⚡"];
  var ENJOY = { green: "Great", yellow: "Okay", red: "Rough" };
  var STATUS = [["none", "Not started"], ["progress", "In progress"], ["done", "Done"], ["paused", "Paused"]];

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
    btn.setAttribute("aria-label", cite.title + ". " + cite.text);
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-cite", citeKey);
    tip.hidden = true;
    tip.setAttribute("role", "tooltip");
    tip.appendChild(node("b", "", cite.title));
    tip.appendChild(node("span", "info-by", cite.by));
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
    refreshPractice();
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
    els.completion.appendChild(node("span", "", filled + " of " + total + " \u00b7 " + done + " of " + todos.length + " to-dos"));
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

  var FOLD_KEY = "journal-folds";

  function readFolds() {
    try {
      var data = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (e) {
      return {};
    }
  }

  function rememberFold(el, id) {
    el.setAttribute("data-fold", id);
    el.open = readFolds()[id] === true;
    el.addEventListener("toggle", function () {
      var data = readFolds();
      if (el.open) data[id] = true;
      else delete data[id];
      localStorage.setItem(FOLD_KEY, JSON.stringify(data));
      if (el.open) fitAll();
    });
  }

  function oneLine(parts) {
    var out = [];
    parts.forEach(function (part) {
      var text = String(part == null ? "" : part).replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    });
    return out.join(" \u00b7 ");
  }

  function clip(text, max) {
    var value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length <= max) return value;
    return value.slice(0, max - 1).trim() + "\u2026";
  }

  function card(line, extra, foldId) {
    var section = node("details", "card dx-card fold" + (extra ? " " + extra : ""));
    var summary = node("summary", "fold-summary");
    summary.appendChild(node("span", "fold-line", line));
    section.appendChild(summary);
    rememberFold(section, foldId || line);
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
    if (!area.offsetParent) return;
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
      actions.appendChild(button("carry", "Bring unfinished from yesterday")).addEventListener("click", function () {
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

  function moodLine(trends) {
    var week = trends && trends.feelings && trends.feelings.week;
    if (!week || !week.logged) return "Mood \u00b7 nothing logged";
    return oneLine([
      "Mood",
      week.moodAvg == null ? "" : avgText(week.moodAvg) + " mood",
      week.energyAvg == null ? "" : avgText(week.energyAvg) + " energy",
      week.logged + (week.logged === 1 ? " day" : " days")
    ]);
  }

  function mountFeelings(board) {
    var section = card(moodLine(board), "journal-feelings", cur.kind + ":mood");
    var why = node("div", "fold-why");
    section.setAttribute("data-feelings", board.feelings.badge ? "1" : "0");
    why.appendChild(infoButton("feelings"));
    section.appendChild(why);
    section.appendChild(badge("Feelings logged", board.feelings.badge, { "data-logged-feelings": board.feelings.badge ? "1" : "0" }));
    section.appendChild(sparkLegend());
    section.appendChild(feelingStat("7 days", board.feelings.week));
    section.appendChild(feelingStat("30 days", board.feelings.month));
    return section;
  }

  function moodValue(fields) {
    if (isScore(fields.mood)) return fields.mood;
    if (isScore(fields.moodMeter)) return fields.moodMeter;
    return null;
  }

  function mountStrip(key, trends) {
    var section = card(moodLine(trends), "mood-strip", "week:mood");
    var why = node("div", "fold-why");
    why.appendChild(infoButton("feelings"));
    section.appendChild(why);
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
      var mood = moodValue(fields);
      var link = node("a", dayKey === today ? "today" : "");
      var wd = new Date(Date.UTC(+dayKey.slice(0, 4), +dayKey.slice(5, 7) - 1, +dayKey.slice(8, 10))).getUTCDay();
      if (mood) moods.push(mood);
      if (isScore(fields.energy)) energies.push(fields.energy);
      link.href = "#day/" + dayKey;
      link.appendChild(node("span", "", WEEKDAYS[wd]));
      link.appendChild(node("span", "emo", mood ? MOOD[mood - 1] : "·"));
      link.appendChild(node("span", "", isScore(fields.energy) ? ENERGY[fields.energy - 1] : "·"));
      strip.appendChild(link);
    });
    section.appendChild(strip);
    section.appendChild(node("p", "avg", "This week \u00b7 " + avg(moods) + " mood \u00b7 " + avg(energies) + " energy"));
    if (trends) {
      section.appendChild(badge("Feelings logged", trends.feelings.badge, { "data-logged-feelings": trends.feelings.badge ? "1" : "0" }));
      section.appendChild(sparkLegend());
      section.appendChild(feelingStat("7 days", trends.feelings.week));
      section.appendChild(feelingStat("30 days", trends.feelings.month));
      section.setAttribute("data-feelings", trends.feelings.badge ? "1" : "0");
    }
    return section;
  }

  function mountReview(key, title) {
    var items = todoList(store.entries[JournalCore.shift(key, -1)]).filter(function (todo) {
      return String(todo.text || "").trim();
    });
    var section, ul;
    if (!items.length) return null;
    section = card(oneLine([title, items.length + (items.length === 1 ? " to-do" : " to-dos")]), "", cur.kind + ":last-todos");
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
      var tab = button("dx-tab", JournalSchemas[kind].icon + " " + JournalSchemas[kind].label);
      if (kind === cur.kind) tab.setAttribute("aria-current", "page");
      tab.addEventListener("click", function () {
        location.hash = "#" + kind + "/" + JournalCore.todayKey(kind, new Date());
      });
      els.tabs.appendChild(tab);
    });
    var habitsTab = button("dx-tab", "🔥 Habits");
    if (cur.kind === "habits") habitsTab.setAttribute("aria-current", "page");
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
    status = !play.logged ? "Nothing logged yet" : play.done + "/" + play.total + (play.win ? " \u00b7 win day" : "");
    els.completion.appendChild(node("span", "", status));
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

  var DAY_TEMPLATE = {
    mood: true,
    energy: true,
    focus: true,
    grateful: true,
    makeGreat: true,
    affirmation: true,
    highlights: true,
    better: true
  };

  function textLines(value, limit) {
    var raw = [];
    if (Array.isArray(value)) raw = value;
    else if (value && typeof value === "object" && Array.isArray(value.items)) raw = value.items;
    else if (value != null && String(value).trim()) raw = String(value).split(/\r?\n/);
    var out = [];
    raw.forEach(function (item) {
      var text = item && typeof item === "object" ? (item.text || item.title || item.label || item.name) : item;
      text = String(text == null ? "" : text).trim();
      if (text) out.push(text);
    });
    return limit ? out.slice(0, limit) : out;
  }

  function practiceHead(title, citeKey) {
    var row = node("div", "lbl-row");
    row.appendChild(node("span", "lbl", title));
    if (citeKey) row.appendChild(infoButton(citeKey));
    return row;
  }

  function practiceBlock(key, title, citeKey, body, emptyPrompt) {
    var wrap = node("div", "field");
    wrap.setAttribute("data-field", key);
    wrap.appendChild(practiceHead(title, citeKey));
    if (body) wrap.appendChild(body);
    else {
      wrap.setAttribute("data-empty", "1");
      wrap.appendChild(node("p", "prompt", emptyPrompt));
    }
    return wrap;
  }

  function textBody(value) {
    var text = String(value == null ? "" : value).trim();
    return text ? node("p", "val", text) : null;
  }

  function lineList(lines, className) {
    var list = node("ol", className || "priorities");
    lines.forEach(function (line) { list.appendChild(node("li", "", line)); });
    return list;
  }

  function gratefulBody(value) {
    var lines = trioLines(value);
    if (!lines.length) return null;
    var list = node("ul", "trio");
    lines.forEach(function (line) { list.appendChild(node("li", "", line)); });
    return list;
  }

  function feelingMeter(value) {
    var text = String(value == null ? "" : value).trim();
    var box = node("div", "meter feeling-meter");
    var copy = node("div");
    box.setAttribute("data-field", "feeling");
    if (!text) box.setAttribute("data-empty", "1");
    copy.appendChild(practiceHead("Feeling", "feelings"));
    copy.appendChild(text ? node("b", "", text) : node("p", "prompt", "Name the feeling."));
    box.appendChild(copy);
    return box;
  }

  function priorityLines(fields, todos) {
    var lines = textLines(fields.priorities, 3);
    var source = lines.length ? "priorities" : "";
    var note = "";
    if (!lines.length) {
      lines = textLines(fields.top3, 3);
      if (lines.length) {
        source = "top3";
        note = "From this morning.";
      }
    }
    if (!lines.length) {
      var mits = [];
      var rest = [];
      todos.forEach(function (todo) {
        var text = String(todo && todo.text || "").trim();
        if (!text) return;
        if (todo.mit === true) mits.push(text);
        else rest.push(text);
      });
      if (mits.length) {
        lines = mits.slice(0, 3);
        source = "mit";
        note = "From the important to-dos.";
      } else if (rest.length) {
        lines = rest.slice(0, 3);
        source = "todos";
        note = "From today's to-dos.";
      }
    }
    return { lines: lines, source: source, note: note };
  }

  function prioritiesField(fields, todos) {
    var picked = priorityLines(fields, todos);
    var lines = picked.lines;
    var source = picked.source;
    var note = picked.note;
    var body = null;
    if (lines.length) {
      body = node("div");
      body.appendChild(lineList(lines, "priorities"));
      if (note) body.appendChild(node("p", "prompt", note));
    }
    var wrap = practiceBlock("priorities", "Priorities", "", body, "Up to 3 things that matter.");
    wrap.setAttribute("data-priorities-source", source || "none");
    return wrap;
  }

  function morningLine(fields, todos) {
    var focus = String(fields.focus || "").trim();
    var n = priorityLines(fields, todos).lines.length;
    if (!focus && !n) return "Morning \u00b7 nothing yet";
    return oneLine(["Morning", focus ? "focus: " + clip(focus, 28) : "", n ? n + (n === 1 ? " priority" : " priorities") : ""]);
  }

  function mountMorning(fields, todos) {
    var section = card(morningLine(fields, todos), "practice", "day:morning");
    var meters = node("div", "meters");
    var moodScore = moodValue(fields);
    if (moodScore) meters.appendChild(meter({ key: "mood", label: "Mood" }, moodScore));
    if (isScore(fields.energy)) meters.appendChild(meter({ key: "energy", label: "Energy" }, fields.energy));
    meters.appendChild(feelingMeter(fields.feeling));
    section.appendChild(meters);
    section.appendChild(practiceBlock("focus", "Focus", "", textBody(fields.focus, "val intention"), "One word for today."));
    section.appendChild(prioritiesField(fields, todos));
    section.appendChild(practiceBlock("failureCost", "If I skip #1", "failure", textBody(fields.failureCost), "If I skip #1, what happens?"));
    section.appendChild(practiceBlock("ifThen", "If this happens", "obstacle", textBody(fields.ifThen), "What could stop me? If it happens, I will\u2026"));
    section.appendChild(practiceBlock("grateful", "Grateful", "gratitude", gratefulBody(fields.grateful), "What am I glad about?"));
    if (isFilled({ type: "area" }, fields.makeGreat)) section.appendChild(fieldView({ type: "area", label: "What would make today great" }, fields.makeGreat));
    if (isFilled({ type: "text" }, fields.affirmation)) section.appendChild(fieldView({ type: "text", label: "A line to repeat" }, fields.affirmation));
    return section;
  }

  function eveningLine(fields) {
    var mood = moodValue(fields);
    var energy = isScore(fields.energy) ? fields.energy : null;
    var wins = textLines(fields.wins).length;
    var moodBit = (mood || energy) ? "mood " + (mood || "\u2013") + " / energy " + (energy || "\u2013") : "";
    var winBit = wins ? wins + (wins === 1 ? " win" : " wins") : "";
    if (!moodBit && !winBit) return "Evening \u00b7 nothing yet";
    return oneLine(["Evening", moodBit, winBit]);
  }

  function mountEvening(fields) {
    var section = card(eveningLine(fields), "practice", "day:evening");
    var wins = textLines(fields.wins);
    var tomorrow = textLines(fields.tomorrow, 3);
    section.appendChild(practiceBlock("wins", "Wins", "effort", wins.length ? lineList(wins, "wins") : null, "Name the effort, not only the result."));
    section.appendChild(practiceBlock("lesson", "Lesson", "", textBody(fields.lesson), "What did I learn?"));
    section.appendChild(practiceBlock("chosenVsMomentum", "Choice or autopilot", "reviews", textBody(fields.chosenVsMomentum), "Did I choose this, or was it autopilot?"));
    section.appendChild(practiceBlock("tomorrow", "Tomorrow", "", tomorrow.length ? lineList(tomorrow, "priorities") : null, "Top 3 for tomorrow."));
    if (String(fields.highlights || "").trim()) section.appendChild(fieldView({ type: "area", label: "Highlights" }, fields.highlights));
    if (String(fields.better || "").trim()) section.appendChild(fieldView({ type: "area", label: "What I would change" }, fields.better));
    return section;
  }

  function mountDayPractice(fields, todos) {
    var wrap = node("div", "practice-day");
    wrap.setAttribute("data-practice", "day");
    wrap.appendChild(mountMorning(fields, todos));
    wrap.appendChild(mountEvening(fields));
    return wrap;
  }

  function goalCard(id, label, raw) {
    var card = node("article", "goal-card");
    var goal = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
    var progress = goal ? String(goal.progress || "").trim() : (typeof raw === "string" ? String(raw).trim() : "");
    var next = goal ? String(goal.next || "").trim() : "";
    var score = goal && isScore(goal.score) ? goal.score : null;
    var bar, fill;
    card.setAttribute("data-goal", id);
    card.appendChild(node("h4", "", label));
    if (score) {
      card.appendChild(node("b", "", score + "/5"));
      bar = node("span", "bar");
      fill = node("i");
      fill.style.setProperty("--v", score * 20 + "%");
      bar.appendChild(fill);
      card.appendChild(bar);
    } else card.appendChild(node("p", "prompt", "Score from 1 to 5."));
    card.appendChild(progress ? node("p", "val", progress) : node("p", "prompt", "How it's going."));
    card.appendChild(next ? node("p", "val", "Next: " + next) : node("p", "prompt", "Next step"));
    return card;
  }

  function periodDayKeys(kind, key) {
    var today = JournalCore.dayKey(new Date());
    var start;
    var end;
    if (kind === "week") {
      var days = JournalCore.weekDays(key);
      start = days[0];
      end = days[6];
    } else {
      start = key + "-01";
      end = JournalCore.shift(JournalCore.shift(key, 1) + "-01", -1);
    }
    if (today < end) end = today;
    var out = [];
    var day = start;
    if (!start || !end || end < start) return out;
    while (day <= end) {
      out.push(day);
      day = JournalCore.shift(day, 1);
    }
    return out;
  }

  function mountHabitSummary(kind, key) {
    var defs = JournalCore.habitDefsOf(store);
    var stats = JournalCore.habitStats(store, defs, periodDayKeys(kind, key));
    var link = node("a", "habit-jump");
    var pct = stats.overall == null ? "nothing logged yet" : Math.round(stats.overall * 100) + "% done";
    link.href = "#habits";
    link.appendChild(node("span", "", "Habits \u00b7 " + stats.logged + (stats.logged === 1 ? " day logged" : " days logged") + " \u00b7 " + pct));
    link.appendChild(node("span", "habit-open-label", "See them"));
    return link;
  }

  function mountCycle(anchor) {
    var cycle = JournalGamify.cycle(store, JournalCore.habitDefsOf(store), anchor);
    var wrap = node("div", "field");
    var wins = cycle.wins === 1 ? "1 win" : cycle.wins + " wins";
    var label = cycle.phase === "test"
      ? "Test week \u00b7 day " + cycle.testDay + " of 7 \u00b7 " + wins + " in the first 21 days"
      : "Day " + cycle.day + " of 21 \u00b7 " + wins + " so far";
    wrap.setAttribute("data-field", "cycle");
    wrap.setAttribute("data-cycle-phase", cycle.phase);
    wrap.setAttribute("data-cycle-day", String(cycle.day));
    wrap.appendChild(practiceHead("21 days", "habitCycle"));
    wrap.appendChild(node("p", "val", label));
    return wrap;
  }

  function goalsLine(fields) {
    var goals = fields.goals && typeof fields.goals === "object" ? fields.goals : {};
    var names = ["thesis", "career", "health"];
    var i;
    for (i = 0; i < names.length; i++) {
      var goal = goals[names[i]];
      if (goal && isScore(goal.score)) return "Goals \u00b7 " + names[i] + " " + goal.score + "/5";
    }
    return "Goals \u00b7 no score yet";
  }

  function mountPeriodPractice(fields, board) {
    var section = card(goalsLine(fields), "practice", cur.kind + ":goals");
    var goals = fields.goals && typeof fields.goals === "object" ? fields.goals : {};
    var grid = node("div", "goal-grid");
    section.setAttribute("data-practice", cur.kind);
    grid.appendChild(goalCard("thesis", "Thesis", goals.thesis));
    grid.appendChild(goalCard("career", "Career", goals.career));
    grid.appendChild(goalCard("health", "Health", goals.health));
    section.appendChild(grid);
    section.appendChild(practiceBlock("difficulty", "How hard", "moderate", textBody(fields.difficulty), "Too easy, too hard, or about right?"));
    section.appendChild(practiceBlock("audit", "Choices", "reviews", textBody(fields.audit), "What did I choose, and what was autopilot?"));
    section.appendChild(mountHabitSummary(cur.kind, cur.key));
    if (cur.kind === "month" && board) section.appendChild(mountCycle(board.anchor));
    return section;
  }

  function appendReflection(id, text, date) {
    var trimmed = String(text || "").trim();
    var raw;
    var list;
    var last;
    if (!trimmed || !id) return false;
    raw = store.reflections;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      store.reflections = { questions: JournalCore.reflectionQuestions(), answers: {} };
      raw = store.reflections;
    }
    if (!Array.isArray(raw.questions) || !raw.questions.length) raw.questions = JournalCore.reflectionQuestions();
    if (!raw.answers || typeof raw.answers !== "object" || Array.isArray(raw.answers)) raw.answers = {};
    list = raw.answers[id];
    if (!Array.isArray(list)) list = [];
    last = list.length ? list[list.length - 1] : null;
    if (last && last.date === date && String(last.text || "") === trimmed) return false;
    list.push({ date: date, text: trimmed });
    raw.answers[id] = list;
    persist();
    scheduleSave();
    return true;
  }

  function reflectionAnswers(id) {
    var data = JournalCore.reflectionsOf(store);
    var list = data.answers && data.answers[id];
    return Array.isArray(list) ? list.slice().reverse() : [];
  }

  function reflectionHistory(id) {
    var list = reflectionAnswers(id);
    var ul;
    if (!list.length) return node("p", "reflect-note", "No answer yet.");
    ul = node("ul", "reflect-answers");
    list.forEach(function (item) {
      var li = node("li");
      li.setAttribute("data-answer-date", item.date);
      li.appendChild(node("span", "reflect-when", JournalCore.label(item.date) || item.date));
      li.appendChild(node("p", "val", item.text));
      ul.appendChild(li);
    });
    return ul;
  }

  function reflectionLine(dayKey) {
    var data = JournalCore.reflectionsOf(store);
    var index = JournalCore.reflectionIndex(dayKey, data.questions.length);
    var answered = 0;
    data.questions.forEach(function (item) {
      if (data.answers[item.id] && data.answers[item.id].length) answered += 1;
    });
    return "Reflection \u00b7 today: Q" + (index + 1) + " \u00b7 " + answered + " answered";
  }

  function mountReflections(dayKey) {
    var data = JournalCore.reflectionsOf(store);
    var questions = data.questions;
    var index = JournalCore.reflectionIndex(dayKey, questions.length);
    var question = questions[index];
    var section = card(reflectionLine(dayKey), "reflections", "day:reflection");
    var box = node("textarea", "reflect-box");
    var save = button("dx-btn", "Save");
    var note = node("p", "reflect-note", "");
    var actions = node("div", "reflect-actions");
    var all = node("details", "fold reflect-all");
    var allSummary = node("summary", "fold-summary");
    section.setAttribute("data-reflections", "1");
    section.setAttribute("data-question-id", question.id);
    section.setAttribute("data-reflection-index", String(index));
    section.appendChild(node("p", "reflect-kicker", "Question " + (index + 1) + " of " + questions.length));
    section.appendChild(node("p", "reflect-question", question.text));
    box.rows = 4;
    box.setAttribute("aria-label", "Your answer");
    box.setAttribute("placeholder", "Write your answer.");
    save.setAttribute("data-save-reflection", question.id);
    actions.appendChild(save);
    actions.appendChild(note);
    section.appendChild(box);
    section.appendChild(actions);
    section.appendChild(reflectionHistory(question.id));
    allSummary.appendChild(node("span", "fold-line", "All questions"));
    all.appendChild(allSummary);
    rememberFold(all, "day:reflection-all");
    questions.forEach(function (item, itemIndex) {
      var block = node("article", "reflect-item");
      var itemBox;
      var itemSave;
      var itemNote;
      var itemActions;
      block.setAttribute("data-question-id", item.id);
      block.appendChild(node("h4", "", (itemIndex + 1) + ". " + item.text));
      block.appendChild(reflectionHistory(item.id));
      if (item.id !== question.id) {
        itemBox = node("textarea", "reflect-box");
        itemBox.rows = 3;
        itemBox.setAttribute("aria-label", "Answer");
        itemSave = button("dx-btn dx-btn--ghost", "Save");
        itemSave.setAttribute("data-save-reflection", item.id);
        itemNote = node("p", "reflect-note", "");
        itemActions = node("div", "reflect-actions");
        itemActions.appendChild(itemSave);
        itemActions.appendChild(itemNote);
        itemSave.addEventListener("click", function () {
          if (!appendReflection(item.id, itemBox.value, dayKey)) {
            if (!String(itemBox.value || "").trim()) itemNote.textContent = "Write something first.";
            return;
          }
          replaceReflections(section, dayKey, true);
        });
        block.appendChild(itemBox);
        block.appendChild(itemActions);
      }
      all.appendChild(block);
    });
    section.appendChild(all);
    save.addEventListener("click", function () {
      var allOpen = all.open;
      if (!appendReflection(question.id, box.value, dayKey)) {
        if (!String(box.value || "").trim()) note.textContent = "Write something first.";
        return;
      }
      replaceReflections(section, dayKey, allOpen);
    });
    return section;
  }

  function replaceReflections(section, dayKey, allOpen) {
    var next = mountReflections(dayKey);
    var nextAll = next.querySelector(".reflect-all");
    if (allOpen && nextAll) nextAll.open = true;
    section.replaceWith(next);
  }

  function fieldSnippet(field, value) {
    var lines;
    if (field.type === "scale") return field.label + " " + value;
    if (field.type === "enjoy") return ENJOY[value] || "";
    if (field.type === "trio") {
      lines = trioLines(value);
      return lines.length + (lines.length === 1 ? " thing" : " things");
    }
    return clip(String(value == null ? "" : value).split(/\r?\n/)[0], 36);
  }

  function emptyField(field) {
    var wrap = node("div", "field");
    wrap.setAttribute("data-field", field.key);
    wrap.setAttribute("data-empty", "1");
    wrap.appendChild(node("span", "lbl", field.label));
    wrap.appendChild(node("p", "prompt", "Nothing here yet."));
    return wrap;
  }

  function refreshPractice() {
    var old;
    var fields;
    if (!cur) return;
    fields = fieldMap(store.entries[cur.key]);
    if (cur.kind === "day") {
      old = els.form.querySelector(".practice-day");
      if (old) old.replaceWith(mountDayPractice(fields, todoList(store.entries[cur.key])));
    }
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
      block = card(oneLine(["Quote", clip(quote, 48)]), "quote", "day:quote");
      block.appendChild(node("p", "", quote));
      els.form.appendChild(block);
    }
    var trends = null;
    if (cur.kind === "day" || cur.kind === "week" || cur.kind === "month") {
      trends = JournalGamify.moodTrends(store, journalView());
    }
    if (schema.moodStrip) els.form.appendChild(mountStrip(cur.key, trends));
    else if (trends) els.form.appendChild(mountFeelings(trends));
    if (cur.kind === "day") {
      els.form.appendChild(mountDayPractice(fields, todoList(store.entries[cur.key])));
      els.form.appendChild(mountReflections(cur.key));
    } else if (cur.kind === "week" || cur.kind === "month") els.form.appendChild(mountPeriodPractice(fields, trends));

    schema.sections.forEach(function (section) {
      var box = card(section.title, "", cur.kind + ":" + (section.id || section.title));
      var meters = node("div", "meters");
      var hasTodos = false;
      var count = 0;
      var snippet = "";
      var todoItems = [];
      section.fields.forEach(function (field) {
        var value = fields[field.key];
        if (field.type === "todos") {
          mountTodos(box, field);
          hasTodos = true;
          todoItems = todoList(store.entries[cur.key]).filter(function (todo) {
            return String(todo.text || "").trim();
          });
          return;
        }
        if (cur.kind === "day" && DAY_TEMPLATE[field.key]) return;
        if (!isFilled(field, value)) {
          count += 1;
          box.appendChild(emptyField(field));
          return;
        }
        count += 1;
        if (!snippet) snippet = fieldSnippet(field, value);
        if (field.type === "scale") {
          meters.appendChild(meter(field, value));
          if (meters.parentNode !== box) box.insertBefore(meters, box.children[1] || null);
        } else {
          box.appendChild(fieldView(field, value));
        }
      });
      if (hasTodos) {
        var left = todoItems.filter(function (todo) { return !todo.done; }).length;
        box.querySelector(".fold-line").textContent = todoItems.length
          ? oneLine([section.title, left + " left"])
          : oneLine([section.title, "none yet"]);
      } else if (snippet) {
        box.querySelector(".fold-line").textContent = oneLine([section.title, snippet]);
      } else {
        box.querySelector(".fold-line").textContent = oneLine([section.title, "nothing yet"]);
      }
      shown += count;
      if (count || hasTodos) els.form.appendChild(box);
    });

    if (schema.reviewPrevTodos) {
      review = mountReview(cur.key, schema.reviewPrevTodos);
      if (review) els.form.appendChild(review);
    }
    if (!shown && !quote && cur.kind !== "day" && cur.kind !== "week" && cur.kind !== "month") {
      block = card(schema.label + " \u00b7 nothing written yet", "empty", cur.kind + ":empty");
      block.appendChild(node("p", "prompt", "Nothing written for this " + schema.label.toLowerCase() + " yet."));
      els.form.insertBefore(block, els.form.firstChild);
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
