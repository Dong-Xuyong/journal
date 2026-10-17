/* Read-only view of journal.json. Never writes the file or localStorage.
   Morning, evening, week, and month fields stay Grok-written. */
(function () {
  "use strict";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var QUARTER_SPAN = ["Jan \u2013 Mar", "Apr \u2013 Jun", "Jul \u2013 Sep", "Oct \u2013 Dec"];
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var CLOCK_RE = /^(\d{2}):(\d{2})$/;

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

  var DEFAULT_HABIT_DEFS = [
    { id: "thesis", label: "Thesis", emoji: "\uD83D\uDCDD" },
    { id: "training", label: "Training", emoji: "\uD83D\uDCAA" },
    { id: "food_logged", label: "Food logged", emoji: "\uD83C\uDF7D\uFE0F" },
    { id: "weigh_in", label: "Weigh in", emoji: "\u2696\uFE0F" },
    { id: "speaking", label: "Speaking", emoji: "\uD83D\uDDE3\uFE0F" },
    { id: "sunlight", label: "Sunlight", emoji: "\u2600\uFE0F" },
    { id: "protein_breakfast", label: "Protein breakfast", emoji: "\uD83E\uDD5A" }
  ];

  var state = { version: 1, entries: {}, quotes: {} };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value) {
    if (value == null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function dayKey(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

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
    var when = date || new Date();
    if (kind === "day") return dayKey(when);
    if (kind === "week") return weekKey(when);
    if (kind === "month") return monthKey(when);
    if (kind === "quarter") return quarterKey(when);
    if (kind === "year") return yearKey(when);
    return null;
  }

  function weeksInMonth(key) {
    var year = Number(key.slice(0, 4));
    var month = Number(key.slice(5, 7));
    var first = new Date(Date.UTC(year, month - 1, 1));
    var weekday = first.getUTCDay() || 7;
    var monday = weekday === 1 ? 1 : 1 + (8 - weekday);
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var out = [];
    var day;
    for (day = monday; day <= last; day += 7) out.push(isoWeekKey(year, month - 1, day));
    return out;
  }

  function monthsInQuarter(key) {
    var year = key.slice(0, 4);
    var start = (Number(key.slice(6)) - 1) * 3 + 1;
    return [year + "-" + pad2(start), year + "-" + pad2(start + 1), year + "-" + pad2(start + 2)];
  }

  function quartersInYear(key) {
    return [key + "-Q1", key + "-Q2", key + "-Q3", key + "-Q4"];
  }

  function monthDays(key) {
    var year = Number(key.slice(0, 4));
    var month = Number(key.slice(5, 7));
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var out = [];
    var day;
    for (day = 1; day <= last; day++) out.push(year + "-" + pad2(month) + "-" + pad2(day));
    return out;
  }

  function children(key) {
    var kind = kindOf(key);
    if (kind === "week") return weekDays(key);
    if (kind === "month") return weeksInMonth(key);
    if (kind === "quarter") return monthsInQuarter(key);
    if (kind === "year") return quartersInYear(key);
    return [];
  }

  function ancestors(key) {
    var out = [];
    var next = parentKey(key);
    var guard = 0;
    while (next && guard < 6) {
      out.push(next);
      next = parentKey(next);
      guard += 1;
    }
    return out;
  }

  function daysIn(key, through) {
    var kind = kindOf(key);
    var days = [];
    var i;
    if (kind === "day") days = [key];
    else if (kind === "week") days = weekDays(key);
    else if (kind === "month") days = monthDays(key);
    else if (kind === "quarter") {
      var months = monthsInQuarter(key);
      for (i = 0; i < months.length; i++) days = days.concat(monthDays(months[i]));
    } else if (kind === "year") {
      var month;
      for (month = 1; month <= 12; month++) days = days.concat(monthDays(String(key).slice(0, 4) + "-" + pad2(month)));
    }
    if (typeof through === "string" && through.length) {
      days = days.filter(function (day) { return day <= through; });
    }
    return days;
  }

  function load(raw) {
    state = isRecord(raw) ? cloneJson(raw) : { version: 1, entries: {}, quotes: {} };
  }

  function entryRaw(key) {
    var entries = isRecord(state.entries) ? state.entries : null;
    if (!entries) return null;
    return isRecord(entries[key]) ? entries[key] : null;
  }

  function entry(key) {
    var found = entryRaw(key);
    return found ? cloneJson(found) : null;
  }

  function fields(key) {
    var found = entryRaw(key);
    if (!found || !isRecord(found.fields)) return {};
    return cloneJson(found.fields);
  }

  function todos(key) {
    var found = entryRaw(key);
    if (!found || !Array.isArray(found.todos)) return [];
    return cloneJson(found.todos);
  }

  function quote(day) {
    var quotes = isRecord(state.quotes) ? state.quotes : null;
    var item = quotes ? quotes[day] : null;
    if (!isRecord(item) || typeof item.text !== "string" || item.text.trim() === "") return null;
    return cloneJson(item);
  }

  function integerScore(value) {
    if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
    return null;
  }

  function scoreInFields(found, key) {
    if (!found || !isRecord(found.fields)) return null;
    return integerScore(found.fields[key]);
  }

  function daysBag(day) {
    if (!isRecord(state.days)) return null;
    return state.days[day];
  }

  function scoreInDays(day, key) {
    var bag = daysBag(day);
    if (!isRecord(bag)) return null;
    var direct = integerScore(bag[key]);
    if (direct != null) return direct;
    if (isRecord(bag.fields)) return integerScore(bag.fields[key]);
    return null;
  }

  function moodOf(day) {
    var found = entryRaw(day);
    var fromFields = scoreInFields(found, "mood");
    if (fromFields != null) return fromFields;
    var fromDays = scoreInDays(day, "mood");
    if (fromDays != null) return fromDays;
    var meter = scoreInFields(found, "moodMeter");
    if (meter != null) return meter;
    return scoreInDays(day, "moodMeter");
  }

  function energyOf(day) {
    var fromFields = scoreInFields(entryRaw(day), "energy");
    if (fromFields != null) return fromFields;
    return scoreInDays(day, "energy");
  }

  function finite(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function clockMinutes(value) {
    if (typeof value !== "string") return null;
    var match = CLOCK_RE.exec(value.trim());
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function clockOrNull(value) {
    return clockMinutes(value) == null ? null : value.trim();
  }

  function sleepHours(bed, wake) {
    var bedMinutes = clockMinutes(bed);
    var wakeMinutes = clockMinutes(wake);
    if (bedMinutes == null || wakeMinutes == null) return null;
    var diff = wakeMinutes - bedMinutes;
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  }

  function qualityOrNull(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < 1 || value > 5) return null;
    return value;
  }

  function hoursFromText(value) {
    var text = value.trim();
    var range = /^(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})$/.exec(text);
    if (range) return { bed: range[1], wake: range[2], hours: sleepHours(range[1], range[2]) };
    if (CLOCK_RE.test(text)) return null;
    var leading = /^\s*(-?\d+(?:\.\d+)?)/.exec(text);
    if (!leading) return null;
    var n = Number(leading[1]);
    if (!Number.isFinite(n) || n < 0 || n > 24) return null;
    return { bed: null, wake: null, hours: n };
  }

  function readNight(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 24) {
      return { bed: null, wake: null, hours: value, quality: null, note: "", updatedAt: null };
    }
    if (typeof value === "string") {
      var parsed = hoursFromText(value);
      if (!parsed) return null;
      return { bed: parsed.bed, wake: parsed.wake, hours: parsed.hours, quality: null, note: "", updatedAt: null };
    }
    if (!isRecord(value)) return null;
    var bed = clockOrNull(value.bed);
    var wake = clockOrNull(value.wake);
    var hours = finite(value.hours);
    if (hours == null) hours = finite(value.sleepHours);
    if (hours == null) hours = sleepHours(bed, wake);
    if (hours != null && (hours < 0 || hours > 24)) hours = null;
    var quality = qualityOrNull(value.quality);
    var note = typeof value.note === "string" ? value.note : "";
    if (bed == null && wake == null && hours == null && quality == null && !note) return null;
    return {
      bed: bed,
      wake: wake,
      hours: hours,
      quality: quality,
      note: note,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
    };
  }

  function timeOf(record) {
    if (!record || record.updatedAt == null) return null;
    var t = Date.parse(record.updatedAt);
    return Number.isFinite(t) ? t : null;
  }

  function newerRecord(a, b) {
    var ta = timeOf(a);
    var tb = timeOf(b);
    if (ta == null && tb == null) return b;
    if (ta == null) return b;
    if (tb == null) return a;
    return tb >= ta ? b : a;
  }

  function overlay(loser, winner) {
    var out = {};
    var key;
    var source = loser || {};
    for (key in source) if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
    source = winner || {};
    for (key in source) if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
    return out;
  }

  function nightFromEntry(found) {
    if (!isRecord(found)) return null;
    var entryFields = isRecord(found.fields) ? found.fields : {};
    var night = readNight(entryFields.sleep) || readNight(found.sleep) || readNight(entryFields.sleepHours);
    if (night && !night.updatedAt && typeof found.updatedAt === "string") night.updatedAt = found.updatedAt;
    return night;
  }

  function journalSleepMap(doc) {
    var out = {};
    if (!isRecord(doc)) return out;
    var entries = isRecord(doc.entries) ? doc.entries : {};
    var date;
    var dates = Object.keys(entries);
    var i;
    for (i = 0; i < dates.length; i++) {
      date = dates[i];
      if (!DATE_RE.test(date)) continue;
      var night = nightFromEntry(entries[date]);
      if (night) out[date] = night;
    }
    if (isRecord(doc.sleep)) {
      dates = Object.keys(doc.sleep);
      for (i = 0; i < dates.length; i++) {
        date = dates[i];
        if (!DATE_RE.test(date)) continue;
        var mapped = readNight(doc.sleep[date]);
        if (!mapped) continue;
        if (!out[date]) out[date] = mapped;
        else {
          var winner = newerRecord(out[date], mapped);
          var loser = winner === out[date] ? mapped : out[date];
          out[date] = overlay(loser, winner);
          if (out[date].hours == null) out[date].hours = sleepHours(out[date].bed, out[date].wake);
        }
      }
    }
    return out;
  }

  function sleepOf(day) {
    if (kindOf(day) !== "day") return null;
    var night = journalSleepMap(state)[day];
    return night ? cloneJson(night) : null;
  }

  function defaultQuestions() {
    return cloneJson(REFLECTION_QUESTIONS);
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

  function reflections() {
    var raw = isRecord(state.reflections) ? state.reflections : null;
    var questions = raw ? questionList(raw) : [];
    if (!questions.length) questions = defaultQuestions();
    var answers = raw && isRecord(raw.answers) ? cloneJson(raw.answers) : {};
    return { questions: questions, answers: answers };
  }

  function reflectionIndex(day, count) {
    var n = count > 0 ? count : REFLECTION_QUESTIONS.length;
    var days = Math.floor(Date.UTC(Number(String(day).slice(0, 4)), Number(String(day).slice(5, 7)) - 1, Number(String(day).slice(8, 10))) / 86400000);
    if (days !== days) return 0;
    return ((days % n) + n) % n;
  }

  function questionOfDay(day) {
    var list = reflections().questions;
    if (!list.length) return null;
    return list[reflectionIndex(day, list.length)];
  }

  function habitDefsOf(store) {
    var raw = store && store.habitDefs;
    var out = [];
    var i;
    if (!Array.isArray(raw)) return cloneJson(DEFAULT_HABIT_DEFS);
    for (i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (!item || typeof item.id !== "string" || item.id.length === 0) continue;
      out.push({
        id: item.id,
        label: typeof item.label === "string" && item.label.length ? item.label : item.id,
        emoji: typeof item.emoji === "string" && item.emoji.length ? item.emoji : "\u2022"
      });
    }
    return out.length ? out : cloneJson(DEFAULT_HABIT_DEFS);
  }

  function habitDefs() {
    return habitDefsOf(state);
  }

  function habitStatusOf(found, id) {
    if (!isRecord(found) || !isRecord(found.habits)) return "none";
    if (!Object.prototype.hasOwnProperty.call(found.habits, id)) return "unknown";
    var value = found.habits[id];
    if (value === true) return "done";
    if (value === false) return "miss";
    return "unknown";
  }

  function habitStatus(day, id) {
    return habitStatusOf(entryRaw(day), id);
  }

  function stat(values) {
    var n = 0;
    var sum = 0;
    var min = null;
    var max = null;
    var i;
    for (i = 0; i < values.length; i++) {
      var value = values[i];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      n += 1;
      sum += value;
      if (min == null || value < min) min = value;
      if (max == null || value > max) max = value;
    }
    return { avg: n ? sum / n : null, n: n, min: min, max: max };
  }

  function rollupKeys(key, through) {
    var seen = Object.create(null);
    var out = [];
    function add(item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    }
    function walk(item) {
      add(item);
      var kids = children(item);
      var i;
      for (i = 0; i < kids.length; i++) {
        if (kindOf(kids[i]) === "day") {
          if (typeof through !== "string" || !through || kids[i] <= through) add(kids[i]);
        } else walk(kids[i]);
      }
    }
    walk(key);
    var days = daysIn(key, through);
    var n;
    for (n = 0; n < days.length; n++) add(days[n]);
    return out;
  }

  function todoTotals(keys) {
    var done = 0;
    var total = 0;
    var i;
    var j;
    for (i = 0; i < keys.length; i++) {
      var found = entryRaw(keys[i]);
      var list = found && Array.isArray(found.todos) ? found.todos : [];
      for (j = 0; j < list.length; j++) {
        total += 1;
        if (list[j] && list[j].done === true) done += 1;
      }
    }
    return { done: done, total: total };
  }

  function habitRateFor(days) {
    var defs = habitDefsOf(state);
    if (!defs.length) return null;
    var logged = [];
    var i;
    var j;
    for (i = 0; i < days.length; i++) {
      var found = entryRaw(days[i]);
      if (found && isRecord(found.habits)) logged.push(days[i]);
    }
    if (!logged.length) return null;
    var hits = 0;
    for (j = 0; j < defs.length; j++) {
      for (i = 0; i < logged.length; i++) {
        if (habitStatusOf(entryRaw(logged[i]), defs[j].id) === "done") hits += 1;
      }
    }
    return hits / (logged.length * defs.length);
  }

  function reflectionCount(daySet) {
    var answers = isRecord(state.reflections) && isRecord(state.reflections.answers) ? state.reflections.answers : {};
    var ids = Object.keys(answers);
    var n = 0;
    var i;
    var j;
    for (i = 0; i < ids.length; i++) {
      var list = answers[ids[i]];
      if (!Array.isArray(list)) continue;
      for (j = 0; j < list.length; j++) {
        var item = list[j];
        if (item && typeof item.date === "string" && daySet[item.date]) n += 1;
      }
    }
    return n;
  }

  function compute(key, through) {
    var days = daysIn(key, through);
    var sleepMap = journalSleepMap(state);
    var moods = [];
    var energies = [];
    var sleeps = [];
    var logged = 0;
    var daySet = Object.create(null);
    var i;
    for (i = 0; i < days.length; i++) {
      var day = days[i];
      daySet[day] = true;
      var mood = moodOf(day);
      var energy = energyOf(day);
      var night = sleepMap[day];
      if (mood != null) moods.push(mood);
      if (energy != null) energies.push(energy);
      if (night && typeof night.hours === "number" && Number.isFinite(night.hours)) sleeps.push(night.hours);
      if (mood != null || energy != null || night) logged += 1;
    }
    return {
      days: days.length,
      logged: logged,
      mood: stat(moods),
      energy: stat(energies),
      sleep: stat(sleeps),
      todos: todoTotals(rollupKeys(key, through)),
      habitRate: habitRateFor(days),
      reflections: reflectionCount(daySet)
    };
  }

  function isEmptyRollup(stats) {
    return stats.logged === 0 && stats.mood.n === 0 && stats.energy.n === 0 && stats.sleep.n === 0 && stats.todos.total === 0 && stats.reflections === 0 && stats.habitRate == null;
  }

  function rollup(key, opts) {
    if (!kindOf(key)) return null;
    var through = opts && typeof opts.through === "string" ? opts.through : "";
    var stats = compute(key, through);
    if (isEmptyRollup(stats)) return null;
    var kids = children(key);
    var series = [];
    var i;
    for (i = 0; i < kids.length; i++) {
      var point = compute(kids[i], through);
      point.key = kids[i];
      series.push(point);
    }
    stats.series = series;
    return stats;
  }

  var api = {
    load: load,
    entry: entry,
    fields: fields,
    todos: todos,
    quote: quote,
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
    todayKey: todayKey,
    parentKey: parentKey,
    weekDays: weekDays,
    defaultQuestions: defaultQuestions
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalData = api;
})();
