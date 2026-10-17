/* Read-only sync for journal.json. It GETs the file from progress-sync on
   open, on focus, and every minute, keeps the last copy in a local cache,
   and never writes to GitHub. Robin edits journal.json; this page only shows
   it. Old local keys (journal-next-ops, journal-v1) are never read or
   changed. */
(function () {
  "use strict";

  var CACHE_KEY = "journal-next-cache";
  var BACKUP_KEY = "journal-next-backup";
  var TOKEN_KEY = "dong-gh-sync";
  var DEFAULT_REPO = "Dong-Xuyong/progress-sync";

  var memoryStore = Object.create(null);
  var memoryStorage = {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    },
    setItem: function (key, value) { memoryStore[key] = String(value); },
    removeItem: function (key) { delete memoryStore[key]; }
  };

  var stateName = "idle";
  var listeners = [];
  var tail = Promise.resolve();

  function storage() {
    try {
      if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function") return localStorage;
    } catch (e) {}
    return memoryStorage;
  }

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function dataApi() {
    if (typeof window !== "undefined" && window.JournalData) return window.JournalData;
    if (typeof JournalData !== "undefined") return JournalData;
    return null;
  }

  function emit() {
    var i;
    for (i = 0; i < listeners.length; i++) {
      try { listeners[i](stateName); } catch (e) {}
    }
  }

  function setStatus(next) {
    stateName = next;
    emit();
  }

  function show(doc) {
    var data = dataApi();
    var before;
    if (!data || typeof data.load !== "function") return;
    before = typeof data.version === "function" ? data.version() : null;
    data.load(doc);
    if (before != null && data.version() !== before) emit();
  }

  function loadCache() {
    try {
      var raw = storage().getItem(CACHE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (isRecord(parsed)) return parsed;
    } catch (e) {}
    return { version: 1, entries: {}, quotes: {} };
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
      var cfg = JSON.parse(storage().getItem(TOKEN_KEY) || "null");
      if (!cfg || typeof cfg.token !== "string" || !cfg.token.trim()) return null;
      return {
        token: cfg.token.trim(),
        repo: typeof cfg.repo === "string" && cfg.repo.trim() ? cfg.repo.trim() : DEFAULT_REPO
      };
    } catch (e) {
      return null;
    }
  }

  function fromBase64(b64) {
    var clean = String(b64).replace(/\s/g, "");
    if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(clean, "base64").toString("utf8");
    return decodeURIComponent(escape(atob(clean)));
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
    return fetch("https://api.github.com/repos/" + cfg.repo + "/contents/journal.json", {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json" }
    }).then(function (res) {
      if (!res.ok) throw httpError(res.status, false);
      return res.json();
    }, function () {
      throw httpError(0, true);
    });
  }

  function pull() {
    var cfg = readConfig();
    if (!cfg) return Promise.resolve(stateName);
    return exclusive(function () {
      return getFile(cfg).then(function (file) {
        var rawText = file && typeof file.content === "string" ? fromBase64(file.content) : null;
        var parsed;
        if (rawText == null) throw httpError(0, false);
        parsed = JSON.parse(rawText);
        if (!isRecord(parsed)) throw httpError(0, false);
        rememberBackup(rawText);
        storage().setItem(CACHE_KEY, rawText);
        show(parsed);
        setStatus("synced");
        return stateName;
      }).catch(function (err) {
        setStatus(err && err.offline ? "offline" : "error");
        return stateName;
      });
    });
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

  show(loadCache());

  try {
    if (typeof document !== "undefined" && document && typeof document.addEventListener === "function") {
      setTimeout(function () { pull(); }, 0);
    }
  } catch (e) {}

  var api = { pull: pull, onChange: onChange, status: status };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalSync = api;
})();
