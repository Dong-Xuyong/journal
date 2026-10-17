(function () {
  "use strict";

  // Day screen. Morning and evening fields stay read-only.
  // Writes go through JournalOps (to-dos only). Folds come from JournalUI.
  var MOOD = ["\uD83D\uDE1E", "\uD83D\uDE15", "\uD83D\uDE10", "\uD83D\uDE42", "\uD83D\uDE04"];
  var ENERGY = ["\uD83E\uDEAB", "\uD83D\uDE34", "\uD83D\uDD0B", "\uD83D\uDCAA", "\u26A1"];
  var APPS = [
    ["Health", "https://dong-xuyong.github.io/health/"],
    ["Study", "https://dong-xuyong.github.io/wiki-flashcards/"],
    ["Thesis", "https://dong-xuyong.github.io/thesis/"]
  ];
  var STUDY = "https://dong-xuyong.github.io/wiki-flashcards/";

  var watch = { fn: null, bound: false };

  if (!window.JournalViews) window.JournalViews = {};

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function validScore(n) {
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
  }

  function textLines(value, limit) {
    var raw = [];
    var out = [];
    var i;
    var item;
    var text;
    if (Array.isArray(value)) raw = value;
    else if (value && typeof value === "object" && Array.isArray(value.items)) raw = value.items;
    else if (value != null && String(value).trim()) raw = String(value).split(/\r?\n/);
    for (i = 0; i < raw.length; i++) {
      item = raw[i];
      text = item && typeof item === "object" ? (item.text || item.title || item.label || item.name) : item;
      text = String(text == null ? "" : text).trim();
      if (text) out.push(text);
    }
    return limit ? out.slice(0, limit) : out;
  }

  function filled(value) {
    return String(value == null ? "" : value).trim() !== "";
  }

  function oneLine(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function countLabel(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  function newId() {
    return "t" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }

  function prioritiesOf(fields, todos) {
    var lines = textLines(fields.priorities, 3);
    var mits = [];
    var i;
    var todo;
    var text;
    if (lines.length) return { lines: lines, source: "priorities", note: "" };
    lines = textLines(fields.top3, 3);
    if (lines.length) return { lines: lines, source: "top3", note: "From this morning's top 3." };
    for (i = 0; i < todos.length; i++) {
      todo = todos[i];
      text = String(todo && todo.text || "").trim();
      if (text && todo.mit === true) mits.push(text);
    }
    if (mits.length) {
      return { lines: mits.slice(0, 3), source: "mit", note: "From the most important to-dos." };
    }
    return { lines: [], source: "none", note: "" };
  }

  function winCount(fields) {
    var n = textLines(fields.wins).length;
    if (filled(fields.highlights)) n += 1;
    return n;
  }

  function morningSummary(fields, priorities) {
    var focus = oneLine(fields.focus);
    var focusBit = focus ? "focus: " + focus : "no focus";
    return "Morning \u00b7 " + focusBit + " \u00b7 " + countLabel(priorities.lines.length, "priority", "priorities");
  }

  function eveningSummary(mood, energy, wins) {
    var moodBit = validScore(mood) ? "mood " + mood : "no mood";
    var energyBit = validScore(energy) ? "energy " + energy : "no energy";
    return "Evening \u00b7 " + moodBit + " / " + energyBit + " \u00b7 " + countLabel(wins, "win", "wins");
  }

  function todoSummary(todos) {
    var done = 0;
    var i;
    for (i = 0; i < todos.length; i++) if (todos[i] && todos[i].done) done += 1;
    return "To-dos \u00b7 " + done + " of " + todos.length + " done";
  }

  function missingLine(names) {
    if (!names.length) return null;
    return el("p", "day-missing", "Not written yet: " + names.join(", ") + ".");
  }

  function infoButton(citeKey) {
    var node;
    if (!citeKey || !window.JournalUI || typeof JournalUI.info !== "function") return null;
    node = JournalUI.info(citeKey);
    if (node && node.classList) node.classList.add("day-info");
    return node;
  }

  function addLabel(wrap, label, citeKey) {
    var row = el("div", "day-label-row");
    row.appendChild(el("p", "day-label", label));
    var info = infoButton(citeKey);
    if (info) row.appendChild(info);
    wrap.appendChild(row);
  }

  function field(parent, id, label, citeKey) {
    var wrap = el("div", "day-field");
    wrap.setAttribute("data-field", id);
    addLabel(wrap, label, citeKey);
    parent.appendChild(wrap);
    return wrap;
  }

  function addCopy(wrap, text) {
    wrap.appendChild(el("p", "day-copy", text));
  }

  function addList(wrap, lines, ordered) {
    var list = el(ordered ? "ol" : "ul", "day-list");
    var i;
    for (i = 0; i < lines.length; i++) list.appendChild(el("li", "", lines[i]));
    wrap.appendChild(list);
  }

  function meter(parent, id, label, score, faces) {
    var row = el("p", "day-meter");
    var emoji = el("span", "day-emoji", faces[score - 1]);
    emoji.setAttribute("aria-hidden", "true");
    row.setAttribute("data-field", id);
    row.appendChild(emoji);
    row.appendChild(el("span", "day-meter-text", label + " " + score + " of 5"));
    parent.appendChild(row);
  }

  function section(parent, id, title, summary) {
    var made = JournalUI.fold({ id: id, title: title, level: 3, summary: summary });
    if (made.root.classList) made.root.classList.add("dx-card", "day-fold");
    made.root.setAttribute("data-fold", id);
    if (made.body && made.body.classList) made.body.classList.add("day-fold-body");
    parent.appendChild(made.root);
    return made.body;
  }

  function mountQuote(parent, key) {
    var quote = JournalData.quote(key);
    var text = "";
    var figure;
    var quoteEl;
    if (typeof quote === "string") text = quote.trim();
    else if (quote && typeof quote.text === "string") text = quote.text.trim();
    if (!text) return;
    figure = el("figure", "day-quote dx-card");
    quoteEl = el("blockquote", "", text);
    figure.appendChild(quoteEl);
    parent.appendChild(figure);
  }

  function mountMorning(parent, fields, todos) {
    var priorities = prioritiesOf(fields, todos);
    var body = section(parent, "morning", "Morning", morningSummary(fields, priorities));
    var missing = [];
    var focus = oneLine(fields.focus);
    var grateful = textLines(fields.grateful);
    var wrap;
    if (focus) addCopy(field(body, "focus", "Focus"), focus);
    else missing.push("focus");
    if (priorities.lines.length) {
      wrap = field(body, "priorities", "Priorities");
      wrap.setAttribute("data-priorities-source", priorities.source);
      addList(wrap, priorities.lines, true);
      if (priorities.note) wrap.appendChild(el("p", "day-note", priorities.note));
    } else missing.push("priorities");
    if (filled(fields.failureCost)) addCopy(field(body, "failureCost", "If the first priority is skipped", "failure"), String(fields.failureCost).trim());
    else missing.push("if the first priority is skipped");
    if (filled(fields.ifThen)) addCopy(field(body, "ifThen", "If-then plan", "obstacle"), String(fields.ifThen).trim());
    else missing.push("if-then plan");
    if (grateful.length) addList(field(body, "grateful", "Grateful", "gratitude"), grateful, false);
    else missing.push("grateful");
    if (filled(fields.makeGreat)) addCopy(field(body, "makeGreat", "What will make today great"), String(fields.makeGreat).trim());
    if (filled(fields.affirmation)) addCopy(field(body, "affirmation", "Daily affirmation"), String(fields.affirmation).trim());
    wrap = missingLine(missing);
    if (wrap) body.appendChild(wrap);
  }

  function mountWins(body, fields, missing) {
    var wins = textLines(fields.wins);
    var highlights = filled(fields.highlights) ? String(fields.highlights).trim() : "";
    var wrap;
    var older;
    if (!wins.length && !highlights) {
      missing.push("wins");
      return;
    }
    wrap = field(body, "wins", "Wins", "effort");
    if (wins.length) addList(wrap, wins, false);
    if (highlights) {
      older = el("div", "day-field");
      older.setAttribute("data-field", "highlights");
      addLabel(older, "Highlights");
      addCopy(older, highlights);
      wrap.appendChild(older);
    }
  }

  function mountLesson(body, fields, missing) {
    var lesson = filled(fields.lesson) ? String(fields.lesson).trim() : "";
    var better = filled(fields.better) ? String(fields.better).trim() : "";
    var wrap;
    var older;
    var link;
    if (!lesson && !better) {
      missing.push("lesson");
      return;
    }
    wrap = field(body, "lesson", "Lesson");
    link = el("a", "day-study dx-btn dx-btn--ghost", "Study");
    link.href = STUDY;
    wrap.appendChild(link);
    if (lesson) addCopy(wrap, lesson);
    if (better) {
      older = el("div", "day-field");
      older.setAttribute("data-field", "better");
      addLabel(older, "How today could have been better");
      addCopy(older, better);
      wrap.appendChild(older);
    }
  }

  function mountEvening(parent, key, fields) {
    var mood = JournalData.moodOf(key);
    var energy = JournalData.energyOf(key);
    var body = section(parent, "evening", "Evening", eveningSummary(mood, energy, winCount(fields)));
    var missing = [];
    var tomorrow = textLines(fields.tomorrow, 3);
    if (!validScore(mood)) mood = null;
    if (!validScore(energy)) energy = null;
    if (mood) meter(body, "mood", "Mood", mood, MOOD);
    else missing.push("mood");
    if (energy) meter(body, "energy", "Energy", energy, ENERGY);
    else missing.push("energy");
    if (filled(fields.feeling)) addCopy(field(body, "feeling", "Feeling", "feelings"), oneLine(fields.feeling));
    else missing.push("feeling");
    mountWins(body, fields, missing);
    mountLesson(body, fields, missing);
    if (filled(fields.chosenVsMomentum)) {
      addCopy(field(body, "chosenVsMomentum", "Chosen or autopilot", "reviews"), String(fields.chosenVsMomentum).trim());
    } else missing.push("chosen or autopilot");
    if (tomorrow.length) addList(field(body, "tomorrow", "Tomorrow"), tomorrow, true);
    else missing.push("tomorrow");
    var line = missingLine(missing);
    if (line) body.appendChild(line);
  }

  function mountReflect(parent, key) {
    var slot = el("div", "day-reflect");
    slot.setAttribute("data-day-reflect", key);
    parent.appendChild(slot);
    if (window.JournalReflect && typeof JournalReflect.mount === "function") {
      JournalReflect.mount(slot, { mode: "day", day: key });
    }
  }

  function mountYesterday(parent, key) {
    var prev = JournalData.shift(key, -1);
    var oldTodos;
    var todayTodos;
    var have = {};
    var open = [];
    var i;
    var text;
    var box;
    var list;
    var item;
    var button;
    if (!prev) return;
    oldTodos = JournalData.todos(prev) || [];
    todayTodos = JournalData.todos(key) || [];
    for (i = 0; i < todayTodos.length; i++) {
      text = String(todayTodos[i] && todayTodos[i].text || "").trim();
      if (text) have[text] = true;
    }
    for (i = 0; i < oldTodos.length; i++) {
      text = String(oldTodos[i] && oldTodos[i].text || "").trim();
      if (!text || oldTodos[i].done || have[text]) continue;
      open.push(text);
    }
    if (!open.length) return;
    box = el("div", "day-yesterday");
    box.appendChild(el("p", "day-label", "Still open from yesterday"));
    list = el("ul", "day-carry-list");
    for (i = 0; i < open.length; i++) {
      text = open[i];
      item = el("li", "day-carry");
      item.appendChild(el("span", "day-carry-text", text));
      button = el("button", "day-add dx-btn dx-btn--ghost", "Add to today");
      button.type = "button";
      button.setAttribute("aria-label", "Add to today: " + text);
      button.addEventListener("click", function (label) {
        return function () {
          JournalOps.todoAdd(key, { id: newId(), text: label, done: false });
          if (window.JournalUI && typeof JournalUI.announce === "function") JournalUI.announce("Added to today");
        };
      }(text));
      item.appendChild(button);
      list.appendChild(item);
    }
    box.appendChild(list);
    parent.appendChild(box);
  }

  function mountTodos(parent, key, todos) {
    var body = section(parent, "todos", "To-dos", todoSummary(todos));
    if (window.JournalUI && typeof JournalUI.todoList === "function") JournalUI.todoList(body, key, {});
    mountYesterday(body, key);
  }

  function mountApps(parent) {
    var body = section(parent, "other-apps", "Other apps", "Other apps \u00b7 Health, Study, Thesis");
    var list = el("ul", "day-apps");
    var i;
    var item;
    var link;
    for (i = 0; i < APPS.length; i++) {
      item = el("li");
      link = el("a", "day-app", APPS[i][0]);
      link.href = APPS[i][1];
      item.appendChild(link);
      list.appendChild(item);
    }
    body.appendChild(list);
  }

  function paint(root, key) {
    var view;
    var fields;
    var todos;
    if (!window.JournalData || !window.JournalUI || typeof JournalUI.fold !== "function") return;
    fields = JournalData.fields(key) || {};
    todos = JournalData.todos(key) || [];
    root.textContent = "";
    view = el("div", "day-view");
    mountQuote(view, key);
    mountMorning(view, fields, todos);
    mountEvening(view, key, fields);
    mountReflect(view, key);
    mountTodos(view, key, todos);
    mountApps(view);
    root.appendChild(view);
  }

  function bindOps() {
    if (watch.bound || !window.JournalOps || typeof JournalOps.onChange !== "function") return;
    watch.bound = true;
    JournalOps.onChange(function () {
      if (watch.fn) watch.fn();
    });
  }

  JournalViews.day = function (root, opts) {
    var key = opts && opts.key;
    if (!root || !key) return;
    watch.fn = function () { paint(root, key); };
    bindOps();
    paint(root, key);
  };
})();
