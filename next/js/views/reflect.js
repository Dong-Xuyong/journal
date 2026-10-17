/* Reflections. Append-only answers. JournalData, JournalOps, and JournalUI
   come from builders 1 and 2; the spec stubs those signatures. */
(function () {
  "use strict";

  var DEFAULT_QUESTIONS = [
    { id: "q1", text: "If I knew I couldn't fail, what would I like to do?" },
    { id: "q2", text: "Even if I knew I would fail, what would I like to do anyway?" },
    { id: "q3", text: "If I had all the time and money in the world, but I had to use 40 hours a week to be of service to other people, what would I do?" },
    { id: "q4", text: "If I was giving a TED talk 40 years from now and the audience is giving it a standing ovation, what would I like to have talked about?" },
    { id: "q5", text: "What do I want people to say about me at my funeral?" },
    { id: "q6", text: "What do I want written about myself in my obituary?" },
    { id: "q7", text: "If I continued on this exact path, where would I end up five years from now? And is that where I want to end up?" },
    { id: "q8", text: "If I took a completely different path to what I'm doing right now, where might I end up five years from now?" },
    { id: "q9", text: "If I took a completely different path and did not care about money or what other people thought of me, where might I end up?" }
  ];

  var mounts = [];
  var listening = false;

  function apis() {
    if (!window.JournalData || !window.JournalOps || !window.JournalUI || !window.JournalUI.fold || !window.JournalUI.announce) {
      throw new Error("JournalReflect needs JournalData, JournalOps, and JournalUI");
    }
  }

  function ensureCss() {
    var nodes = document.getElementsByTagName("link");
    var scripts;
    var href;
    var i;
    var link;
    for (i = 0; i < nodes.length; i++) {
      href = nodes[i].getAttribute("href") || "";
      if (href.indexOf("reflect.css") !== -1) return;
    }
    scripts = document.getElementsByTagName("script");
    href = "css/reflect.css";
    for (i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].getAttribute("src") || "";
      if (src.indexOf("reflect.js") !== -1) {
        href = src.replace("js/views/reflect.js", "css/reflect.css");
        break;
      }
    }
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function addClass(el, name) {
    var current = el.className ? String(el.className) : "";
    if ((" " + current + " ").indexOf(" " + name + " ") === -1) {
      el.className = current ? current + " " + name : name;
    }
  }

  function defaultQuestions() {
    return JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
  }

  function readData() {
    var raw = window.JournalData.reflections();
    var questions = raw && raw.questions && raw.questions.length ? raw.questions : defaultQuestions();
    var answers = raw && raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers) ? raw.answers : {};
    return { questions: questions, answers: answers };
  }

  function reflectionIndex(day, count) {
    var n = count > 0 ? count : DEFAULT_QUESTIONS.length;
    var text = String(day || "");
    var days = Math.floor(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10))) / 86400000);
    if (days !== days) return 0;
    return ((days % n) + n) % n;
  }

  function pickQuestion(questions, day) {
    var picked = null;
    var index = -1;
    var i;
    if (typeof window.JournalData.questionOfDay === "function") picked = window.JournalData.questionOfDay(day);
    if (picked && picked.id) {
      for (i = 0; i < questions.length; i++) {
        if (questions[i].id === picked.id) {
          index = i;
          break;
        }
      }
    }
    if (index < 0) index = reflectionIndex(day, questions.length);
    if (!questions.length) return null;
    if (index < 0 || index >= questions.length) index = 0;
    return { question: questions[index], number: index + 1 };
  }

  function answerList(answers, id) {
    var list = answers ? answers[id] : null;
    return Array.isArray(list) ? list : [];
  }

  function inYear(item, year) {
    return String(item && item.date || "").slice(0, 4) === String(year);
  }

  function newestFirst(list, year) {
    var rows = [];
    var out = [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (year && !inYear(list[i], year)) continue;
      rows.push({ item: list[i], index: i });
    }
    rows.sort(function (a, b) {
      var ad = String(a.item && a.item.date || "");
      var bd = String(b.item && b.item.date || "");
      if (ad < bd) return 1;
      if (ad > bd) return -1;
      return b.index - a.index;
    });
    for (i = 0; i < rows.length; i++) out.push(rows[i].item);
    return out;
  }

  function countAnswered(questions, answers, year) {
    var total = 0;
    var i;
    var list;
    for (i = 0; i < questions.length; i++) {
      list = year ? newestFirst(answerList(answers, questions[i].id), year) : answerList(answers, questions[i].id);
      if (list.length) total += 1;
    }
    return total;
  }

  function answerPhrase(n) {
    return n === 1 ? "1 answer" : String(n) + " answers";
  }

  function dateLabel(date) {
    var label = "";
    if (window.JournalData && typeof window.JournalData.label === "function") {
      label = window.JournalData.label(date) || "";
    }
    return label || String(date || "");
  }

  function makeFold(spec) {
    var folded = window.JournalUI.fold({
      id: spec.id,
      title: spec.title,
      level: spec.level,
      summary: spec.summary
    });
    addClass(folded.root, "reflect-fold");
    if (spec.extraClass) addClass(folded.root, spec.extraClass);
    folded.root.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    return folded;
  }

  function history(list, emptyText) {
    var ul;
    var i;
    var li;
    var when;
    if (!list.length) return node("p", "reflect-empty", emptyText);
    ul = node("ul", "reflect-answers");
    for (i = 0; i < list.length; i++) {
      li = document.createElement("li");
      when = node("time", "reflect-when", dateLabel(list[i] && list[i].date));
      if (list[i] && list[i].date) when.setAttribute("datetime", String(list[i].date));
      li.appendChild(when);
      li.appendChild(node("p", "reflect-answer", String(list[i] && list[i].text != null ? list[i].text : "")));
      ul.appendChild(li);
    }
    return ul;
  }

  function domId(scope, id) {
    return "reflect-" + scope + "-" + String(id || "").replace(/[^A-Za-z0-9_-]/g, "-");
  }

  function commit(id, value, date, note) {
    var text = String(value || "").replace(/^\s+|\s+$/g, "");
    var added;
    if (!text) {
      if (note) {
        note.hidden = false;
        note.textContent = "Write an answer first.";
      }
      window.JournalUI.announce("Write an answer first.");
      return;
    }
    added = window.JournalOps.appendAnswer(id, { date: date, text: text });
    if (added === false) {
      if (note) {
        note.hidden = false;
        note.textContent = "That answer is already saved.";
      }
      window.JournalUI.announce("That answer is already saved.");
      return;
    }
    window.JournalUI.announce("Answer saved.");
  }

  function editor(question, number, date, scope) {
    var wrap = node("div", "reflect-editor");
    var label = node("label", "reflect-field");
    var box = node("textarea", "reflect-box");
    var actions = node("div", "reflect-actions");
    var save = node("button", "dx-btn reflect-save", "Save");
    var note = node("p", "reflect-note");
    var fieldId = domId(scope, question.id);
    box.id = fieldId;
    box.rows = 4;
    box.setAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
    label.setAttribute("for", fieldId);
    label.appendChild(node("span", "reflect-question", question.text || ""));
    label.appendChild(box);
    save.type = "button";
    save.setAttribute("aria-label", "Save answer for question " + number);
    note.hidden = true;
    actions.appendChild(save);
    actions.appendChild(note);
    wrap.appendChild(label);
    wrap.appendChild(actions);
    function run() {
      commit(question.id, box.value, date, note);
    }
    save.addEventListener("click", run);
    box.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        run();
      }
    });
    return wrap;
  }

  function buildDay(day) {
    var data = readData();
    var picked = pickQuestion(data.questions, day);
    var answered = countAnswered(data.questions, data.answers, null);
    var line = "Reflection · today: Q" + (picked ? picked.number : 0) + " · " + answered + " answered";
    var folded = makeFold({
      id: "day:reflection",
      title: "Reflection",
      level: 3,
      summary: line
    });
    var today;
    var allLine;
    var all;
    var i;
    var item;
    var list;
    var qLine;
    var qFold;
    folded.root.setAttribute("data-reflect", "day");
    if (!picked) return folded.root;
    folded.root.setAttribute("data-question-id", picked.question.id);
    today = node("div", "reflect-today");
    today.appendChild(node("p", "reflect-kicker", "Question " + picked.number + " of " + data.questions.length));
    today.appendChild(editor(picked.question, picked.number, day, "today"));
    today.appendChild(history(newestFirst(answerList(data.answers, picked.question.id), null), "No answer yet."));
    folded.body.appendChild(today);
    allLine = "All " + data.questions.length + (data.questions.length === 1 ? " question" : " questions");
    all = makeFold({
      id: "day:reflection-all",
      title: allLine,
      level: 4,
      summary: allLine
    });
    addClass(all.root, "reflect-all");
    for (i = 0; i < data.questions.length; i++) {
      item = data.questions[i];
      list = answerList(data.answers, item.id);
      qLine = "Question " + (i + 1) + " · " + answerPhrase(list.length);
      qFold = makeFold({
        id: "day:reflection:" + item.id,
        title: "Question " + (i + 1),
        level: 5,
        summary: qLine
      });
      qFold.root.setAttribute("data-question-id", item.id);
      qFold.root.setAttribute("data-question-number", String(i + 1));
      qFold.body.appendChild(editor(item, i + 1, day, "q"));
      qFold.body.appendChild(history(newestFirst(list, null), "No answer yet."));
      all.body.appendChild(qFold.root);
    }
    folded.body.appendChild(all.root);
    return folded.root;
  }

  function buildYear(year) {
    var data = readData();
    var answered = countAnswered(data.questions, data.answers, year);
    var line = "Reflection · " + year + " · " + answered + " answered";
    var folded = makeFold({
      id: "year:reflection:" + year,
      title: "Reflection",
      level: 3,
      summary: line
    });
    var i;
    var item;
    var list;
    var qLine;
    var qFold;
    var digest;
    folded.root.setAttribute("data-reflect", "year");
    folded.root.setAttribute("data-year", year);
    for (i = 0; i < data.questions.length; i++) {
      item = data.questions[i];
      list = newestFirst(answerList(data.answers, item.id), year);
      qLine = "Question " + (i + 1) + " · " + answerPhrase(list.length);
      qFold = makeFold({
        id: "year:reflection:" + year + ":" + item.id,
        title: "Question " + (i + 1),
        level: 4,
        summary: qLine
      });
      qFold.root.setAttribute("data-question-id", item.id);
      qFold.root.setAttribute("data-question-number", String(i + 1));
      digest = node("div", "reflect-digest");
      digest.appendChild(node("p", "reflect-question", item.text || ""));
      digest.appendChild(node("p", "reflect-count", answerPhrase(list.length) + " in " + year));
      if (!list.length) digest.appendChild(node("p", "reflect-empty", "No answer this year."));
      else digest.appendChild(history([list[0]], "No answer this year."));
      qFold.body.appendChild(digest);
      folded.body.appendChild(qFold.root);
    }
    return folded.root;
  }

  function render(record) {
    var container = record.container;
    var options = record.options || {};
    var root;
    while (container.firstChild) container.removeChild(container.firstChild);
    if (options.mode === "year") root = buildYear(String(options.year || ""));
    else root = buildDay(String(options.day || ""));
    container.appendChild(root);
  }

  function mount(container, options) {
    var record = null;
    var i;
    apis();
    ensureCss();
    for (i = 0; i < mounts.length; i++) {
      if (mounts[i].container === container) {
        record = mounts[i];
        record.options = options || {};
        break;
      }
    }
    if (!record) {
      record = { container: container, options: options || {} };
      mounts.push(record);
    }
    if (!listening) {
      listening = true;
      window.JournalOps.onChange(function () {
        var n;
        for (n = 0; n < mounts.length; n++) render(mounts[n]);
      });
    }
    render(record);
  }

  window.JournalReflect = { mount: mount };
})();
