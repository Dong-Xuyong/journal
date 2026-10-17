/* Shared journal UI: folds, cards, read-only to-dos, citations, and
   announcements. Fold buttons carry data-focus so the frame can put focus
   back after a re-render. */
(function (global) {
  "use strict";

  var FOLD_KEY = "journal-folds";
  var tipOpen = null;
  var citeSeq = 0;

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

  function citation(key) {
    var cite = global.JournalCites && typeof global.JournalCites.cite === "function" ? global.JournalCites.cite(key) : null;
    if (!cite || !cite.text) return null;
    return cite;
  }

  function closeTip() {
    if (!tipOpen) return;
    tipOpen.tip.hidden = true;
    tipOpen.btn.setAttribute("aria-expanded", "false");
    tipOpen = null;
  }

  function info(citeKey) {
    var key = String(citeKey || "");
    var cite = citation(key);
    var wrap = el("span", "info-wrap");
    var btn = el("button", "info-btn", "\u24D8");
    var tip = el("span", "info-tip");
    citeSeq += 1;
    btn.type = "button";
    btn.setAttribute("aria-label", "Why this is here");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "info-tip-" + citeSeq);
    btn.setAttribute("data-cite", key);
    tip.id = "info-tip-" + citeSeq;
    tip.hidden = true;
    tip.setAttribute("role", "note");
    if (cite) {
      tip.appendChild(el("span", "info-text", plain(cite.text)));
      if (cite.title) tip.appendChild(el("span", "info-by", cite.title + (cite.by ? " (" + cite.by + ")" : "")));
    } else {
      tip.appendChild(el("span", "info-text", "A short note on why this prompt is here."));
    }
    btn.addEventListener("click", function (event) {
      var opening = tip.hidden;
      event.stopPropagation();
      closeTip();
      if (!opening) return;
      tip.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      tipOpen = { tip: tip, btn: btn };
    });
    wrap.appendChild(btn);
    wrap.appendChild(tip);
    return wrap;
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest(".info-wrap")) return;
    closeTip();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !tipOpen) return;
    var btn = tipOpen.btn;
    closeTip();
    btn.focus();
  });

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
