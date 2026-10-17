/* Shared journal UI: folds, to-dos, citations, and announcements.
   Every interactive element carries data-focus so the frame can put focus
   back after a re-render. */
(function (global) {
  "use strict";

  var FOLD_KEY = "journal-folds";
  var tipOpen = null;
  var pendingDelete = Object.create(null);
  var wantedFocus = null;
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

  function wantFocus(key) {
    wantedFocus = key || null;
  }

  function takeFocus() {
    var key = wantedFocus;
    wantedFocus = null;
    return key;
  }

  // Closed by default. A heading holds a button with aria-expanded that
  // controls the panel, the same pattern as the current app.
  function fold(opts) {
    opts = opts || {};
    var title = String(opts.title || "Section");
    var line = String(opts.summary || title);
    var level = Number(opts.level);
    var id = String(opts.id || title);
    var root = el("section", "card dx-card fold");
    var bar = el("div", "fold-bar");
    var heading;
    var button = el("button", "fold-summary");
    var body = el("div", "fold-body fold-panel");
    var panelId = domId("panel", id);
    if (!(level >= 2 && level <= 6)) level = 3;
    heading = el("h" + level, "fold-heading");
    heading.id = panelId + "-label";
    button.type = "button";
    button.setAttribute("aria-controls", panelId);
    button.setAttribute("data-focus", "fold:" + id);
    button.appendChild(el("span", "fold-line", line));
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
    return { root: root, body: body, line: button.firstChild };
  }

  function citation(key) {
    var cite = global.JournalGamify && typeof global.JournalGamify.cite === "function" ? global.JournalGamify.cite(key) : null;
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
      tip.appendChild(el("span", "info-text", cite.text));
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

  function grow(area) {
    if (!area.offsetParent) return;
    area.style.height = "auto";
    area.style.height = Math.max(44, area.scrollHeight) + "px";
  }

  function todoText(todo) {
    return String(todo && todo.text || "").trim();
  }

  function focusId(key, id, part) {
    return "todo:" + key + ":" + id + ":" + part;
  }

  function paintTodos(container, key, opts) {
    var todos = global.JournalData.todos(key) || [];
    var list = el("ul", "todo-list");
    var undoList = el("ul", "undo-list");
    var add = el("button", "add-todo dx-btn dx-btn--ghost", opts.yearStatus ? "Add a goal" : "Add a to-do");
    var i;
    container.textContent = "";
    for (i = 0; i < todos.length; i++) {
      if (pendingDelete[key + "\n" + todos[i].id]) continue;
      list.appendChild(todoItem(container, key, todos[i], opts));
    }
    Object.keys(pendingDelete).forEach(function (token) {
      var pending = pendingDelete[token];
      var row;
      var btn;
      if (!pending || pending.key !== key) return;
      row = el("li", "undo-row");
      row.appendChild(el("span", "", "Deleted " + (pending.text || "a to-do") + "."));
      btn = el("button", "dx-btn dx-btn--ghost", "Undo");
      btn.type = "button";
      btn.setAttribute("aria-label", "Undo delete " + (pending.text || "to-do"));
      btn.setAttribute("data-focus", "undo:" + token);
      btn.addEventListener("click", function () {
        global.clearTimeout(pending.timer);
        delete pendingDelete[token];
        announce("Restored " + (pending.text || "to-do") + ".");
        wantFocus(focusId(key, pending.id, "text"));
        paintTodos(container, key, opts);
        global.setTimeout(function () {
          var target = container.querySelector('[data-focus="' + focusId(key, pending.id, "text") + '"]');
          if (target) target.focus();
          takeFocus();
        }, 0);
      });
      row.appendChild(btn);
      undoList.appendChild(row);
    });
    add.type = "button";
    add.setAttribute("data-focus", "todo-add:" + key);
    add.addEventListener("click", function () {
      var todo = { id: uid(), text: "", done: false };
      if (opts.yearStatus) todo.status = "none";
      wantFocus(focusId(key, todo.id, "text"));
      global.JournalOps.todoAdd(key, todo);
    });
    if (undoList.childNodes.length) container.appendChild(undoList);
    if (todos.length) container.appendChild(list);
    else container.appendChild(el("p", "empty-line", opts.yearStatus ? "No goals yet." : "No to-dos yet."));
    container.appendChild(add);
  }

  function todoItem(container, key, todo, opts) {
    var item = el("li", todo.done ? "todo done" : "todo");
    var check = el("input", "todo-check");
    var area = el("textarea");
    var del = el("button", "del dx-btn dx-btn--ghost", "Delete");
    var text = todoText(todo);
    check.type = "checkbox";
    check.checked = !!todo.done;
    check.setAttribute("aria-label", (text || "To-do") + ", done");
    check.setAttribute("data-focus", focusId(key, todo.id, "check"));
    area.rows = 1;
    area.value = todo.text || "";
    area.placeholder = opts.yearStatus ? "Write a goal" : "Write a to-do";
    area.setAttribute("aria-label", text ? "Edit " + text : "New to-do");
    area.setAttribute("data-focus", focusId(key, todo.id, "text"));
    del.type = "button";
    del.setAttribute("aria-label", "Delete " + (text || "to-do"));
    del.setAttribute("data-focus", focusId(key, todo.id, "del"));
    check.addEventListener("change", function () {
      var patch = { done: check.checked };
      if (opts.yearStatus) patch.status = check.checked ? "done" : "progress";
      global.JournalOps.todoPatch(key, todo.id, patch);
    });
    area.addEventListener("keydown", function (event) {
      if (event.key === "Enter") event.preventDefault();
    });
    area.addEventListener("input", function () {
      var next = area.value.replace(/\n/g, " ");
      if (next !== area.value) area.value = next;
      grow(area);
      global.JournalOps.todoPatch(key, todo.id, { text: next });
    });
    del.addEventListener("click", function () {
      var token = key + "\n" + todo.id;
      var pending = pendingDelete[token];
      if (pending) global.clearTimeout(pending.timer);
      pendingDelete[token] = {
        key: key,
        id: todo.id,
        text: text || area.value.trim(),
        timer: global.setTimeout(function () {
          delete pendingDelete[token];
          global.JournalOps.todoRemove(key, todo.id);
        }, 10000)
      };
      announce("Deleted " + (text || "to-do") + ". Undo is there for 10 seconds.");
      wantFocus("undo:" + token);
      paintTodos(container, key, opts);
      global.setTimeout(function () {
        var target = container.querySelector('[data-focus="undo:' + token.replace(/["\\]/g, "\\$&") + '"]');
        if (target) target.focus();
        takeFocus();
      }, 0);
    });
    item.appendChild(check);
    item.appendChild(area);
    item.appendChild(del);
    if (opts.yearStatus) item.appendChild(statusGroup(key, todo));
    global.setTimeout(function () { grow(area); }, 0);
    return item;
  }

  function statusGroup(key, todo) {
    var group = el("div", "year-status");
    var choices = [
      ["none", "Not started"],
      ["progress", "In progress"],
      ["done", "Done"],
      ["paused", "Paused"]
    ];
    var current = todo.status || "none";
    var text = todoText(todo) || "goal";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Status for " + text);
    function choose(value) {
      wantFocus(focusId(key, todo.id, "status:" + value));
      global.JournalOps.todoPatch(key, todo.id, { status: value, done: value === "done" });
    }
    choices.forEach(function (choice, index) {
      var btn = el("button", "", choice[1]);
      var selected = current === choice[0];
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", selected ? "true" : "false");
      btn.setAttribute("data-focus", focusId(key, todo.id, "status:" + choice[0]));
      btn.tabIndex = selected ? 0 : -1;
      btn.addEventListener("click", function () { choose(choice[0]); });
      btn.addEventListener("keydown", function (event) {
        var next;
        if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].indexOf(event.key) === -1) return;
        event.preventDefault();
        next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % choices.length : (index + choices.length - 1) % choices.length;
        choose(choices[next][0]);
      });
      group.appendChild(btn);
    });
    return group;
  }

  function uid() {
    return "t" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }

  function todoList(container, key, opts) {
    opts = opts || {};
    if (opts.status && !opts.yearStatus) opts.yearStatus = true;
    paintTodos(container, key, opts);
  }

  global.JournalUI = {
    el: el,
    oneLine: oneLine,
    clip: clip,
    fold: fold,
    info: info,
    todoList: todoList,
    announce: announce,
    wantFocus: wantFocus,
    takeFocus: takeFocus
  };
})(window);
