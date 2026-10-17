(function () {
  "use strict";

  // Day screen. Read-only: journal.json is edited outside this page.
  // Faces for mood 1–5. None when the score is missing. Energy is always ⚡.
  var FACES = ["\uD83D\uDE1E", "\uD83D\uDE15", "\uD83D\uDE10", "\uD83D\uDE42", "\uD83D\uDE04"];

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

  function scoreOrNull(n) {
    return validScore(n) ? n : null;
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

  function prioritiesOf(fields, todos) {
    var lines = textLines(fields.priorities, 3);
    var mits = [];
    var i;
    var todo;
    var text;
    if (lines.length) return { lines: lines, source: "priorities", note: "", own: false };
    lines = textLines(fields.top3, 3);
    if (lines.length) return { lines: lines, source: "top3", note: "From this morning's top 3.", own: false };
    for (i = 0; i < todos.length; i++) {
      todo = todos[i];
      text = String(todo && todo.text || "").trim();
      if (text && todo.mit === true) mits.push(text);
    }
    if (mits.length) {
      return { lines: mits.slice(0, 3), source: "mit", note: "From the most important to-dos.", own: true };
    }
    return { lines: [], source: "none", note: "", own: false };
  }

  function morningSummary(fields, priorities) {
    var focus = JournalUI.plain(oneLine(fields.focus));
    var n = priorities.lines.length;
    if (!focus && !n) return "Morning \u00b7 nothing yet";
    return JournalUI.oneLine(["Morning", focus ? "focus: " + JournalUI.clip(focus, 28) : "", n ? countLabel(n, "priority", "priorities") : ""]);
  }

  function eveningSummary(mood, energy, fields) {
    var wins = textLines(fields.wins).length;
    var moodBit = "";
    if (validScore(mood) || validScore(energy)) {
      moodBit = "mood " + (validScore(mood) ? mood : "\u2013") + " / energy " + (validScore(energy) ? energy : "\u2013");
    }
    if (!moodBit && !wins) return "Evening \u00b7 nothing yet";
    return JournalUI.oneLine(["Evening", moodBit, wins ? countLabel(wins, "win", "wins") : ""]);
  }

  function todoSummary(todos) {
    var left = 0;
    var i;
    if (!todos.length) return "To-dos \u00b7 none yet";
    for (i = 0; i < todos.length; i++) if (todos[i] && !todos[i].done) left += 1;
    return "To-dos \u00b7 " + left + " left";
  }

  function missingLine(names) {
    if (!names.length) return null;
    return el("p", "day-missing", "Not written yet: " + names.join(", ") + ".");
  }

  // Morning sub-headings. Emoji is presentation only. Accents cover every morning field.
  var SUB = {
    focus: { emoji: "\uD83C\uDFAF", accent: "focus" },
    priorities: { emoji: "\uD83D\uDCCC", accent: "priorities" },
    failureCost: { emoji: "\uD83D\uDD01", accent: "skip" },
    ifThen: { accent: "obstacle" },
    grateful: { emoji: "\uD83D\uDE4F", accent: "grateful" },
    makeGreat: { emoji: "\uD83C\uDF1F", accent: "great" },
    affirmation: { accent: "affirm" }
  };

  function addLabel(wrap, label, emoji) {
    var row = el("div", "day-label-row");
    var node = el("p", "day-label");
    var mark;
    if (emoji) {
      mark = el("span", "day-sub-emoji", emoji);
      mark.setAttribute("aria-hidden", "true");
      node.appendChild(mark);
      node.appendChild(document.createTextNode(" " + label));
    } else node.textContent = label;
    row.appendChild(node);
    wrap.appendChild(row);
  }

  function field(parent, id, label) {
    var meta = SUB[id] || {};
    var wrap = el("div", "day-field");
    wrap.setAttribute("data-field", id);
    if (meta.accent) {
      wrap.classList.add("day-accent");
      wrap.setAttribute("data-accent", meta.accent);
    }
    addLabel(wrap, label, meta.emoji || "");
    parent.appendChild(wrap);
    return wrap;
  }

  function addCopy(wrap, text, opts) {
    JournalUI.fillText(wrap, JournalUI.plain(text), {
      copyClass: "day-copy",
      listClass: "day-list",
      pill: !!(opts && opts.pill)
    });
  }

  function addList(wrap, lines, ordered, opts) {
    var list = el(ordered ? "ol" : "ul", opts && opts.className ? opts.className : "day-list");
    var own = !!(opts && opts.own);
    var i;
    var item;
    var text;
    for (i = 0; i < lines.length; i++) {
      text = own ? String(lines[i]) : JournalUI.plain(String(lines[i])).replace(/^\s*-\s+/, "");
      item = el("li");
      if (own) item.setAttribute("data-own", "");
      JournalUI.appendMarked(item, text);
      list.appendChild(item);
    }
    wrap.appendChild(list);
  }

  function makeFold(parent, id, title, summary, emoji) {
    var made = JournalUI.fold({ id: id, title: title, level: 3, summary: summary, emoji: emoji || "" });
    if (made.root.classList) made.root.classList.add("dx-card", "day-fold");
    made.root.setAttribute("data-fold", id);
    if (made.body && made.body.classList) made.body.classList.add("day-fold-body");
    parent.appendChild(made.root);
    return made;
  }

  function mountQuote(parent, key) {
    var quote = JournalData.quote(key);
    var text = "";
    var figure;
    var quoteEl;
    var body;
    if (typeof quote === "string") text = quote.trim();
    else if (quote && typeof quote.text === "string") text = quote.text.trim();
    if (!text) return;
    text = JournalUI.plain(text);
    figure = el("figure", "day-quote");
    quoteEl = el("blockquote");
    JournalUI.fillText(quoteEl, text, { copyClass: "day-copy", listClass: "day-list" });
    figure.appendChild(quoteEl);
    body = makeFold(parent, "day:quote", "Quote", JournalUI.oneLine(["Quote", JournalUI.clip(text, 48)]), "\uD83D\uDCAC").body;
    body.appendChild(figure);
  }

  function mountMorning(parent, fields, todos) {
    var priorities = prioritiesOf(fields, todos);
    var body = makeFold(parent, "day:morning", "Morning", morningSummary(fields, priorities), "\uD83C\uDF05").body;
    var missing = [];
    var focus = JournalUI.plain(oneLine(fields.focus));
    var grateful = textLines(fields.grateful);
    var wrap;
    if (focus) addCopy(field(body, "focus", "Focus"), focus, { pill: true });
    else missing.push("focus");
    if (priorities.lines.length) {
      wrap = field(body, "priorities", "Priorities");
      wrap.setAttribute("data-priorities-source", priorities.source);
      addList(wrap, priorities.lines, true, { className: "day-list day-priorities", own: priorities.own });
      if (priorities.note) wrap.appendChild(el("p", "day-note", priorities.note));
    } else missing.push("priorities");
    if (filled(fields.failureCost)) addCopy(field(body, "failureCost", "If I skip #1"), String(fields.failureCost).trim());
    else missing.push("if I skip #1");
    if (filled(fields.ifThen)) addCopy(field(body, "ifThen", "If this happens"), String(fields.ifThen).trim());
    else missing.push("if this happens");
    if (grateful.length) addList(field(body, "grateful", "Grateful"), grateful, false);
    else missing.push("grateful");
    if (filled(fields.makeGreat)) addCopy(field(body, "makeGreat", "What would make today great"), String(fields.makeGreat).trim());
    if (filled(fields.affirmation)) addCopy(field(body, "affirmation", "A line to repeat"), String(fields.affirmation).trim());
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
    wrap = field(body, "wins", "Wins");
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
    if (!lesson && !better) {
      missing.push("lesson");
      return;
    }
    wrap = field(body, "lesson", "Lesson");
    if (lesson) addCopy(wrap, lesson);
    if (better) {
      older = el("div", "day-field");
      older.setAttribute("data-field", "better");
      addLabel(older, "What I would change");
      addCopy(older, better);
      wrap.appendChild(older);
    }
  }

  function eveningChips(mood, energy) {
    var row = el("div", "day-chips");
    var moodScore = scoreOrNull(mood);
    var energyScore = scoreOrNull(energy);
    var moodOpts = { label: "Mood", value: moodScore, max: 5 };
    var moodChip;
    var energyChip;
    if (moodScore) moodOpts.emoji = FACES[moodScore - 1];
    moodChip = JournalUI.chip(moodOpts);
    energyChip = JournalUI.chip({ emoji: "\u26A1", label: "Energy", value: energyScore, max: 5 });
    moodChip.setAttribute("data-field", "mood");
    energyChip.setAttribute("data-field", "energy");
    row.appendChild(moodChip);
    row.appendChild(energyChip);
    return row;
  }

  function eveningDots(mood, energy) {
    var wrap = el("span", "day-eve-dots");
    wrap.setAttribute("aria-hidden", "true");
    wrap.appendChild(JournalUI.dots(scoreOrNull(mood), 5, "Mood"));
    wrap.appendChild(JournalUI.dots(scoreOrNull(energy), 5, "Energy"));
    return wrap;
  }

  function mountEvening(parent, key, fields) {
    var mood = JournalData.moodOf(key);
    var energy = JournalData.energyOf(key);
    var made = makeFold(parent, "day:evening", "Evening", eveningSummary(mood, energy, fields), "\uD83C\uDF19");
    var body = made.body;
    var button = made.root.querySelector(".fold-summary");
    var missing = [];
    var tomorrow = textLines(fields.tomorrow, 3);
    var line;
    button.appendChild(eveningDots(mood, energy));
    body.appendChild(eveningChips(mood, energy));
    if (!validScore(mood)) missing.push("mood");
    if (!validScore(energy)) missing.push("energy");
    if (filled(fields.feeling)) addCopy(field(body, "feeling", "Feeling"), oneLine(fields.feeling));
    else missing.push("feeling");
    mountWins(body, fields, missing);
    mountLesson(body, fields, missing);
    if (filled(fields.chosenVsMomentum)) {
      addCopy(field(body, "chosenVsMomentum", "Choice or autopilot"), String(fields.chosenVsMomentum).trim());
    } else missing.push("choice or autopilot");
    if (tomorrow.length) addList(field(body, "tomorrow", "Tomorrow"), tomorrow, true);
    else missing.push("tomorrow");
    line = missingLine(missing);
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
      item.appendChild(el("span", "day-carry-mark", "\u21A9\uFE0F"));
      item.lastChild.setAttribute("aria-hidden", "true");
      item.appendChild(el("span", "day-carry-text", text));
      item.lastChild.setAttribute("data-own", "");
      list.appendChild(item);
    }
    box.appendChild(list);
    parent.appendChild(box);
  }

  function mountTodos(parent, key, todos) {
    var body = makeFold(parent, "day:todos", "To-dos", todoSummary(todos), "\u2705").body;
    if (window.JournalUI && typeof JournalUI.todoList === "function") JournalUI.todoList(body, key, {});
    mountYesterday(body, key);
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
    root.appendChild(view);
  }

  JournalViews.day = function (root, opts) {
    var key = opts && opts.key;
    if (!root || !key) return;
    paint(root, key);
  };
})();
