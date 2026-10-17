/* Reflections, read-only and always open on the main view. Answers are
   Dong's own text and are shown exactly as stored. */
(function () {
  "use strict";

  var REFLECT_EMOJI = "\uD83E\uDE9E";
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

  function apis() {
    if (!window.JournalData || !window.JournalUI || !window.JournalUI.card) {
      throw new Error("JournalReflect needs JournalData and JournalUI");
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

  function dateLabel(date) {
    var label = "";
    if (window.JournalData && typeof window.JournalData.label === "function") {
      label = window.JournalData.label(date) || "";
    }
    return label || String(date || "");
  }

  function shownQuestion(text) {
    return window.JournalUI.plain(String(text || ""));
  }

  function makeCard(id, title) {
    var made = window.JournalUI.card({ id: id, title: title, level: 3, emoji: REFLECT_EMOJI });
    addClass(made.root, "reflect-card");
    return made;
  }

  function history(list, emptyText) {
    var ul;
    var i;
    var li;
    var when;
    var answer;
    if (!list.length) return node("p", "reflect-empty", emptyText);
    ul = node("ul", "reflect-answers");
    for (i = 0; i < list.length; i++) {
      li = document.createElement("li");
      when = node("time", "reflect-when", dateLabel(list[i] && list[i].date));
      if (list[i] && list[i].date) when.setAttribute("datetime", String(list[i].date));
      li.appendChild(when);
      answer = node("p", "reflect-answer", String(list[i] && list[i].text != null ? list[i].text : ""));
      answer.setAttribute("data-own", "");
      li.appendChild(answer);
      ul.appendChild(li);
    }
    return ul;
  }

  function buildDay(day) {
    var data = readData();
    var picked = pickQuestion(data.questions, day);
    var made = makeCard("day:reflection", "Reflection");
    var body = made.body;
    made.root.setAttribute("data-reflect", "day");
    if (!picked) {
      body.appendChild(node("p", "reflect-empty", "No questions yet."));
      return made.root;
    }
    made.root.setAttribute("data-question-id", picked.question.id);
    body.appendChild(node("p", "reflect-kicker", "Question " + picked.number + " of " + data.questions.length));
    body.appendChild(node("p", "reflect-question", shownQuestion(picked.question.text || "")));
    body.appendChild(history(newestFirst(answerList(data.answers, picked.question.id), null), "No answer yet."));
    return made.root;
  }

  function buildYear(year) {
    var data = readData();
    var answered = countAnswered(data.questions, data.answers, year);
    var made = makeCard("year:reflection:" + year, "Reflection");
    var body = made.body;
    var i;
    var item;
    var list;
    var block;
    made.root.setAttribute("data-reflect", "year");
    made.root.setAttribute("data-year", year);
    body.appendChild(node("p", "reflect-kicker", answered + " of " + data.questions.length + " questions answered in " + year));
    for (i = 0; i < data.questions.length; i++) {
      item = data.questions[i];
      list = newestFirst(answerList(data.answers, item.id), year);
      if (!list.length) continue;
      block = node("div", "reflect-digest");
      block.setAttribute("data-question-id", item.id);
      block.setAttribute("data-question-number", String(i + 1));
      block.appendChild(node("p", "reflect-question", "Q" + (i + 1) + " " + shownQuestion(item.text || "")));
      block.appendChild(history([list[0]], ""));
      body.appendChild(block);
    }
    return made.root;
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
    apis();
    ensureCss();
    render({ container: container, options: options || {} });
  }

  window.JournalReflect = { mount: mount };
})();
