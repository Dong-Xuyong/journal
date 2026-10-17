/* Queued edits for journal.json. A save GETs the remote file, applies only
   the queue, and PUTs that result. It never writes the copy it has in memory,
   and it never reads or writes the current app's cache. */
(function () {
  "use strict";

  var OPS_KEY = "journal-next-ops";
  var CACHE_KEY = "journal-next-cache";
  var BACKUP_KEY = "journal-next-backup";
  var SAVE_DELAY = 2500;
  var DEFAULT_REPO = "Dong-Xuyong/progress-sync";

  var memoryStore = Object.create(null);
  var memoryStorage = {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    },
    setItem: function (key, value) { memoryStore[key] = String(value); },
    removeItem: function (key) { delete memoryStore[key]; }
  };

  function storage() {
    try {
      if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function") return localStorage;
    } catch (e) {}
    return memoryStorage;
  }

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value) {
    if (value == null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function dataApi() {
    if (typeof window !== "undefined" && window.JournalData) return window.JournalData;
    if (typeof JournalData !== "undefined") return JournalData;
    if (typeof require === "function") {
      try { return require("./data.js"); } catch (e) {}
    }
    return null;
  }

  function defaultQuestions() {
    var data = dataApi();
    if (data && typeof data.defaultQuestions === "function") return data.defaultQuestions();
    return [];
  }

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }

  function safeId(id) {
    return typeof id === "string" && id.length > 0 && id !== "__proto__" && id !== "constructor" && id !== "prototype";
  }

  function findTodo(list, id) {
    var i;
    for (i = 0; i < list.length; i++) {
      if (isRecord(list[i]) && list[i].id === id) return list[i];
    }
    return null;
  }

  function ensureEntries(doc) {
    if (!isRecord(doc.entries)) doc.entries = {};
    return doc.entries;
  }

  function applyAnswer(doc, op) {
    var answer = isRecord(op.answer) ? op.answer : {};
    var date = typeof answer.date === "string" ? answer.date : "";
    var text = typeof answer.text === "string" ? answer.text : "";
    if (!safeId(op.qid) || text.trim().length === 0) return;
    if (!isRecord(doc.reflections)) doc.reflections = {};
    var ref = doc.reflections;
    if (!Array.isArray(ref.questions) || ref.questions.length === 0) ref.questions = defaultQuestions();
    if (!isRecord(ref.answers)) ref.answers = {};
    var list = ref.answers[op.qid];
    if (!Array.isArray(list)) {
      list = [];
      ref.answers[op.qid] = list;
    }
    var i;
    for (i = 0; i < list.length; i++) {
      if (isRecord(list[i]) && list[i].date === date && list[i].text === text) return;
    }
    list.push({ date: date, text: text });
  }

  function applyTodoAdd(doc, op, now) {
    var todo = cloneJson(op.todo);
    if (!isRecord(todo) || !safeId(todo.id) || typeof op.key !== "string" || !op.key) return;
    var entries = ensureEntries(doc);
    var entry = entries[op.key];
    if (entry == null) {
      entry = { updatedAt: now, fields: {}, todos: [] };
      entries[op.key] = entry;
    }
    if (!isRecord(entry)) return;
    if (entry.todos == null) entry.todos = [];
    if (!Array.isArray(entry.todos)) return;
    if (findTodo(entry.todos, todo.id)) return;
    entry.todos.push(todo);
    entry.updatedAt = now;
  }

  function applyTodoPatch(doc, op, now) {
    if (typeof op.key !== "string" || !safeId(op.id) || !isRecord(op.patch)) return;
    var entries = isRecord(doc.entries) ? doc.entries : null;
    var entry = entries ? entries[op.key] : null;
    if (!isRecord(entry) || !Array.isArray(entry.todos)) return;
    var target = findTodo(entry.todos, op.id);
    if (!target) return;
    var keys = Object.keys(op.patch);
    var changed = false;
    var i;
    for (i = 0; i < keys.length; i++) {
      if (keys[i] === "id") continue;
      target[keys[i]] = op.patch[keys[i]];
      changed = true;
    }
    if (changed) entry.updatedAt = now;
  }

  function applyTodoRemove(doc, op, now) {
    if (typeof op.key !== "string" || !safeId(op.id)) return;
    var entries = isRecord(doc.entries) ? doc.entries : null;
    var entry = entries ? entries[op.key] : null;
    if (!isRecord(entry) || !Array.isArray(entry.todos)) return;
    var next = [];
    var removed = false;
    var i;
    for (i = 0; i < entry.todos.length; i++) {
      var item = entry.todos[i];
      if (isRecord(item) && item.id === op.id) {
        removed = true;
        continue;
      }
      next.push(item);
    }
    if (!removed) return;
    entry.todos = next;
    entry.updatedAt = now;
  }

  function applyOne(doc, op, now) {
    if (!op || typeof op.type !== "string") return;
    if (op.type === "appendAnswer") applyAnswer(doc, op);
    else if (op.type === "todoAdd") applyTodoAdd(doc, op, now);
    else if (op.type === "todoPatch") applyTodoPatch(doc, op, now);
    else if (op.type === "todoRemove") applyTodoRemove(doc, op, now);
  }

  function applyOps(raw, ops, nowIso) {
    var doc = isRecord(raw) ? cloneJson(raw) : { version: 1, entries: {}, quotes: {} };
    var now = typeof nowIso === "string" && nowIso ? nowIso : new Date().toISOString();
    var list = Array.isArray(ops) ? ops : [];
    var i;
    for (i = 0; i < list.length; i++) applyOne(doc, list[i], now);
    return doc;
  }

  var base = { version: 1, entries: {}, quotes: {} };
  var queue = [];
  var seq = 1;
  var stateName = "idle";
  var listeners = [];
  var timer = null;
  var inFlight = false;
  var inFlightPromise = null;
  var tail = Promise.resolve();

  function setStatus(next) {
    stateName = next;
    emit();
  }

  function emit() {
    var i;
    for (i = 0; i < listeners.length; i++) {
      try { listeners[i](stateName); } catch (e) {}
    }
  }

  function persistQueue() {
    var store = storage();
    if (!queue.length) {
      store.removeItem(OPS_KEY);
      return;
    }
    store.setItem(OPS_KEY, JSON.stringify({ v: 1, ops: queue }));
  }

  function loadQueue() {
    queue = [];
    try {
      var parsed = JSON.parse(storage().getItem(OPS_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.ops)) return;
      queue = parsed.ops;
      var i;
      for (i = 0; i < queue.length; i++) {
        if (queue[i] && typeof queue[i].seq === "number" && queue[i].seq >= seq) seq = queue[i].seq + 1;
      }
    } catch (e) {}
  }

  function loadBase() {
    base = { version: 1, entries: {}, quotes: {} };
    try {
      var raw = storage().getItem(CACHE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (isRecord(parsed)) base = parsed;
    } catch (e) {}
  }

  function refreshView() {
    var data = dataApi();
    if (data && typeof data.load === "function") data.load(applyOps(base, queue));
  }

  function rememberBackup(rawText) {
    var store = storage();
    try {
      if (store.getItem(BACKUP_KEY)) return;
      store.setItem(BACKUP_KEY, rawText);
    } catch (e) {}
  }

  function readConfig() {
    try {
      var cfg = JSON.parse(storage().getItem("dong-gh-sync") || "null");
      if (!cfg || typeof cfg.token !== "string" || !cfg.token.trim()) return null;
      return {
        token: cfg.token.trim(),
        repo: typeof cfg.repo === "string" && cfg.repo.trim() ? cfg.repo.trim() : DEFAULT_REPO
      };
    } catch (e) {
      return null;
    }
  }

  function toBase64(str) {
    if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(str, "utf8").toString("base64");
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64(b64) {
    var clean = String(b64).replace(/\s/g, "");
    if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(clean, "base64").toString("utf8");
    return decodeURIComponent(escape(atob(clean)));
  }

  function apiUrl(cfg, path) {
    return "https://api.github.com/repos/" + cfg.repo + "/contents/" + path;
  }

  function headers(cfg) {
    return {
      Authorization: "Bearer " + cfg.token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    };
  }

  function httpError(status, offline) {
    var err = new Error(offline ? "offline" : "GitHub " + status);
    err.status = status;
    err.offline = !!offline;
    return err;
  }

  function exclusive(fn) {
    var run = tail.then(function () { return fn(); }, function () { return fn(); });
    tail = run.then(function () { return null; }, function () { return null; });
    return run;
  }

  function getFile(cfg) {
    return fetch(apiUrl(cfg, "journal.json"), {
      method: "GET",
      cache: "no-store",
      headers: headers(cfg)
    }).then(function (res) {
      if (!res.ok) throw httpError(res.status, false);
      return res.json();
    }, function () {
      throw httpError(0, true);
    });
  }

  function decodeContent(file) {
    if (!file || typeof file.content !== "string" || typeof file.sha !== "string" || !file.sha) return null;
    return fromBase64(file.content);
  }

  function putFile(cfg, text, sha) {
    return fetch(apiUrl(cfg, "journal.json"), {
      method: "PUT",
      cache: "no-store",
      headers: headers(cfg),
      body: JSON.stringify({
        message: "Save journal progress",
        content: toBase64(text),
        sha: sha
      })
    }).then(function (res) {
      if (res.status === 409) throw httpError(409, false);
      if (!res.ok) throw httpError(res.status, false);
      return res.json().catch(function () { return {}; });
    }, function () {
      throw httpError(0, true);
    });
  }

  function saveOnce(cfg, snapshot, now) {
    return getFile(cfg).then(function (file) {
      var rawText = decodeContent(file);
      if (rawText == null) throw httpError(0, false);
      rememberBackup(rawText);
      var remote = JSON.parse(rawText);
      var applied = applyOps(remote, snapshot, now);
      var text = JSON.stringify(applied);
      if (text === JSON.stringify(remote)) {
        return { wrote: false, applied: remote, text: text, rawText: rawText };
      }
      return putFile(cfg, text, file.sha).then(function () {
        return { wrote: true, applied: applied, text: text, rawText: rawText };
      });
    });
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    stateName = "pending";
    emit();
    timer = setTimeout(function () {
      timer = null;
      flush();
    }, SAVE_DELAY);
  }

  function finishSave(result, maxSeq) {
    queue = queue.filter(function (op) { return op && op.seq > maxSeq; });
    persistQueue();
    if (result.wrote) {
      base = result.applied;
      storage().setItem(CACHE_KEY, result.text);
    } else if (result.rawText) {
      storage().setItem(CACHE_KEY, result.rawText);
      try { base = JSON.parse(result.rawText); } catch (e) { base = result.applied; }
    }
    refreshView();
    inFlight = false;
    inFlightPromise = null;
    if (queue.length) schedule();
    else setStatus("saved");
  }

  function failSave(err) {
    inFlight = false;
    inFlightPromise = null;
    setStatus(err && err.offline ? "offline" : "error");
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!queue.length) return Promise.resolve(stateName);
    if (inFlight) return inFlightPromise;
    var snapshot = queue.slice();
    var maxSeq = snapshot[snapshot.length - 1].seq;
    inFlight = true;
    setStatus("saving");
    inFlightPromise = exclusive(function () {
      var cfg = readConfig();
      if (!cfg) {
        failSave(httpError(0, true));
        return stateName;
      }
      var now = new Date().toISOString();
      return saveOnce(cfg, snapshot, now).catch(function (err) {
        if (err && err.status === 409) return saveOnce(cfg, snapshot, now);
        throw err;
      }).then(function (result) {
        finishSave(result, maxSeq);
        return stateName;
      }).catch(function (err) {
        failSave(err);
        return stateName;
      });
    });
    return inFlightPromise;
  }

  function pull() {
    var cfg = readConfig();
    if (!cfg) {
      if (queue.length && !inFlight) setStatus("offline");
      return Promise.resolve(stateName);
    }
    return exclusive(function () {
      return getFile(cfg).then(function (file) {
        var rawText = decodeContent(file);
        if (rawText == null) throw httpError(0, false);
        rememberBackup(rawText);
        storage().setItem(CACHE_KEY, rawText);
        var parsed = JSON.parse(rawText);
        if (isRecord(parsed)) base = parsed;
        refreshView();
        if (!inFlight && !queue.length && stateName !== "saved") setStatus("idle");
        return stateName;
      }).catch(function (err) {
        if (!inFlight && !queue.length) setStatus(err && err.offline ? "offline" : "error");
        return stateName;
      });
    });
  }

  function enqueue(op) {
    op.seq = seq;
    seq += 1;
    queue.push(op);
    persistQueue();
    refreshView();
    if (inFlight) return;
    var cfg = readConfig();
    if (!cfg) {
      stateName = "offline";
      emit();
      return;
    }
    schedule();
  }

  function todoAdd(key, todo) {
    var copy = isRecord(todo) ? cloneJson(todo) : {};
    if (!safeId(copy.id)) copy.id = uid();
    if (typeof copy.text !== "string") copy.text = "";
    if (typeof copy.done !== "boolean") copy.done = false;
    if (typeof key !== "string" || !key) return copy;
    enqueue({ type: "todoAdd", key: key, todo: copy });
    return copy;
  }

  function todoPatch(key, id, patch) {
    if (typeof key !== "string" || !safeId(id) || !isRecord(patch)) return;
    enqueue({ type: "todoPatch", key: key, id: id, patch: cloneJson(patch) });
  }

  function todoRemove(key, id) {
    if (typeof key !== "string" || !safeId(id)) return;
    enqueue({ type: "todoRemove", key: key, id: id });
  }

  function appendAnswer(qid, answer) {
    var date = answer && typeof answer.date === "string" ? answer.date : "";
    var text = answer && typeof answer.text === "string" ? answer.text : "";
    if (!safeId(qid) || text.trim().length === 0) return;
    enqueue({ type: "appendAnswer", qid: qid, answer: { date: date, text: text } });
  }

  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      var index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  function status() {
    return stateName;
  }

  loadBase();
  loadQueue();
  refreshView();
  if (queue.length) {
    if (readConfig()) schedule();
    else stateName = "offline";
  }

  try {
    if (typeof document !== "undefined" && document && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") flush();
      });
      setTimeout(function () { pull(); }, 0);
    }
  } catch (e) {}

  var api = {
    todoAdd: todoAdd,
    todoPatch: todoPatch,
    todoRemove: todoRemove,
    appendAnswer: appendAnswer,
    onChange: onChange,
    status: status,
    flush: flush,
    pull: pull,
    applyOps: applyOps
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalOps = api;
})();
