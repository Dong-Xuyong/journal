(function () {
  "use strict";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var QUARTER_SPAN = ["Jan \u2013 Mar", "Apr \u2013 Jun", "Jul \u2013 Sep", "Oct \u2013 Dec"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dayKey(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  // Local Y/M/D -> UTC date -> that week's Thursday -> week of the Thursday's year.
  function isoWeekKey(year, monthIndex, day) {
    var utc = new Date(Date.UTC(year, monthIndex, day));
    var weekday = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
    var isoYear = utc.getUTCFullYear();
    var dayOffset = Math.round((utc.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000);
    return isoYear + "-W" + pad2(Math.floor(dayOffset / 7) + 1);
  }

  function weekKey(date) {
    return isoWeekKey(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function monthKey(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1);
  }

  function quarterKey(date) {
    return date.getFullYear() + "-Q" + (Math.floor(date.getMonth() / 3) + 1);
  }

  function yearKey(date) {
    return String(date.getFullYear());
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

  function formatUTCDay(date) {
    return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1) + "-" + pad2(date.getUTCDate());
  }

  function thursdayOf(isoYear, week) {
    var jan4 = new Date(Date.UTC(isoYear, 0, 4));
    var weekday = jan4.getUTCDay() || 7;
    jan4.setUTCDate(jan4.getUTCDate() + 4 - weekday + (week - 1) * 7);
    return jan4;
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
    var startMonth = Number(start.slice(5, 7));
    var endMonth = Number(end.slice(5, 7));
    var startYear = start.slice(0, 4);
    var endYear = end.slice(0, 4);
    var left = MONTHS_SHORT[startMonth - 1] + " " + Number(start.slice(8, 10));
    var right = MONTHS_SHORT[endMonth - 1] + " " + Number(end.slice(8, 10));
    var title = "Week " + Number(key.slice(6)) + " \u00b7 ";
    if (startYear !== endYear) return title + left + ", " + startYear + " \u2013 " + right + ", " + endYear;
    return title + left + " \u2013 " + right + ", " + endYear;
  }

  function labelMonth(key) {
    return MONTHS[Number(key.slice(5, 7)) - 1] + " " + key.slice(0, 4);
  }

  function labelQuarter(key) {
    var quarter = Number(key.slice(6));
    return key.slice(0, 4) + " Q" + quarter + " \u00b7 " + QUARTER_SPAN[quarter - 1];
  }

  function label(key) {
    var kind = kindOf(key);
    if (kind === "day") return labelDay(key);
    if (kind === "week") return labelWeek(key);
    if (kind === "month") return labelMonth(key);
    if (kind === "quarter") return labelQuarter(key);
    if (kind === "year") return key;
    return null;
  }

  function weekDays(key) {
    var monday = thursdayOf(Number(key.slice(0, 4)), Number(key.slice(6)));
    monday.setUTCDate(monday.getUTCDate() - 3);
    var days = [];
    var i;
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

  function todayKey(kind, date) {
    if (kind === "day") return dayKey(date);
    if (kind === "week") return weekKey(date);
    if (kind === "month") return monthKey(date);
    if (kind === "quarter") return quarterKey(date);
    if (kind === "year") return yearKey(date);
    return null;
  }

  function blankStore() {
    return { version: 1, entries: {}, quotes: {} };
  }

  function stamp(entry) {
    if (!entry || typeof entry.updatedAt !== "string" || entry.updatedAt.length === 0) return null;
    return entry.updatedAt;
  }

  function choose(left, right) {
    var a = stamp(left);
    var b = stamp(right);
    if (a == null) return b == null ? left : right;
    if (b == null) return left;
    return b > a ? right : left;
  }

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function copyEntry(entry) {
    if (!isRecord(entry)) return entry;
    var copy = {};
    var keys = Object.keys(entry);
    var i;
    for (i = 0; i < keys.length; i++) copy[keys[i]] = entry[keys[i]];
    return copy;
  }

  function cloneData(value) {
    if (value == null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  // Writer-owned maps: remote wins per key, local fills keys the remote copy lost.
  function mergeRemoteFirst(localMap, remoteMap) {
    var out = {};
    var keys, i;
    if (isRecord(localMap)) {
      keys = Object.keys(localMap);
      for (i = 0; i < keys.length; i++) out[keys[i]] = localMap[keys[i]];
    }
    if (isRecord(remoteMap)) {
      keys = Object.keys(remoteMap);
      for (i = 0; i < keys.length; i++) out[keys[i]] = remoteMap[keys[i]];
    }
    return out;
  }

  function copyMergedEntry(localEntry, remoteEntry) {
    var inLocal = isRecord(localEntry);
    var inRemote = isRecord(remoteEntry);
    var chosen = inLocal && inRemote ? choose(localEntry, remoteEntry) : (inLocal ? localEntry : remoteEntry);
    var copy = copyEntry(chosen);
    if (!isRecord(copy)) return copy;
    if ((inLocal && isRecord(localEntry.habits)) || (inRemote && isRecord(remoteEntry.habits))) {
      copy.habits = mergeRemoteFirst(inLocal ? localEntry.habits : null, inRemote ? remoteEntry.habits : null);
    }
    if ((inLocal && isRecord(localEntry.habitStreaks)) || (inRemote && isRecord(remoteEntry.habitStreaks))) {
      copy.habitStreaks = mergeRemoteFirst(inLocal ? localEntry.habitStreaks : null, inRemote ? remoteEntry.habitStreaks : null);
    }
    return copy;
  }

  function mapOf(store, key) {
    if (!store || !store[key] || typeof store[key] !== "object") return {};
    return store[key];
  }

  function entriesOf(store) {
    return mapOf(store, "entries");
  }

  function quotesOf(store) {
    return mapOf(store, "quotes");
  }

  function versionOf(store) {
    var version = store && store.version;
    return typeof version === "number" ? version : 1;
  }

  function mergeMap(left, right) {
    var names = Object.keys(left).concat(Object.keys(right));
    var out = {};
    var seen = Object.create(null);
    var i;
    for (i = 0; i < names.length; i++) {
      var key = names[i];
      if (seen[key]) continue;
      seen[key] = true;
      var inLeft = Object.prototype.hasOwnProperty.call(left, key);
      var inRight = Object.prototype.hasOwnProperty.call(right, key);
      var chosen = inLeft && inRight ? choose(left[key], right[key]) : (inLeft ? left[key] : right[key]);
      out[key] = copyEntry(chosen);
    }
    return out;
  }

  var REFLECTION_QUESTIONS = [
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

  function reflectionQuestions() {
    return JSON.parse(JSON.stringify(REFLECTION_QUESTIONS));
  }

  function questionList(raw) {
    var out = [];
    var seen = Object.create(null);
    var list = isRecord(raw) && Array.isArray(raw.questions) ? raw.questions : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0) continue;
      if (seen[item.id]) continue;
      seen[item.id] = true;
      out.push({ id: item.id, text: typeof item.text === "string" ? item.text : "" });
    }
    return out;
  }

  function cleanAnswers(list) {
    var out = [];
    var i;
    if (!Array.isArray(list)) return out;
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isRecord(item) || typeof item.text !== "string" || item.text.trim().length === 0) continue;
      out.push({ date: typeof item.date === "string" ? item.date : "", text: item.text });
    }
    return out;
  }

  function mergeAnswerLists(localList, remoteList) {
    var out = [];
    var seen = Object.create(null);
    function add(list) {
      var cleaned = cleanAnswers(list);
      var i;
      for (i = 0; i < cleaned.length; i++) {
        var item = cleaned[i];
        var key = item.date + "\n" + item.text;
        if (seen[key]) continue;
        seen[key] = true;
        out.push(item);
      }
    }
    add(localList);
    add(remoteList);
    out.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });
    return out;
  }

  function answerMap(raw) {
    var out = {};
    var source = isRecord(raw) && isRecord(raw.answers) ? raw.answers : {};
    var keys = Object.keys(source);
    var i;
    for (i = 0; i < keys.length; i++) {
      var cleaned = cleanAnswers(source[keys[i]]);
      if (cleaned.length) out[keys[i]] = cleaned;
    }
    return out;
  }

  // Questions: remote text wins. Answers: append-only union, one copy of the same date and text.
  function mergeReflections(localRaw, remoteRaw) {
    var questions = [];
    var indexOf = Object.create(null);
    function addQs(list) {
      var i;
      for (i = 0; i < list.length; i++) {
        var item = list[i];
        if (Object.prototype.hasOwnProperty.call(indexOf, item.id)) {
          if (!questions[indexOf[item.id]].text && item.text) questions[indexOf[item.id]].text = item.text;
          continue;
        }
        indexOf[item.id] = questions.length;
        questions.push({ id: item.id, text: item.text });
      }
    }
    addQs(questionList(remoteRaw));
    addQs(questionList(localRaw));
    var localAnswers = answerMap(localRaw);
    var remoteAnswers = answerMap(remoteRaw);
    var ids = Object.create(null);
    var keys = Object.keys(localAnswers).concat(Object.keys(remoteAnswers));
    var answers = {};
    var i;
    for (i = 0; i < keys.length; i++) ids[keys[i]] = true;
    keys = Object.keys(ids);
    for (i = 0; i < keys.length; i++) {
      var merged = mergeAnswerLists(localAnswers[keys[i]], remoteAnswers[keys[i]]);
      if (merged.length) answers[keys[i]] = merged;
    }
    return { questions: questions, answers: answers };
  }

  function reflectionsOf(store) {
    var raw = store && isRecord(store.reflections) ? store.reflections : null;
    var questions = raw ? questionList(raw) : [];
    if (!questions.length) questions = reflectionQuestions();
    return { questions: questions, answers: answerMap(raw) };
  }

  function reflectionIndex(day, count) {
    var n = count > 0 ? count : REFLECTION_QUESTIONS.length;
    var days = Math.floor(Date.UTC(Number(String(day).slice(0, 4)), Number(String(day).slice(5, 7)) - 1, Number(String(day).slice(8, 10))) / 86400000);
    if (days !== days) return 0;
    return ((days % n) + n) % n;
  }

  function mergeEntries(left, right) {
    var names = Object.keys(left).concat(Object.keys(right));
    var out = {};
    var seen = Object.create(null);
    var i;
    for (i = 0; i < names.length; i++) {
      var key = names[i];
      if (seen[key]) continue;
      seen[key] = true;
      var inLeft = Object.prototype.hasOwnProperty.call(left, key);
      var inRight = Object.prototype.hasOwnProperty.call(right, key);
      out[key] = copyMergedEntry(inLeft ? left[key] : null, inRight ? right[key] : null);
    }
    return out;
  }

  function mergeStores(local, remote) {
    var left = isRecord(local) ? local : {};
    var right = isRecord(remote) ? remote : {};
    var out = {};
    var seen = Object.create(null);
    function put(key) {
      if (seen[key]) return;
      seen[key] = true;
      if (key === "version") out.version = Math.max(versionOf(left), versionOf(right));
      else if (key === "entries") out.entries = mergeEntries(entriesOf(left), entriesOf(right));
      else if (key === "quotes") out.quotes = mergeMap(quotesOf(left), quotesOf(right));
      else if (key === "reflections") out.reflections = mergeReflections(left.reflections, right.reflections);
      else if (Object.prototype.hasOwnProperty.call(right, key)) out[key] = cloneData(right[key]);
      else out[key] = cloneData(left[key]);
    }
    var rightKeys = Object.keys(right);
    var leftKeys = Object.keys(left);
    var i;
    for (i = 0; i < rightKeys.length; i++) put(rightKeys[i]);
    for (i = 0; i < leftKeys.length; i++) put(leftKeys[i]);
    put("version");
    put("quotes");
    put("entries");
    return out;
  }

  var DEFAULT_HABIT_DEFS = [
    { id: "thesis", label: "Thesis", emoji: "\uD83D\uDCDD" },
    { id: "training", label: "Training", emoji: "\uD83D\uDCAA" },
    { id: "food_logged", label: "Food logged", emoji: "\uD83C\uDF7D\uFE0F" },
    { id: "weigh_in", label: "Weigh in", emoji: "\u2696\uFE0F" },
    { id: "speaking", label: "Speaking", emoji: "\uD83D\uDDE3\uFE0F" },
    { id: "sunlight", label: "Sunlight", emoji: "\u2600\uFE0F" },
    { id: "protein_breakfast", label: "Protein breakfast", emoji: "\uD83E\uDD5A" }
  ];

  function defaultHabitDefs() {
    return JSON.parse(JSON.stringify(DEFAULT_HABIT_DEFS));
  }

  function habitDefsOf(store) {
    var raw = store && store.habitDefs;
    var out = [];
    var i;
    if (!Array.isArray(raw)) return defaultHabitDefs();
    for (i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (!item || typeof item.id !== "string" || item.id.length === 0) continue;
      out.push({
        id: item.id,
        label: typeof item.label === "string" && item.label.length ? item.label : item.id,
        emoji: typeof item.emoji === "string" && item.emoji.length ? item.emoji : "\u2022"
      });
    }
    return out.length ? out : defaultHabitDefs();
  }

  function habitStatus(entry, id) {
    if (!isRecord(entry) || !isRecord(entry.habits)) return "none";
    if (!Object.prototype.hasOwnProperty.call(entry.habits, id)) return "unknown";
    var value = entry.habits[id];
    if (value === true) return "done";
    if (value === false) return "miss";
    return "unknown";
  }

  // An unlogged today does not break a streak. null, false, and a missing id on a logged day do.
  function currentStreak(store, id, day) {
    var entries = entriesOf(store);
    var key = day;
    var todayEntry = entries[key];
    var n = 0;
    if (isRecord(todayEntry) && isRecord(todayEntry.habits)) {
      if (habitStatus(todayEntry, id) !== "done") return 0;
    } else {
      key = shift(day, -1);
    }
    while (key && habitStatus(entries[key], id) === "done") {
      n += 1;
      key = shift(key, -1);
    }
    return n;
  }

  function bestStreak(store, id, through) {
    var entries = entriesOf(store);
    var keys = Object.keys(entries).filter(function (key) {
      return kindOf(key) === "day" && (!through || key <= through);
    }).sort();
    var best = 0;
    var run = 0;
    var prev = null;
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (prev && shift(prev, 1) !== key) run = 0;
      if (habitStatus(entries[key], id) === "done") {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
      prev = key;
    }
    return best;
  }

  function dayCompletion(entry, defs) {
    var list = Array.isArray(defs) ? defs : [];
    var done = 0;
    var miss = 0;
    var unknown = 0;
    var i;
    if (!isRecord(entry) || !isRecord(entry.habits)) {
      return { state: "none", done: 0, miss: 0, unknown: list.length, total: list.length, rate: null };
    }
    for (i = 0; i < list.length; i++) {
      var status = habitStatus(entry, list[i].id);
      if (status === "done") done += 1;
      else if (status === "miss") miss += 1;
      else unknown += 1;
    }
    if (!list.length || unknown === list.length) {
      return { state: "unknown", done: done, miss: miss, unknown: unknown, total: list.length, rate: null };
    }
    return { state: "logged", done: done, miss: miss, unknown: unknown, total: list.length, rate: done / list.length };
  }

  function habitStats(store, defs, dayKeys) {
    var entries = entriesOf(store);
    var list = Array.isArray(defs) ? defs : [];
    var days = Array.isArray(dayKeys) ? dayKeys : [];
    var logged = [];
    var per = {};
    var i, j, hits = 0;
    for (i = 0; i < days.length; i++) {
      var entry = entries[days[i]];
      if (isRecord(entry) && isRecord(entry.habits)) logged.push(days[i]);
    }
    for (j = 0; j < list.length; j++) {
      var id = list[j].id;
      var count = 0;
      for (i = 0; i < logged.length; i++) {
        if (habitStatus(entries[logged[i]], id) === "done") count += 1;
      }
      hits += count;
      per[id] = { done: count, total: logged.length, rate: logged.length ? count / logged.length : null };
    }
    var slots = logged.length * list.length;
    return { logged: logged.length, overall: slots ? hits / slots : null, perHabit: per };
  }

  var api = {
    dayKey: dayKey,
    weekKey: weekKey,
    monthKey: monthKey,
    quarterKey: quarterKey,
    yearKey: yearKey,
    kindOf: kindOf,
    shift: shift,
    label: label,
    weekDays: weekDays,
    parentKey: parentKey,
    todayKey: todayKey,
    blankStore: blankStore,
    mergeStores: mergeStores,
    defaultHabitDefs: defaultHabitDefs,
    habitDefsOf: habitDefsOf,
    habitStatus: habitStatus,
    currentStreak: currentStreak,
    bestStreak: bestStreak,
    dayCompletion: dayCompletion,
    habitStats: habitStats,
    reflectionQuestions: reflectionQuestions,
    reflectionsOf: reflectionsOf,
    reflectionIndex: reflectionIndex
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalCore = api;

  if (typeof require === "function" && typeof module !== "undefined" && require.main === module) {
    var assert = require("assert");
    var names = ["dayKey", "weekKey", "monthKey", "quarterKey", "yearKey", "kindOf", "shift", "label", "weekDays", "parentKey", "todayKey", "blankStore", "mergeStores", "defaultHabitDefs", "habitDefsOf", "habitStatus", "currentStreak", "bestStreak", "dayCompletion", "habitStats", "reflectionQuestions", "reflectionsOf", "reflectionIndex"];
    var n;
    for (n = 0; n < names.length; n++) assert.strictEqual(typeof api[names[n]], "function");

    assert.strictEqual(weekKey(new Date(2026, 11, 31)), "2026-W53");
    assert.strictEqual(weekKey(new Date(2026, 0, 1)), "2026-W01");
    assert.strictEqual(shift("2026-W53", 1), "2027-W01");
    assert.strictEqual(shift("2026-W01", -1), "2025-W52");
    assert.strictEqual(shift("2026-W52", 1), "2026-W53");
    assert.strictEqual(shift("2026-10-06", -1), "2026-10-05");
    assert.strictEqual(shift("2026-01-01", -1), "2025-12-31");
    assert.strictEqual(shift("2026-12", 1), "2027-01");
    assert.strictEqual(shift("2026-01", -1), "2025-12");
    assert.strictEqual(shift("2026-Q4", 1), "2027-Q1");
    assert.strictEqual(shift("2026-Q1", -1), "2025-Q4");
    assert.strictEqual(shift("2026", -1), "2025");
    assert.strictEqual(quarterKey(new Date(2026, 9, 6)), "2026-Q4");
    assert.strictEqual(parentKey("2026-10-06"), weekKey(new Date(2026, 9, 6)));
    assert.strictEqual(weekKey(new Date(2026, 9, 6)), "2026-W41");

    var days = weekDays("2026-W41");
    assert.strictEqual(days.length, 7);
    assert.deepStrictEqual(days, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    assert.strictEqual(new Date(Date.UTC(2026, 9, 5)).getUTCDay(), 1);

    assert.strictEqual(label("2026-10-06"), "Tuesday, October 6, 2026");
    assert.strictEqual(label("2026-W41"), "Week 41 \u00b7 Oct 5 \u2013 Oct 11, 2026");
    assert.strictEqual(label("2026-W01"), "Week 1 \u00b7 Dec 29, 2025 \u2013 Jan 4, 2026");
    assert.strictEqual(label("2026-10"), "October 2026");
    assert.strictEqual(label("2026-Q4"), "2026 Q4 \u00b7 Oct \u2013 Dec");
    assert.strictEqual(label("2026"), "2026");
    assert.strictEqual(parentKey("2026-W41"), "2026-10");
    assert.strictEqual(parentKey("2026-W01"), "2025-12");
    assert.strictEqual(parentKey("2026-10"), "2026-Q4");
    assert.strictEqual(parentKey("2026-Q4"), "2026");
    assert.strictEqual(parentKey("2026"), null);
    assert.strictEqual(todayKey("day", new Date(2026, 9, 6)), "2026-10-06");
    assert.strictEqual(kindOf("nope"), null);

    var local = {
      version: 1,
      entries: {
        both: { body: "local", updatedAt: "2026-01-01T00:00:00.000Z" },
        localOnly: { body: "L", updatedAt: "2026-02-01T00:00:00.000Z" },
        missing: { body: "no-stamp" }
      }
    };
    var remote = {
      version: 1,
      entries: {
        both: { body: "remote", updatedAt: "2026-06-01T00:00:00.000Z" },
        remoteOnly: { body: "R", updatedAt: "2026-02-02T00:00:00.000Z" },
        missing: { body: "stamped", updatedAt: "2026-01-01T00:00:00.000Z" }
      }
    };
    var localJson = JSON.stringify(local);
    var remoteJson = JSON.stringify(remote);
    var merged = mergeStores(local, remote);
    assert.strictEqual(JSON.stringify(local), localJson);
    assert.strictEqual(JSON.stringify(remote), remoteJson);
    assert.strictEqual(merged.entries.both.body, "remote");
    assert.strictEqual(merged.entries.localOnly.body, "L");
    assert.strictEqual(merged.entries.remoteOnly.body, "R");
    assert.strictEqual(merged.entries.missing.body, "stamped");
    assert.notStrictEqual(merged.entries.localOnly, local.entries.localOnly);
    merged.entries.localOnly.body = "mutated";
    assert.strictEqual(local.entries.localOnly.body, "L");

    var olderRemote = mergeStores(
      { version: 1, entries: { k: { body: "newer", updatedAt: "2026-05-01T00:00:00.000Z" } } },
      { version: 1, entries: { k: { body: "older", updatedAt: "2026-01-01T00:00:00.000Z" } } }
    );
    assert.strictEqual(olderRemote.entries.k.body, "newer");

    var stampWins = mergeStores(
      { version: 1, entries: { k: { body: "has", updatedAt: "2026-01-02T00:00:00.000Z" } } },
      { version: 1, entries: { k: { body: "none" } } }
    );
    assert.strictEqual(stampWins.entries.k.body, "has");

    var quoteMerge = mergeStores(
      {
        version: 1,
        entries: { "2026-10-06": { body: "day", updatedAt: "2026-10-06T12:00:00.000Z" } },
        quotes: { "2026-10-06": { text: "old", updatedAt: "2026-10-06T01:00:00.000Z" } }
      },
      {
        version: 1,
        entries: { "2026-10-06": { body: "stale", updatedAt: "2026-10-06T08:00:00.000Z" } },
        quotes: { "2026-10-06": { text: "new", updatedAt: "2026-10-06T09:00:00.000Z" } }
      }
    );
    assert.strictEqual(quoteMerge.entries["2026-10-06"].body, "day");
    assert.strictEqual(quoteMerge.quotes["2026-10-06"].text, "new");
    assert.deepStrictEqual(blankStore().quotes, {});

    var habitLocal = {
      version: 1,
      meta: { note: "keep-me" },
      habitDefs: [{ id: "thesis", label: "Old", emoji: "a" }],
      entries: {
        "2026-10-06": {
          body: "local",
          updatedAt: "2026-10-06T12:00:00.000Z",
          todos: [{ id: "t1", text: "Call bank", done: false }],
          habits: { thesis: true, sunlight: true },
          habitStreaks: { thesis: 3, sunlight: 1 }
        }
      },
      quotes: {}
    };
    var habitRemote = {
      version: 2,
      extra: { ok: true },
      habitDefs: [{ id: "thesis", label: "New", emoji: "b" }, { id: "training", label: "Training", emoji: "c" }],
      entries: {
        "2026-10-06": {
          body: "remote",
          updatedAt: "2026-10-06T08:00:00.000Z",
          habits: { thesis: null, training: false },
          habitStreaks: { thesis: 9, training: 0 }
        }
      },
      quotes: { "2026-10-06": { text: "remote quote", updatedAt: "2026-10-06T09:00:00.000Z" } }
    };
    var habitLocalJson = JSON.stringify(habitLocal);
    var habitRemoteJson = JSON.stringify(habitRemote);
    var habitMerged = mergeStores(habitLocal, habitRemote);
    assert.strictEqual(JSON.stringify(habitLocal), habitLocalJson);
    assert.strictEqual(JSON.stringify(habitRemote), habitRemoteJson);
    assert.strictEqual(habitMerged.version, 2);
    assert.strictEqual(habitMerged.entries["2026-10-06"].body, "local");
    assert.strictEqual(habitMerged.entries["2026-10-06"].todos[0].text, "Call bank");
    assert.strictEqual(habitMerged.entries["2026-10-06"].habits.thesis, null);
    assert.strictEqual(habitMerged.entries["2026-10-06"].habits.training, false);
    assert.strictEqual(habitMerged.entries["2026-10-06"].habits.sunlight, true);
    assert.strictEqual(habitMerged.entries["2026-10-06"].habitStreaks.thesis, 9);
    assert.strictEqual(habitMerged.entries["2026-10-06"].habitStreaks.training, 0);
    assert.strictEqual(habitMerged.entries["2026-10-06"].habitStreaks.sunlight, 1);
    assert.strictEqual(habitMerged.habitDefs[0].label, "New");
    assert.strictEqual(habitMerged.habitDefs[1].id, "training");
    assert.strictEqual(habitMerged.meta.note, "keep-me");
    assert.strictEqual(habitMerged.extra.ok, true);
    assert.strictEqual(habitMerged.quotes["2026-10-06"].text, "remote quote");
    habitMerged.habitDefs[0].label = "mutated";
    habitMerged.entries["2026-10-06"].habits.sunlight = false;
    assert.strictEqual(habitRemote.habitDefs[0].label, "New");
    assert.strictEqual(habitLocal.entries["2026-10-06"].habits.sunlight, true);

    var healed = mergeStores(
      { version: 1, entries: { "2026-10-06": { todos: [], updatedAt: "2026-10-07T00:00:00.000Z" } }, quotes: {} },
      {
        version: 1,
        habitDefs: [{ id: "thesis", label: "Thesis", emoji: "x" }],
        entries: { "2026-10-06": { habits: { thesis: true }, habitStreaks: { thesis: 4 }, updatedAt: "2026-10-06T00:00:00.000Z" } },
        quotes: {}
      }
    );
    assert.deepStrictEqual(healed.entries["2026-10-06"].todos, []);
    assert.strictEqual(healed.entries["2026-10-06"].habits.thesis, true);
    assert.strictEqual(healed.entries["2026-10-06"].habitStreaks.thesis, 4);
    assert.strictEqual(healed.habitDefs[0].id, "thesis");

    var filled = mergeStores(
      { version: 1, entries: { d: { updatedAt: "2026-01-01T00:00:00.000Z", habits: { thesis: true }, habitStreaks: { thesis: 2 } } }, quotes: {} },
      { version: 1, entries: { d: { updatedAt: "2026-02-01T00:00:00.000Z", body: "writer" } }, quotes: {} }
    );
    assert.strictEqual(filled.entries.d.body, "writer");
    assert.strictEqual(filled.entries.d.habits.thesis, true);
    assert.strictEqual(filled.entries.d.habitStreaks.thesis, 2);

    var localDefs = mergeStores(
      { version: 1, habitDefs: [{ id: "sunlight", label: "Sunlight" }], entries: {}, quotes: {} },
      { version: 1, entries: {}, quotes: {} }
    );
    assert.strictEqual(localDefs.habitDefs[0].id, "sunlight");

    var defs = habitDefsOf({});
    assert.strictEqual(defs.length, 7);
    assert.strictEqual(defs[0].id, "thesis");
    assert.strictEqual(defs[6].id, "protein_breakfast");
    assert.strictEqual(habitDefsOf({ habitDefs: [] }).length, 7);
    assert.strictEqual(habitDefsOf({ habitDefs: [{ id: "custom", label: "", emoji: "" }] })[0].label, "custom");
    assert.strictEqual(habitDefsOf({ habitDefs: [{ id: "thesis", label: "Thesis work", emoji: "📚" }] })[0].label, "Thesis work");

    var streakStore = {
      entries: {
        "2026-10-01": { habits: { thesis: true, training: true } },
        "2026-10-02": { habits: { thesis: true, training: null } },
        "2026-10-03": { habits: { thesis: false, training: true } },
        "2026-10-05": { habits: { thesis: true, training: true, sunlight: null } },
        "2026-W41": { body: "not a day" }
      }
    };
    var streakDefs = [{ id: "thesis" }, { id: "training" }, { id: "sunlight" }];
    assert.strictEqual(currentStreak(streakStore, "thesis", "2026-10-02"), 2);
    assert.strictEqual(currentStreak(streakStore, "thesis", "2026-10-05"), 1);
    assert.strictEqual(currentStreak(streakStore, "training", "2026-10-02"), 0);
    assert.strictEqual(currentStreak(streakStore, "training", "2026-10-01"), 1);
    assert.strictEqual(currentStreak(streakStore, "thesis", "2026-10-06"), 1);
    assert.strictEqual(currentStreak({ entries: { "2026-10-06": { habits: { thesis: null } } } }, "thesis", "2026-10-06"), 0);
    assert.strictEqual(bestStreak(streakStore, "thesis", "2026-10-05"), 2);
    assert.strictEqual(bestStreak(streakStore, "training", "2026-10-05"), 1);
    assert.strictEqual(habitStatus(streakStore.entries["2026-10-02"], "training"), "unknown");
    assert.strictEqual(habitStatus(streakStore.entries["2026-10-03"], "thesis"), "miss");
    assert.strictEqual(habitStatus(streakStore.entries["2026-10-01"], "sunlight"), "unknown");
    assert.strictEqual(habitStatus({ fields: {} }, "thesis"), "none");
    assert.strictEqual(habitStatus(undefined, "thesis"), "none");
    var mixed = dayCompletion(streakStore.entries["2026-10-02"], streakDefs);
    assert.strictEqual(mixed.state, "logged");
    assert.strictEqual(mixed.done, 1);
    assert.strictEqual(mixed.unknown, 2);
    assert.strictEqual(mixed.rate, 1 / 3);
    var allUnknown = dayCompletion({ habits: { thesis: null, training: null, sunlight: null } }, streakDefs);
    assert.strictEqual(allUnknown.state, "unknown");
    assert.strictEqual(allUnknown.rate, null);
    assert.strictEqual(dayCompletion({}, streakDefs).state, "none");
    var stats = habitStats(streakStore, streakDefs, ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    assert.strictEqual(stats.logged, 4);
    assert.strictEqual(stats.perHabit.thesis.done, 3);
    assert.strictEqual(stats.perHabit.training.done, 3);
    assert.strictEqual(stats.perHabit.training.rate, 0.75);
    assert.strictEqual(stats.perHabit.sunlight.done, 0);

    var seeded = reflectionsOf({ version: 1, entries: {} });
    assert.strictEqual(seeded.questions.length, 9);
    assert.strictEqual(seeded.questions[0].id, "q1");
    assert.strictEqual(seeded.questions[0].text, "If I knew I couldn't fail, what would I like to do?");
    assert.strictEqual(seeded.questions[1].text, "Even if I knew I would fail, what would I like to do anyway?");
    assert.strictEqual(seeded.questions[2].text, "If I had all the time and money in the world, but I had to use 40 hours a week to be of service to other people, what would I do?");
    assert.strictEqual(seeded.questions[3].text, "If I was giving a TED talk 40 years from now and the audience is giving it a standing ovation, what would I like to have talked about?");
    assert.strictEqual(seeded.questions[4].text, "What do I want people to say about me at my funeral?");
    assert.strictEqual(seeded.questions[5].text, "What do I want written about myself in my obituary?");
    assert.strictEqual(seeded.questions[6].text, "If I continued on this exact path, where would I end up five years from now? And is that where I want to end up?");
    assert.strictEqual(seeded.questions[7].text, "If I took a completely different path to what I'm doing right now, where might I end up five years from now?");
    assert.strictEqual(seeded.questions[8].text, "If I took a completely different path and did not care about money or what other people thought of me, where might I end up?");
    assert.deepStrictEqual(seeded.answers, {});
    var bare = { version: 1, entries: {} };
    reflectionsOf(bare);
    assert.strictEqual(bare.reflections, undefined);
    var covered = Object.create(null);
    var cursor = "2026-01-01";
    for (n = 0; n < 9; n++) {
      covered[reflectionIndex(cursor, 9)] = true;
      cursor = shift(cursor, 1);
    }
    assert.strictEqual(Object.keys(covered).length, 9);
    assert.strictEqual((reflectionIndex("2026-10-14", 9) + 1) % 9, reflectionIndex("2026-10-15", 9));
    assert.strictEqual(reflectionIndex("2026-10-14", 9), reflectionIndex("2026-10-14", 9));

    var reflectLocal = {
      version: 1,
      entries: {},
      quotes: {},
      reflections: {
        questions: [{ id: "q1", text: "local wording" }, { id: "extra", text: "A question only on this device" }],
        answers: {
          q1: [{ date: "2026-10-14", text: "Ship" }],
          extra: [{ date: "2026-10-01", text: "Local only" }]
        }
      }
    };
    var reflectRemote = {
      version: 1,
      entries: {},
      quotes: {},
      reflections: {
        questions: [{ id: "q1", text: "If I knew I couldn't fail, what would I like to do?" }],
        answers: {
          q1: [
            { date: "2026-10-14", text: "Ship" },
            { date: "2026-10-13", text: "Earlier thought" }
          ]
        }
      }
    };
    var reflectLocalJson = JSON.stringify(reflectLocal);
    var reflectRemoteJson = JSON.stringify(reflectRemote);
    var reflectMerged = mergeStores(reflectLocal, reflectRemote);
    assert.strictEqual(JSON.stringify(reflectLocal), reflectLocalJson);
    assert.strictEqual(JSON.stringify(reflectRemote), reflectRemoteJson);
    assert.strictEqual(reflectMerged.reflections.questions[0].text, "If I knew I couldn't fail, what would I like to do?");
    assert.strictEqual(reflectMerged.reflections.questions[1].id, "extra");
    assert.strictEqual(reflectMerged.reflections.answers.q1.length, 2);
    assert.strictEqual(reflectMerged.reflections.answers.q1[0].date, "2026-10-13");
    assert.strictEqual(reflectMerged.reflections.answers.q1[0].text, "Earlier thought");
    assert.strictEqual(reflectMerged.reflections.answers.q1[1].text, "Ship");
    assert.strictEqual(reflectMerged.reflections.answers.extra[0].text, "Local only");
    reflectMerged.reflections.answers.q1[1].text = "mutated";
    assert.strictEqual(reflectLocal.reflections.answers.q1[0].text, "Ship");
    assert.strictEqual(reflectRemote.reflections.answers.q1[1].text, "Earlier thought");
    var reflectOnlyLocal = mergeStores(
      { version: 1, entries: {}, reflections: { questions: [{ id: "q2", text: "Keep" }], answers: { q2: [{ date: "2026-10-02", text: "Anyway" }] } } },
      { version: 1, entries: {}, quotes: {} }
    );
    assert.strictEqual(reflectOnlyLocal.reflections.answers.q2[0].text, "Anyway");
    var reflectOnlyRemote = mergeStores(
      { version: 1, entries: {} },
      { version: 1, entries: {}, reflections: { questions: [{ id: "q3", text: "Service" }], answers: { q3: [{ date: "2026-10-03", text: "Teach" }] } } }
    );
    assert.strictEqual(reflectOnlyRemote.reflections.questions[0].id, "q3");
    assert.strictEqual(reflectOnlyRemote.reflections.answers.q3[0].text, "Teach");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(mergeStores({ version: 1, entries: {} }, { version: 1, entries: {} }), "reflections"), false);

    console.log("core ok");
  }
})();
