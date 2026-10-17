(function () {
  "use strict";

  var ENJOY = { green: "Good", yellow: "Mixed", red: "Rough" };
  var FACES = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
  var FOLD_EMOJI = {
    glance: "📈",
    children: "🗓️",
    plan: "🧭",
    review: "🔍",
    goals: "🎯",
    choices: "🔀",
    habits: "🔁",
    last: "↩️",
    todos: "✅"
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var GOAL_ORDER = [
    { id: "thesis", label: "Thesis", href: "https://dong-xuyong.github.io/thesis/" },
    { id: "career", label: "Career", href: "" },
    { id: "health", label: "Health", href: "https://dong-xuyong.github.io/health/" }
  ];
  var SPECS = {
    week: {
      plan: [
        { key: "enjoyment", label: "Enjoyment", short: "enjoyment", type: "enjoy", missing: "enjoyment" },
        { key: "why", label: "Why", short: "why", missing: "why" },
        { key: "oneThing", label: "The one thing that would make this week a success", short: "the one thing", missing: "the one thing" },
        { key: "watch", label: "Things to watch out for", short: "things to watch", missing: "things to watch" }
      ],
      review: [
        { key: "wins", label: "Wins", short: "wins", missing: "wins", merge: "wins" },
        { key: "accomplishments", label: "Accomplishments", short: "accomplishments", missing: "accomplishments", merge: "wins" },
        { key: "improve", label: "What to improve", short: "what to improve", missing: "what to improve", merge: "improve" },
        { key: "rootCause", label: "Root cause", short: "root cause", missing: "root cause", merge: "improve" },
        { key: "grateful", label: "Grateful for", short: "grateful", type: "list", missing: "grateful" },
        { key: "lesson", label: "Lesson of the week", short: "lesson", missing: "lesson" }
      ]
    },
    month: {
      plan: [
        { key: "oneThing", label: "The one thing that would make this month a success", short: "the one thing", missing: "the one thing" }
      ],
      review: [
        { key: "wins", label: "Wins", short: "wins", missing: "wins", merge: "wins" },
        { key: "accomplishments", label: "Accomplishments", short: "accomplishments", missing: "accomplishments", merge: "wins" },
        { key: "improve", label: "What to improve", short: "what to improve", missing: "what to improve", merge: "improve" },
        { key: "rootCause", label: "Root cause", short: "root cause", missing: "root cause", merge: "improve" },
        { key: "goalsReview", label: "Did I move the year goals forward?", short: "year goals", missing: "year goals" }
      ]
    },
    quarter: {
      plan: [
        { key: "mainQuest", label: "Main quest", short: "main quest", missing: "main quest" },
        { key: "q1", label: "The most important goal for these 3 months", short: "the 3-month goal", missing: "the 3-month goal" },
        { key: "q2", label: "What would move the needle the most", short: "the needle-mover", missing: "the needle-mover" },
        { key: "q3", label: "The accomplishment that would make me proud", short: "a proud accomplishment", missing: "a proud accomplishment" },
        { key: "q4", label: "What would make everything else easier", short: "what makes everything easier", missing: "what makes everything easier" },
        { key: "q5", label: "What I have been postponing", short: "postponed", missing: "postponed" },
        { key: "q6", label: "First two hours of the work day", short: "first two hours", missing: "first two hours" },
        { key: "commit90", label: "In the next 90 days I will have", short: "the 90-day commitment", missing: "the 90-day commitment" },
        { key: "goingTo", label: "To complete it I am going to", short: "the plan to finish", missing: "the plan to finish" }
      ],
      review: [
        { key: "wins", label: "Wins this quarter", short: "wins", missing: "wins" },
        { key: "improve", label: "What to improve next quarter", short: "what to improve", missing: "what to improve" },
        { key: "yearProgress", label: "Did this quarter move the year goals forward?", short: "year goals", missing: "year goals" }
      ]
    },
    year: {
      plan: [
        { key: "vision", label: "The person I want to be by December", short: "vision", missing: "vision" },
        { key: "principle", label: "Guiding principle", short: "guiding principle", missing: "guiding principle" }
      ],
      review: [
        { key: "wins", label: "Biggest wins", short: "wins", missing: "wins" },
        { key: "finished", label: "What I finished", short: "what I finished", missing: "what I finished" },
        { key: "differently", label: "What I would do differently", short: "what I would do differently", missing: "what I would do differently" },
        { key: "lessons", label: "Lessons learned", short: "lessons", missing: "lessons" }
      ]
    }
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function dayString(today) {
    if (typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
    var date = today && typeof today.getFullYear === "function" ? today : new Date();
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function periodDays(key, through) {
    var days = JournalData.daysIn(key, through);
    return Array.isArray(days) ? days.length : 0;
  }

  function rollupOf(key, through) {
    var roll = JournalData.rollup(key, { through: through });
    if (!roll || typeof roll !== "object") {
      return { days: periodDays(key, through), logged: 0, mood: null, energy: null, sleep: null, todos: { done: 0, total: 0 }, habitRate: null, reflections: 0 };
    }
    return roll;
  }

  function show(text) {
    return JournalUI.plain(String(text == null ? "" : text));
  }

  function nearestDot(stat) {
    var avg = statAvg(stat);
    var dot;
    if (avg == null) return null;
    dot = Math.round(avg);
    if (dot < 1) return 1;
    if (dot > 5) return 5;
    return dot;
  }

  function statAvg(stat) {
    var avg = stat;
    var n = null;
    if (stat == null) return null;
    if (typeof stat === "object") {
      avg = stat.avg;
      n = stat.n;
    }
    if (typeof avg !== "number" || avg !== avg) return null;
    if (n === 0) return null;
    if (avg < 1 || avg > 5) return null;
    return avg;
  }

  function oneDecimal(value) {
    var avg = statAvg(value);
    if (avg == null && typeof value === "number" && value === value) avg = value;
    if (typeof avg !== "number" || avg !== avg) return null;
    return (Math.round(avg * 10) / 10).toFixed(1);
  }

  function fmtScore(stat) {
    var avg = statAvg(stat);
    if (avg == null) return null;
    return (Math.round(avg * 10) / 10).toFixed(1);
  }

  function metric(name, current, previous) {
    var now = fmtScore(current);
    var then;
    var delta;
    if (now == null) return null;
    then = fmtScore(previous);
    if (then == null) return name + " " + now;
    delta = Math.round((Number(now) - Number(then)) * 10) / 10;
    if (delta === 0) return name + " " + now;
    return name + " " + now + " (" + (delta > 0 ? "\u2191" : "\u2193") + Math.abs(delta).toFixed(1) + ")";
  }

  function glanceSummary(roll, prev) {
    var mood = metric("mood", roll.mood, prev && prev.mood);
    var energy = metric("energy", roll.energy, prev && prev.energy);
    var parts = ["At a glance"];
    if (!mood && !energy) return "At a glance \u00b7 no check-ins yet";
    if (mood) parts.push(mood);
    if (energy) parts.push(energy);
    return parts.join(" \u00b7 ");
  }

  function chartSentence(roll) {
    var mood = fmtScore(roll.mood);
    var energy = fmtScore(roll.energy);
    if (mood && energy) return "Mood averaged " + mood + " and energy averaged " + energy + ".";
    if (mood) return "Mood averaged " + mood + " and energy has no check-ins.";
    if (energy) return "Energy averaged " + energy + " and mood has no check-ins.";
    return "No check-ins yet.";
  }

  function countText(value) {
    return typeof value === "number" && value === value ? value : 0;
  }

  function noun(kind) {
    if (kind === "week") return "week";
    if (kind === "month") return "month";
    if (kind === "quarter") return "quarter";
    return "year";
  }

  function childNoun(kind) {
    if (kind === "week") return "days";
    if (kind === "month") return "weeks";
    if (kind === "quarter") return "months";
    return "quarters";
  }

  function childHeading(kind) {
    var word = childNoun(kind);
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function loggedKids(kids) {
    var n = 0;
    var i;
    for (i = 0; i < kids.length; i++) if (kids[i].roll && kids[i].roll.logged) n += 1;
    return n;
  }

  function childTitle(key) {
    var kind = JournalData.kindOf(key);
    var label = JournalData.label(key) || key;
    var short;
    if (kind === "week") return "Week " + Number(key.slice(6));
    if (kind === "day") {
      short = MONTHS[Number(key.slice(5, 7)) - 1] + " " + Number(key.slice(8, 10));
      if (label.indexOf(short) === -1) return short + ", " + label;
    }
    return label;
  }

  function pointLabel(key) {
    var kind = JournalData.kindOf(key);
    if (kind === "day") return MONTHS[Number(key.slice(5, 7)) - 1] + " " + Number(key.slice(8, 10));
    if (kind === "week") return "Week " + Number(key.slice(6));
    if (kind === "quarter") return "Q" + key.slice(6);
    return JournalData.label(key) || key;
  }

  function linesOf(spec, value) {
    var out = [];
    var i;
    var word;
    var text;
    if (spec.type === "enjoy") {
      word = ENJOY[value];
      if (word) return [show(word)];
      if (value == null || String(value).trim() === "") return [];
      text = show(String(value).trim());
      return text ? [text] : [];
    }
    if (Array.isArray(value)) {
      for (i = 0; i < value.length; i++) {
        var item = value[i];
        text = item && typeof item === "object" ? (item.text || item.title || item.label || item.name || "") : item;
        text = show(String(text == null ? "" : text).trim());
        if (text) out.push(text);
      }
      return out;
    }
    text = show(String(value == null ? "" : value).trim());
    return text ? [text] : [];
  }

  function hasLines(spec, fields) {
    return linesOf(spec, fields[spec.key]).length > 0;
  }

  function sectionSummary(title, specs, fields) {
    var i;
    var lines;
    for (i = 0; i < specs.length; i++) {
      lines = linesOf(specs[i], fields[specs[i].key]);
      if (lines.length) return JournalUI.oneLine([title, JournalUI.clip(lines[0], 40)]);
    }
    return title + " \u00b7 nothing yet";
  }

  function foldId(kind, name) {
    if (name === "plan") return kind + (kind === "quarter" ? ":focus" : kind === "year" ? ":vision" : ":planning");
    return kind + ":" + name;
  }

  function addFold(parent, opts) {
    var made = JournalUI.fold(opts);
    made.root.classList.add("period-fold");
    parent.appendChild(made.root);
    return made;
  }

  function appendInfo(parent, citeKey) {
    var node;
    if (!window.JournalUI || typeof JournalUI.info !== "function") return;
    node = JournalUI.info(citeKey);
    if (node && node.nodeType === 1) parent.appendChild(node);
  }

  function appendField(parent, spec, fields) {
    var lines = linesOf(spec, fields[spec.key]);
    var block;
    var head;
    var list;
    var i;
    if (!lines.length) return false;
    block = el("div", "period-field");
    block.setAttribute("data-field", spec.key);
    if (spec.type === "enjoy") {
      block.appendChild(JournalUI.chip({ label: spec.label, text: lines[0] }));
      parent.appendChild(block);
      return true;
    }
    head = el("div", "period-field-head");
    head.appendChild(el("h4", null, spec.label));
    if (spec.cite) appendInfo(head, spec.cite);
    block.appendChild(head);
    if (lines.length > 1 || spec.type === "list") {
      list = el("ul", "period-list");
      for (i = 0; i < lines.length; i++) list.appendChild(el("li", null, lines[i]));
      block.appendChild(list);
    } else {
      block.appendChild(el("p", "period-prose", lines[0]));
    }
    parent.appendChild(block);
    return true;
  }

  function renderSpecs(body, specs, fields) {
    var missing = [];
    var i = 0;
    while (i < specs.length) {
      var spec = specs[i];
      var group;
      if (spec.merge && i + 1 < specs.length && specs[i + 1].merge === spec.merge) {
        group = el("div", "period-merge");
        group.setAttribute("data-merge", spec.merge);
        if (!appendField(group, spec, fields)) missing.push(spec.missing);
        if (!appendField(group, specs[i + 1], fields)) missing.push(specs[i + 1].missing);
        if (group.childNodes.length) body.appendChild(group);
        i += 2;
        continue;
      }
      if (!appendField(body, spec, fields)) missing.push(spec.missing);
      i += 1;
    }
    if (missing.length) body.appendChild(el("p", "period-missing", "Not written yet: " + missing.join(", ") + "."));
  }

  function renderSection(view, kind, name, title, fields) {
    var specs = SPECS[kind][name];
    var fold = addFold(view, {
      id: foldId(kind, name),
      title: title,
      level: 3,
      summary: sectionSummary(title, specs, fields),
      emoji: FOLD_EMOJI[name] || FOLD_EMOJI.plan
    });
    renderSpecs(fold.body, specs, fields);
  }

  function textTodos(todos) {
    var out = [];
    var i;
    var list = Array.isArray(todos) ? todos : [];
    for (i = 0; i < list.length; i++) {
      var text = String(list[i] && list[i].text || "").trim();
      if (text) out.push(list[i]);
    }
    return out;
  }

  function todoSummary(prefix, todos) {
    var items = textTodos(todos);
    var done = 0;
    var i;
    if (!items.length) return prefix + " \u00b7 none yet";
    for (i = 0; i < items.length; i++) if (items[i].done) done += 1;
    return prefix + " \u00b7 " + (items.length - done) + " left";
  }

  function habitPhrase(roll) {
    var rate = roll && roll.habitRate;
    if (typeof rate !== "number" || rate !== rate) return "no log yet";
    return Math.round(rate * 100) + "% done";
  }

  function goalMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
  }

  function scoreOf(goal) {
    var n;
    if (!goal || typeof goal !== "object" || Array.isArray(goal)) return null;
    n = goal.score;
    if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
    return null;
  }

  function goalBit(goal, prop) {
    if (!goal || typeof goal !== "object" || Array.isArray(goal)) return "";
    return String(goal[prop] == null ? "" : goal[prop]).trim();
  }

  function goalsSummary(goals) {
    var parts = [];
    var i;
    for (i = 0; i < GOAL_ORDER.length; i++) {
      var score = scoreOf(goals[GOAL_ORDER[i].id]);
      if (score) parts.push(GOAL_ORDER[i].id + " " + score + "/5");
    }
    if (!parts.length) return "Goals \u00b7 no score yet";
    return "Goals \u00b7 " + parts.join(" \u00b7 ");
  }

  function choicesSummary(fields) {
    var text = String(fields.difficulty == null ? "" : fields.difficulty).trim() || String(fields.audit == null ? "" : fields.audit).trim();
    if (text) return JournalUI.oneLine(["Difficulty and choices", JournalUI.clip(show(text), 40)]);
    return "Difficulty and choices \u00b7 nothing yet";
  }

  function metricChip(label, stat, emoji) {
    var avg = statAvg(stat);
    var dot = nearestDot(stat);
    var exact = avg == null ? "" : (Math.round(avg * 10) / 10).toFixed(1);
    var opts = { label: label, value: dot, max: 5 };
    var row = el("div", "glance-metric");
    if (emoji) opts.emoji = emoji;
    row.appendChild(JournalUI.chip(opts));
    if (exact) row.appendChild(el("span", "glance-exact", exact));
    return row;
  }

  function renderGlance(view, kind, roll, prev, kids) {
    var fold = addFold(view, {
      id: kind + ":mood",
      title: "At a glance",
      level: 3,
      summary: glanceSummary(roll, prev),
      emoji: FOLD_EMOJI.glance
    });
    var moodDot = nearestDot(roll.mood);
    var metrics = el("div", "glance-metrics");
    var checks = el("div", "glance-checks");
    var checkLabel = el("span", "glance-checks-label", "Check-ins");
    var logged = countText(roll.logged);
    var days = countText(roll.days);
    var points = [];
    var i;
    metrics.appendChild(metricChip("Mood", roll.mood, moodDot == null ? "" : FACES[moodDot]));
    metrics.appendChild(metricChip("Energy", roll.energy, statAvg(roll.energy) == null ? "" : "⚡"));
    fold.body.appendChild(metrics);
    // One dot per day only fits a week at 360px; longer spans get a count.
    if (days <= 7) {
      checkLabel.setAttribute("aria-hidden", "true");
      checks.appendChild(checkLabel);
      checks.appendChild(JournalUI.dots(logged, days, "Check-ins"));
    } else {
      checks.appendChild(JournalUI.chip({ label: "Check-ins", text: logged + " of " + days + " days" }));
    }
    fold.body.appendChild(checks);
    if (!fmtScore(roll.mood) && !fmtScore(roll.energy)) fold.body.appendChild(el("p", "period-prose", "No check-ins yet"));
    for (i = 0; i < kids.length; i++) {
      points.push({
        key: kids[i].key,
        label: pointLabel(kids[i].key),
        mood: statAvg(kids[i].roll.mood),
        energy: statAvg(kids[i].roll.energy)
      });
    }
    if (window.JournalTrends && typeof JournalTrends.mount === "function") {
      JournalTrends.mount(fold.body, {
        points: points,
        label: chartSentence(roll),
        foldId: kind + ":data"
      });
    }
  }

  function moodPhrase(roll) {
    var avg = statAvg(roll && roll.mood);
    var nearest;
    if (avg == null) return "no check-in";
    nearest = Math.round(avg);
    if (Math.abs(avg - nearest) < 0.05) return "mood " + nearest;
    return "mood " + (Math.round(avg * 10) / 10).toFixed(1);
  }

  function renderChildren(view, kind, kids) {
    var fold = addFold(view, {
      id: kind + ":children",
      title: childHeading(kind),
      level: 3,
      summary: childHeading(kind) + " \u00b7 " + loggedKids(kids) + " of " + kids.length + " with check-ins",
      emoji: FOLD_EMOJI.children
    });
    var i;
    for (i = 0; i < kids.length; i++) {
      var avg = statAvg(kids[i].roll && kids[i].roll.mood);
      var link = el("a", "period-child");
      var dot = el("span", "jn-dot" + (avg == null ? "" : " on"));
      var phrase = moodPhrase(kids[i].roll);
      var kindName = JournalData.kindOf(kids[i].key);
      var name = kindName === "day"
        ? MONTHS[Number(kids[i].key.slice(5, 7)) - 1] + " " + Number(kids[i].key.slice(8, 10))
        : childTitle(kids[i].key);
      var full = JournalData.label(kids[i].key) || name;
      link.href = "#" + kindName + "/" + kids[i].key;
      link.setAttribute("data-focus", "child:" + kids[i].key);
      link.setAttribute("aria-label", name + " " + phrase + (full === name ? "" : ", " + full));
      link.appendChild(el("span", "period-child-name", name));
      dot.setAttribute("aria-hidden", "true");
      link.appendChild(document.createTextNode(" "));
      link.appendChild(dot);
      link.appendChild(el("span", "period-child-mood", phrase));
      fold.body.appendChild(link);
    }
  }

  function renderGoals(view, kind, fields) {
    var goals = goalMap(fields.goals);
    var fold = addFold(view, {
      id: kind + ":goals",
      title: "Goals",
      level: 3,
      summary: goalsSummary(goals),
      emoji: FOLD_EMOJI.goals
    });
    var missing = [];
    var i;
    for (i = 0; i < GOAL_ORDER.length; i++) {
      var item = GOAL_ORDER[i];
      var goal = goals[item.id];
      var progress = typeof goal === "string" ? goal.trim() : goalBit(goal, "progress");
      var next = goalBit(goal, "next");
      var score = scoreOf(goal);
      var block;
      var row;
      if (!progress && !next && !score) missing.push(item.id);
      else {
        block = el("div", "period-field period-goal");
        row = el("div", "period-goal-row");
        block.setAttribute("data-field", "goals." + item.id);
        row.appendChild(el("span", "period-goal-name", item.label));
        row.appendChild(JournalUI.dots(score, 5, item.label + " score"));
        if (next) row.appendChild(el("span", "period-goal-next", show(next)));
        block.appendChild(row);
        if (progress) block.appendChild(el("p", "period-prose", show(progress)));
        fold.body.appendChild(block);
      }
      if (item.href) {
        var link = el("a", "period-app", "Open " + item.label);
        link.href = item.href;
        fold.body.appendChild(link);
      }
    }
    if (missing.length) fold.body.appendChild(el("p", "period-missing", "Not written yet: " + missing.join(", ") + "."));
  }

  function renderChoices(view, kind, fields) {
    var fold = addFold(view, {
      id: kind + ":choices",
      title: "Difficulty and choices",
      level: 3,
      summary: choicesSummary(fields),
      emoji: FOLD_EMOJI.choices
    });
    renderSpecs(fold.body, [
      { key: "difficulty", label: "Difficulty", short: "difficulty", missing: "difficulty", cite: "moderate" },
      { key: "audit", label: "What I chose, versus habit or momentum", short: "choices", missing: "choices", cite: "reviews" }
    ], fields);
  }

  function renderHabits(view, kind, roll) {
    var phrase = habitPhrase(roll);
    var fold = addFold(view, {
      id: kind + ":habits",
      title: "Habits",
      level: 3,
      summary: "Habits \u00b7 " + phrase,
      emoji: FOLD_EMOJI.habits
    });
    var link = el("a", "period-habit", "Habits, " + countText(roll.logged) + " days with check-ins, " + phrase);
    link.href = "#habits";
    link.setAttribute("data-focus", "habits-link");
    fold.body.appendChild(link);
  }

  function renderReadonlyTodos(body, todos) {
    var items = textTodos(todos);
    var list;
    var i;
    if (!items.length) {
      body.appendChild(el("p", "period-note", "No to-dos from the previous period."));
      return;
    }
    list = el("ul", "period-readonly");
    list.setAttribute("data-readonly", "todos");
    for (i = 0; i < items.length; i++) {
      var row = el("li");
      var own = el("span", null, String(items[i].text).trim());
      own.setAttribute("data-own", "");
      row.appendChild(document.createTextNode(items[i].done ? "Done. " : "Not done. "));
      row.appendChild(own);
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  function renderPrev(view, kind, key) {
    var prev = JournalData.shift(key, -1);
    var items = prev ? JournalData.todos(prev) : [];
    var label = "Last " + noun(kind) + "'s to-dos";
    var fold = addFold(view, {
      id: kind + ":last-todos",
      title: label,
      level: 3,
      summary: todoSummary(label, items),
      emoji: FOLD_EMOJI.last
    });
    renderReadonlyTodos(fold.body, items);
  }

  function renderTodos(view, kind, key, asGoals) {
    var items = JournalData.todos(key);
    var title = asGoals ? "Goals" : "To-dos";
    var fold = addFold(view, {
      id: kind + (asGoals ? ":goals" : ":todos"),
      title: title,
      level: 3,
      summary: todoSummary(title, items),
      emoji: asGoals ? FOLD_EMOJI.goals : FOLD_EMOJI.todos
    });
    var slot = el("div", "period-todos");
    fold.body.appendChild(slot);
    JournalUI.todoList(slot, key, asGoals ? { status: true } : {});
  }

  function renderReflect(view, key) {
    var slot = el("div", "period-reflect");
    view.appendChild(slot);
    if (window.JournalReflect && typeof JournalReflect.mount === "function") {
      JournalReflect.mount(slot, { mode: "year", year: key });
    }
  }

  function childBundle(key, through) {
    var kids = JournalData.children(key) || [];
    var out = [];
    var i;
    for (i = 0; i < kids.length; i++) out.push({ key: kids[i], roll: rollupOf(kids[i], through) });
    return out;
  }

  function render(root, ctx, kind) {
    var key = ctx && ctx.key;
    var through = dayString(ctx && ctx.today);
    var fields = JournalData.fields(key) || {};
    var roll = rollupOf(key, through);
    var prevKey = JournalData.shift(key, -1);
    var prev = prevKey ? rollupOf(prevKey, through) : null;
    var kids = childBundle(key, through);
    var view = el("div", "period-view");
    root.textContent = "";
    view.setAttribute("data-kind", kind);
    view.setAttribute("data-key", key);
    view.setAttribute("data-readonly", "fields");
    root.appendChild(view);
    renderGlance(view, kind, roll, prev, kids);
    renderChildren(view, kind, kids);
    renderSection(view, kind, "plan", "Plan", fields);
    if (kind === "year") renderTodos(view, kind, key, true);
    renderSection(view, kind, "review", "Review", fields);
    if (kind === "week" || kind === "month") {
      renderGoals(view, kind, fields);
      renderChoices(view, kind, fields);
    }
    renderHabits(view, kind, roll);
    renderPrev(view, kind, key);
    if (kind !== "year") renderTodos(view, kind, key, false);
    if (kind === "year") renderReflect(view, key);
  }

  var views = window.JournalViews || {};
  views.week = function (root, ctx) { render(root, ctx, "week"); };
  views.month = function (root, ctx) { render(root, ctx, "month"); };
  views.quarter = function (root, ctx) { render(root, ctx, "quarter"); };
  views.year = function (root, ctx) { render(root, ctx, "year"); };
  window.JournalViews = views;
})();
