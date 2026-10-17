/* Shared journal UI: folds, cards, read-only to-dos, and announcements.
   Fold buttons carry data-focus so the frame can put focus back after a
   re-render. Info buttons are not rendered. */
(function (global) {
  "use strict";

  var FOLD_KEY = "journal-folds";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function oneLine(parts) {
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var text = String(parts[i] == null ? "" : parts[i]).replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    }
    return out.join(" \u00b7 ");
  }

  function clip(text, max) {
    var value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length <= max) return value;
    return value.slice(0, max - 1).trim() + "\u2026";
  }

  // Display-only. Stored to-dos and reflection answers stay as typed.
  function plain(text) {
    var value = String(text == null ? "" : text);
    value = value.replace(/!\?|\?!/g, "?");
    value = value.replace(/!+(?=\s|$)/g, ".");
    value = value.replace(/!/g, "");
    return value;
  }

  function dots(value, max, label) {
    var empty = value == null;
    var count = Math.max(0, Math.round(Number(max) || 0));
    var filled = empty ? 0 : Math.round(Number(value));
    var span = el("span", empty ? "jn-dots is-empty" : "jn-dots");
    var name = String(label == null ? "" : label);
    var i;
    if (filled !== filled || filled < 0) filled = 0;
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", empty ? name + " not logged" : name + " " + filled + " of " + count);
    for (i = 0; i < count; i++) span.appendChild(el("span", !empty && i < filled ? "jn-dot on" : "jn-dot"));
    return span;
  }

  function chip(opts) {
    opts = opts || {};
    var node = el("span", "jn-chip");
    var emoji;
    if (opts.emoji) {
      emoji = el("span", "jn-chip-emoji", String(opts.emoji));
      emoji.setAttribute("aria-hidden", "true");
      node.appendChild(emoji);
    }
    if (opts.label) node.appendChild(el("span", "jn-chip-label", String(opts.label)));
    if (opts.label && (opts.max != null || opts.text != null)) node.appendChild(document.createTextNode(" "));
    if (opts.max != null) node.appendChild(dots(opts.value, opts.max, opts.label));
    else if (opts.text != null) node.appendChild(el("span", "jn-chip-text", String(opts.text)));
    return node;
  }

  function readFolds() {
    try {
      var data = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}");
      if (data && typeof data === "object" && !Array.isArray(data)) return data;
    } catch (e) {}
    return {};
  }

  function domId(prefix, id) {
    return prefix + "-" + String(id == null ? "" : id).replace(/[^A-Za-z0-9_-]+/g, "-");
  }

  // Closed by default. A heading holds a button with aria-expanded that
  // controls the panel, the same pattern as the current app.
  function fold(opts) {
    opts = opts || {};
    var title = String(opts.title || "Section");
    var line = String(opts.summary || title);
    var level = Number(opts.level);
    var id = String(opts.id || title);
    var emoji = opts.emoji ? String(opts.emoji) : "";
    var root = el("section", "card dx-card fold");
    var bar = el("div", "fold-bar");
    var heading;
    var button = el("button", "fold-summary");
    var body = el("div", "fold-body fold-panel");
    var lineNode = el("span", "fold-line", line);
    var emojiNode;
    var panelId = domId("panel", id);
    if (!(level >= 2 && level <= 6)) level = 3;
    heading = el("h" + level, "fold-heading");
    heading.id = panelId + "-label";
    button.type = "button";
    button.setAttribute("aria-controls", panelId);
    button.setAttribute("data-focus", "fold:" + id);
    if (emoji) {
      emojiNode = el("span", "fold-emoji", emoji);
      emojiNode.setAttribute("aria-hidden", "true");
      button.appendChild(emojiNode);
    }
    button.appendChild(lineNode);
    heading.appendChild(button);
    bar.appendChild(heading);
    body.id = panelId;
    root.setAttribute("data-fold", id);
    root.setAttribute("data-title", title);
    root.setAttribute("aria-labelledby", heading.id);
    root.appendChild(bar);
    root.appendChild(body);

    function apply(next, save) {
      var data;
      button.setAttribute("aria-expanded", next ? "true" : "false");
      body.hidden = !next;
      root.classList.toggle("is-open", next);
      if (next) root.setAttribute("open", "");
      else root.removeAttribute("open");
      if (save) {
        data = readFolds();
        if (next) data[id] = true;
        else delete data[id];
        try { localStorage.setItem(FOLD_KEY, JSON.stringify(data)); } catch (e) {}
        root.dispatchEvent(new Event("toggle"));
      }
    }

    Object.defineProperty(root, "open", {
      configurable: true,
      get: function () { return button.getAttribute("aria-expanded") === "true"; },
      set: function (value) { apply(!!value, true); }
    });
    button.addEventListener("click", function () {
      apply(!root.open, true);
    });
    apply(readFolds()[id] === true, false);
    return { root: root, body: body, line: lineNode };
  }

  // Always open: a section heading with one emoji, then the body.
  function card(opts) {
    opts = opts || {};
    var title = String(opts.title || "Section");
    var level = Number(opts.level);
    var root = el("section", "card dx-card jn-card");
    var heading;
    var emoji;
    var body = el("div", "jn-card-body");
    if (!(level >= 2 && level <= 6)) level = 3;
    heading = el("h" + level, "jn-card-title");
    heading.id = domId("card", opts.id || title);
    if (opts.emoji) {
      emoji = el("span", "fold-emoji", String(opts.emoji));
      emoji.setAttribute("aria-hidden", "true");
      heading.appendChild(emoji);
    }
    heading.appendChild(el("span", "jn-card-line", title));
    if (opts.id) root.setAttribute("data-card", String(opts.id));
    root.setAttribute("aria-labelledby", heading.id);
    root.appendChild(heading);
    root.appendChild(body);
    return { root: root, body: body, heading: heading };
  }

  // Display-only. The matched characters stay exactly as written.
  function markExpression() {
    var month = "January|February|March|April|June|July|August|September|October|November|December|Sept|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
    var day = "\\d{1,2}(?:st|nd|rd|th)?";
    var date = "(?:\\d{4}-\\d{2}-\\d{2}|" + day + "\\s+(?:" + month + ")(?:\\s+\\d{4})?|(?:" + month + ")\\s+" + day + "(?:,?\\s+\\d{4})?|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})";
    var time = "(?:[01]?\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?";
    var deadline = "\\b(?:expires|due|deadline)\\s+(?:on\\s+|by\\s+)?" + date + "\\b";
    return new RegExp("(" + deadline + "|\\b" + date + "\\b|\\b" + time + "(?!\\d))", "gi");
  }

  function appendMarked(parent, text) {
    var value = String(text == null ? "" : text);
    var re = markExpression();
    var last = 0;
    var match;
    if (!value) return;
    while ((match = re.exec(value))) {
      if (!match[0]) {
        re.lastIndex += 1;
        continue;
      }
      if (match.index > last) parent.appendChild(document.createTextNode(value.slice(last, match.index)));
      parent.appendChild(el("span", "jn-mark", match[0]));
      last = match.index + match[0].length;
    }
    if (last === 0) parent.appendChild(document.createTextNode(value));
    else if (last < value.length) parent.appendChild(document.createTextNode(value.slice(last)));
  }

  // Lines that start with "- " become a list. The marker is not shown.
  function fillText(parent, text, opts) {
    var value = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var lines = value.split("\n");
    var copyClass = opts && opts.copyClass ? opts.copyClass : "day-copy";
    var listClass = opts && opts.listClass ? opts.listClass : "day-list";
    var pill = !!(opts && opts.pill);
    var i = 0;
    var list;
    var item;
    var block;
    var buf;
    var j;
    while (i < lines.length) {
      if (!String(lines[i]).trim()) {
        i += 1;
        continue;
      }
      if (/^\s*-\s+/.test(lines[i])) {
        list = el("ul", listClass);
        while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
          item = el("li");
          appendMarked(item, String(lines[i]).replace(/^\s*-\s+/, ""));
          list.appendChild(item);
          i += 1;
        }
        parent.appendChild(list);
        continue;
      }
      buf = [];
      while (i < lines.length && String(lines[i]).trim() && !/^\s*-\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      block = el("p", pill ? "day-focus-pill" : copyClass);
      for (j = 0; j < buf.length; j++) {
        if (j) block.appendChild(el("br"));
        appendMarked(block, buf[j]);
      }
      parent.appendChild(block);
    }
  }

  // The circled info buttons were removed. Nothing in the journal renders one.
  function info() {
    return null;
  }

  function announce(text) {
    var region = document.getElementById("announce");
    if (!region) return;
    region.textContent = "";
    global.setTimeout(function () {
      region.textContent = String(text || "");
    }, 30);
  }

  var GOAL_STATUS = { none: "Not started", progress: "In progress", done: "Done", paused: "Paused" };

  function todoText(todo) {
    return String(todo && todo.text != null ? todo.text : "");
  }

  // Read-only. Dong's text is shown exactly as stored.
  function todoList(container, key, opts) {
    var goals;
    var todos;
    var list;
    opts = opts || {};
    goals = !!(opts.yearStatus || opts.status);
    todos = (global.JournalData.todos(key) || []).filter(function (todo) { return todoText(todo).trim(); });
    container.textContent = "";
    if (!todos.length) {
      container.appendChild(el("p", "empty-line", goals ? "No goals yet." : "No to-dos yet."));
      return;
    }
    list = el("ul", "todo-list");
    todos.forEach(function (todo) {
      var done = todo.done === true || todo.status === "done";
      var item = el("li", done ? "todo done" : "todo");
      var mark = el("span", "todo-mark", done ? "\u2713" : "");
      var text = el("span", "todo-text", todoText(todo));
      mark.setAttribute("aria-hidden", "true");
      text.setAttribute("data-own", "todo");
      item.setAttribute("data-todo", String(todo.id || ""));
      item.appendChild(mark);
      item.appendChild(el("span", "sr-only", done ? "Done: " : "Open: "));
      item.appendChild(text);
      if (goals && GOAL_STATUS[todo.status]) item.appendChild(el("span", "todo-status", GOAL_STATUS[todo.status]));
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  global.JournalUI = {
    el: el,
    oneLine: oneLine,
    clip: clip,
    plain: plain,
    appendMarked: appendMarked,
    fillText: fillText,
    dots: dots,
    chip: chip,
    STATUS: { error: "is-error", done: "is-done", miss: "is-miss", unknown: "is-unknown" },
    fold: fold,
    info: info,
    todoList: todoList,
    announce: announce,
    card: card
  };
})(window);
