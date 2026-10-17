import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire("/tmp/jt/package.json");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const LONG_THING = "ONETHING_SENTINEL_" + "W".repeat(300 - "ONETHING_SENTINEL_".length);

function day(mood, energy) {
  const fields = {};
  if (mood != null) fields.mood = mood;
  if (energy != null) fields.energy = energy;
  return { updatedAt: "2026-10-01T00:00:00.000Z", fields: fields, todos: [] };
}

const FIXTURE = {
  version: 1,
  mirrorSecret: "MIRROR_SECRET_SENTINEL",
  habitDefs: [
    { id: "thesis", label: "Thesis", emoji: "pen" },
    { id: "training", label: "Training", emoji: "run" }
  ],
  quotes: { "2026-10-05": { text: "QUOTE_KEEP_SENTINEL", updatedAt: "2026-10-05T00:00:00.000Z" } },
  days: { "2099-01-01": { mood: 5, marker: "DAYS_MAP_SENTINEL" } },
  sleep: { "2099-01-01": 8 },
  reflections: {
    questions: [{ id: "q1", text: "What would I do?" }],
    answers: { q1: [{ date: "2026-10-05", text: "SEEDED_ANSWER_KEEP" }] }
  },
  entries: {
    "2025-12-29": day(4, 3),
    "2025-12-31": day(2, 2),
    "2026-09-28": day(3, 3),
    "2026-09-29": day(3, 3),
    "2026-09-30": day(4, 3),
    "2026-10-01": day(3, 4),
    "2026-10-02": day(4, 3),
    "2026-10-05": Object.assign(day(4, 3), { habits: { thesis: true, training: false }, habitStreaks: { thesis: 2, training: 0 } }),
    "2026-10-06": day(4, 3),
    "2026-10-07": day(3, 3),
    "2026-10-08": day(4, 4),
    "2026-10-09": day(4, 3),
    "2026-11-02": day(2, 5),
    "2026-11-03": day(4, 5),
    "2026-W40": {
      updatedAt: "2026-10-04T00:00:00.000Z",
      fields: {},
      todos: [
        { id: "tp1", text: "TODO_PREV_bank", done: true },
        { id: "tp2", text: "TODO_PREV_open", done: false }
      ]
    },
    "2026-W41": {
      updatedAt: "2026-10-11T00:00:00.000Z",
      fields: {
        enjoyment: "green",
        why: "WHY_SENTINEL because it mattered",
        oneThing: LONG_THING,
        wins: "WINS_SENTINEL shipped the draft",
        accomplishments: "ACCOMPLISH_SENTINEL chapter four",
        improve: "IMPROVE_SENTINEL sleep earlier",
        rootCause: "ROOT_SENTINEL late meetings",
        grateful: ["GRATE1_morning light", "GRATE2_a walk", "GRATE3_soup"],
        lesson: "LESSON_SENTINEL write first",
        watch: "WATCH_SENTINEL calendar",
        goals: {
          thesis: { progress: "THESIS_PROGRESS_outline", score: 3, next: "THESIS_NEXT_section" },
          health: { progress: "HEALTH_PROGRESS_walks", score: 4, next: "HEALTH_NEXT_bedtime" }
        },
        difficulty: "DIFFICULTY_SENTINEL too hard",
        audit: "AUDIT_SENTINEL chose the draft",
        hiddenExtra: "HIDDEN_EXTRA_SENTINEL",
        secretNote: "SECRET_NOTE_SENTINEL"
      },
      todos: [
        { id: "tw1", text: "TODO_CURRENT_call", done: true },
        { id: "tw2", text: "TODO_CURRENT_write", done: false }
      ]
    },
    "2026-10": {
      updatedAt: "2026-10-16T00:00:00.000Z",
      fields: {
        oneThing: "MONTH_ONE_SENTINEL finish the chapter",
        wins: "MONTH_WINS_SENTINEL",
        accomplishments: "MONTH_ACC_SENTINEL",
        improve: "MONTH_IMP_SENTINEL",
        rootCause: "MONTH_ROOT_SENTINEL",
        goalsReview: "MONTH_GOALS_SENTINEL",
        goals: {
          thesis: { progress: "MONTH_THESIS_SENTINEL", score: 3, next: "MONTH_THESIS_NEXT" },
          health: { progress: "MONTH_HEALTH_SENTINEL", score: 4, next: "MONTH_HEALTH_NEXT" }
        },
        difficulty: "MONTH_DIFF_SENTINEL",
        audit: "MONTH_AUDIT_SENTINEL"
      },
      todos: [{ id: "tm1", text: "MONTH_TODO_SENTINEL", done: false }]
    },
    "2026-Q4": {
      updatedAt: "2026-10-16T00:00:00.000Z",
      fields: {
        mainQuest: "QUEST_SENTINEL ship",
        q1: "Q1_SENTINEL important",
        q2: "Q2_SENTINEL needle",
        q3: "Q3_SENTINEL proud",
        q4: "Q4_SENTINEL easier",
        q5: "Q5_SENTINEL postponed",
        q6: "Q6_SENTINEL morning",
        commit90: "COMMIT_SENTINEL ninety",
        goingTo: "GOING_SENTINEL steps",
        wins: "QWINS_SENTINEL",
        improve: "QIMP_SENTINEL",
        yearProgress: "QYEAR_SENTINEL"
      },
      todos: [{ id: "tq1", text: "QTODO_SENTINEL", done: true }]
    },
    "2026": {
      updatedAt: "2026-10-16T00:00:00.000Z",
      fields: {
        vision: "VISION_SENTINEL person",
        principle: "PRINCIPLE_SENTINEL steady",
        wins: "YWINS_SENTINEL",
        finished: "FINISHED_SENTINEL",
        differently: "DIFFERENT_SENTINEL",
        lessons: "LESSONS_SENTINEL"
      },
      todos: [{ id: "ty1", text: "YTODO_SENTINEL", done: false, status: "progress" }]
    }
  }
};

const WEEK_SENTINELS = [
  "WHY_SENTINEL because it mattered",
  LONG_THING,
  "WINS_SENTINEL shipped the draft",
  "ACCOMPLISH_SENTINEL chapter four",
  "IMPROVE_SENTINEL sleep earlier",
  "ROOT_SENTINEL late meetings",
  "GRATE1_morning light",
  "GRATE2_a walk",
  "GRATE3_soup",
  "LESSON_SENTINEL write first",
  "WATCH_SENTINEL calendar",
  "THESIS_PROGRESS_outline",
  "THESIS_NEXT_section",
  "HEALTH_PROGRESS_walks",
  "HEALTH_NEXT_bedtime",
  "DIFFICULTY_SENTINEL too hard",
  "AUDIT_SENTINEL chose the draft",
  "TODO_CURRENT_call",
  "TODO_CURRENT_write",
  "TODO_PREV_bank",
  "TODO_PREV_open",
  "Good"
];

const HIDDEN = ["HIDDEN_EXTRA_SENTINEL", "SECRET_NOTE_SENTINEL", "MIRROR_SECRET_SENTINEL", "DAYS_MAP_SENTINEL", "SEEDED_ANSWER_KEEP", "QUOTE_KEEP_SENTINEL"];

const QUARTER_SENTINELS = [
  "QUEST_SENTINEL ship",
  "Q1_SENTINEL important",
  "Q2_SENTINEL needle",
  "Q3_SENTINEL proud",
  "Q4_SENTINEL easier",
  "Q5_SENTINEL postponed",
  "Q6_SENTINEL morning",
  "COMMIT_SENTINEL ninety",
  "GOING_SENTINEL steps",
  "QWINS_SENTINEL",
  "QIMP_SENTINEL",
  "QYEAR_SENTINEL",
  "QTODO_SENTINEL"
];

const YEAR_SENTINELS = [
  "VISION_SENTINEL person",
  "PRINCIPLE_SENTINEL steady",
  "YWINS_SENTINEL",
  "FINISHED_SENTINEL",
  "DIFFERENT_SENTINEL",
  "LESSONS_SENTINEL",
  "YTODO_SENTINEL"
];

const MONTH_SENTINELS = [
  "MONTH_ONE_SENTINEL finish the chapter",
  "MONTH_WINS_SENTINEL",
  "MONTH_ACC_SENTINEL",
  "MONTH_IMP_SENTINEL",
  "MONTH_ROOT_SENTINEL",
  "MONTH_GOALS_SENTINEL",
  "MONTH_THESIS_SENTINEL",
  "MONTH_THESIS_NEXT",
  "MONTH_HEALTH_SENTINEL",
  "MONTH_HEALTH_NEXT",
  "MONTH_DIFF_SENTINEL",
  "MONTH_AUDIT_SENTINEL",
  "MONTH_TODO_SENTINEL"
];

function mean(nums) {
  const sum = nums.reduce(function (a, b) { return a + b; }, 0);
  return (Math.round((sum / nums.length) * 10) / 10).toFixed(1);
}

function scores(prefix, prop) {
  return Object.keys(FIXTURE.entries).filter(function (key) {
    return new RegExp("^" + prefix + "-\\d{2}$").test(key);
  }).map(function (key) {
    const fields = FIXTURE.entries[key].fields || {};
    return fields[prop];
  }).filter(function (n) { return n === 1 || n === 2 || n === 3 || n === 4 || n === 5; });
}

function harness() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light" style="color-scheme: light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Journal period</title>
  <link rel="stylesheet" href="/ui/shell.css" />
  <link rel="stylesheet" href="/journal/next/css/period.css" />
  <style>
    body.dx::before, body.dx::after { display: none !important; }
    html, body.dx { background: var(--dx-bg, #f6f4ef); margin: 0; }
    #main { width: 100%; max-width: 100%; padding: 8px; box-sizing: border-box; }
    #period-heading { margin: 0 0 8px; font-size: 1.2rem; }
  </style>
</head>
<body class="dx">
  <main id="main">
    <h2 id="period-heading" tabindex="-1">Period</h2>
    <div id="view"></div>
  </main>
  <script src="/journal/core.js"></script>
  <script>
    window.FIXTURE = ${JSON.stringify(FIXTURE)};
    (function () {
      var store = null;
      function isScore(n) { return n === 1 || n === 2 || n === 3 || n === 4 || n === 5; }
      function entry(key) {
        var map = store && store.entries;
        return map && map[key] ? map[key] : null;
      }
      function fields(key) {
        var item = entry(key);
        var value = item && item.fields;
        return value && typeof value === "object" ? value : {};
      }
      function todos(key) {
        var item = entry(key);
        return item && Array.isArray(item.todos) ? item.todos : [];
      }
      function moodOf(day) {
        var item = entry(day) || {};
        var bag = item.fields || {};
        var extra = store && store.days && store.days[day] || {};
        if (isScore(bag.mood)) return bag.mood;
        if (isScore(extra.mood)) return extra.mood;
        if (isScore(bag.moodMeter)) return bag.moodMeter;
        if (isScore(extra.moodMeter)) return extra.moodMeter;
        return null;
      }
      function energyOf(day) {
        var item = entry(day) || {};
        var bag = item.fields || {};
        var extra = store && store.days && store.days[day] || {};
        if (isScore(bag.energy)) return bag.energy;
        if (isScore(extra.energy)) return extra.energy;
        return null;
      }
      function sleepOf(day) {
        var item = entry(day) || {};
        var bag = item.fields || {};
        var candidates = [bag.sleep, item.sleep, store && store.sleep && store.sleep[day]];
        var i;
        for (i = 0; i < candidates.length; i++) {
          if (typeof candidates[i] === "number" && candidates[i] === candidates[i] && candidates[i] > 0) return candidates[i];
        }
        return null;
      }
      function habitDefs() {
        var raw = store && store.habitDefs;
        if (!Array.isArray(raw) || !raw.length) return [{ id: "thesis" }, { id: "training" }];
        return raw;
      }
      function habitStatus(day, id) {
        var item = entry(day);
        if (!item || !item.habits || typeof item.habits !== "object") return "none";
        if (!Object.prototype.hasOwnProperty.call(item.habits, id)) return "unknown";
        if (item.habits[id] === true) return "done";
        if (item.habits[id] === false) return "miss";
        return "unknown";
      }
      function children(key) {
        var kind = JournalCore.kindOf(key);
        if (kind === "week") return JournalCore.weekDays(key);
        if (kind === "quarter") {
          var start = (Number(key.slice(6)) - 1) * 3 + 1;
          var year = key.slice(0, 4);
          var out = [];
          var i;
          for (i = 0; i < 3; i++) out.push(year + "-" + (start + i < 10 ? "0" : "") + (start + i));
          return out;
        }
        if (kind === "year") return [key + "-Q1", key + "-Q2", key + "-Q3", key + "-Q4"];
        if (kind === "month") {
          var week = JournalCore.shift(JournalCore.parentKey(key + "-01"), -1);
          var found = [];
          var guard = 0;
          while (week && guard < 8) {
            var monday = JournalCore.weekDays(week)[0].slice(0, 7);
            if (monday === key) found.push(week);
            if (monday > key) break;
            week = JournalCore.shift(week, 1);
            guard += 1;
          }
          return found;
        }
        return [];
      }
      function daysIn(key, through) {
        var kind = JournalCore.kindOf(key);
        var days = [];
        var i;
        if (kind === "day") days = [key];
        else if (kind === "week") days = JournalCore.weekDays(key);
        else if (kind === "month") {
          var cursor = key + "-01";
          var end = JournalCore.shift(key, 1) + "-01";
          while (cursor < end) {
            days.push(cursor);
            cursor = JournalCore.shift(cursor, 1);
          }
        } else {
          var kids = children(key);
          for (i = 0; i < kids.length; i++) days = days.concat(daysIn(kids[i], null));
        }
        if (through) days = days.filter(function (item) { return item <= through; });
        return days;
      }
      function average(nums) {
        if (!nums.length) return null;
        var sum = 0;
        var min = nums[0];
        var max = nums[0];
        var i;
        for (i = 0; i < nums.length; i++) {
          sum += nums[i];
          if (nums[i] < min) min = nums[i];
          if (nums[i] > max) max = nums[i];
        }
        return { avg: sum / nums.length, n: nums.length, min: min, max: max };
      }
      function rollup(key, opts) {
        var through = opts && opts.through;
        var days = daysIn(key, through);
        var moods = [];
        var energies = [];
        var sleeps = [];
        var logged = 0;
        var i;
        var j;
        for (i = 0; i < days.length; i++) {
          var mood = moodOf(days[i]);
          var energy = energyOf(days[i]);
          var sleep = sleepOf(days[i]);
          if (mood != null || energy != null) logged += 1;
          if (mood != null) moods.push(mood);
          if (energy != null) energies.push(energy);
          if (sleep != null) sleeps.push(sleep);
        }
        var kind = JournalCore.kindOf(key);
        var kids = kind === "day" ? [] : children(key);
        var series = [];
        for (i = 0; i < kids.length; i++) {
          var child = rollup(kids[i], opts);
          series.push({
            key: kids[i],
            mood: child.mood ? child.mood.avg : null,
            energy: child.energy ? child.energy.avg : null,
            logged: child.logged,
            days: child.days
          });
        }
        var list = todos(key);
        var done = 0;
        var total = 0;
        for (i = 0; i < list.length; i++) {
          if (!String(list[i] && list[i].text || "").trim()) continue;
          total += 1;
          if (list[i].done) done += 1;
        }
        var defs = habitDefs();
        var hits = 0;
        var slots = 0;
        for (i = 0; i < days.length; i++) {
          if (habitStatus(days[i], defs[0] && defs[0].id) === "none" && !(entry(days[i]) && entry(days[i]).habits)) continue;
          if (!(entry(days[i]) && entry(days[i]).habits)) continue;
          for (j = 0; j < defs.length; j++) {
            slots += 1;
            if (habitStatus(days[i], defs[j].id) === "done") hits += 1;
          }
        }
        var answers = 0;
        var bag = store && store.reflections && store.reflections.answers;
        if (bag && typeof bag === "object") {
          var ids = Object.keys(bag);
          var seen = {};
          for (i = 0; i < days.length; i++) seen[days[i]] = true;
          for (i = 0; i < ids.length; i++) {
            var arr = bag[ids[i]];
            if (!Array.isArray(arr)) continue;
            for (j = 0; j < arr.length; j++) if (seen[arr[j] && arr[j].date]) answers += 1;
          }
        }
        return {
          days: days.length,
          logged: logged,
          mood: average(moods),
          energy: average(energies),
          sleep: average(sleeps),
          series: series,
          todos: { done: done, total: total },
          habitRate: slots ? hits / slots : null,
          reflections: answers
        };
      }
      function readFolds() {
        try { return JSON.parse(localStorage.getItem("journal-folds") || "{}") || {}; }
        catch (e) { return {}; }
      }
      window.JournalData = {
        load: function (raw) { store = raw; },
        entry: entry,
        fields: fields,
        todos: todos,
        quote: function (day) { return store && store.quotes ? store.quotes[day] || null : null; },
        moodOf: moodOf,
        energyOf: energyOf,
        sleepOf: sleepOf,
        habitDefs: habitDefs,
        habitStatus: habitStatus,
        reflections: function () { return store && store.reflections || { questions: [], answers: {} }; },
        questionOfDay: function (day) {
          var list = (store && store.reflections && store.reflections.questions) || [];
          if (!list.length) return null;
          return list[0];
        },
        children: children,
        ancestors: function (key) {
          var out = [];
          var cur = key;
          var guard = 0;
          while (cur && guard < 6) {
            out.unshift(cur);
            cur = JournalCore.parentKey(cur);
            guard += 1;
          }
          return out;
        },
        daysIn: daysIn,
        rollup: rollup,
        shift: function (key, delta) { return JournalCore.shift(key, delta); },
        label: function (key) { return JournalCore.label(key); },
        kindOf: function (key) { return JournalCore.kindOf(key); },
        todayKey: function (kind, date) { return JournalCore.todayKey(kind, date); }
      };
      window.JournalOps = {
        todoAdd: function () {},
        todoPatch: function (key, id, patch) {
          var item = entry(key);
          var list = item && item.todos || [];
          var i;
          var names;
          var j;
          for (i = 0; i < list.length; i++) {
            if (list[i].id !== id) continue;
            names = Object.keys(patch || {});
            for (j = 0; j < names.length; j++) list[i][names[j]] = patch[names[j]];
          }
          if (item) item.updatedAt = "2026-10-17T12:00:00.000Z";
          return fetch("https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/journal.json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "Save journal progress",
              content: btoa(JSON.stringify(store)),
              sha: "abc"
            })
          });
        },
        todoRemove: function () {},
        appendAnswer: function () {},
        onChange: function () {},
        status: function () { return "idle"; }
      };
      window.JournalUI = {
        el: function (tag, className, text) {
          var node = document.createElement(tag);
          if (className) node.className = className;
          if (text != null) node.textContent = text;
          return node;
        },
        fold: function (opts) {
          var details = document.createElement("details");
          var summary = document.createElement("summary");
          var heading = document.createElement("h" + (opts.level || 3));
          var body = document.createElement("div");
          var state = readFolds();
          details.className = "dx-card journal-fold";
          details.setAttribute("data-fold", opts.id || "");
          heading.textContent = opts.title || "";
          summary.appendChild(heading);
          if (opts.summary) {
            var line = document.createElement("span");
            line.className = "fold-summary";
            line.textContent = opts.summary;
            summary.appendChild(line);
          }
          body.className = "fold-body";
          details.appendChild(summary);
          details.appendChild(body);
          if (state[opts.id]) details.open = true;
          details.addEventListener("toggle", function () {
            var cur = readFolds();
            cur[opts.id] = details.open;
            localStorage.setItem("journal-folds", JSON.stringify(cur));
          });
          return { root: details, body: body };
        },
        info: function (citeKey) {
          var wrap = document.createElement("span");
          var btn = document.createElement("button");
          var tip = document.createElement("span");
          btn.type = "button";
          btn.className = "period-info";
          btn.setAttribute("aria-expanded", "false");
          btn.setAttribute("aria-label", citeKey === "moderate" ? "About moderate difficulty" : "About the choice audit");
          btn.textContent = "About";
          tip.hidden = true;
          tip.textContent = citeKey === "moderate" ? "Too easy, too hard, or about right." : "How much was chosen versus habit or momentum.";
          btn.addEventListener("click", function () {
            var open = btn.getAttribute("aria-expanded") === "true";
            btn.setAttribute("aria-expanded", open ? "false" : "true");
            tip.hidden = open;
          });
          wrap.appendChild(btn);
          wrap.appendChild(tip);
          return wrap;
        },
        todoList: function (container, key, opts) {
          var list = todos(key);
          var i;
          for (i = 0; i < list.length; i++) {
            (function (todo) {
              var text = String(todo.text || "").trim();
              var label;
              var input;
              var group;
              var statuses;
              var s;
              if (!text) return;
              label = document.createElement("label");
              label.className = "period-check";
              input = document.createElement("input");
              input.type = "checkbox";
              input.checked = !!todo.done;
              label.appendChild(input);
              label.appendChild(document.createTextNode(text));
              input.addEventListener("change", function () {
                window.JournalOps.todoPatch(key, todo.id, { done: input.checked });
              });
              container.appendChild(label);
              if (!(opts && opts.status)) return;
              group = document.createElement("div");
              group.setAttribute("role", "radiogroup");
              group.setAttribute("aria-label", "Status for " + text);
              statuses = [["none", "Not started"], ["progress", "In progress"], ["done", "Done"], ["paused", "Paused"]];
              for (s = 0; s < statuses.length; s++) {
                (function (pair) {
                  var choice = document.createElement("label");
                  var radio = document.createElement("input");
                  choice.className = "period-check";
                  radio.type = "radio";
                  radio.name = "status-" + todo.id;
                  radio.checked = (todo.status || "none") === pair[0];
                  radio.addEventListener("change", function () {
                    window.JournalOps.todoPatch(key, todo.id, { status: pair[0] });
                  });
                  choice.appendChild(radio);
                  choice.appendChild(document.createTextNode(pair[1]));
                  group.appendChild(choice);
                })(statuses[s]);
              }
              container.appendChild(group);
            })(list[i]);
          }
        },
        announce: function (text) {
          var live = document.getElementById("live");
          if (live) live.textContent = text;
        }
      };
      window.JournalReflect = {
        mount: function (container, opts) {
          var note = document.createElement("p");
          note.textContent = "Year reflection digest for " + (opts && opts.year);
          container.appendChild(note);
        }
      };
      window.mountJournal = function (kind, key, today, keepFolds) {
        if (!keepFolds) localStorage.removeItem("journal-folds");
        window.JournalData.load(JSON.parse(JSON.stringify(window.FIXTURE)));
        var root = document.getElementById("view");
        root.textContent = "";
        window.JournalViews[kind](root, { key: key, today: today });
      };
    })();
  </script>
  <script src="/journal/next/js/trends.js"></script>
  <script src="/journal/next/js/views/period.js"></script>
</body>
</html>`;
}

function prepareSite() {
  fs.mkdirSync("/tmp/site/ui", { recursive: true });
  try { fs.symlinkSync("/workspace", "/tmp/site/journal"); } catch (err) { if (err.code !== "EEXIST") throw err; }
  if (!fs.existsSync("/tmp/shell.css")) throw new Error("missing /tmp/shell.css");
  fs.copyFileSync("/tmp/shell.css", "/tmp/site/ui/shell.css");
}

function startServer() {
  const child = spawn("python3", ["-m", "http.server", "8000", "--bind", "127.0.0.1"], {
    cwd: "/tmp/site",
    stdio: "ignore"
  });
  return new Promise(function (resolve, reject) {
    const timer = setInterval(function () {
      fetch("http://127.0.0.1:8000/journal/next/js/views/period.js").then(function (res) {
        if (!res.ok) return;
        clearInterval(timer);
        resolve(child);
      }).catch(function () {});
    }, 100);
    setTimeout(function () {
      clearInterval(timer);
      reject(new Error("local server did not start"));
    }, 10000);
  });
}

async function countInView(page, needle) {
  return page.locator("#view").evaluate(function (el, text) {
    const blob = el.textContent || "";
    let count = 0;
    let from = 0;
    while (from <= blob.length) {
      const at = blob.indexOf(text, from);
      if (at < 0) break;
      count += 1;
      from = at + text.length;
    }
    return count;
  }, needle);
}

async function assertOnce(page, needles) {
  for (const needle of needles) {
    const count = await countInView(page, needle);
    assert.equal(count, 1, needle + " appeared " + count + " times");
  }
}

async function assertAbsent(page, needles) {
  for (const needle of needles) {
    const count = await countInView(page, needle);
    assert.equal(count, 0, needle + " should stay off the page");
  }
}

async function assertNoNaN(page) {
  const found = await page.locator("#view").evaluate(function (el) {
    const labels = Array.from(el.querySelectorAll("[aria-label]")).map(function (node) {
      return node.getAttribute("aria-label") || "";
    }).join(" ");
    return (el.textContent || "") + " " + labels;
  });
  assert.equal(found.indexOf("NaN") >= 0, false, found.slice(found.indexOf("NaN") - 40, found.indexOf("NaN") + 40));
}

async function axe(page, label) {
  const results = await new AxeBuilder({ page: page }).withTags(["wcag2aa"]).analyze();
  const bad = results.violations.filter(function (item) {
    return item.impact === "serious" || item.impact === "critical";
  });
  assert.equal(bad.length, 0, label + " " + bad.map(function (item) {
    return item.id + " " + item.impact + " " + item.nodes.slice(0, 2).map(function (node) { return node.html; }).join(" | ");
  }).join("\n"));
}

function diffSuperset(fixture, actual, allow, path, problems) {
  if (allow.has(path)) return;
  if (fixture && typeof fixture === "object") {
    if (Array.isArray(fixture)) {
      if (!Array.isArray(actual)) {
        problems.push(path + " lost the array");
        return;
      }
      if (actual.length < fixture.length) problems.push(path + " got shorter");
      fixture.forEach(function (item, index) {
        diffSuperset(item, actual[index], allow, path + "[" + index + "]", problems);
      });
      return;
    }
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      problems.push(path + " lost the object");
      return;
    }
    Object.keys(fixture).forEach(function (key) {
      diffSuperset(fixture[key], actual[key], allow, path ? path + "." + key : key, problems);
    });
    return;
  }
  if (fixture !== actual) problems.push(path + " changed");
}

async function openAll(page) {
  await page.evaluate(function () {
    document.querySelectorAll("details").forEach(function (el) { el.open = true; });
  });
}

async function scrollWidth(page) {
  return page.evaluate(function () { return document.documentElement.scrollWidth; });
}

async function main() {
  prepareSite();
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  let failed = false;
  try {
    await page.addInitScript(function (raw) {
      localStorage.setItem("journal-next-cache", raw);
      localStorage.setItem("journal-v1", "do-not-touch");
    }, JSON.stringify(FIXTURE));
    await page.route("http://127.0.0.1:8000/journal/next/tests/period-harness.html", function (route) {
      route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: harness() });
    });
    const earlyPuts = [];
    await page.route("https://api.github.com/**", function (route) {
      if (route.request().method() === "PUT") earlyPuts.push(route.request().postData() || "");
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("http://127.0.0.1:8000/journal/next/tests/period-harness.html", { waitUntil: "load" });
    await page.waitForFunction(function () { return window.JournalViews && window.JournalViews.week && window.JournalTrends; });

    await page.evaluate(function () { window.mountJournal("week", "2026-W01", "2026-10-17"); });
    const weekOne = await page.locator("#view a.period-child").evaluateAll(function (els) {
      return els.map(function (el) { return { href: el.getAttribute("href"), text: el.textContent }; });
    });
    assert.deepEqual(weekOne.map(function (item) { return item.href; }), [
      "#day/2025-12-29",
      "#day/2025-12-30",
      "#day/2025-12-31",
      "#day/2026-01-01",
      "#day/2026-01-02",
      "#day/2026-01-03",
      "#day/2026-01-04"
    ]);
    assert.equal(weekOne[0].text.indexOf("Dec 29") >= 0, true, weekOne[0].text);
    assert.equal(weekOne[6].text.indexOf("Jan 4") >= 0, true, weekOne[6].text);
    const plotted = await page.locator(".trend-chart").getAttribute("data-mood");
    assert.equal(plotted, "4,,2,,,,");
    assert.equal(plotted.split(",").indexOf("0") >= 0, false);
    const path = await page.locator("path.trend-mood").getAttribute("d");
    assert.equal((path.match(/M/g) || []).length, 2, path);
    const dec30 = await page.locator(".period-table tr", { hasText: "Dec 30" }).evaluate(function (el) { return el.textContent; });
    assert.equal(dec30.indexOf("Not logged") >= 0, true, dec30);
    assert.equal(dec30.indexOf("0.0") >= 0, false, dec30);
    await assertNoNaN(page);

    await page.evaluate(function () { window.mountJournal("year", "2024", "2026-10-17"); });
    const emptyText = await page.locator("#view").innerText();
    assert.equal(emptyText.indexOf("No check-ins yet") >= 0, true);
    await assertNoNaN(page);
    assert.equal(await page.locator("#view").evaluate(function (el) { return el.innerHTML.indexOf("NaN"); }), -1);

    await page.evaluate(function () { window.mountJournal("quarter", "2026-Q4", "2026-12-31"); });
    const monthLinks = await page.locator("#view a.period-child").evaluateAll(function (els) {
      return els.map(function (el) { return { href: el.getAttribute("href"), text: el.textContent }; });
    });
    assert.deepEqual(monthLinks.map(function (item) { return item.href; }), ["#month/2026-10", "#month/2026-11", "#month/2026-12"]);
    const octoberMood = mean(scores("2026-10", "mood"));
    const octoberEnergy = mean(scores("2026-10", "energy"));
    const novemberMood = mean(scores("2026-11", "mood"));
    const novemberEnergy = mean(scores("2026-11", "energy"));
    assert.equal(monthLinks[0].text.indexOf("mood " + octoberMood) >= 0, true, monthLinks[0].text + " expected " + octoberMood);
    assert.equal(monthLinks[0].text.indexOf("energy " + octoberEnergy) >= 0, true, monthLinks[0].text);
    assert.equal(monthLinks[1].text.indexOf("mood " + novemberMood) >= 0, true, monthLinks[1].text);
    assert.equal(monthLinks[1].text.indexOf("energy " + novemberEnergy) >= 0, true, monthLinks[1].text);
    assert.equal(monthLinks[2].text.indexOf("mood not logged") >= 0, true, monthLinks[2].text);
    const apiOctober = await page.evaluate(function () {
      const roll = window.JournalData.rollup("2026-10", { through: "2026-12-31" });
      return (Math.round(roll.mood.avg * 10) / 10).toFixed(1);
    });
    assert.equal(apiOctober, octoberMood);
    assert.equal(monthLinks[0].text.indexOf("mood " + apiOctober) >= 0, true);
    await assertOnce(page, QUARTER_SENTINELS);
    await assertNoNaN(page);

    await page.evaluate(function () { window.mountJournal("month", "2026-10", "2026-10-17"); });
    await assertOnce(page, MONTH_SENTINELS);
    assert.equal((await page.locator("#view").innerText()).indexOf("Goals · thesis 3/5 · health 4/5") >= 0, true);
    assert.equal(await page.locator('#view [data-field] textarea, #view [data-field] input').count(), 0);

    await page.evaluate(function () { window.mountJournal("year", "2026", "2026-12-31"); });
    await assertOnce(page, YEAR_SENTINELS);
    assert.equal((await page.locator("#view").evaluate(function (el) { return el.textContent; })).indexOf("Year reflection digest for 2026") >= 0, true);
    assert.equal(await page.locator('[role="radiogroup"]').count(), 1);
    assert.equal(await page.locator("#view .period-field textarea, #view .period-field input").count(), 0);
    await assertNoNaN(page);

    await page.evaluate(function () {
      localStorage.setItem("journal-folds", JSON.stringify({ "week-plan": true }));
      window.mountJournal("week", "2026-W41", "2026-10-17", true);
    });
    const planOpen = await page.locator('details[data-fold="week-plan"]').evaluate(function (el) { return el.open; });
    const glanceOpen = await page.locator('details[data-fold="week-glance"]').evaluate(function (el) { return el.open; });
    assert.equal(planOpen, true);
    assert.equal(glanceOpen, false);
    const glanceSummary = await page.locator('details[data-fold="week-glance"] > summary .fold-summary').innerText();
    assert.equal(glanceSummary, "At a glance · mood 3.8 (↑0.4) · energy 3.2");
    const goalsSummary = await page.locator('details[data-fold="week-goals"] > summary .fold-summary').innerText();
    assert.equal(goalsSummary, "Goals · thesis 3/5 · health 4/5");
    await assertOnce(page, WEEK_SENTINELS);
    await assertAbsent(page, HIDDEN);
    assert.equal(LONG_THING.length, 300);
    assert.equal(await page.locator("#view [data-field] input, #view [data-field] textarea").count(), 0);
    assert.equal(await page.locator('[data-readonly="todos"] input').count(), 0);
    assert.equal(await page.locator('a.period-habit').getAttribute("href"), "#habits");
    assert.equal(await page.locator('a[href="https://dong-xuyong.github.io/thesis/"]').count(), 1);
    assert.equal(await page.locator('a[href="https://dong-xuyong.github.io/health/"]').count(), 1);
    await assertNoNaN(page);

    await page.evaluate(function () {
      document.querySelectorAll("details").forEach(function (el) { el.open = false; });
    });
    await axe(page, "folds closed");
    assert.equal(await scrollWidth(page) <= 360, true, "closed scrollWidth " + await scrollWidth(page));

    const glance = page.locator('details[data-fold="week-glance"]');
    await glance.locator("> summary").click();
    const tableFold = page.locator('details[data-fold="week-data"]');
    assert.equal(await tableFold.evaluate(function (el) { return el.open; }), false);
    assert.equal(await glance.evaluate(function (el) { return el.open; }), true);
    await tableFold.locator("> summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await tableFold.evaluate(function (el) { return el.open; }), true);
    assert.equal(await glance.evaluate(function (el) { return el.open; }), true);
    await page.keyboard.press("Tab");
    const landed = await page.evaluate(function () { return document.activeElement && document.activeElement.className; });
    assert.equal(String(landed).indexOf("period-table") >= 0, true, landed);

    await openAll(page);
    await axe(page, "folds open");
    const openScroll = await scrollWidth(page);
    assert.equal(openScroll <= 360, true, "open scrollWidth " + openScroll);

    const small = await page.evaluate(function () {
      const bad = [];
      document.querySelectorAll("a, button, input, textarea, select, summary, table[tabindex]").forEach(function (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.width < 44 || rect.height < 44) {
          bad.push(el.tagName + " " + Math.round(rect.width) + "x" + Math.round(rect.height) + " " + (el.innerText || el.getAttribute("aria-label") || "").slice(0, 40));
        }
      });
      return bad;
    });
    assert.deepEqual(small, []);

    await page.locator("#view summary").first().focus();
    const seenSummaries = new Set();
    const summaryCount = await page.locator("summary").count();
    for (let i = 0; i < summaryCount + 40; i++) {
      const info = await page.evaluate(function () {
        const el = document.activeElement;
        const style = getComputedStyle(el);
        const width = parseFloat(style.outlineWidth);
        return {
          summary: el && el.tagName === "SUMMARY",
          key: el && el.tagName === "SUMMARY" ? (el.innerText || "").replace(/\s+/g, " ").slice(0, 80) : "",
          ring: !!el && style.outlineStyle !== "none" && width >= 2,
          outline: style.outlineStyle + " " + style.outlineWidth,
          tag: el ? el.tagName : "",
          name: el ? (el.getAttribute("aria-label") || el.innerText || el.tagName || "").replace(/\s+/g, " ").slice(0, 90) : ""
        };
      });
      assert.equal(info.ring, true, "missing focus ring on " + info.tag + " " + info.outline + " " + info.name);
      if (info.summary) seenSummaries.add(info.key);
      if (seenSummaries.size === summaryCount && i > 5) break;
      await page.keyboard.press("Tab");
    }
    assert.equal(seenSummaries.size, summaryCount, "reached " + seenSummaries.size + " of " + summaryCount);

    const summaries = page.locator("summary");
    const total = await summaries.count();
    for (let i = 0; i < total; i++) {
      const summary = summaries.nth(i);
      await summary.focus();
      const before = await summary.evaluate(function (el) { return el.parentElement.open; });
      await page.keyboard.press("Enter");
      const afterEnter = await summary.evaluate(function (el) { return el.parentElement.open; });
      assert.equal(afterEnter, !before, "Enter did not toggle summary " + i);
      await page.keyboard.press("Space");
      const afterSpace = await summary.evaluate(function (el) { return el.parentElement.open; });
      assert.equal(afterSpace, before, "Space did not toggle summary " + i);
    }

    assert.equal(await scrollWidth(page) <= 360, true, "after keys scrollWidth " + await scrollWidth(page));
    assert.deepEqual(earlyPuts, []);

    await page.unroute("https://api.github.com/**");
    const putBodies = [];
    await page.route("https://api.github.com/**", function (route) {
      const request = route.request();
      if (request.method() === "PUT") putBodies.push(request.postData() || "");
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.locator('details[data-fold="week-todos"]').evaluate(function (el) { el.open = true; });
    const pending = page.waitForRequest(function (request) {
      return request.method() === "PUT" && request.url().indexOf("api.github.com") >= 0;
    });
    await page.locator(".period-todos label", { hasText: "TODO_CURRENT_write" }).locator("input").click();
    await pending;
    assert.equal(putBodies.length, 1);
    const payload = JSON.parse(putBodies[0]);
    const saved = JSON.parse(Buffer.from(payload.content, "base64").toString("utf8"));
    const problems = [];
    diffSuperset(FIXTURE, saved, new Set([
      "entries.2026-W41.todos[1].done",
      "entries.2026-W41.updatedAt"
    ]), "", problems);
    assert.deepEqual(problems, []);
    assert.equal(saved.entries["2026-W41"].todos[1].done, true);
    assert.equal(saved.mirrorSecret, "MIRROR_SECRET_SENTINEL");
    assert.equal(saved.days["2099-01-01"].marker, "DAYS_MAP_SENTINEL");
    assert.equal(saved.reflections.answers.q1[0].text, "SEEDED_ANSWER_KEEP");

    await page.evaluate(function () {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    });
    await axe(page, "dark open");

    const cache = await page.evaluate(function () {
      return {
        v1: localStorage.getItem("journal-v1"),
        cache: localStorage.getItem("journal-next-cache")
      };
    });
    assert.equal(cache.v1, "do-not-touch");
    assert.equal(cache.cache, JSON.stringify(FIXTURE));
    console.log("period.spec.mjs: passed at 360px");
  } catch (err) {
    failed = true;
    console.error(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
  if (failed) process.exit(1);
}

main();
