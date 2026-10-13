(function () {
  "use strict";

  // Every wiki citation used by the Habits view lives here.
  var WIKI = {
    videos: {
      habits: {
        title: "The Science of Making & Breaking Habits",
        by: "Huberman"
      },
      dopamine: {
        title: "Controlling Your Dopamine For Motivation, Focus & Satisfaction",
        by: "Huberman"
      },
      goals: {
        title: "How to Set & Achieve Goals | Huberman Lab Essentials",
        by: "Huberman"
      }
    },
    cites: {
      twentyOne: {
        video: "habits",
        concept: "21-day habit system",
        text: "6 habits a day, expect 4\u20135; missing some is built in. No making up missed habits the next day. Days 22\u201328 are a test automaticity week."
      },
      effort: {
        video: "dopamine",
        concept: "dopamine-from-effort",
        text: "Learn to spike your dopamine from effort itself."
      },
      intermittent: {
        video: "dopamine",
        concept: "intermittent-dopamine-schedules",
        text: "avoid predictable every-third-time rules; randomness matters"
      },
      milestones: {
        video: "habits",
        concept: "21-day habit system",
        text: "The 21-day mark is the 21-day habit system. The 66-day mark is habit formation average ~66 days, range 18\u2013254, Lally."
      },
      linchpin: {
        video: "habits",
        concept: "linchpin-habits",
        text: ""
      },
      identity: {
        video: "habits",
        concept: "goal-based vs identity-based habits",
        text: ""
      },
      moderate: {
        video: "goals",
        concept: "moderate-difficulty-goals",
        text: ""
      }
    }
  };

  var SLOTS = 7;
  var WIN_AT = 4;
  var BUILD_DAYS = 21;
  var CYCLE_DAYS = 28;
  var MILESTONES = [3, 7, 14, 21, 30, 66, 100];
  var XP_HABIT = 10;
  var XP_WIN = 20;
  var XP_SURPRISE = 30;
  var LINCHPINS = { thesis: true, training: true };
  var IDENTITY = {
    thesis: "I'm a researcher who ships",
    training: "I'm an athlete",
    speaking: "I'm a clear speaker",
    food_logged: "I'm someone who logs my food",
    weigh_in: "I'm someone who faces the scale",
    sunlight: "I'm someone who gets daylight",
    protein_breakfast: "I'm someone who starts with protein"
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function entriesOf(store) {
    return isRecord(store) && isRecord(store.entries) ? store.entries : {};
  }

  function isLogged(entry) {
    return isRecord(entry) && isRecord(entry.habits);
  }

  function isDone(entry, id) {
    return isLogged(entry) && entry.habits[id] === true;
  }

  function shiftDay(key, delta) {
    var date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)) + delta));
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
  }

  function daysBetween(start, end) {
    var a = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
    var b = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
    return Math.round((b - a) / 86400000);
  }

  function doneCount(entry, defs) {
    var list = Array.isArray(defs) ? defs : [];
    var n = 0;
    var i;
    for (i = 0; i < list.length; i++) if (isDone(entry, list[i].id)) n += 1;
    return n;
  }

  function isWin(entry, defs) {
    return isLogged(entry) && doneCount(entry, defs) >= WIN_AT;
  }

  function winStreak(store, defs, today) {
    var entries = entriesOf(store);
    var key = today;
    var n = 0;
    if (isLogged(entries[key])) {
      if (!isWin(entries[key], defs)) return 0;
    } else {
      key = shiftDay(today, -1);
    }
    while (key && isWin(entries[key], defs)) {
      n += 1;
      key = shiftDay(key, -1);
    }
    return n;
  }

  function firstLogged(store, today) {
    var entries = entriesOf(store);
    var keys = Object.keys(entries).filter(function (key) {
      return /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= today && isLogged(entries[key]);
    }).sort();
    return keys.length ? keys[0] : null;
  }

  function cycle(store, defs, today) {
    var start = firstLogged(store, today) || today;
    var offset = daysBetween(start, today);
    if (offset < 0) offset = 0;
    var day = (offset % CYCLE_DAYS) + 1;
    var phase = day <= BUILD_DAYS ? "build" : "test";
    var cycleStart = shiftDay(today, -(day - 1));
    var wins = 0;
    var limit = phase === "build" ? day : BUILD_DAYS;
    var i;
    for (i = 0; i < limit; i++) {
      var key = shiftDay(cycleStart, i);
      if (isWin(entriesOf(store)[key], defs)) wins += 1;
    }
    return {
      day: day,
      phase: phase,
      testDay: phase === "test" ? day - BUILD_DAYS : 0,
      wins: wins,
      progress: phase === "build" ? day / BUILD_DAYS : (day - BUILD_DAYS) / (CYCLE_DAYS - BUILD_DAYS)
    };
  }

  function surpriseRoll(dayKey) {
    var h = 2166136261;
    var s = "journal-surprise:" + dayKey;
    var i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100) < 31;
  }

  function dayXp(entry, defs, dayKey) {
    var done = doneCount(entry, defs);
    var habit = done * XP_HABIT;
    var win = isWin(entry, defs) ? XP_WIN : 0;
    var surprise = done > 0 && surpriseRoll(dayKey) ? XP_SURPRISE : 0;
    return { done: done, habit: habit, win: win, surprise: surprise, total: habit + win + surprise };
  }

  function levelOf(xp) {
    var level = 1;
    var need = 40;
    var left = xp;
    while (left >= need && level < 80) {
      left -= need;
      level += 1;
      need = 40 + (level - 1) * 15;
    }
    return { level: level, into: left, need: need, xp: xp };
  }

  function xpSummary(store, defs, today) {
    var entries = entriesOf(store);
    var keys = Object.keys(entries).filter(function (key) {
      return /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= today && isLogged(entries[key]);
    });
    var total = 0;
    var i;
    for (i = 0; i < keys.length; i++) total += dayXp(entries[keys[i]], defs, keys[i]).total;
    var todayXp = dayXp(entries[today], defs, today);
    var level = levelOf(total);
    level.today = todayXp;
    return level;
  }

  function milestoneStates(best) {
    var n = Number(best) || 0;
    return MILESTONES.map(function (days) {
      return { days: days, unlocked: n >= days };
    });
  }

  function weekRate(store, id, today) {
    var entries = entriesOf(store);
    var end = isLogged(entries[today]) ? today : shiftDay(today, -1);
    var done = 0;
    var loggedDays = 0;
    var key = end;
    var i;
    for (i = 0; i < 7; i++) {
      if (isLogged(entries[key])) loggedDays += 1;
      if (isDone(entries[key], id)) done += 1;
      key = shiftDay(key, -1);
    }
    return { done: done, loggedDays: loggedDays, rate: done / 7 };
  }

  function nudge(store, id, today) {
    var stat = weekRate(store, id, today);
    if (stat.loggedDays < 4) return null;
    if (stat.rate > 0.9) return { kind: "raise", rate: stat.rate, text: "Almost automatic this week. Raise the bar." };
    if (stat.rate < 0.3) return { kind: "ease", rate: stat.rate, text: "Rarely happening this week. Make it easier." };
    return null;
  }

  function identityOf(id) {
    return IDENTITY[id] || "I'm someone who shows up for this";
  }

  function isLinchpin(id) {
    return !!LINCHPINS[id];
  }

  function cite(key) {
    var item = WIKI.cites[key];
    var video = item ? WIKI.videos[item.video] : null;
    return {
      key: key,
      title: video ? video.title : "",
      by: video ? video.by : "",
      concept: item ? item.concept : "",
      text: item ? item.text : ""
    };
  }

  function play(store, defs, today) {
    var entry = entriesOf(store)[today];
    var done = doneCount(entry, defs);
    var logged = isLogged(entry);
    var experience = xpSummary(store, defs, today);
    return {
      done: done,
      total: SLOTS,
      logged: logged,
      win: logged && done >= WIN_AT,
      winStreak: winStreak(store, defs, today),
      cycle: cycle(store, defs, today),
      xp: experience
    };
  }

  var api = {
    WIKI: WIKI,
    SLOTS: SLOTS,
    WIN_AT: WIN_AT,
    MILESTONES: MILESTONES,
    XP_HABIT: XP_HABIT,
    XP_WIN: XP_WIN,
    XP_SURPRISE: XP_SURPRISE,
    cite: cite,
    doneCount: doneCount,
    isWin: isWin,
    winStreak: winStreak,
    cycle: cycle,
    surpriseRoll: surpriseRoll,
    dayXp: dayXp,
    levelOf: levelOf,
    xpSummary: xpSummary,
    milestoneStates: milestoneStates,
    weekRate: weekRate,
    nudge: nudge,
    identityOf: identityOf,
    isLinchpin: isLinchpin,
    play: play
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalGamify = api;

  if (typeof require === "function" && typeof module !== "undefined" && require.main === module) {
    var assert = require("assert");
    var titles = Object.keys(WIKI.videos).map(function (key) { return WIKI.videos[key].title; }).sort();
    assert.deepStrictEqual(titles, [
      "Controlling Your Dopamine For Motivation, Focus & Satisfaction",
      "How to Set & Achieve Goals | Huberman Lab Essentials",
      "The Science of Making & Breaking Habits"
    ]);
    Object.keys(WIKI.cites).forEach(function (key) {
      assert.ok(WIKI.videos[WIKI.cites[key].video], key);
    });
    assert.strictEqual(cite("twentyOne").text.indexOf("6 habits a day, expect 4\u20135; missing some is built in. No making up missed habits the next day.") >= 0, true);
    assert.strictEqual(cite("twentyOne").text.indexOf("test automaticity") >= 0, true);
    assert.strictEqual(cite("effort").text, "Learn to spike your dopamine from effort itself.");
    assert.strictEqual(cite("effort").concept, "dopamine-from-effort");
    assert.strictEqual(cite("intermittent").concept, "intermittent-dopamine-schedules");
    assert.strictEqual(cite("intermittent").text, "avoid predictable every-third-time rules; randomness matters");
    assert.strictEqual(cite("milestones").text.indexOf("18\u2013254, Lally") >= 0, true);
    assert.strictEqual(cite("linchpin").concept, "linchpin-habits");
    assert.strictEqual(cite("identity").concept, "goal-based vs identity-based habits");
    assert.strictEqual(cite("moderate").title, WIKI.videos.goals.title);
    assert.strictEqual(identityOf("training"), "I'm an athlete");
    assert.strictEqual(identityOf("thesis"), "I'm a researcher who ships");
    assert.strictEqual(identityOf("speaking"), "I'm a clear speaker");
    assert.strictEqual(isLinchpin("training"), true);
    assert.strictEqual(isLinchpin("thesis"), true);
    assert.strictEqual(isLinchpin("speaking"), false);

    var defs = [
      { id: "thesis" }, { id: "training" }, { id: "food_logged" }, { id: "weigh_in" },
      { id: "speaking" }, { id: "sunlight" }, { id: "protein_breakfast" }
    ];
    function habits(trues, nulls) {
      var map = {};
      defs.forEach(function (def, i) {
        if (i < trues) map[def.id] = true;
        else if (nulls && i < trues + nulls) map[def.id] = null;
        else map[def.id] = false;
      });
      return { habits: map };
    }
    assert.strictEqual(isWin(habits(4, 3), defs), true);
    assert.strictEqual(isWin(habits(3, 4), defs), false);
    assert.strictEqual(doneCount(habits(4, 2), defs), 4);
    assert.strictEqual(isWin({ habits: { thesis: null } }, defs), false);

    var streakStore = { entries: {} };
    streakStore.entries["2026-10-11"] = habits(5, 0);
    streakStore.entries["2026-10-12"] = habits(4, 1);
    streakStore.entries["2026-10-13"] = habits(2, 0);
    assert.strictEqual(winStreak(streakStore, defs, "2026-10-12"), 2);
    assert.strictEqual(winStreak(streakStore, defs, "2026-10-13"), 0);
    assert.strictEqual(winStreak(streakStore, defs, "2026-10-14"), 0);
    delete streakStore.entries["2026-10-13"];
    assert.strictEqual(winStreak(streakStore, defs, "2026-10-13"), 2);

    var cycleStore = { entries: { "2026-10-01": habits(4, 0), "2026-10-02": habits(1, 0) } };
    var built = cycle(cycleStore, defs, "2026-10-01");
    assert.strictEqual(built.day, 1);
    assert.strictEqual(built.phase, "build");
    assert.strictEqual(built.wins, 1);
    var later = cycle(cycleStore, defs, "2026-10-21");
    assert.strictEqual(later.day, 21);
    assert.strictEqual(later.phase, "build");
    var testWeek = cycle(cycleStore, defs, "2026-10-22");
    assert.strictEqual(testWeek.phase, "test");
    assert.strictEqual(testWeek.testDay, 1);
    assert.strictEqual(testWeek.wins, 1);
    var next = cycle(cycleStore, defs, "2026-10-29");
    assert.strictEqual(next.day, 1);
    assert.strictEqual(next.phase, "build");

    var flags = [];
    var everyThird = true;
    var cursor = "2026-01-01";
    var n;
    for (n = 0; n < 90; n++) {
      var hit = surpriseRoll(cursor);
      flags.push(hit);
      if (hit !== (n % 3 === 0)) everyThird = false;
      cursor = shiftDay(cursor, 1);
    }
    var hits = flags.filter(Boolean).length;
    assert.strictEqual(everyThird, false);
    assert.ok(hits > 12 && hits < 50);
    assert.strictEqual(surpriseRoll("2026-05-05"), surpriseRoll("2026-05-05"));

    var lucky = "2026-03-01";
    while (!surpriseRoll(lucky)) lucky = shiftDay(lucky, 1);
    var quiet = "2026-03-01";
    while (surpriseRoll(quiet)) quiet = shiftDay(quiet, 1);
    var xpStore = { entries: {} };
    xpStore.entries[lucky] = habits(4, 0);
    xpStore.entries[quiet] = habits(4, 0);
    var luckyXp = dayXp(xpStore.entries[lucky], defs, lucky);
    var quietXp = dayXp(xpStore.entries[quiet], defs, quiet);
    assert.strictEqual(luckyXp.habit, 40);
    assert.strictEqual(luckyXp.win, 20);
    assert.strictEqual(luckyXp.surprise, 30);
    assert.strictEqual(quietXp.surprise, 0);
    assert.strictEqual(dayXp(habits(0, 7), defs, lucky).surprise, 0);
    var sum = xpSummary(xpStore, defs, lucky > quiet ? lucky : quiet);
    assert.strictEqual(sum.xp, luckyXp.total + quietXp.total);
    assert.ok(sum.level >= 1 && sum.need > sum.into);

    assert.strictEqual(milestoneStates(20).filter(function (m) { return m.days === 21; })[0].unlocked, false);
    assert.strictEqual(milestoneStates(21).filter(function (m) { return m.days === 21; })[0].unlocked, true);
    assert.strictEqual(milestoneStates(66).filter(function (m) { return m.days === 66; })[0].unlocked, true);
    assert.strictEqual(milestoneStates(65).filter(function (m) { return m.days === 66; })[0].unlocked, false);

    var rateStore = { entries: {} };
    var day = "2026-10-07";
    for (n = 0; n < 7; n++) {
      var mid = habits(0, 0);
      mid.habits.thesis = n < 4;
      rateStore.entries[day] = mid;
      day = shiftDay(day, 1);
    }
    assert.strictEqual(nudge(rateStore, "thesis", "2026-10-13"), null);
    day = "2026-10-07";
    for (n = 0; n < 7; n++) {
      rateStore.entries[day] = habits(7, 0);
      day = shiftDay(day, 1);
    }
    assert.strictEqual(nudge(rateStore, "thesis", "2026-10-13").kind, "raise");
    day = "2026-10-07";
    for (n = 0; n < 7; n++) {
      var row = habits(0, 0);
      row.habits.thesis = n < 1;
      rateStore.entries[day] = row;
      day = shiftDay(day, 1);
    }
    assert.strictEqual(nudge(rateStore, "thesis", "2026-10-13").kind, "ease");
    assert.strictEqual(nudge({ entries: { "2026-10-13": habits(7, 0) } }, "thesis", "2026-10-13"), null);

    console.log("gamify ok");
  }
})();
