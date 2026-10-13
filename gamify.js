(function () {
  "use strict";

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
      },
      journalStreak: {
        video: "habits",
        concept: "21-day habit system",
        text: "The 21-day mark is the 21-day habit system. The 66-day mark is habit formation average ~66 days, range 18\u2013254, Lally."
      },
      gratitude: {
        video: "contiMental",
        concept: "agency-and-gratitude",
        text: "Agency and gratitude are the two pillars of a healthy self."
      },
      feelings: {
        video: "brackett",
        concept: "granular-emotion-labeling",
        text: "Labeling drives choosing the right strategy."
      },
      reviews: {
        video: "contiTools",
        concept: "examined-life-choice-audit",
        text: "Ask how much is chosen versus habit or momentum."
      },
      balance: {
        video: "contiTools",
        concept: "doing-vs-thinking-balance",
        text: ""
      },
      failure: {
        video: "goals",
        concept: "visualize-failure-goal-pursuit",
        text: "Nearly doubles goal attainment."
      },
      obstacle: {
        video: "balcetis",
        concept: "obstacle-planning-goal-pursuit",
        text: ""
      },
      habitCycle: {
        video: "habits",
        concept: "twenty-one-day-habit-system",
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
  var JOURNAL_MILESTONES = [3, 7, 21, 30, 66, 100];
  var XP_MORNING = 10;
  var XP_EVENING = 10;
  var XP_WEEK = 30;
  var XP_MONTH = 50;
  var XP_QUARTER = 80;
  var XP_JOURNAL_SURPRISE = 30;
  var MORNING_FIELDS = ["mood", "energy", "focus", "grateful", "makeGreat", "affirmation"];
  var EVENING_FIELDS = ["highlights", "better"];
  var REVIEW_FIELDS = {
    week: ["wins", "accomplishments", "improve", "rootCause"],
    month: ["wins", "accomplishments", "improve", "rootCause", "goalsReview"],
    quarter: ["wins", "improve", "yearProgress"]
  };
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
    if (typeof window !== "undefined" && window.JournalCore) return window.JournalCore;
    return require("./core.js");
  }

  function fieldsOf(entry) {
    return isRecord(entry) && isRecord(entry.fields) ? entry.fields : {};
  }

  function textFilled(value) {
    return String(value == null ? "" : value).trim() !== "";
  }

  function scoreFilled(value) {
    return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
  }

  function gratefulList(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function (line) {
      return String(line == null ? "" : line).trim();
    }).filter(Boolean);
  }

  function fieldFilled(key, value) {
    if (key === "mood" || key === "energy") return scoreFilled(value);
    if (key === "grateful") return gratefulList(value).length > 0;
    return textFilled(value);
  }

  function sectionFilled(entry, keys) {
    var fields = fieldsOf(entry);
    var i;
    for (i = 0; i < keys.length; i++) if (fieldFilled(keys[i], fields[keys[i]])) return true;
    return false;
  }

  function morningFilled(entry) {
    return sectionFilled(entry, MORNING_FIELDS);
  }

  function eveningFilled(entry) {
    return sectionFilled(entry, EVENING_FIELDS);
  }

  function journaled(entry) {
    return morningFilled(entry) || eveningFilled(entry);
  }

  function gratitudeCount(entry) {
    return gratefulList(fieldsOf(entry).grateful).length;
  }

  function actionTaken(entry) {
    var list = isRecord(entry) && Array.isArray(entry.todos) ? entry.todos : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var todo = list[i];
      if (!isRecord(todo)) continue;
      if (!textFilled(todo.text)) continue;
      if (todo.done === true || todo.mit === true) return true;
    }
    return false;
  }

  function reviewFilled(entry, kind) {
    var keys = REVIEW_FIELDS[kind];
    return !!keys && sectionFilled(entry, keys);
  }

  function quarterStart(key) {
    var quarter = Number(key.slice(6));
    return key.slice(0, 4) + "-" + pad((quarter - 1) * 3 + 1) + "-01";
  }

  function anchorDay(kind, key, today) {
    var cal = calendar();
    var end = today;
    if (kind === "day") end = key;
    else if (kind === "week") end = cal.weekDays(key)[6];
    else if (kind === "month") end = cal.shift(cal.shift(key, 1) + "-01", -1);
    return end > today ? today : end;
  }

  function eachDay(start, end, visit) {
    var cal = calendar();
    var day = start;
    while (day && end && day <= end) {
      visit(day);
      day = cal.shift(day, 1);
    }
  }

  function periodDays(kind, key, today) {
    var cal = calendar();
    var anchor = anchorDay(kind, key, today);
    var start = anchor;
    var days = [];
    if (kind === "day") start = key;
    else if (kind === "week") start = cal.weekDays(key)[0];
    else if (kind === "month") start = key + "-01";
    if (!start || !anchor || anchor < start) return days;
    eachDay(start, anchor, function (day) { days.push(day); });
    return days;
  }

  function streakEnding(store, today, pred) {
    var entries = entriesOf(store);
    var key = pred(entries[today]) ? today : shiftDay(today, -1);
    var n = 0;
    while (pred(entries[key])) {
      n += 1;
      key = shiftDay(key, -1);
    }
    return n;
  }

  function bestRun(store, today, pred) {
    var entries = entriesOf(store);
    var keys = Object.keys(entries).filter(function (key) {
      return /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= today;
    }).sort();
    if (!keys.length) return 0;
    var best = 0;
    var run = 0;
    eachDay(keys[0], today, function (day) {
      if (pred(entries[day])) run += 1;
      else run = 0;
      if (run > best) best = run;
    });
    return best;
  }

  function journalStreak(store, today) {
    return streakEnding(store, today, journaled);
  }

  function journalBest(store, today) {
    return bestRun(store, today, journaled);
  }

  function gratitudeStreak(store, today) {
    return streakEnding(store, today, function (entry) { return gratitudeCount(entry) > 0; });
  }

  function gratitudeTotal(store, today) {
    var entries = entriesOf(store);
    var total = 0;
    Object.keys(entries).forEach(function (key) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && key <= today) total += gratitudeCount(entries[key]);
    });
    return total;
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
      var mood = scoreFilled(fields.mood) ? fields.mood : null;
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

  function weeksTouched(monthKey, today) {
    var cal = calendar();
    var start = monthKey + "-01";
    var end = cal.shift(cal.shift(monthKey, 1) + "-01", -1);
    var seen = [];
    if (today < start) return seen;
    if (today < end) end = today;
    eachDay(start, end, function (day) {
      var week = cal.parentKey(day);
      if (seen.indexOf(week) === -1) seen.push(week);
    });
    return seen;
  }

  function entryStarted(key, today) {
    var cal = calendar();
    var kind = cal.kindOf(key);
    if (kind === "day") return key <= today;
    if (kind === "week") return cal.weekDays(key)[0] <= today;
    if (kind === "month") return key + "-01" <= today;
    if (kind === "quarter") return quarterStart(key) <= today;
    return false;
  }

  function journalParts(entry, key) {
    var kind = calendar().kindOf(key);
    var morning = 0;
    var evening = 0;
    var review = 0;
    if (kind === "day") {
      if (morningFilled(entry)) morning = XP_MORNING;
      if (eveningFilled(entry)) evening = XP_EVENING;
    } else if (reviewFilled(entry, kind)) {
      if (kind === "week") review = XP_WEEK;
      else if (kind === "month") review = XP_MONTH;
      else if (kind === "quarter") review = XP_QUARTER;
    }
    var base = morning + evening + review;
    var surprise = base > 0 && surpriseRoll(key, "journal-page:") ? XP_JOURNAL_SURPRISE : 0;
    return { morning: morning, evening: evening, review: review, surprise: surprise, total: base + surprise };
  }

  function journalXp(store, today) {
    var entries = entriesOf(store);
    var total = 0;
    Object.keys(entries).forEach(function (key) {
      if (entryStarted(key, today)) total += journalParts(entries[key], key).total;
    });
    return levelOf(total);
  }

  function reviewRatio(done, expected) {
    return { done: done, expected: expected };
  }

  function journalBoard(store, view) {
    var kind = view.kind;
    var key = view.key;
    var today = view.today;
    var cal = calendar();
    var entries = entriesOf(store);
    var anchor = anchorDay(kind, key, today);
    var days = periodDays(kind, key, today);
    var balancedCount = 0;
    var periodItems = 0;
    var i;
    for (i = 0; i < days.length; i++) {
      var dayEntry = entries[days[i]];
      if (eveningFilled(dayEntry) && actionTaken(dayEntry)) balancedCount += 1;
      periodItems += gratitudeCount(dayEntry);
    }
    var focus = kind === "day" ? entries[key] : entries[anchor];
    var weekKey = kind === "week" ? key : cal.parentKey(anchor);
    var monthKey = kind === "month" ? key : anchor.slice(0, 7);
    var quarterKey = cal.parentKey(monthKey);
    var weeks = weeksTouched(monthKey, today < anchor ? today : anchor);
    var weeksDone = 0;
    for (i = 0; i < weeks.length; i++) if (reviewFilled(entries[weeks[i]], "week")) weeksDone += 1;
    var weekStart = cal.weekDays(weekKey)[0];
    var monthStart = monthKey + "-01";
    var quarterOpen = quarterStart(quarterKey);
    var cap = today < anchor ? today : anchor;
    var weekWindow = feelingWindow(store, anchor, 7);
    var monthWindow = feelingWindow(store, anchor, 30);
    var viewedKey = kind === "day" || kind === "week" || kind === "month" ? key : anchor;
    var best = journalBest(store, today);
    var period = entryStarted(viewedKey, today) ? journalParts(entries[viewedKey], viewedKey) : { morning: 0, evening: 0, review: 0, surprise: 0, total: 0 };
    return {
      anchor: anchor,
      streak: {
        current: journalStreak(store, today),
        best: best,
        badges: JOURNAL_MILESTONES.map(function (span) {
          return { days: span, unlocked: best >= span };
        })
      },
      xp: {
        level: journalXp(store, today),
        period: period
      },
      gratitude: {
        streak: gratitudeStreak(store, today),
        items: gratitudeTotal(store, today),
        period: periodItems
      },
      balance: {
        reflection: eveningFilled(focus),
        action: actionTaken(focus),
        balanced: eveningFilled(focus) && actionTaken(focus),
        count: balancedCount,
        span: days.length
      },
      feelings: {
        week: weekWindow,
        month: monthWindow,
        badge: weekWindow.logged > 0 || monthWindow.logged > 0
      },
      reviews: {
        week: reviewRatio(reviewFilled(entries[weekKey], "week") ? 1 : 0, weekStart <= cap ? 1 : 0),
        weeks: reviewRatio(weeksDone, weeks.length),
        month: reviewRatio(reviewFilled(entries[monthKey], "month") ? 1 : 0, monthStart <= cap ? 1 : 0),
        quarter: reviewRatio(reviewFilled(entries[quarterKey], "quarter") ? 1 : 0, quarterOpen <= cap ? 1 : 0)
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
    JOURNAL_MILESTONES: JOURNAL_MILESTONES,
    XP_MORNING: XP_MORNING,
    XP_EVENING: XP_EVENING,
    XP_WEEK: XP_WEEK,
    XP_MONTH: XP_MONTH,
    XP_QUARTER: XP_QUARTER,
    XP_JOURNAL_SURPRISE: XP_JOURNAL_SURPRISE,
    morningFilled: morningFilled,
    eveningFilled: eveningFilled,
    journaled: journaled,
    gratitudeCount: gratitudeCount,
    actionTaken: actionTaken,
    journalParts: journalParts,
    journalBoard: journalBoard
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

    assert.strictEqual(cite("journalStreak").text.indexOf("21-day habit system") >= 0, true);
    assert.strictEqual(cite("journalStreak").text.indexOf("18\u2013254, Lally") >= 0, true);
    assert.strictEqual(cite("gratitude").concept, "agency-and-gratitude");
    assert.strictEqual(cite("gratitude").text, "Agency and gratitude are the two pillars of a healthy self.");
    assert.strictEqual(cite("feelings").concept, "granular-emotion-labeling");
    assert.strictEqual(cite("feelings").text, "Labeling drives choosing the right strategy.");
    assert.strictEqual(cite("reviews").concept, "examined-life-choice-audit");
    assert.strictEqual(cite("reviews").text, "Ask how much is chosen versus habit or momentum.");
    assert.strictEqual(cite("balance").concept, "doing-vs-thinking-balance");
    assert.strictEqual(cite("balance").text, "");
    assert.strictEqual(cite("balance").title, WIKI.videos.contiTools.title);
    assert.strictEqual(cite("failure").concept, "visualize-failure-goal-pursuit");
    assert.strictEqual(cite("failure").text, "Nearly doubles goal attainment.");
    assert.strictEqual(cite("obstacle").concept, "obstacle-planning-goal-pursuit");
    assert.strictEqual(cite("obstacle").title, WIKI.videos.balcetis.title);
    assert.strictEqual(cite("habitCycle").concept, "twenty-one-day-habit-system");
    assert.strictEqual(cite("moderate").concept, "moderate-difficulty-goals");

    var log = { entries: {} };
    log.entries["2026-10-10"] = {
      fields: { mood: 4, energy: 3, grateful: ["a", " ", "b"], focus: "ship" },
      todos: [{ text: "Call bank", done: true }]
    };
    log.entries["2026-10-10"].fields.highlights = "Wrote";
    log.entries["2026-10-11"] = { fields: { focus: "rest" }, todos: [] };
    log.entries["2026-10-13"] = { fields: { better: "Sleep" }, todos: [{ text: "Draft", done: false }] };
    log.entries["2026-W42"] = { fields: { wins: "Shipped" } };
    log.entries["2026-W41"] = { fields: { oneThing: "Plan only" } };
    log.entries["2026-10"] = { fields: { goalsReview: "Moved" } };
    assert.strictEqual(journaled(log.entries["2026-10-10"]), true);
    assert.strictEqual(journaled({ fields: {}, todos: [{ text: "x", done: true }] }), false);
    assert.strictEqual(journalStreak(log, "2026-10-13"), 1);
    assert.strictEqual(journalStreak(log, "2026-10-12"), 2);
    assert.strictEqual(journalBest(log, "2026-10-13"), 2);
    assert.strictEqual(gratitudeCount(log.entries["2026-10-10"]), 2);
    assert.strictEqual(gratitudeStreak(log, "2026-10-13"), 0);
    assert.strictEqual(gratitudeTotal(log, "2026-10-13"), 2);
    assert.strictEqual(actionTaken(log.entries["2026-10-10"]), true);
    assert.strictEqual(actionTaken({ todos: [{ text: "MIT", done: false, mit: true }] }), true);
    assert.strictEqual(actionTaken({ todos: [{ text: " ", done: true }] }), false);
    assert.strictEqual(eveningFilled(log.entries["2026-10-13"]), true);
    assert.strictEqual(journalParts(log.entries["2026-10-10"], "2026-10-10").morning, 10);
    assert.strictEqual(journalParts(log.entries["2026-10-10"], "2026-10-10").evening, 10);
    assert.strictEqual(journalParts(log.entries["2026-10-13"], "2026-10-13").evening, 10);
    assert.strictEqual(journalParts(log.entries["2026-10-13"], "2026-10-13").morning, 0);
    assert.strictEqual(journalParts(log.entries["2026-W42"], "2026-W42").review, 30);
    assert.strictEqual(journalParts(log.entries["2026-W41"], "2026-W41").total, 0);
    assert.strictEqual(journalParts(log.entries["2026-10"], "2026-10").review, 50);
    assert.strictEqual(journalParts({ fields: { wins: "q" } }, "2026-Q4").review, 80);
    assert.strictEqual(journalParts({ fields: {} }, "2026-10-10").surprise, 0);
    var pageRolls = [];
    var pageThird = true;
    var pageDay = "2026-01-01";
    for (n = 0; n < 90; n++) {
      var pageHit = surpriseRoll(pageDay, "journal-page:");
      pageRolls.push(pageHit);
      if (pageHit !== (n % 3 === 0)) pageThird = false;
      pageDay = shiftDay(pageDay, 1);
    }
    var pageHits = pageRolls.filter(Boolean).length;
    assert.strictEqual(pageThird, false);
    assert.ok(pageHits > 12 && pageHits < 50);

    var board = journalBoard(log, { kind: "day", key: "2026-10-13", today: "2026-10-13" });
    assert.strictEqual(board.streak.current, 1);
    assert.strictEqual(board.streak.badges.length, 6);
    assert.strictEqual(board.streak.badges[2].days, 21);
    assert.strictEqual(board.streak.badges[2].unlocked, false);
    assert.strictEqual(board.balance.reflection, true);
    assert.strictEqual(board.balance.action, false);
    assert.strictEqual(board.balance.balanced, false);
    assert.strictEqual(board.feelings.week.logged >= 1, true);
    assert.strictEqual(board.reviews.week.done, 1);
    assert.strictEqual(board.reviews.week.expected, 1);
    assert.strictEqual(board.reviews.weeks.expected, 3);
    assert.strictEqual(board.reviews.weeks.done, 1);
    assert.strictEqual(board.reviews.month.done, 1);
    assert.strictEqual(board.reviews.quarter.done, 0);
    assert.strictEqual(board.reviews.quarter.expected, 1);
    assert.strictEqual(board.xp.period.evening, 10);
    assert.ok(board.xp.level.xp >= 10 + 10 + 10 + 30 + 50);

    var monthBoard = journalBoard(log, { kind: "month", key: "2026-10", today: "2026-10-13" });
    assert.strictEqual(monthBoard.balance.count, 1);
    assert.strictEqual(monthBoard.gratitude.period, 2);
    assert.strictEqual(monthBoard.xp.period.review, 50);

    var run = { entries: {} };
    var cursorDay = "2026-01-01";
    for (n = 0; n < 21; n++) {
      run.entries[cursorDay] = { fields: { focus: "x" } };
      cursorDay = shiftDay(cursorDay, 1);
    }
    assert.strictEqual(journalBest(run, "2026-01-21"), 21);
    assert.strictEqual(journalBoard(run, { kind: "day", key: "2026-01-21", today: "2026-01-21" }).streak.badges.filter(function (b) { return b.days === 21; })[0].unlocked, true);
    assert.strictEqual(journalBoard(run, { kind: "day", key: "2026-01-21", today: "2026-01-21" }).streak.badges.filter(function (b) { return b.days === 66; })[0].unlocked, false);

    console.log("gamify ok");
  }
})();
