/**
 * Day view at 360px.
 * Run: npm i --prefix /tmp/jt playwright @axe-core/playwright && node next/tests/day.spec.mjs
 * The interfaces from builders 1, 2 and 4 are not on main, so this spec stubs them.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function moduleRoot() {
  const roots = ["/tmp/jt/node_modules", join(process.cwd(), "node_modules")];
  for (const root of roots) {
    if (existsSync(join(root, "playwright", "package.json"))) return root;
  }
  throw new Error("Install with: npm i --prefix /tmp/jt playwright @axe-core/playwright");
}

const require = createRequire(join(moduleRoot(), "playwright", "package.json"));
const { test, expect } = require("playwright/test");
const axeModule = require("@axe-core/playwright");
const AxeBuilder = axeModule.default || axeModule;

const DAY = "2026-10-17";
const YDAY = "2026-10-16";
const LONG = "B".repeat(300);
const QUOTE = "Q".repeat(300);
const TODO_LONG = "T".repeat(300);

const STUBS = `
(function () {
  "use strict";

  var model = null;
  var queue = [];
  var listeners = [];
  var saving = false;
  var again = false;
  var API = "https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/journal.json";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toB64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function fromB64(text) {
    return decodeURIComponent(escape(atob(text.replace(/\\s/g, ""))));
  }

  function token() {
    try {
      var cfg = JSON.parse(localStorage.getItem("dong-gh-sync") || "null");
      return cfg && cfg.token ? cfg.token : "";
    } catch (e) {
      return "";
    }
  }

  function score(n) {
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? n : null;
  }

  function dayBag(day) {
    return model && model.days && model.days[day] && typeof model.days[day] === "object" ? model.days[day] : null;
  }

  function emit() {
    var i;
    for (i = 0; i < listeners.length; i++) listeners[i]();
  }

  function ensure(base, key) {
    if (!base.entries || typeof base.entries !== "object") base.entries = {};
    if (!base.entries[key]) base.entries[key] = { updatedAt: "", fields: {}, todos: [] };
    if (!base.entries[key].fields || typeof base.entries[key].fields !== "object") base.entries[key].fields = {};
    if (!Array.isArray(base.entries[key].todos)) base.entries[key].todos = [];
    return base.entries[key];
  }

  function apply(base, op) {
    var entry = ensure(base, op.key);
    var i;
    var keys;
    var k;
    if (op.type === "todoAdd") {
      entry.todos.push(clone(op.todo));
    } else if (op.type === "todoPatch") {
      for (i = 0; i < entry.todos.length; i++) {
        if (entry.todos[i] && entry.todos[i].id === op.id) {
          keys = Object.keys(op.patch || {});
          for (k = 0; k < keys.length; k++) entry.todos[i][keys[k]] = op.patch[keys[k]];
        }
      }
    } else if (op.type === "todoRemove") {
      entry.todos = entry.todos.filter(function (todo) { return !todo || todo.id !== op.id; });
    }
    entry.updatedAt = new Date().toISOString();
  }

  function save() {
    return fetch(API, { headers: { Authorization: "Bearer " + token() } })
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        var base = JSON.parse(fromB64(payload.content));
        var pending = queue.slice();
        var i;
        queue = [];
        for (i = 0; i < pending.length; i++) apply(base, pending[i]);
        return fetch(API, {
          method: "PUT",
          headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Save journal progress",
            content: toB64(JSON.stringify(base)),
            sha: payload.sha
          })
        }).then(function () {
          model = base;
          emit();
        });
      });
  }

  function schedule() {
    if (saving) {
      again = true;
      return;
    }
    saving = true;
    save().then(function () {
      saving = false;
      if (again) {
        again = false;
        schedule();
      }
    });
  }

  window.JournalData = {
    load: function (raw) {
      if (!raw) raw = JSON.parse(localStorage.getItem("journal-next-cache") || "null");
      model = clone(raw || {});
    },
    entry: function (key) {
      return model && model.entries ? model.entries[key] || null : null;
    },
    fields: function (key) {
      var entry = this.entry(key);
      return entry && entry.fields && typeof entry.fields === "object" ? entry.fields : {};
    },
    todos: function (key) {
      var entry = this.entry(key);
      return entry && Array.isArray(entry.todos) ? entry.todos : [];
    },
    quote: function (day) {
      var quote = model && model.quotes ? model.quotes[day] : null;
      return quote && typeof quote.text === "string" ? quote.text : "";
    },
    moodOf: function (day) {
      var fields = this.fields(day);
      var bag = dayBag(day);
      return score(fields.mood) || (bag && score(bag.mood)) || score(fields.moodMeter) || (bag && score(bag.moodMeter)) || null;
    },
    energyOf: function (day) {
      var fields = this.fields(day);
      var bag = dayBag(day);
      return score(fields.energy) || (bag && score(bag.energy)) || null;
    },
    sleepOf: function () { return null; },
    habitDefs: function () { return []; },
    habitStatus: function () { return "unknown"; },
    reflections: function () { return []; },
    questionOfDay: function () { return null; },
    children: function () { return []; },
    ancestors: function () { return []; },
    daysIn: function () { return []; },
    rollup: function () { return null; },
    shift: function (key, delta) {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(key)) return null;
      var date = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + delta));
      function pad(n) { return (n < 10 ? "0" : "") + n; }
      return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
    },
    label: function (key) { return key; },
    kindOf: function () { return "day"; },
    todayKey: function () { return "${DAY}"; }
  };

  window.JournalOps = {
    todoAdd: function (key, todo) {
      queue.push({ type: "todoAdd", key: key, todo: clone(todo) });
      apply(model, queue[queue.length - 1]);
      emit();
      schedule();
    },
    todoPatch: function (key, id, patch) {
      queue.push({ type: "todoPatch", key: key, id: id, patch: clone(patch) });
      apply(model, queue[queue.length - 1]);
      emit();
      schedule();
    },
    todoRemove: function (key, id) {
      queue.push({ type: "todoRemove", key: key, id: id });
      apply(model, queue[queue.length - 1]);
      emit();
      schedule();
    },
    appendAnswer: function () {},
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    },
    status: function () { return saving ? "saving" : queue.length ? "pending" : "idle"; }
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
      var stored = {};
      var summary = document.createElement("summary");
      var heading = document.createElement("h" + (opts.level || 3));
      var line = document.createElement("p");
      var body = document.createElement("div");
      details.className = "day-fold";
      details.setAttribute("data-fold", opts.id);
      try { stored = JSON.parse(localStorage.getItem("journal-folds") || "{}"); } catch (e) { stored = {}; }
      if (stored && stored[opts.id] === true) details.open = true;
      heading.textContent = opts.title;
      line.className = "fold-summary";
      line.textContent = opts.summary;
      summary.appendChild(heading);
      summary.appendChild(line);
      body.className = "day-fold-body";
      details.appendChild(summary);
      details.appendChild(body);
      details.addEventListener("toggle", function () {
        var map = {};
        try { map = JSON.parse(localStorage.getItem("journal-folds") || "{}"); } catch (e2) { map = {}; }
        if (!map || typeof map !== "object") map = {};
        map[opts.id] = details.open;
        localStorage.setItem("journal-folds", JSON.stringify(map));
      });
      return { root: details, body: body };
    },
    info: function (citeKey) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "day-info";
      button.textContent = "About";
      button.setAttribute("aria-label", "About " + citeKey);
      button.setAttribute("aria-expanded", "false");
      return button;
    },
    todoList: function (container, key) {
      var todos = JournalData.todos(key);
      var i;
      for (i = 0; i < todos.length; i++) {
        (function (todo) {
          var block = document.createElement("div");
          var label = document.createElement("label");
          var box = document.createElement("input");
          var span = document.createElement("span");
          var text = document.createElement("textarea");
          var del = document.createElement("button");
          block.className = "day-todo";
          box.type = "checkbox";
          box.checked = !!todo.done;
          span.textContent = todo.text || "";
          text.value = todo.text || "";
          text.setAttribute("aria-label", "Edit to-do: " + (todo.text || "To-do"));
          del.type = "button";
          del.textContent = "Delete";
          del.setAttribute("aria-label", "Delete to-do: " + (todo.text || "To-do"));
          box.addEventListener("change", function () {
            JournalOps.todoPatch(key, todo.id, { done: box.checked });
          });
          label.appendChild(box);
          label.appendChild(span);
          block.appendChild(label);
          block.appendChild(text);
          block.appendChild(del);
          container.appendChild(block);
        })(todos[i]);
      }
    },
    announce: function (text) {
      var live = document.getElementById("day-live");
      if (!live) {
        live = document.createElement("div");
        live.id = "day-live";
        live.className = "sr-only";
        live.setAttribute("aria-live", "polite");
        document.body.appendChild(live);
      }
      live.textContent = text;
    }
  };

  window.JournalReflect = {
    mount: function (container, opts) {
      window.__reflect = opts;
      var made = JournalUI.fold({
        id: "reflection",
        title: "Reflection",
        level: 3,
        summary: "Reflection · today: Q5 · 3 answered"
      });
      container.appendChild(made.root);
    }
  };
})();
`;

function pageHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Saturday, October 17, 2026 · Journal</title>
  <link rel="stylesheet" href="/ui/shell.css" />
  <link rel="stylesheet" href="/journal/next/css/day.css" />
  <style>html, body { margin: 0; }</style>
</head>
<body class="dx">
  <main id="main" class="dx-main">
    <h2 id="period" tabindex="-1">Saturday, October 17, 2026</h2>
    <div id="view"></div>
  </main>
  <script>${STUBS}</script>
  <script src="/journal/next/js/views/day.js"></script>
  <script>
    var raw = JSON.parse(localStorage.getItem("journal-next-cache"));
    JournalData.load(raw);
    JournalViews.day(document.getElementById("view"), { key: ${JSON.stringify(DAY)}, today: ${JSON.stringify(DAY)} });
  </script>
</body>
</html>`;
}

function baseEntry(fields, todos) {
  return {
    updatedAt: "2026-10-17T08:00:00.000Z",
    fields: fields,
    todos: todos,
    habits: { thesis: true, sunlight: null },
    habitStreaks: { thesis: 4, sunlight: 0 }
  };
}

function mainFixture() {
  return {
    version: 1,
    notesFromMirror: { keep: "SENTINEL_MIRROR" },
    quotes: {
      [DAY]: { text: QUOTE, updatedAt: "2026-10-17T07:00:00.000Z" }
    },
    days: {
      [DAY]: { note: "SENTINEL_DAYS_NOTE", hubWeather: { tempC: 18 } }
    },
    entries: {
      [YDAY]: baseEntry({}, [
        { id: "y1", text: "Reply to the lab", done: false },
        { id: "y2", text: "Buy milk", done: true },
        { id: "y3", text: "Sketch the figure", done: false }
      ]),
      [DAY]: baseEntry({
        focus: "Ship",
        priorities: ["Write the plan", "Review the data", "Send the draft"],
        failureCost: "The chapter slips a week.",
        ifThen: "If the lab is busy, then book the evening slot.",
        grateful: ["Quiet morning", "A clear desk", "Hot tea"],
        makeGreat: "Finish the figure.",
        affirmation: "I can do hard things calmly.",
        feeling: "Steady",
        mood: 4,
        energy: 4,
        moodMeter: 1,
        wins: ["Wrote the introduction"],
        highlights: "The walk at lunch stayed with me.",
        lesson: "Small starts beat waiting.",
        better: LONG,
        chosenVsMomentum: "I chose the draft over the inbox.",
        tomorrow: ["Outline section two", "Email the advisor"],
        top3: ["TOP3_ALPHA", "TOP3_BETA", "TOP3_GAMMA"],
        top3UpdatedAt: "SENTINEL_TOP3_AT",
        sleep: "SENTINEL_SLEEP",
        caffeine: "SENTINEL_CAFFEINE"
      }, [
        { id: "t1", text: "Call the bank", done: true },
        { id: "t2", text: "File the form", done: true },
        { id: "t3", text: "Read the paper", done: false },
        { id: "t4", text: "Water the plants", done: false },
        { id: "t5", text: TODO_LONG, done: false }
      ])
    }
  };
}

function decodePut(postData) {
  const body = JSON.parse(postData);
  return JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
}

function deepSuperset(actual, expected, path = "$") {
  const problems = [];
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [path + " is not an array"];
    expected.forEach((item, i) => {
      if (item && typeof item === "object" && !Array.isArray(item) && item.id) {
        const found = actual.find((row) => row && row.id === item.id);
        if (!found) problems.push(path + " missing id " + item.id);
        else problems.push(...deepSuperset(found, item, path + "[" + item.id + "]"));
      } else {
        const matched = actual.some((row) => deepSuperset(row, item, path).length === 0);
        if (!matched) problems.push(path + "[" + i + "] has no match");
      }
    });
    return problems;
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return [path + " missing"];
    Object.keys(expected).forEach((key) => {
      if (key === "updatedAt" || key === "done") return;
      problems.push(...deepSuperset(actual[key], expected[key], path + "." + key));
    });
    return problems;
  }
  if (actual !== expected) problems.push(path + " changed from " + JSON.stringify(expected) + " to " + JSON.stringify(actual));
  return problems;
}

async function boot(page, raw, folds) {
  const puts = [];
  let remote = structuredClone(raw);
  let sha = "fixture-sha";
  await page.route("https://api.github.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          sha,
          encoding: "base64",
          content: Buffer.from(JSON.stringify(remote)).toString("base64")
        })
      });
      return;
    }
    if (request.method() === "PUT") {
      const decoded = decodePut(request.postData());
      puts.push(decoded);
      remote = decoded;
      sha = "sha-" + puts.length;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ content: { sha } })
      });
      return;
    }
    await route.fulfill({ status: 404, body: "" });
  });
  await page.route("http://127.0.0.1:8000/journal/next/day-test", async (route) => {
    await route.fulfill({ contentType: "text/html; charset=utf-8", body: pageHtml() });
  });
  await page.addInitScript(({ raw: data, folds: open }) => {
    localStorage.setItem("journal-next-cache", JSON.stringify(data));
    localStorage.setItem("dong-gh-sync", JSON.stringify({ token: "test-token" }));
    localStorage.setItem("journal-v1", "do-not-touch");
    if (open) localStorage.setItem("journal-folds", JSON.stringify(open));
  }, { raw, folds: folds || null });
  await page.goto("http://127.0.0.1:8000/journal/next/day-test", { waitUntil: "networkidle" });
  await page.locator(".day-view").waitFor();
  return puts;
}

async function scrollWidth(page) {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
}

async function seriousAxe(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  return results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
}

async function openAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((details) => {
      details.open = true;
    });
  });
}

test.use({ viewport: { width: 360, height: 740 } });

test("day source does not touch journal-v1 or GitHub", () => {
  const src = readFileSync(new URL("../js/views/day.js", import.meta.url), "utf8");
  expect(src).not.toContain("journal-v1");
  expect(src).not.toContain("api.github.com");
  expect(src).not.toContain("localStorage");
});

test("closed day view matches the summary formats and shows each field once", async ({ page }) => {
  const fixture = mainFixture();
  const puts = await boot(page, fixture);
  const hidden = ["SENTINEL_SLEEP", "SENTINEL_CAFFEINE", "SENTINEL_TOP3_AT", "TOP3_ALPHA", "SENTINEL_DAYS_NOTE", "SENTINEL_MIRROR"];
  const once = [
    "Write the plan",
    "Review the data",
    "Send the draft",
    "The chapter slips a week.",
    "If the lab is busy, then book the evening slot.",
    "Quiet morning",
    "A clear desk",
    "Hot tea",
    "Finish the figure.",
    "I can do hard things calmly.",
    "Steady",
    "Wrote the introduction",
    "The walk at lunch stayed with me.",
    "Small starts beat waiting.",
    LONG,
    "I chose the draft over the inbox.",
    "Outline section two",
    "Email the advisor",
    "Mood 4 of 5",
    "Energy 4 of 5",
    QUOTE
  ];

  await expect(page.locator("details")).toHaveCount(5);
  for (const id of ["morning", "evening", "reflection", "todos", "other-apps"]) {
    await expect(page.locator(`details[data-fold="${id}"]`)).toHaveJSProperty("open", false);
  }
  await expect(page.locator('[data-fold="morning"] .fold-summary')).toHaveText("Morning · focus: Ship · 3 priorities");
  await expect(page.locator('[data-fold="evening"] .fold-summary')).toHaveText("Evening · mood 4 / energy 4 · 2 wins");
  await expect(page.locator('[data-fold="todos"] .fold-summary')).toHaveText("To-dos · 2 of 5 done");
  await expect(page.locator("figure.day-quote blockquote")).toHaveText(QUOTE);
  await expect(page.locator("figure.day-quote")).toHaveCount(1);
  expect(await page.locator("details figure").count()).toBe(0);

  const html = await page.content();
  for (const marker of hidden) expect(html).not.toContain(marker);
  const text = await page.evaluate(() => document.body.textContent);
  for (const value of once) {
    const hits = text.split(value).length - 1;
    expect(hits, value.slice(0, 40)).toBe(1);
  }
  await expect(page.locator("[data-field='focus']")).toHaveCount(1);
  await expect(page.locator("[data-field='focus']")).toContainText("Ship");
  await expect(page.locator("[data-field='mood'] [aria-hidden='true']")).toHaveCount(1);
  await expect(page.locator("[data-field='energy'] [aria-hidden='true']")).toHaveCount(1);
  await expect(page.locator("[data-field='priorities']")).toHaveAttribute("data-priorities-source", "priorities");
  await expect(page.locator("[data-fold='morning'] textarea, [data-fold='morning'] input, [data-fold='evening'] textarea, [data-fold='evening'] input")).toHaveCount(0);
  await expect(page.locator("[data-field='lesson'] a")).toHaveAttribute("href", "https://dong-xuyong.github.io/wiki-flashcards/");
  await expect(page.locator(".day-app")).toHaveText(["Health", "Study", "Thesis"]);
  expect(await page.evaluate(() => window.__reflect)).toEqual({ mode: "day", day: DAY });

  const order = await page.evaluate(() => Array.from(document.querySelectorAll(".day-view > *")).map((node) => node.getAttribute("data-fold") || node.dataset.dayReflect || node.tagName.toLowerCase()));
  expect(order).toEqual(["figure", "morning", "evening", DAY, "todos", "other-apps"]);

  expect(await scrollWidth(page)).toBeLessThanOrEqual(360);
  expect(await seriousAxe(page)).toEqual([]);
  expect(puts).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("journal-v1"))).toBe("do-not-touch");
});

test("mood stored only on days[date] still shows", async ({ page }) => {
  const fixture = mainFixture();
  delete fixture.entries[DAY].fields.mood;
  delete fixture.entries[DAY].fields.energy;
  fixture.entries[DAY].fields.moodMeter = 5;
  fixture.days[DAY].mood = 3;
  fixture.days[DAY].energy = 2;
  await boot(page, fixture);
  await expect(page.locator("[data-field='mood']")).toContainText("Mood 3 of 5");
  await expect(page.locator("[data-field='energy']")).toContainText("Energy 2 of 5");
  await expect(page.locator('[data-fold="evening"] .fold-summary')).toHaveText("Evening · mood 3 / energy 2 · 2 wins");
  const html = await page.content();
  expect(html).not.toContain("Mood 5 of 5");
  expect(html).not.toContain("SENTINEL_DAYS_NOTE");
});

test("priorities fall back to this morning's top 3", async ({ page }) => {
  const top3 = mainFixture();
  top3.entries[DAY].fields.priorities = [];
  await boot(page, top3);
  await expect(page.locator("[data-field='priorities']")).toHaveAttribute("data-priorities-source", "top3");
  await expect(page.locator("[data-field='priorities']")).toContainText("TOP3_ALPHA");
  await expect(page.locator("[data-field='priorities'] .day-note")).toHaveText("From this morning's top 3.");
  await expect(page.locator('[data-fold="morning"] .fold-summary')).toHaveText("Morning · focus: Ship · 3 priorities");
  const html = await page.content();
  expect(html.split("TOP3_ALPHA").length - 1).toBe(1);
});

test("priorities fall back to the most important to-dos", async ({ page }) => {
  const mit = mainFixture();
  mit.entries[DAY].fields.priorities = [];
  mit.entries[DAY].fields.top3 = [];
  mit.entries[DAY].todos[2].mit = true;
  await boot(page, mit);
  await expect(page.locator("[data-field='priorities']")).toHaveAttribute("data-priorities-source", "mit");
  await expect(page.locator("[data-field='priorities']")).toContainText("Read the paper");
  await expect(page.locator("[data-field='priorities'] .day-note")).toHaveText("From the most important to-dos.");
  await expect(page.locator('[data-fold="morning"] .fold-summary')).toContainText("1 priority");
});

test("empty morning and evening use one not-written line", async ({ page }) => {
  const fixture = {
    version: 1,
    quotes: {},
    entries: { [DAY]: { updatedAt: "2026-10-17T08:00:00.000Z", fields: {}, todos: [] } }
  };
  await boot(page, fixture);
  await expect(page.locator("figure")).toHaveCount(0);
  await expect(page.locator('[data-fold="morning"] .fold-summary')).toHaveText("Morning · no focus · 0 priorities");
  await expect(page.locator('[data-fold="evening"] .fold-summary')).toHaveText("Evening · no mood / no energy · 0 wins");
  await expect(page.locator('[data-fold="todos"] .fold-summary')).toHaveText("To-dos · 0 of 0 done");
  await expect(page.locator("[data-fold='morning'] .day-missing")).toHaveText("Not written yet: focus, priorities, if the first priority is skipped, if-then plan, grateful.");
  await expect(page.locator("[data-fold='morning'] .day-field")).toHaveCount(0);
  await expect(page.locator("[data-fold='evening'] .day-missing")).toContainText("Not written yet:");
  await expect(page.locator("[data-fold='evening'] .day-field")).toHaveCount(0);
});

test("a fold saved under journal-folds stays open", async ({ page }) => {
  await boot(page, mainFixture(), { evening: true });
  await expect(page.locator('[data-fold="evening"]')).toHaveJSProperty("open", true);
  await expect(page.locator('[data-fold="morning"]')).toHaveJSProperty("open", false);
});

test("keyboard, focus, tap size, long text, and saves keep unknown fields", async ({ page }) => {
  const fixture = mainFixture();
  const puts = await boot(page, fixture);
  const folds = ["morning", "evening", "reflection", "todos", "other-apps"];

  for (const id of folds) {
    const details = page.locator(`details[data-fold="${id}"]`);
    const summary = details.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveJSProperty("open", true);
    await page.keyboard.press("Space");
    await expect(details).toHaveJSProperty("open", false);
  }

  await openAll(page);
  expect(await scrollWidth(page)).toBeLessThanOrEqual(360);
  expect(await seriousAxe(page)).toEqual([]);

  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".day-view summary, .day-view button, .day-view a, .day-view input, .day-view textarea").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        bad.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 50) + " " + Math.round(rect.width) + "x" + Math.round(rect.height));
      }
    });
    return bad;
  });
  expect(small).toEqual([]);

  await page.locator("h2").focus();
  const seen = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const style = getComputedStyle(el);
      const label = el.getAttribute("aria-label")
        || (el.labels && el.labels[0] && el.labels[0].innerText)
        || (el.closest && el.closest("label") && el.closest("label").innerText)
        || el.innerText
        || "";
      const rect = el.getBoundingClientRect();
      return {
        key: el.tagName + ":" + Math.round(rect.top) + ":" + label.trim().slice(0, 40),
        outline: style.outlineStyle,
        width: parseFloat(style.outlineWidth) || 0,
        name: label.trim()
      };
    });
    if (!stop) break;
    if (seen.some((item) => item.key === stop.key)) break;
    seen.push(stop);
  }
  expect(seen.length).toBeGreaterThan(8);
  for (const stop of seen) {
    expect(stop.name.length, stop.key).toBeGreaterThan(0);
    expect(stop.outline, stop.key).not.toBe("none");
    expect(stop.width, stop.key).toBeGreaterThanOrEqual(2);
  }

  await page.getByRole("checkbox", { name: "Read the paper" }).click();
  await expect.poll(() => puts.length).toBe(1);
  await page.getByRole("button", { name: "Add to today: Reply to the lab" }).click();
  await expect.poll(() => puts.length).toBe(2);
  await expect(page.locator('[data-fold="todos"] .fold-summary')).toHaveText("To-dos · 3 of 6 done");
  await expect(page.getByRole("button", { name: "Add to today: Reply to the lab" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to today: Sketch the figure" })).toHaveCount(1);

  for (const body of puts) {
    expect(deepSuperset(body, fixture)).toEqual([]);
    expect(body.entries[DAY].fields.sleep).toBe("SENTINEL_SLEEP");
    expect(body.entries[DAY].fields.caffeine).toBe("SENTINEL_CAFFEINE");
    expect(body.entries[DAY].fields.top3UpdatedAt).toBe("SENTINEL_TOP3_AT");
    expect(body.entries[DAY].habits).toEqual(fixture.entries[DAY].habits);
    expect(body.days[DAY].note).toBe("SENTINEL_DAYS_NOTE");
    expect(body.notesFromMirror).toEqual(fixture.notesFromMirror);
  }
  const saved = puts[1];
  expect(saved.entries[DAY].todos.find((todo) => todo.id === "t3").done).toBe(true);
  expect(saved.entries[DAY].todos.some((todo) => todo.text === "Reply to the lab" && todo.done === false)).toBe(true);
  expect(saved.entries[YDAY].todos).toEqual(fixture.entries[YDAY].todos);
  expect(await page.evaluate(() => localStorage.getItem("journal-v1"))).toBe("do-not-touch");
});
