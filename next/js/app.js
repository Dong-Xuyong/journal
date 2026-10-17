/* Frame, routing, and stand-ins for JournalData and JournalOps.
   The stand-ins install only when builder 1's modules are not already loaded.
   Morning, evening, week, and month fields stay read-only.
   Habits keep points, levels, and surprise rolls for the habits view. */
(function (global) {
  "use strict";

  var CACHE_KEY = "journal-next-cache";
  var OPS_KEY = "journal-next-ops";
  var BACKUP_KEY = "journal-next-backup";
  var TOKEN_KEY = "dong-gh-sync";
  var SAVE_DELAY = 2500;
  var DEFAULT_REPO = "Dong-Xuyong/progress-sync";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var QUARTER_SPAN = ["Jan \u2013 Mar", "Apr \u2013 Jun", "Jul \u2013 Sep", "Oct \u2013 Dec"];
  var KIND_WORD = { day: "Day", week: "Week", month: "Month", quarter: "Quarter", year: "Year", habits: "Habits" };
  var PERIODS = ["day", "week", "month", "quarter", "year"];
  var STATUS_TEXT = {
    idle: "",
    pending: "Waiting to save",
    saving: "Saving\u2026",
    saved: "Saved",
    error: "Could not save",
    offline: "Offline"
  };
  var QUESTIONS = [
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
  var HABITS = [
    { id: "thesis", label: "Thesis", emoji: "\uD83D\uDCDD" },
    { id: "training", label: "Training", emoji: "\uD83D\uDCAA" },
    { id: "food_logged", label: "Food logged", emoji: "\uD83C\uDF7D\uFE0F" },
    { id: "weigh_in", label: "Weigh in", emoji: "\u2696\uFE0F" },
    { id: "speaking", label: "Speaking", emoji: "\uD83D\uDDE3\uFE0F" },
    { id: "sunlight", label: "Sunlight", emoji: "\u2600\uFE0F" },
    { id: "protein_breakfast", label: "Protein breakfast", emoji: "\uD83E\uDD5A" }
  ];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isoWeekKey(year, monthIndex, day) {
    var utc = new Date(Date.UTC(year, monthIndex, day));
    var weekday = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
    var isoYear = utc.getUTCFullYear();
    var dayOffset = Math.round((utc.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000);
    return isoYear + "-W" + pad2(Math.floor(dayOffset / 7) + 1);
  }

  function formatUTCDay(date) {
    return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1) + "-" + pad2(date.getUTCDate());
  }

  function thursdayOf(isoYear, week) {
    var jan4 = new Date(Date.UTC(isoYear, 0, 4));
    var weekday = jan4.getUTCDay() || 7;
    jan4.setUTCDate(jan4.getUTCDate() + 4 - weekday + (week - 1) * 7);
    return jan4;
  }

  function kindOf(key) {
    if (typeof key !== "string") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return "day";
    if (/^\d{4}-W\d{2}$/.test(key)) return "week";
    if (/^\d{4}-Q[1-4]$/.test(key)) return "quarter";
    if (/^\d{4}-\d{2}$/.test(key)) return "month";
    if (/^\d{4}$/.test(key)) return "year";
    return null;
  }

  function shiftDay(key, delta) {
    var date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)) + delta));
    return formatUTCDay(date);
  }

  function shiftWeek(key, delta) {
    var moved = thursdayOf(Number(key.slice(0, 4)), Number(key.slice(6)));
    moved.setUTCDate(moved.getUTCDate() + delta * 7);
    return isoWeekKey(moved.getUTCFullYear(), moved.getUTCMonth(), moved.getUTCDate());
  }

  function shiftMonth(key, delta) {
    var date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1));
    return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1);
  }

  function shiftQuarter(key, delta) {
    var index = Number(key.slice(0, 4)) * 4 + (Number(key.slice(6)) - 1) + delta;
  var year = Math.floor(index / 4);
  return year + "-Q" + (index - year * 4 + 1);
}

  function shiftYear(key, delta) {
    return String(Number(key) + delta);
  }

  function shift(key, delta) {
    var kind = kindOf(key);
    if (kind === "day") return shiftDay(key, delta);
    if (kind === "week") return shiftWeek(key, delta);
    if (kind === "month") return shiftMonth(key, delta);
    if (kind === "quarter") return shiftQuarter(key, delta);
    if (kind === "year") return shiftYear(key, delta);
    return null;
  }

  function weekDays(key) {
    var monday = thursdayOf(Number(key.slice(0, 4)), Number(key.slice(6)));
    var days = [];
    var i;
    monday.setUTCDate(monday.getUTCDate() - 3);
    for (i = 0; i < 7; i++) {
      var day = new Date(monday.getTime());
      day.setUTCDate(monday.getUTCDate() + i);
      days.push(formatUTCDay(day));
    }
    return days;
  }

  function parentKey(key) {
    var kind = kindOf(key);
    if (kind === "day") return isoWeekKey(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
    if (kind === "week") return weekDays(key)[0].slice(0, 7);
    if (kind === "month") return key.slice(0, 4) + "-Q" + (Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1);
    if (kind === "quarter") return key.slice(0, 4);
    return null;
  }

  function labelDay(key) {
    var year = Number(key.slice(0, 4));
    var month = Number(key.slice(5, 7));
    var day = Number(key.slice(8, 10));
    var weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    return weekday + ", " + MONTHS[month - 1] + " " + day + ", " + year;
  }

  function labelWeek(key) {
    var days = weekDays(key);
    var start = days[0];
    var end = days[6];
    var left = MONTHS_SHORT[Number(start.slice(5, 7)) - 1] + " " + Number(start.slice(8, 10));
    var right = MONTHS_SHORT[Number(end.slice(5, 7)) - 1] + " " + Number(end.slice(8, 10));
    var title = "Week " + Number(key.slice(6)) + " \u00b7 ";
    if (start.slice(0, 4) !== end.slice(0, 4)) return title + left + ", " + start.slice(0, 4) + " \u2013 " + right + ", " + end.slice(0, 4);
    return title + left + " \u2013 " + right + ", " + end.slice(0, 4);
  }

  function label(key) {
    var kind = kindOf(key);
    if (kind === "day") return labelDay(key);
    if (kind === "week") return labelWeek(key);
    if (kind === "month") return MONTHS[Number(key.slice(5, 7)) - 1] + " " + key.slice(0, 4);
    if (kind === "quarter") return key.slice(0, 4) + " Q" + key.slice(6) + " \u00b7 " + QUARTER_SPAN[Number(key.slice(6)) - 1];
    if (kind === "year") return key;
    return "";
  }

  function todayKey(kind, date) {
    var now = date || new Date();
    if (kind === "day") return now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
    if (kind === "week") return isoWeekKey(now.getFullYear(), now.getMonth(), now.getDate());
    if (kind === "month") return now.getFullYear() + "-" + pad2(now.getMonth() + 1);
    if (kind === "quarter") return now.getFullYear() + "-Q" + (Math.floor(now.getMonth() / 3) + 1);
    if (kind === "year") return String(now.getFullYear());
    return "";
  }

  function blankStore() {
    return { version: 1, entries: {}, quotes: {} };
  }

  function score(value) {
    return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null;
  }

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  }

  function hasToken() {
    var cfg = readJSON(TOKEN_KEY);
    return !!(cfg && cfg.token);
  }

  function ghConfig() {
    var cfg = readJSON(TOKEN_KEY) || {};
    return { token: cfg.token || "", repo: cfg.repo || DEFAULT_REPO };
  }

  if (!global.JournalData || !global.JournalOps) {
    var store = blankStore();
    var queue = [];
    var listeners = [];
    var state = "idle";
    var timer = null;
    var saving = false;
    var saveAgain = false;

    function entry(key) {
      var value = store.entries && store.entries[key];
      return value && typeof value === "object" ? value : null;
    }

    function fields(key) {
      var item = entry(key);
      return item && item.fields && typeof item.fields === "object" ? item.fields : {};
    }

    function todos(key) {
      var item = entry(key);
      return item && Array.isArray(item.todos) ? item.todos : [];
    }

    function dayRecord(day) {
      var days = store.days;
      if (!days || typeof days !== "object") return {};
      return days[day] && typeof days[day] === "object" ? days[day] : {};
    }

    function moodOf(day) {
      var own = fields(day);
      var extra = dayRecord(day);
      return score(own.mood) || score(extra.mood) || score(own.moodMeter) || score(extra.moodMeter);
    }

    function energyOf(day) {
      return score(fields(day).energy) || score(dayRecord(day).energy);
    }

    function sleepOf(day) {
      var item = entry(day);
      var own = fields(day);
      if (own.sleep != null && own.sleep !== "") return own.sleep;
      if (item && item.sleep != null && item.sleep !== "") return item.sleep;
      if (store.sleep && typeof store.sleep === "object" && store.sleep[day] != null && store.sleep[day] !== "") return store.sleep[day];
      return null;
    }

    function habitDefs() {
      var list = store.habitDefs;
      var out = [];
      var i;
      if (!Array.isArray(list) || !list.length) return HABITS.slice();
      for (i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item || typeof item.id !== "string" || !item.id) continue;
        out.push({
          id: item.id,
          label: typeof item.label === "string" && item.label ? item.label : item.id,
          emoji: typeof item.emoji === "string" ? item.emoji : ""
        });
      }
      return out.length ? out : HABITS.slice();
    }

    function habitStatus(day, id) {
      var item = entry(day);
      if (!item || !item.habits || typeof item.habits !== "object") return null;
      if (!Object.prototype.hasOwnProperty.call(item.habits, id)) return null;
      var value = item.habits[id];
      if (value === true || value === false || value === null) return value;
      return null;
    }

    function reflections() {
      var raw = store.reflections && typeof store.reflections === "object" ? store.reflections : {};
      var questions = [];
      var seen = Object.create(null);
      var source = Array.isArray(raw.questions) ? raw.questions : [];
      var i;
      for (i = 0; i < source.length; i++) {
        var item = source[i];
        if (!item || typeof item.id !== "string" || !item.id || seen[item.id]) continue;
        seen[item.id] = true;
        questions.push({ id: item.id, text: typeof item.text === "string" ? item.text : "" });
      }
      if (!questions.length) questions = JSON.parse(JSON.stringify(QUESTIONS));
      return {
        questions: questions,
        answers: raw.answers && typeof raw.answers === "object" ? raw.answers : {}
      };
    }

    function questionOfDay(day) {
      var data = reflections();
      var count = data.questions.length || 1;
      var days = Math.floor(Date.UTC(Number(String(day).slice(0, 4)), Number(String(day).slice(5, 7)) - 1, Number(String(day).slice(8, 10))) / 86400000);
      var index = ((days % count) + count) % count;
      return data.questions[index] || null;
    }

    function children(key) {
      var kind = kindOf(key);
      var out = [];
      var guard;
      var week;
      var year;
      var start;
      if (kind === "week") return weekDays(key);
      if (kind === "month") {
        week = isoWeekKey(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
        for (guard = 0; guard < 8; guard++) {
          var monday = weekDays(week)[0];
          if (monday.slice(0, 7) > key) break;
          if (monday.slice(0, 7) === key) out.push(week);
          week = shiftWeek(week, 1);
        }
        return out;
      }
      if (kind === "quarter") {
        start = (Number(key.slice(6)) - 1) * 3 + 1;
        year = key.slice(0, 4);
        return [0, 1, 2].map(function (step) { return year + "-" + pad2(start + step); });
      }
      if (kind === "year") return [1, 2, 3, 4].map(function (q) { return key + "-Q" + q; });
      return out;
    }

    function ancestors(key) {
      var out = [];
      var parent = parentKey(key);
      var guard = 0;
      while (parent && guard < 6) {
        out.unshift(parent);
        parent = parentKey(parent);
        guard += 1;
      }
      return out;
    }

    function daysIn(key, through) {
      var kind = kindOf(key);
      var days = [];
      var cursor = "";
      var end = "";
      var months;
      if (kind === "day") days = [key];
      else if (kind === "week") days = weekDays(key);
      else if (kind === "month" || kind === "quarter" || kind === "year") {
        if (kind === "month") {
          cursor = key + "-01";
          end = shiftDay(shiftMonth(key, 1) + "-01", -1);
        } else if (kind === "quarter") {
          months = children(key);
          cursor = months[0] + "-01";
          end = shiftDay(shiftMonth(months[2], 1) + "-01", -1);
        } else {
          cursor = key + "-01-01";
          end = key + "-12-31";
        }
        while (cursor && cursor <= end) {
          days.push(cursor);
          cursor = shiftDay(cursor, 1);
        }
      }
      if (through) days = days.filter(function (day) { return day <= through; });
      return days;
    }

    function numberList(values) {
      if (!values.length) return { avg: null, n: 0, min: null, max: null };
      var sum = 0;
      var min = values[0];
      var max = values[0];
      var i;
      for (i = 0; i < values.length; i++) {
        sum += values[i];
        if (values[i] < min) min = values[i];
        if (values[i] > max) max = values[i];
      }
      return { avg: sum / values.length, n: values.length, min: min, max: max };
    }

    function numeric(value) {
      var n = typeof value === "number" ? value : Number(value);
      return n === n && isFinite(n) ? n : null;
    }

    function todoTotals(list) {
      var done = 0;
      var total = 0;
      var i;
      if (!Array.isArray(list)) return { done: 0, total: 0 };
      for (i = 0; i < list.length; i++) {
        if (!String(list[i] && list[i].text || "").trim()) continue;
        total += 1;
        if (list[i].done) done += 1;
      }
      return { done: done, total: total };
    }

    function rollup(key, opts) {
      var through = opts && opts.through;
      var days = daysIn(key, through);
      var moods = [];
      var energies = [];
      var sleeps = [];
      var logged = 0;
      var done = 0;
      var total = 0;
      var habitKnown = 0;
      var habitDone = 0;
      var reflected = 0;
      var own = todoTotals(todos(key));
      var answers = reflections().answers;
      var defs = habitDefs();
      var series = [];
      var kids = children(key);
      var i;
      var j;
      done += own.done;
      total += own.total;
      for (i = 0; i < days.length; i++) {
        var day = days[i];
        var mood = moodOf(day);
        var energy = energyOf(day);
        var sleep = numeric(sleepOf(day));
        var dayTodos = todoTotals(todos(day));
        if (mood != null) moods.push(mood);
        if (energy != null) energies.push(energy);
        if (sleep != null) sleeps.push(sleep);
        if (mood != null || energy != null || sleep != null) logged += 1;
        if (kindOf(key) !== "day") {
          done += dayTodos.done;
          total += dayTodos.total;
        }
        for (j = 0; j < defs.length; j++) {
          var status = habitStatus(day, defs[j].id);
          if (status === true || status === false) {
            habitKnown += 1;
            if (status === true) habitDone += 1;
          }
        }
      }
      Object.keys(answers).forEach(function (qid) {
        var list = answers[qid];
        var n;
        if (!Array.isArray(list)) return;
        for (n = 0; n < list.length; n++) {
          var date = list[n] && list[n].date;
          if (date && days.indexOf(date) !== -1) reflected += 1;
        }
      });
      for (i = 0; i < kids.length; i++) {
        var child = kids[i];
        var childDays = daysIn(child, through);
        var childMoods = [];
        var childEnergies = [];
        for (j = 0; j < childDays.length; j++) {
          var childMood = moodOf(childDays[j]);
          var childEnergy = energyOf(childDays[j]);
          if (childMood != null) childMoods.push(childMood);
          if (childEnergy != null) childEnergies.push(childEnergy);
        }
        series.push({
          key: child,
          mood: numberList(childMoods).avg,
          energy: numberList(childEnergies).avg,
          days: childDays.length
        });
      }
      return {
        days: days.length,
        logged: logged,
        mood: numberList(moods),
        energy: numberList(energies),
        sleep: numberList(sleeps),
        series: series,
        todos: { done: done, total: total },
        habitRate: habitKnown ? habitDone / habitKnown : null,
        reflections: reflected
      };
    }

    function load(raw) {
      store = raw && typeof raw === "object" ? raw : blankStore();
      if (!store.entries || typeof store.entries !== "object" || Array.isArray(store.entries)) store.entries = {};
      if (!store.quotes || typeof store.quotes !== "object" || Array.isArray(store.quotes)) store.quotes = {};
      return store;
    }

    global.JournalData = {
      load: load,
      entry: entry,
      fields: fields,
      todos: todos,
      quote: function (day) {
        var quote = store.quotes && store.quotes[day];
        return quote && typeof quote === "object" ? quote : null;
      },
      moodOf: moodOf,
      energyOf: energyOf,
      sleepOf: sleepOf,
      habitDefs: habitDefs,
      habitStatus: habitStatus,
      reflections: reflections,
      questionOfDay: questionOfDay,
      children: children,
      ancestors: ancestors,
      daysIn: daysIn,
      rollup: rollup,
      shift: shift,
      label: label,
      kindOf: kindOf,
      todayKey: todayKey
    };

    function setStatus(next) {
      state = next;
      try {
        document.dispatchEvent(new CustomEvent("journal-ops-status"));
      } catch (e) {}
    }

    function persistQueue() {
      localStorage.setItem(OPS_KEY, JSON.stringify(queue));
    }

    function writeCache() {
      localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    }

    function emit() {
      listeners.forEach(function (fn) {
        try { fn(); } catch (e) {}
      });
    }

    function ensureEntry(key) {
      if (!store.entries[key] || typeof store.entries[key] !== "object") {
        store.entries[key] = { updatedAt: "", fields: {}, todos: [] };
      }
      if (!store.entries[key].fields || typeof store.entries[key].fields !== "object") store.entries[key].fields = {};
      if (!Array.isArray(store.entries[key].todos)) store.entries[key].todos = [];
      return store.entries[key];
    }

    function touch(key) {
      ensureEntry(key).updatedAt = new Date().toISOString();
    }

    function enqueue(op) {
      var i;
      if (op.type === "todoPatch") {
        for (i = 0; i < queue.length; i++) {
          if (queue[i].type === "todoPatch" && queue[i].key === op.key && queue[i].id === op.id) {
            Object.keys(op.patch).forEach(function (name) { queue[i].patch[name] = op.patch[name]; });
            persistQueue();
            schedule();
            return;
          }
        }
      }
      queue.push(op);
      persistQueue();
      schedule();
    }

    function schedule() {
      setStatus("pending");
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY);
    }

    function toBase64(str) {
      return btoa(unescape(encodeURIComponent(str)));
    }

    function fromBase64(b64) {
      return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ""))));
    }

    function request(method, body) {
      var cfg = ghConfig();
      return fetch("https://api.github.com/repos/" + cfg.repo + "/contents/journal.json", {
        method: method,
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + cfg.token,
          Accept: "application/vnd.github+json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
    }

    function copyData(data) {
      return JSON.parse(JSON.stringify(data));
    }

    function ensureRemote(data, key) {
      if (!data.entries || typeof data.entries !== "object") data.entries = {};
      if (!data.entries[key] || typeof data.entries[key] !== "object") {
        data.entries[key] = { updatedAt: "", fields: {}, todos: [] };
      }
      if (!Array.isArray(data.entries[key].todos)) data.entries[key].todos = [];
      if (!data.entries[key].fields || typeof data.entries[key].fields !== "object") data.entries[key].fields = {};
      return data.entries[key];
    }

    function applyOps(raw, ops) {
      var data = copyData(raw || blankStore());
      var now = new Date().toISOString();
      var touched = Object.create(null);
      ops.forEach(function (op) {
        var item;
        var i;
        if (op.type === "appendAnswer") {
          applyAnswer(data, op.qid, op.answer);
          return;
        }
        item = ensureRemote(data, op.key);
        touched[op.key] = item;
        if (op.type === "todoAdd") item.todos.push(copyData(op.todo));
        if (op.type === "todoPatch") {
          for (i = 0; i < item.todos.length; i++) {
            if (item.todos[i].id === op.id) {
              Object.keys(op.patch).forEach(function (name) { item.todos[i][name] = op.patch[name]; });
            }
          }
        }
        if (op.type === "todoRemove") {
          item.todos = item.todos.filter(function (todo) { return todo.id !== op.id; });
        }
      });
      Object.keys(touched).forEach(function (key) { touched[key].updatedAt = now; });
      return data;
    }

    function applyAnswer(data, qid, answer) {
      var date = answer && typeof answer.date === "string" ? answer.date : "";
      var text = answer && typeof answer.text === "string" ? answer.text : "";
      var list;
      var i;
      if (!text.trim()) return;
      if (!data.reflections || typeof data.reflections !== "object") data.reflections = {};
      if (!Array.isArray(data.reflections.questions) || !data.reflections.questions.length) {
        data.reflections.questions = JSON.parse(JSON.stringify(QUESTIONS));
      }
      if (!data.reflections.answers || typeof data.reflections.answers !== "object") data.reflections.answers = {};
      list = data.reflections.answers[qid];
      if (!Array.isArray(list)) list = [];
      for (i = 0; i < list.length; i++) {
        if (list[i] && list[i].date === date && list[i].text === text) return;
      }
      list.push({ date: date, text: text });
      data.reflections.answers[qid] = list;
    }

    function rememberBackup(text) {
      try {
        if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, text);
      } catch (e) {}
    }

    function getRemote() {
      return request("GET").then(function (res) {
        if (res.status === 404) return { sha: "", data: blankStore(), raw: "" };
        if (!res.ok) throw new Error("GitHub error " + res.status);
        return res.json().then(function (file) {
          var raw = fromBase64(file.content || "");
          rememberBackup(raw);
          return { sha: file.sha || "", data: JSON.parse(raw), raw: raw };
        });
      });
    }

    function putRemote(sha, data, allowRetry) {
      var body = {
        message: "Save journal progress",
        content: toBase64(JSON.stringify(data))
      };
      if (sha) body.sha = sha;
      return request("PUT", body).then(function (res) {
        if (res.status === 409 && allowRetry) {
          return getRemote().then(function (remote) {
            return putRemote(remote.sha, applyOps(remote.data, queue.slice()), false);
          });
        }
        if (!res.ok) throw new Error("GitHub error " + res.status);
        return data;
      });
    }

    function flush() {
      var batch;
      clearTimeout(timer);
      timer = null;
      if (!queue.length) {
        setStatus(hasToken() ? "idle" : "offline");
        return;
      }
      if (!hasToken()) {
        setStatus("offline");
        return;
      }
      if (saving) {
        saveAgain = true;
        return;
      }
      saving = true;
      setStatus("saving");
      batch = queue.slice();
      getRemote().then(function (remote) {
        var next = applyOps(remote.data, batch);
        return putRemote(remote.sha, next, true);
      }).then(function (next) {
        queue = queue.slice(batch.length);
        persistQueue();
        load(next);
        writeCache();
        saving = false;
        if (queue.length || saveAgain) {
          saveAgain = false;
          flush();
          return;
        }
        setStatus("saved");
        emit();
      }, function () {
        saving = false;
        setStatus("error");
      });
    }

    function todoAdd(key, todo) {
      var item = ensureEntry(key);
      var copy = {
        id: todo && todo.id ? String(todo.id) : Math.random().toString(36).slice(2, 10),
        text: todo && todo.text != null ? String(todo.text) : "",
        done: !!(todo && todo.done)
      };
      if (todo && todo.mit) copy.mit = true;
      if (todo && todo.status) copy.status = todo.status;
      item.todos.push(copy);
      touch(key);
      enqueue({ type: "todoAdd", key: key, todo: copy });
      writeCache();
      emit();
      return copy;
    }

    function todoPatch(key, id, patch) {
      var list = ensureEntry(key).todos;
      var todo = null;
      var clean = {};
      var i;
      var textOnly;
      for (i = 0; i < list.length; i++) if (list[i].id === id) todo = list[i];
      if (!todo || !patch) return;
      ["done", "text", "status", "mit"].forEach(function (name) {
        if (!Object.prototype.hasOwnProperty.call(patch, name)) return;
        if (name === "done" || name === "mit") todo[name] = !!patch[name];
        else todo[name] = patch[name];
        clean[name] = todo[name];
      });
      if (!Object.keys(clean).length) return;
      touch(key);
      enqueue({ type: "todoPatch", key: key, id: id, patch: clean });
      writeCache();
      textOnly = Object.keys(clean).length === 1 && Object.prototype.hasOwnProperty.call(clean, "text");
      if (!textOnly) emit();
    }

    function todoRemove(key, id) {
      var item = ensureEntry(key);
      item.todos = item.todos.filter(function (todo) { return todo.id !== id; });
      touch(key);
      enqueue({ type: "todoRemove", key: key, id: id });
      writeCache();
      emit();
    }

    function appendAnswer(qid, answer) {
      var before = JSON.stringify(store.reflections || null);
      applyAnswer(store, qid, answer);
      if (!answer || !String(answer.text || "").trim()) return;
      if (JSON.stringify(store.reflections || null) === before) return;
      enqueue({ type: "appendAnswer", qid: qid, answer: { date: answer.date || "", text: answer.text } });
      writeCache();
      emit();
    }

    function refreshFromRemote() {
      if (!hasToken()) {
        setStatus("offline");
        return Promise.resolve();
      }
      return getRemote().then(function (remote) {
        if (!remote.raw) return;
        load(remote.data);
        writeCache();
        emit();
        if (!queue.length) setStatus("idle");
      }, function () {
        setStatus("error");
      });
    }

    global.JournalOps = {
      todoAdd: todoAdd,
      todoPatch: todoPatch,
      todoRemove: todoRemove,
      appendAnswer: appendAnswer,
      onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
      status: function () { return state; },
      refresh: refreshFromRemote
    };

    try {
      queue = JSON.parse(localStorage.getItem(OPS_KEY) || "[]");
      if (!Array.isArray(queue)) queue = [];
    } catch (e) {
      queue = [];
    }
    load(readJSON(CACHE_KEY) || blankStore());
    if (!hasToken()) setStatus("offline");
    else if (queue.length) schedule();
    else setStatus("idle");
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && queue.length) {
        clearTimeout(timer);
        flush();
      }
    });
    refreshFromRemote();
  }

  global.JournalViews = global.JournalViews || {};

  var tabs = document.getElementById("tabs");
  var crumbs = document.getElementById("crumbs");
  var heading = document.getElementById("period-heading");
  var view = document.getElementById("view");
  var prev = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var today = document.getElementById("today");
  var syncLabel = document.getElementById("sync-label");
  var connect = document.getElementById("connect");
  var connectBtn = document.getElementById("btn-connect");
  var route = { kind: "", key: "" };

  function paintStatus() {
    var text = STATUS_TEXT[global.JournalOps.status()] || "";
    if (syncLabel.textContent !== text) syncLabel.textContent = text;
  }

  function readRoute() {
    var hash = location.hash.replace(/^#/, "");
    var cut = hash.indexOf("/");
    var key;
    var kind;
    if (hash === "habits" || hash.indexOf("habits/") === 0) {
      key = "";
      if (hash.indexOf("habits/") === 0) {
        try { key = decodeURIComponent(hash.slice(7)); } catch (e) { key = ""; }
      }
      return { kind: "habits", key: key };
    }
    if (cut < 1) return null;
    kind = hash.slice(0, cut);
    try { key = decodeURIComponent(hash.slice(cut + 1)); } catch (e) { return null; }
    if (PERIODS.indexOf(kind) === -1) return null;
    if (global.JournalData.kindOf(key) !== kind) return null;
    return { kind: kind, key: key };
  }

  function tabHref(kind) {
    if (kind === "habits") return "#habits";
    return "#" + kind + "/" + global.JournalData.todayKey(kind);
  }

  function paintTabs() {
    tabs.textContent = "";
    ["day", "week", "month", "quarter", "year", "habits"].forEach(function (kind) {
      var link = document.createElement("a");
      link.className = "dx-tab";
      link.href = tabHref(kind);
      link.textContent = KIND_WORD[kind];
      if (kind === route.kind) link.setAttribute("aria-current", "page");
      tabs.appendChild(link);
    });
  }

  function paintCrumbs() {
    var list = document.createElement("ol");
    var chain = [];
    crumbs.textContent = "";
    if (route.kind === "habits") {
      chain = [{ href: "#habits", text: "Habits", current: !route.key }];
      if (route.key) chain.push({ href: "#habits/" + encodeURIComponent(route.key), text: route.key, current: true });
    } else {
      chain = global.JournalData.ancestors(route.key).concat([route.key]).map(function (key, index, all) {
        var kind = global.JournalData.kindOf(key);
        return {
          href: "#" + kind + "/" + key,
          text: KIND_WORD[kind] + " \u00b7 " + global.JournalData.label(key),
          current: index === all.length - 1
        };
      });
    }
    chain.forEach(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.text;
      if (item.current) link.setAttribute("aria-current", "page");
      li.appendChild(link);
      list.appendChild(li);
    });
    crumbs.appendChild(list);
  }

  function paintNav() {
    var word = route.kind === "habits" ? "" : route.kind;
    var show = route.kind !== "habits";
    prev.hidden = !show;
    today.hidden = !show;
    nextBtn.hidden = !show;
    if (!show) return;
    prev.textContent = "Previous " + word;
    nextBtn.textContent = "Next " + word;
    prev.setAttribute("aria-label", "Previous " + word);
    nextBtn.setAttribute("aria-label", "Next " + word);
    today.textContent = "Today";
    today.setAttribute("aria-label", "Today");
  }

  function lines(value) {
    if (Array.isArray(value)) return value.map(function (item) { return String(item == null ? "" : item).trim(); }).filter(Boolean).join(", ");
    return String(value == null ? "" : value).trim();
  }

  function addLines(body, pairs) {
    var any = false;
    pairs.forEach(function (pair) {
      var value = lines(pair.value);
      var p;
      if (!value) return;
      any = true;
      p = global.JournalUI.el("p", "field-line");
      p.appendChild(global.JournalUI.el("span", "field-name", pair.name + ": "));
      p.appendChild(document.createTextNode(value));
      body.appendChild(p);
    });
    if (!any) body.appendChild(global.JournalUI.el("p", "empty-line", "Not written yet."));
    return any;
  }

  function priorities(key) {
    var own = global.JournalData.fields(key);
    var list = own.priorities;
    if (!Array.isArray(list) || !list.length) list = own.top3;
    if (Array.isArray(list) && list.length) return list;
    return global.JournalData.todos(key).filter(function (todo) { return todo && todo.mit && String(todo.text || "").trim(); }).map(function (todo) { return todo.text; });
  }

  function mountDay(root, key) {
    var own = global.JournalData.fields(key);
    var mood = global.JournalData.moodOf(key);
    var energy = global.JournalData.energyOf(key);
    var pri = priorities(key);
    var wins = [].concat(own.wins || [], own.highlights || []).filter(function (item) { return String(item || "").trim(); });
    var todos = global.JournalData.todos(key).filter(function (todo) { return String(todo.text || "").trim(); });
    var done = todos.filter(function (todo) { return todo.done; }).length;
    var morning = global.JournalUI.fold({
      id: "day:morning",
      title: "Morning",
      level: 3,
      summary: global.JournalUI.oneLine(["Morning", own.focus ? "focus: " + own.focus : "", pri.length ? pri.length + (pri.length === 1 ? " priority" : " priorities") : ""])
    });
    var evening = global.JournalUI.fold({
      id: "day:evening",
      title: "Evening",
      level: 3,
      summary: global.JournalUI.oneLine(["Evening", mood || energy ? "mood " + (mood || "\u2013") + " / energy " + (energy || "\u2013") : "", wins.length ? wins.length + (wins.length === 1 ? " win" : " wins") : ""])
    });
    var tasks = global.JournalUI.fold({
      id: "day:todos",
      title: "To-dos",
      level: 3,
      summary: todos.length ? "To-dos \u00b7 " + done + " of " + todos.length + " done" : "To-dos \u00b7 none yet"
    });
    morning.body.appendChild(global.JournalUI.info("focus"));
    addLines(morning.body, [
      { name: "Focus", value: own.focus },
      { name: "Priorities", value: pri },
      { name: "If this slips", value: own.failureCost },
      { name: "If-then plan", value: own.ifThen },
      { name: "Grateful", value: own.grateful },
      { name: "What would make today great", value: own.makeGreat },
      { name: "Affirmation", value: own.affirmation }
    ]);
    addLines(evening.body, [
      { name: "Mood", value: mood ? String(mood) + " of 5" : "" },
      { name: "Energy", value: energy ? String(energy) + " of 5" : "" },
      { name: "Feeling", value: own.feeling },
      { name: "Wins", value: wins },
      { name: "Lesson", value: [own.lesson, own.better].filter(function (item) { return String(item || "").trim(); }) },
      { name: "Chosen or momentum", value: own.chosenVsMomentum },
      { name: "Tomorrow", value: own.tomorrow }
    ]);
    global.JournalUI.todoList(tasks.body, key, {});
    root.appendChild(morning.root);
    root.appendChild(evening.root);
    root.appendChild(tasks.root);
  }

  function mountPeriod(root, kind, key) {
    var ids = {
      week: ["week:planning", "Planning"],
      month: ["month:planning", "Planning"],
      quarter: ["quarter:focus", "Focus"],
      year: ["year:vision", "Vision"]
    };
    var spec = ids[kind];
    var box = global.JournalUI.fold({ id: spec[0], title: spec[1], level: 3, summary: spec[1] + " \u00b7 read only" });
    var tasks = global.JournalUI.fold({ id: kind + ":todos", title: "To-dos", level: 3, summary: "To-dos" });
    addLines(box.body, [{ name: spec[1], value: "These notes stay as they were written." }]);
    global.JournalUI.todoList(tasks.body, key, { yearStatus: kind === "year" });
    root.appendChild(box.root);
    root.appendChild(tasks.root);
  }

  function mountHabits(root, key) {
    var box = global.JournalUI.fold({
      id: "habits:today",
      title: "Today",
      level: 3,
      summary: key ? "Habits \u00b7 " + key : "Habits \u00b7 points and levels stay here"
    });
    var note = global.JournalUI.el("p", "habit-note", "Habit charts stay on this tab, including points, levels, and surprise rolls. This tab does not change the journal file.");
    box.body.appendChild(note);
    if (key) box.body.appendChild(global.JournalUI.el("p", "field-line", "Selected habit: " + key));
    root.appendChild(box.root);
  }

  function mountFallback(root) {
    if (route.kind === "day") mountDay(root, route.key);
    else if (route.kind === "habits") mountHabits(root, route.key);
    else mountPeriod(root, route.kind, route.key);
  }

  function render(opts) {
    var title;
    opts = opts || {};
    view.textContent = "";
    paintTabs();
    paintCrumbs();
    paintNav();
    if (route.kind === "habits") title = route.key ? "Habits \u00b7 " + route.key : "Habits";
    else title = global.JournalData.label(route.key) || KIND_WORD[route.kind];
    heading.textContent = title;
    document.title = title + " \u00b7 Journal";
    document.body.setAttribute("data-kind", route.kind);
    if (typeof global.JournalViews[route.kind] === "function") {
      global.JournalViews[route.kind](view, { key: route.key, today: global.JournalData.todayKey("day") });
    } else {
      mountFallback(view);
    }
    paintConnect();
    paintStatus();
    if (opts.focus) heading.focus();
  }

  function paintConnect() {
    connect.hidden = hasToken();
  }

  function go(delta) {
    var key;
    if (!route.key) return;
    key = global.JournalData.shift(route.key, delta);
    if (key) location.hash = "#" + route.kind + "/" + key;
  }

  function showRoute(focus) {
    var next = readRoute();
    if (!next) {
      location.replace("#day/" + global.JournalData.todayKey("day"));
      return;
    }
    route = next;
    render({ focus: focus });
  }

  prev.addEventListener("click", function () { go(-1); });
  nextBtn.addEventListener("click", function () { go(1); });
  today.addEventListener("click", function () {
    if (route.kind && route.kind !== "habits") location.hash = "#" + route.kind + "/" + global.JournalData.todayKey(route.kind);
  });
  connectBtn.addEventListener("click", function () {
    var token = global.prompt("Paste a GitHub token that can read and write your journal file. It stays in this browser.");
    var cfg;
    if (!token || !String(token).trim()) return;
    cfg = readJSON(TOKEN_KEY) || {};
    cfg.token = String(token).trim();
    if (!cfg.repo) cfg.repo = DEFAULT_REPO;
    localStorage.setItem(TOKEN_KEY, JSON.stringify(cfg));
    paintConnect();
    if (global.JournalOps.refresh) global.JournalOps.refresh();
    else location.reload();
  });
  document.addEventListener("journal-ops-status", paintStatus);
  global.JournalOps.onChange(function () {
    if (readRoute()) render({ focus: false });
  });
  window.addEventListener("hashchange", function () { showRoute(true); });
  paintStatus();
  showRoute(true);
})(window);
