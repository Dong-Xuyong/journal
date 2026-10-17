/**
 * Builder 4 reflections at 360px.
 * Server: /tmp/site on :8000 with /ui/shell.css and /journal -> this repo.
 *   npx --prefix /tmp/jt playwright test --config /tmp/jt/playwright.config.mjs
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DAY = "2026-10-18";
const YEAR = "2026";
const LONG = "X".repeat(300);
const QUESTIONS = [
  { id: "q1", text: "If I knew I couldn't fail, what would I like to do?", source: "seed" },
  { id: "q2", text: "Even if I knew I would fail, what would I like to do anyway?" },
  { id: "q3", text: "If I had all the time and money in the world, but I had to use 40 hours a week to be of service to other people, what would I do?" },
  { id: "q4", text: "If I was giving a TED talk 40 years from now and the audience is giving it a standing ovation, what would I like to have talked about?" },
  { id: "q5", text: "What do I want people to say about me at my funeral?" },
  { id: "q6", text: "What do I want written about myself in my obituary?" },
  { id: "q7", text: "If I continued on this exact path, where would I end up five years from now? And is that where I want to end up?" },
  { id: "q8", text: "If I took a completely different path to what I'm doing right now, where might I end up five years from now?" },
  { id: "q9", text: "If I took a completely different path and did not care about money or what other people thought of me, where might I end up?" },
  { id: "voyage", text: "What would I give a year to learn?" }
];

const FIXTURE = {
  version: 1,
  customFlag: { ok: true, n: 1 },
  sleep: { "2026-10-18": { hours: 7.5, note: "keep" } },
  days: { "2026-10-18": { mood: 4, energy: 3 } },
  habitDefs: [{ id: "thesis", label: "Thesis", emoji: "note" }],
  quotes: { "2026-10-18": { text: "Stay.", updatedAt: "2026-10-18T00:00:00.000Z" } },
  entries: {
    "2026-10-18": {
      updatedAt: "2026-10-18T01:02:03.000Z",
      fields: {
        sleep: "8h",
        caffeine: "none",
        top3UpdatedAt: "2026-10-18T00:00:00.000Z",
        focus: "Ship"
      },
      todos: [{ id: "t1", text: "Call bank", done: false }],
      habits: { thesis: true }
    }
  },
  reflections: {
    questions: QUESTIONS,
    answers: {
      q1: [
        { date: "2026-01-02", text: "First thought.", marker: "keep-first" },
        { date: "2026-08-08", text: LONG, marker: "keep-long" }
      ],
      q8: [{ date: "2025-11-11", text: "Still on this path.", marker: "keep-q8" }],
      voyage: [{ date: "2026-03-03", text: "Ship the next journal.", marker: "keep-voyage" }]
    }
  }
};

const HARNESS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reflections</title>
  <link rel="stylesheet" href="/ui/shell.css">
  <link rel="stylesheet" href="/journal/next/css/reflect.css">
  <style>
    body.dx::before, body.dx::after { content: none !important; display: none !important; }
    body.dx, .dx-header, .dx-main { background: #f6f4ef !important; color: #0d0b08; }
    html.dark body.dx, html.dark .dx-header, html.dark .dx-main,
    html[data-theme="dark"] body.dx, html[data-theme="dark"] .dx-header, html[data-theme="dark"] .dx-main {
      background: #141414 !important;
      color: #efeeec;
    }
    .dx-home { background: #ffffff !important; }
    html.dark .dx-home, html[data-theme="dark"] .dx-home { background: #1f1f1f !important; }
    #journal-live { margin: 0 0 8px; overflow-wrap: anywhere; }
  </style>
</head>
<body class="dx">
  <header class="dx-header">
    <a class="dx-home" href="https://dong-xuyong.github.io/">Home</a>
    <h1 class="dx-title">Journal</h1>
  </header>
  <main id="main" class="dx-main">
    <h2 id="period" tabindex="-1">Saturday, October 18, 2026</h2>
    <div id="journal-live" aria-live="polite"></div>
    <div id="day-slot"></div>
    <div id="year-slot"></div>
  </main>
  <script src="/journal/next/js/views/reflect.js"></script>
  <script>
    JournalReflect.mount(document.getElementById("day-slot"), { mode: "day", day: "${DAY}" });
    JournalReflect.mount(document.getElementById("year-slot"), { mode: "year", year: "${YEAR}" });
  </script>
</body>
</html>`;

function installStubs(payload) {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var store = JSON.parse(JSON.stringify(payload.fixture));
  var listeners = [];
  var status = "idle";
  var tail = Promise.resolve();

  function reflectionIndex(day, count) {
    var n = count > 0 ? count : 9;
    var days = Math.floor(Date.UTC(Number(String(day).slice(0, 4)), Number(String(day).slice(5, 7)) - 1, Number(String(day).slice(8, 10))) / 86400000);
    if (days !== days) return 0;
    return ((days % n) + n) % n;
  }

  function label(key) {
    var text = String(key || "");
    var year;
    var month;
    var day;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    year = Number(text.slice(0, 4));
    month = Number(text.slice(5, 7));
    day = Number(text.slice(8, 10));
    return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] + ", " + MONTHS[month - 1] + " " + day + ", " + year;
  }

  function readFolds() {
    try {
      var data = JSON.parse(localStorage.getItem("journal-folds") || "{}");
      if (data && typeof data === "object" && !Array.isArray(data)) return data;
    } catch (e) {}
    return {};
  }

  function remember(el, id) {
    if (!id) return;
    el.open = readFolds()[id] === true;
    el.addEventListener("toggle", function (event) {
      var data;
      if (event.target !== el) return;
      data = readFolds();
      if (el.open) data[id] = true;
      else delete data[id];
      localStorage.setItem("journal-folds", JSON.stringify(data));
    });
  }

  function fold(opts) {
    var root = document.createElement("details");
    var summary = document.createElement("summary");
    var level = opts.level || 2;
    var heading;
    var body;
    if (level < 2) level = 2;
    if (level > 6) level = 6;
    root.className = "dx-card fold";
    root.setAttribute("data-fold", opts.id || "");
    summary.className = "fold-summary";
    heading = document.createElement("h" + level);
    heading.className = "fold-line";
    heading.textContent = opts.summary || opts.title || "";
    summary.appendChild(heading);
    root.appendChild(summary);
    body = document.createElement("div");
    body.className = "fold-body";
    root.appendChild(body);
    remember(root, opts.id);
    return { root: root, body: body };
  }

  function announce(text) {
    var el = document.getElementById("journal-live");
    if (!el) {
      el = document.createElement("div");
      el.id = "journal-live";
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = "";
    el.textContent = text;
  }

  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64(b64) {
    return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ""))));
  }

  function sameAnswer(item, date, text) {
    return !!item && String(item.date || "") === date && String(item.text || "") === text;
  }

  function pushOne(qid, date, text) {
    var cfg = JSON.parse(localStorage.getItem("dong-gh-sync") || "null");
    var url;
    if (!cfg || !cfg.token) {
      status = "offline";
      return Promise.resolve(false);
    }
    url = "https://api.github.com/repos/" + (cfg.repo || "Dong-Xuyong/progress-sync") + "/contents/journal.json";
    status = "saving";
    return fetch(url, {
      headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json" }
    }).then(function (res) { return res.json(); }).then(function (file) {
      var raw = JSON.parse(fromBase64(file.content));
      var list;
      var i;
      if (!raw.reflections || typeof raw.reflections !== "object" || Array.isArray(raw.reflections)) {
        raw.reflections = { questions: [], answers: {} };
      }
      if (!raw.reflections.answers || typeof raw.reflections.answers !== "object" || Array.isArray(raw.reflections.answers)) {
        raw.reflections.answers = {};
      }
      list = raw.reflections.answers[qid];
      if (!Array.isArray(list)) list = [];
      for (i = 0; i < list.length; i++) {
        if (sameAnswer(list[i], date, text)) {
          status = "saved";
          return false;
        }
      }
      list.push({ date: date, text: text });
      raw.reflections.answers[qid] = list;
      return fetch(url, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + cfg.token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Save journal progress",
          content: toBase64(JSON.stringify(raw)),
          sha: file.sha
        })
      }).then(function () {
        status = "saved";
        return true;
      });
    }).catch(function () {
      status = "error";
      return false;
    });
  }

  function appendAnswer(qid, answer) {
    var text = String(answer && answer.text || "").replace(/^\s+|\s+$/g, "");
    var date = String(answer && answer.date || "");
    var list;
    var i;
    if (!qid || !text) return false;
    if (!store.reflections.answers || typeof store.reflections.answers !== "object") store.reflections.answers = {};
    if (!Array.isArray(store.reflections.answers[qid])) store.reflections.answers[qid] = [];
    list = store.reflections.answers[qid];
    for (i = 0; i < list.length; i++) {
      if (sameAnswer(list[i], date, text)) return false;
    }
    list.push({ date: date, text: text });
    status = "pending";
    listeners.slice().forEach(function (fn) { fn(); });
    tail = tail.then(function () { return pushOne(qid, date, text); });
    return true;
  }

  localStorage.setItem("journal-next-cache", JSON.stringify(payload.fixture));
  localStorage.setItem("dong-gh-sync", JSON.stringify({ token: "test-token", repo: "Dong-Xuyong/progress-sync" }));
  localStorage.removeItem("journal-v1");
  if (payload.folds) localStorage.setItem("journal-folds", JSON.stringify(payload.folds));
  else localStorage.removeItem("journal-folds");

  window.JournalData = {
    load: function (raw) { store = raw; },
    entry: function () { return null; },
    fields: function () { return {}; },
    todos: function () { return []; },
    quote: function () { return null; },
    moodOf: function () { return null; },
    energyOf: function () { return null; },
    sleepOf: function () { return null; },
    habitDefs: function () { return store.habitDefs || []; },
    habitStatus: function () { return null; },
    reflections: function () { return store.reflections; },
    questionOfDay: function (day) {
      var questions = store.reflections && store.reflections.questions ? store.reflections.questions : [];
      if (!questions.length) return null;
      return questions[reflectionIndex(day, questions.length)];
    },
    children: function () { return []; },
    ancestors: function () { return []; },
    daysIn: function () { return []; },
    rollup: function () { return null; },
    shift: function () { return null; },
    label: label,
    kindOf: function (key) { return /^\d{4}-\d{2}-\d{2}$/.test(String(key || "")) ? "day" : null; },
    todayKey: function () { return DAY_SENTINEL; }
  };

  window.JournalOps = {
    todoAdd: function () {},
    todoPatch: function () {},
    todoRemove: function () {},
    appendAnswer: appendAnswer,
    onChange: function (fn) { listeners.push(fn); },
    status: function () { return status; }
  };

  window.JournalUI = {
    el: function (tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = text;
      return el;
    },
    fold: fold,
    info: function () { return document.createElement("span"); },
    todoList: function () {},
    announce: announce
  };
}

const STUB = installStubs.toString().replace("DAY_SENTINEL", JSON.stringify(DAY));

function problemsIn(actual, expected, path, problems) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      problems.push(path + " is not an array");
      return;
    }
    if (path.indexOf(".reflections.answers.") !== -1) {
      let cursor = -1;
      expected.forEach((item, i) => {
        const wanted = JSON.stringify(item);
        let found = -1;
        for (let j = cursor + 1; j < actual.length; j += 1) {
          if (JSON.stringify(actual[j]) === wanted) {
            found = j;
            break;
          }
        }
        if (found < 0) problems.push(path + "[" + i + "] missing " + wanted);
        else cursor = found;
      });
      return;
    }
    if (actual.length !== expected.length) problems.push(path + " length " + actual.length + " != " + expected.length);
    expected.forEach((item, i) => problemsIn(actual[i], item, path + "[" + i + "]", problems));
    return;
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") {
      problems.push(path + " missing object");
      return;
    }
    Object.keys(expected).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) problems.push(path + "." + key + " missing");
      else problemsIn(actual[key], expected[key], path + "." + key, problems);
    });
    return;
  }
  if (actual !== expected) problems.push(path + " changed");
}

test.use({ viewport: { width: 360, height: 740 } });

async function boot(page, folds) {
  const puts = [];
  let server = JSON.parse(JSON.stringify(FIXTURE));
  page.on("pageerror", (err) => {
    console.log("PAGEERROR", err.message);
  });
  await page.addInitScript({ content: `(${STUB})(${JSON.stringify({ fixture: FIXTURE, folds: folds || null })})` });
  await page.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      const content = Buffer.from(JSON.stringify(server), "utf8").toString("base64");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sha: "sha-" + puts.length, content: content, encoding: "base64" })
      });
      return;
    }
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      const decoded = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
      server = decoded;
      puts.push({ body: body, decoded: decoded });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "sha-" + puts.length } })
      });
      return;
    }
    await route.fulfill({ status: 404, body: "" });
  });
  await page.route("**/reflect-harness.html", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: HARNESS });
  });
  await page.goto("/journal/next/reflect-harness.html");
  await page.waitForSelector("#day-slot > details");
  return { puts: puts };
}

async function expectNoHorizontalScroll(page) {
  const widths = await page.evaluate(() => ({
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(widths.root).toBeLessThanOrEqual(360);
  expect(widths.body).toBeLessThanOrEqual(360);
}

function serious(results) {
  return results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
}

function formatViolations(list) {
  return list.map((item) => {
    const nodes = item.nodes.map((node) => node.target.join(" ") + " :: " + node.html).join(" || ");
    return item.id + " (" + item.impact + ") " + item.help + " :: " + nodes;
  }).join("\n");
}

async function expectCleanAxe(page, label) {
  const results = await new AxeBuilder({ page: page }).withTags(["wcag2aa"]).analyze();
  const bad = serious(results);
  expect(bad, label + "\n" + formatViolations(bad)).toEqual([]);
}

test("saving A then B keeps both, and saving A twice keeps one", async ({ page }) => {
  const { puts } = await boot(page);
  const day = page.locator("#day-slot");
  const outer = day.locator(":scope > details");
  await expect(outer.locator(":scope > summary")).toContainText("Reflection · today: Q5 · 3 answered");
  await expect(page.evaluate(() => window.JournalData.questionOfDay("2026-10-18").id)).resolves.toBe("q5");
  await outer.locator(":scope > summary").click();
  const box = day.locator(".reflect-today textarea");
  await expect(box).toHaveAccessibleName(/What do I want people to say about me at my funeral\?/);
  await box.fill("A");
  await day.locator(".reflect-today button").click();
  await expect(page.locator("#journal-live")).toHaveText("Answer saved.");
  await expect.poll(() => puts.length).toBe(1);
  await expect(day.locator(".reflect-today .reflect-answer")).toHaveText(["A"]);

  await day.locator(".reflect-today textarea").fill("A");
  await day.locator(".reflect-today textarea").press("Control+Enter");
  await expect(page.locator("#journal-live")).toHaveText("That answer is already saved.");
  expect(puts).toHaveLength(1);
  await expect(day.locator(".reflect-today .reflect-answer")).toHaveText(["A"]);

  await day.locator(".reflect-today textarea").fill("B");
  await page.evaluate(() => {
    var box = document.querySelector("#day-slot .reflect-today textarea");
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true, cancelable: true }));
  });
  await expect(page.locator("#journal-live")).toHaveText("Answer saved.");
  await expect.poll(() => puts.length).toBe(2);
  await expect(day.locator(".reflect-today .reflect-answer")).toHaveText(["B", "A"]);
  await expect(day.locator(".reflect-all [data-question-id='q5'] .reflect-answer")).toHaveText(["B", "A"]);

  await day.locator(".reflect-today textarea").fill("   ");
  await day.locator(".reflect-today button").click();
  await expect(page.locator("#journal-live")).toHaveText("Write an answer first.");
  expect(puts).toHaveLength(2);

  puts.forEach((put) => {
    const problems = [];
    problemsIn(put.decoded, FIXTURE, "", problems);
    expect(problems, problems.join("\n")).toEqual([]);
    expect(put.body.message).toBe("Save journal progress");
    expect(put.body.sha).toBeTruthy();
    expect(JSON.stringify(put.decoded.entries)).toBe(JSON.stringify(FIXTURE.entries));
    expect(JSON.stringify(put.decoded.reflections.questions)).toBe(JSON.stringify(FIXTURE.reflections.questions));
  });
  expect(puts[0].decoded.reflections.answers.q5.map((item) => item.text)).toEqual(["A"]);
  expect(puts[1].decoded.reflections.answers.q5.map((item) => item.text)).toEqual(["A", "B"]);
  expect(puts[1].decoded.reflections.answers.q1.map((item) => JSON.stringify(item))).toEqual(
    FIXTURE.reflections.answers.q1.map((item) => JSON.stringify(item))
  );
  expect(puts[1].decoded.reflections.answers.voyage[0].marker).toBe("keep-voyage");
  expect(await page.evaluate(() => localStorage.getItem("journal-v1"))).toBeNull();
  await expect(page.getByRole("button", { name: /delete|edit/i })).toHaveCount(0);
});

test("an extra question shows as question 10 and the year digest is read-only", async ({ page }) => {
  await boot(page);
  const day = page.locator("#day-slot");
  const year = page.locator("#year-slot");
  await day.locator(":scope > details > summary").click();
  await day.locator(".reflect-all > summary").click();
  const q10 = day.locator("[data-question-number='10']");
  await expect(q10.locator(":scope > summary")).toContainText("Question 10");
  await q10.locator(":scope > summary").click();
  await expect(q10).toContainText("What would I give a year to learn?");
  await expect(q10.locator("textarea")).toHaveAccessibleName(/What would I give a year to learn\?/);
  await expect(day.locator(".reflect-all > summary")).toContainText("All 10 questions");

  await day.locator("[data-question-id='q1'] > summary").click();
  const q1Answers = day.locator("[data-question-id='q1'] .reflect-answer");
  await expect(q1Answers).toHaveCount(2);
  await expect(q1Answers.nth(0)).toHaveText(LONG);
  await expect(q1Answers.nth(1)).toHaveText("First thought.");

  await expect(year.locator(":scope > details > summary")).toContainText("Reflection · 2026 · 2 answered");
  await year.locator(":scope > details > summary").click();
  await expect(year.locator("textarea")).toHaveCount(0);
  await expect(year.locator("button")).toHaveCount(0);
  await expect(year.getByRole("button", { name: /delete|edit|save/i })).toHaveCount(0);
  const yearQ1 = year.locator("[data-question-id='q1']");
  await yearQ1.locator(":scope > summary").click();
  await expect(yearQ1).toContainText("2 answers in 2026");
  await expect(yearQ1.locator(".reflect-answer")).toHaveText(LONG);
  const yearQ8 = year.locator("[data-question-id='q8']");
  await yearQ8.locator(":scope > summary").click();
  await expect(yearQ8).toContainText("No answer this year.");
  await expect(yearQ8).not.toContainText("Still on this path.");
  const yearVoyage = year.locator("[data-question-id='voyage']");
  await yearVoyage.locator(":scope > summary").click();
  await expect(yearVoyage.locator(":scope > summary")).toContainText("Question 10");
  await expect(yearVoyage.locator(".reflect-answer")).toHaveText("Ship the next journal.");
});

test("opening an inner fold does not toggle the outer one", async ({ page }) => {
  await boot(page);
  const outer = page.locator("#day-slot > details");
  const all = page.locator("#day-slot .reflect-all");
  const q10 = page.locator("#day-slot [data-question-number='10']");
  await expect(outer).toHaveJSProperty("open", false);
  await outer.locator(":scope > summary").click();
  await expect(outer).toHaveJSProperty("open", true);
  await all.locator(":scope > summary").click();
  await expect(all).toHaveJSProperty("open", true);
  await expect(outer).toHaveJSProperty("open", true);
  await q10.locator(":scope > summary").click();
  await expect(q10).toHaveJSProperty("open", true);
  await expect(all).toHaveJSProperty("open", true);
  await expect(outer).toHaveJSProperty("open", true);
  await q10.locator(":scope > summary").click();
  await expect(q10).toHaveJSProperty("open", false);
  await expect(all).toHaveJSProperty("open", true);
  await expect(outer).toHaveJSProperty("open", true);
});

test("a fold stored under day:reflection stays open", async ({ page }) => {
  await boot(page, { "day:reflection": true });
  await expect(page.locator("#day-slot > details")).toHaveJSProperty("open", true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("journal-folds"))["day:reflection"])).toBe(true);
});

test("360px axe, keyboard, focus, and tap targets", async ({ page }) => {
  await boot(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
  });
  await expectNoHorizontalScroll(page);
  await expectCleanAxe(page, "light closed");

  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((el) => { el.open = true; });
  });
  await expectNoHorizontalScroll(page);
  await expectCleanAxe(page, "light open");

  const wanted = await page.locator("a, summary, button, textarea").evaluateAll((els) => els.filter((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && el.id !== "tab-start";
  }).length);
  await page.evaluate(() => {
    const start = document.createElement("button");
    start.id = "tab-start";
    start.type = "button";
    start.textContent = "Start";
    document.body.prepend(start);
    start.focus();
  });
  const seen = [];
  let firstControl = "";
  for (let i = 0; i < wanted + 5; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      let name = el.getAttribute("aria-label") || "";
      if (!name && el.labels && el.labels.length) name = Array.from(el.labels).map((label) => label.innerText).join(" ");
      if (!name) name = (el.innerText || "").trim();
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && parts.length < 8) {
        let part = node.tagName;
        if (node.id) part += "#" + node.id;
        else if (node.getAttribute("data-fold")) part += "[fold=" + node.getAttribute("data-fold") + "]";
        else if (node.getAttribute("data-question-id")) part += "[q=" + node.getAttribute("data-question-id") + "]";
        parts.push(part);
        node = node.parentElement;
      }
      return {
        path: parts.join("<"),
        tag: el.tagName,
        name: name.trim(),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        w: rect.width,
        h: rect.height
      };
    });
    if (info.tag === "BODY" || info.tag === "HTML" || info.path.indexOf("#tab-start") !== -1) continue;
    if (!firstControl) firstControl = info.path;
    else if (info.path === firstControl) break;
    seen.push(info);
  }
  expect(seen.length).toBe(wanted);
  seen.forEach((info) => {
    expect(info.name, info.path).not.toBe("");
    expect(parseFloat(info.outlineWidth), info.path).toBeGreaterThanOrEqual(2);
    expect(info.outlineStyle, info.path).not.toBe("none");
    expect(info.w, info.path).toBeGreaterThanOrEqual(44);
    expect(info.h, info.path).toBeGreaterThanOrEqual(44);
  });
  await page.evaluate(() => {
    const start = document.getElementById("tab-start");
    if (start) start.remove();
  });

  const summaries = page.locator("summary");
  const count = await summaries.count();
  for (let i = 0; i < count; i += 1) {
    const summary = summaries.nth(i);
    await summary.evaluate((el) => {
      let node = el.parentElement;
      while (node) {
        if (node.tagName === "DETAILS") node.open = true;
        node = node.parentElement;
      }
    });
    await summary.focus();
    const details = summary.locator("xpath=ancestor::details[1]");
    const before = await details.evaluate((el) => el.open);
    await page.keyboard.press("Enter");
    await expect.poll(() => details.evaluate((el) => el.open)).toBe(!before);
    await page.keyboard.press("Enter");
    await expect.poll(() => details.evaluate((el) => el.open)).toBe(before);
    await page.keyboard.press("Space");
    await expect.poll(() => details.evaluate((el) => el.open)).toBe(!before);
    await page.keyboard.press("Space");
    await expect.poll(() => details.evaluate((el) => el.open)).toBe(before);
  }

  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelectorAll("details").forEach((el) => { el.open = false; });
  });
  await expectCleanAxe(page, "dark closed");
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((el) => { el.open = true; });
  });
  await expectCleanAxe(page, "dark open");
  await expectNoHorizontalScroll(page);
});
