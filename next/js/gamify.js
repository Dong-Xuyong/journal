(function () {
  "use strict";

  // XP, levels, and surprise rolls live in this file so the habits view can drop them without changing journal.json.
  // Every wiki citation used by the journal lives here.
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
      },
      contiMental: {
        title: "Dr. Paul Conti: How to Understand & Assess Your Mental Health | Huberman Lab Guest Series",
        by: "Huberman"
      },
      brackett: {
        title: "How to Better Regulate Your Emotions | Dr. Marc Brackett",
        by: "Huberman"
      },
      contiTools: {
        title: "Tools to Bolster Your Mental Health & Confidence | Dr. Paul Conti",
        by: "Huberman"
      },
      balcetis: {
        title: "Essentials: Tools for Setting & Achieving Goals | Dr. Emily Balcetis",
        by: "Huberman"
      }
    },
    cites: {
      twentyOne: {
        video: "habits",
        concept: "21-day habit system",
        text: "Aim for 4 or 5 habits a day, and don't make up a miss tomorrow."
      },
      effort: {
        video: "dopamine",
        concept: "dopamine-from-effort",
        text: "Let the good feeling come from the effort itself."
      },
      intermittent: {
        video: "dopamine",
        concept: "intermittent-dopamine-schedules",
        text: "A surprise reward works better than one you can count on."
      },
      milestones: {
        video: "habits",
        concept: "21-day habit system",
        text: "The 21-day and 66-day marks are the usual checks for a new habit."
      },
      linchpin: {
        video: "habits",
        concept: "linchpin-habits",
        text: "These habits make the other ones easier."
      },
      identity: {
        video: "habits",
        concept: "goal-based vs identity-based habits",
        text: "Act like the kind of person you want to be."
      },
      moderate: {
        video: "goals",
        concept: "moderate-difficulty-goals",
        text: "If it is too easy or too hard, change it."
      },
      gratitude: {
        video: "contiMental",
        concept: "agency-and-gratitude",
        text: "Being glad for something is part of a healthy mind."
      },
      feelings: {
        video: "brackett",
        concept: "granular-emotion-labeling",
        text: "Naming the feeling helps you decide what to do."
      },
      reviews: {
        video: "contiTools",
        concept: "examined-life-choice-audit",
        text: "Notice what you chose and what you did on autopilot."
      },
      failure: {
        video: "goals",
        concept: "visualize-failure-goal-pursuit",
        text: "Seeing what you lose if you skip it makes you more likely to do it."
      },
      obstacle: {
        video: "balcetis",
        concept: "obstacle-planning-goal-pursuit",
        text: "Name what could stop you, then decide what you will do."
      },
      habitCycle: {
        video: "habits",
        concept: "twenty-one-day-habit-system",
        text: "Build the habit for 21 days, then see if it sticks."
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

  function surpriseRoll(dayKey, prefix) {
    var h = 2166136261;
    var s = (prefix || "journal-surprise:") + dayKey;
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

  function calendar() {
    if (typeof window !== "undefined" && window.JournalCore && window.JournalCore.weekDays) return window.JournalCore;
    if (typeof window !== "undefined" && window.JournalData && window.JournalData.weekDays) return window.JournalData;
    return require("../../core.js");
  }

  function fieldsOf(entry) {
    return isRecord(entry) && isRecord(entry.fields) ? entry.fields : {};
  }

  function scoreFilled(value) {
    return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
  }

  function moodScore(fields) {
    if (scoreFilled(fields.mood)) return fields.mood;
    if (scoreFilled(fields.moodMeter)) return fields.moodMeter;
    return null;
  }

  function anchorDay(kind, key, today) {
    var cal = calendar();
    var end = today;
    if (kind === "day") end = key;
    else if (kind === "week") end = cal.weekDays(key)[6];
    else if (kind === "month") end = cal.shift(cal.shift(key, 1) + "-01", -1);
    return end > today ? today : end;
  }

  function feelingWindow(store, endDay, length) {
    var entries = entriesOf(store);
    var points = [];
    var moodSum = 0;
    var moodN = 0;
    var energySum = 0;
    var energyN = 0;
    var logged = 0;
    var day = shiftDay(endDay, -(length - 1));
    var i;
    for (i = 0; i < length; i++) {
      var fields = fieldsOf(entries[day]);
      var mood = moodScore(fields);
      var energy = scoreFilled(fields.energy) ? fields.energy : null;
      if (mood != null) { moodSum += mood; moodN += 1; }
      if (energy != null) { energySum += energy; energyN += 1; }
      if (mood != null || energy != null) logged += 1;
      points.push({ day: day, mood: mood, energy: energy });
      day = shiftDay(day, 1);
    }
    return {
      points: points,
      logged: logged,
      moodAvg: moodN ? moodSum / moodN : null,
      energyAvg: energyN ? energySum / energyN : null
    };
  }

  function moodTrends(store, view) {
    var anchor = anchorDay(view.kind, view.key, view.today);
    var week = feelingWindow(store, anchor, 7);
    var month = feelingWindow(store, anchor, 30);
    return {
      anchor: anchor,
      feelings: {
        week: week,
        month: month,
        badge: week.logged > 0 || month.logged > 0
      }
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
    play: play,
    moodTrends: moodTrends
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.JournalGamify = api;

  if (typeof require === "function" && typeof module !== "undefined" && require.main === module) {
    var assert = require("assert");
    var titles = Object.keys(WIKI.videos).map(function (key) { return WIKI.videos[key].title; }).sort();
    assert.deepStrictEqual(titles, [
      "Controlling Your Dopamine For Motivation, Focus & Satisfaction",
      "Dr. Paul Conti: How to Understand & Assess Your Mental Health | Huberman Lab Guest Series",
      "Essentials: Tools for Setting & Achieving Goals | Dr. Emily Balcetis",
      "How to Better Regulate Your Emotions | Dr. Marc Brackett",
      "How to Set & Achieve Goals | Huberman Lab Essentials",
      "The Science of Making & Breaking Habits",
      "Tools to Bolster Your Mental Health & Confidence | Dr. Paul Conti"
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

    assert.strictEqual(WIKI.cites.journalStreak, undefined);
    assert.strictEqual(WIKI.cites.balance, undefined);
    assert.strictEqual(cite("gratitude").concept, "agency-and-gratitude");
    assert.strictEqual(cite("gratitude").text, "Agency and gratitude are the two pillars of a healthy self.");
    assert.strictEqual(cite("feelings").concept, "granular-emotion-labeling");
    assert.strictEqual(cite("feelings").text, "Labeling drives choosing the right strategy.");
    assert.strictEqual(cite("reviews").concept, "examined-life-choice-audit");
    assert.strictEqual(cite("reviews").text, "Ask how much is chosen versus habit or momentum.");
    assert.strictEqual(cite("failure").concept, "visualize-failure-goal-pursuit");
    assert.strictEqual(cite("failure").text, "Nearly doubles goal attainment.");
    assert.strictEqual(cite("obstacle").concept, "obstacle-planning-goal-pursuit");
    assert.strictEqual(cite("obstacle").title, WIKI.videos.balcetis.title);
    assert.strictEqual(cite("habitCycle").concept, "twenty-one-day-habit-system");
    assert.strictEqual(cite("moderate").concept, "moderate-difficulty-goals");

    var log = { entries: {} };
    log.entries["2026-10-10"] = { fields: { mood: 4, energy: 3, moodMeter: 1 } };
    log.entries["2026-10-11"] = { fields: { mood: 2, moodMeter: 5 } };
    log.entries["2026-10-12"] = { fields: { moodMeter: 5 } };
    log.entries["2026-10-13"] = { fields: { moodMeter: 9, energy: 2 } };
    var trends = moodTrends(log, { kind: "day", key: "2026-10-13", today: "2026-10-13" });
    var byDay = {};
    assert.strictEqual(trends.anchor, "2026-10-13");
    assert.strictEqual(trends.streak, undefined);
    assert.strictEqual(trends.xp, undefined);
    assert.strictEqual(trends.balance, undefined);
    assert.strictEqual(trends.feelings.week.logged, 4);
    assert.strictEqual(trends.feelings.badge, true);
    assert.strictEqual(trends.feelings.week.moodAvg, 3.6666666666666665);
    trends.feelings.week.points.forEach(function (point) { byDay[point.day] = point; });
    assert.strictEqual(byDay["2026-10-10"].mood, 4);
    assert.strictEqual(byDay["2026-10-11"].mood, 2);
    assert.strictEqual(byDay["2026-10-12"].mood, 5);
    assert.strictEqual(byDay["2026-10-12"].energy, null);
    assert.strictEqual(byDay["2026-10-13"].mood, null);
    assert.strictEqual(byDay["2026-10-13"].energy, 2);
    assert.strictEqual(moodTrends(log, { kind: "month", key: "2026-10", today: "2026-10-13" }).anchor, "2026-10-13");
    assert.strictEqual(moodTrends(log, { kind: "week", key: "2026-W50", today: "2026-10-13" }).anchor, "2026-10-13");
    assert.strictEqual(moodTrends({ entries: {} }, { kind: "day", key: "2026-10-13", today: "2026-10-13" }).feelings.badge, false);

    console.log("gamify ok");
  }
})();
