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
    return { version: 1, entries: {} };
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

  function copyEntry(entry) {
    if (!entry || typeof entry !== "object") return entry;
    var copy = {};
    var keys = Object.keys(entry);
    var i;
    for (i = 0; i < keys.length; i++) copy[keys[i]] = entry[keys[i]];
    return copy;
  }

  function entriesOf(store) {
    if (!store || !store.entries || typeof store.entries !== "object") return {};
    return store.entries;
  }

  function versionOf(store) {
    var version = store && store.version;
    return typeof version === "number" ? version : 1;
  }

  function mergeStores(local, remote) {
    var left = entriesOf(local);
    var right = entriesOf(remote);
    var names = Object.keys(left).concat(Object.keys(right));
    var entries = {};
    var seen = Object.create(null);
    var i;
    for (i = 0; i < names.length; i++) {
      var key = names[i];
      if (seen[key]) continue;
      seen[key] = true;
      var inLeft = Object.prototype.hasOwnProperty.call(left, key);
      var inRight = Object.prototype.hasOwnProperty.call(right, key);
      var chosen = inLeft && inRight ? choose(left[key], right[key]) : (inLeft ? left[key] : right[key]);
      entries[key] = copyEntry(chosen);
    }
    return { version: Math.max(versionOf(local), versionOf(remote)), entries: entries };
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
    mergeStores: mergeStores
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalCore = api;

  if (typeof require === "function" && typeof module !== "undefined" && require.main === module) {
    var assert = require("assert");
    var names = ["dayKey", "weekKey", "monthKey", "quarterKey", "yearKey", "kindOf", "shift", "label", "weekDays", "parentKey", "todayKey", "blankStore", "mergeStores"];
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

    console.log("core ok");
  }
})();
