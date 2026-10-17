/* Shared journal UI: folds, to-dos, citations, and announcements. */
(function (global) {
  "use strict";

  var FOLD_KEY = "journal-folds";
  var tipOpen = null;
  var pendingDelete = Object.create(null);
  var citeSeq = 0;

  var CITES = {
    focus: "Name the one thing that would make today count.",
    grateful: "Write three things you are glad for. Keep them specific.",
    mood: "A number from 1 to 5. 1 is low, 5 is high.",
    energy: "A number from 1 to 5 for how much energy you have.",
    lesson: "What you would do differently next time.",
    wins: "Name the effort, not only the result.",
    priorities: "Up to three things that matter most today.",
    habits: "Done, missed, and not marked are three different states.",
    goals: "Thesis, career, and health, each with a score from 1 to 5."
  };

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

  function readFolds() {
    try {
      var data = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}");
      if (data && typeof data === "object" && !Array.isArray(data)) return data;
    } catch (e) {}
    return {};
  }

  function writeFolds(data) {
    localStorage.setItem(FOLD_KEY, JSON.stringify(data));
  }

  function fold(opts) {
    opts = opts || {};
    var title = String(opts.title || "Section");
    var line = String(opts.summary || title);
    var level = Number(opts.level);
    var id = opts.id || line;
    var root = el("details", "card dx-card fold");
    var summary = el("summary", "fold-summary");
    var heading;
    var body = el("div", "fold-body");
    if (level < 2 || level > 6) level = 3;
    heading = el("h" + level, "fold-line", line);
    root.setAttribute("data-fold", id);
    root.setAttribute("data-title", title);
    summary.appendChild(heading);
    root.appendChild(summary);
    root.appendChild(body);
    root.open = readFolds()[id] === true;
    root.addEventListener("toggle", function () {
      var data = readFolds();
      if (root.open) data[id] = true;
      else delete data[id];
      writeFolds(data);
    });
    return { root: root, body: body };
  }

  function closeTip() {
    if (!tipOpen) return;
    tipOpen.tip.hidden = true;
    tipOpen.btn.setAttribute("aria-expanded", "false");
    tipOpen = null;
  }

  function info(citeKey) {
    var wrap = el("span", "info-wrap");
    var btn = el("button", "info-btn dx-btn dx-btn--ghost", "Why this is here");
    var tip = el("span", "info-tip");
    var key = String(citeKey || "");
    var sentence = CITES[key] || "A short note on why this prompt is here.";
    citeSeq += 1;
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "info-tip-" + citeSeq);
    tip.id = "info-tip-" + citeSeq;
    tip.hidden = true;
    tip.setAttribute("role", "tooltip");
    tip.textContent = sentence;
    btn.addEventListener("click", function (event) {
      var opening;
      event.stopPropagation();
      opening = tip.hidden;
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
    if (event.key === "Escape") closeTip();
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
    area.style.height = "auto";
    area.style.height = Math.max(44, area.scrollHeight) + "px";
  }

  function todoText(todo) {
    return String(todo && todo.text || "").trim();
  }

  function paintTodos(container, key, opts) {
    var todos = global.JournalData.todos(key);
    var list = el("ul", "todo-list");
    var undoList = el("ul", "undo-list");
    var add = el("button", "add-todo dx-btn dx-btn--ghost", "Add to-do");
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
      var label;
      if (!pending || pending.key !== key) return;
      row = el("li", "undo-row");
      label = el("span", "", "Deleted " + (pending.text || "a to-do") + ".");
      btn = el("button", "dx-btn dx-btn--ghost", "Undo");
      btn.type = "button";
      btn.setAttribute("aria-label", "Undo delete " + (pending.text || "to-do"));
      btn.addEventListener("click", function () {
        global.clearTimeout(pending.timer);
        delete pendingDelete[token];
        announce("Restored " + (pending.text || "to-do") + ".");
        paintTodos(container, key, opts);
      });
      row.appendChild(label);
      row.appendChild(btn);
      undoList.appendChild(row);
    });
    add.type = "button";
    add.addEventListener("click", function () {
      var todo = { id: uid(), text: "", done: false };
      if (opts.yearStatus) todo.status = "none";
      global.JournalOps.todoAdd(key, todo);
    });
    if (undoList.childNodes.length) container.appendChild(undoList);
    container.appendChild(list);
    container.appendChild(add);
  }

  function todoItem(container, key, todo, opts) {
    var item = el("li", "todo");
    var check = el("input", "todo-check");
    var area = el("textarea");
    var del = el("button", "del dx-btn dx-btn--ghost", "Delete");
    var text = todoText(todo);
    check.type = "checkbox";
    check.checked = !!todo.done;
    check.setAttribute("aria-label", text || "To-do");
    area.rows = 1;
    area.value = todo.text || "";
    area.placeholder = "Write a to-do";
    area.setAttribute("aria-label", text ? "Edit to-do " + text : "Edit to-do");
    del.type = "button";
    del.setAttribute("aria-label", "Delete " + (text || "to-do"));
    check.addEventListener("change", function () {
      global.JournalOps.todoPatch(key, todo.id, { done: check.checked });
    });
    area.addEventListener("input", function () {
      var next = area.value;
      var trimmed = next.trim();
      grow(area);
      check.setAttribute("aria-label", trimmed || "To-do");
      area.setAttribute("aria-label", trimmed ? "Edit to-do " + trimmed : "Edit to-do");
      del.setAttribute("aria-label", "Delete " + (trimmed || "to-do"));
      global.JournalOps.todoPatch(key, todo.id, { text: next });
    });
    del.addEventListener("click", function () {
      var token = key + "\n" + todo.id;
      var pending = pendingDelete[token];
      if (pending) global.clearTimeout(pending.timer);
      pendingDelete[token] = {
        key: key,
        text: text || area.value.trim(),
        timer: global.setTimeout(function () {
          delete pendingDelete[token];
          global.JournalOps.todoRemove(key, todo.id);
        }, 10000)
      };
      announce("Deleted " + (text || "to-do") + ". Undo is available for 10 seconds.");
      paintTodos(container, key, opts);
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
    group.setAttribute("aria-label", "Year status for " + text);
    choices.forEach(function (choice, index) {
      var btn = el("button", "", choice[1]);
      var selected = current === choice[0];
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", selected ? "true" : "false");
      btn.tabIndex = selected || (index === 0 && !current) ? 0 : -1;
      if (current && selected) btn.tabIndex = 0;
      if (!current && index === 0) btn.tabIndex = 0;
      btn.addEventListener("click", function () {
        global.JournalOps.todoPatch(key, todo.id, { status: choice[0] });
      });
      btn.addEventListener("keydown", function (event) {
        var next = index;
        if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") return;
        event.preventDefault();
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % choices.length;
        else next = (index + choices.length - 1) % choices.length;
        global.JournalOps.todoPatch(key, todo.id, { status: choices[next][0] });
      });
      group.appendChild(btn);
    });
    return group;
  }

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }

  function todoList(container, key, opts) {
    opts = opts || {};
    paintTodos(container, key, opts);
  }

  global.JournalUI = {
    el: el,
    oneLine: oneLine,
    fold: fold,
    info: info,
    todoList: todoList,
    announce: announce
  };
})(window);
