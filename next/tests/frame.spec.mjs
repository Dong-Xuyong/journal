import { spawn, execSync } from "node:child_process";
import { chromium } from "/tmp/jt/node_modules/playwright/index.mjs";
import AxeBuilder from "/tmp/jt/node_modules/@axe-core/playwright/dist/index.mjs";

const DAY = "2026-10-17";
const BASE = "http://127.0.0.1:8000/journal/next/";
const DAY_URL = BASE + "#day/" + DAY;
const HABITS_URL = BASE + "#habits";

const fixture = {
  version: 1,
  habitDefs: [{ id: "thesis", label: "Thesis", emoji: "note" }],
  quotes: { "2026-10-17": { text: "Keep going.", updatedAt: "2026-10-17T00:00:00.000Z" } },
  extraUnknown: { keep: true, nested: { ok: 1 } },
  days: { "2026-10-17": { mood: 3, note: "from days" } },
  sleep: { "2026-10-16": "6h" },
  entries: {
    "2026-10-17": {
      updatedAt: "2026-10-17T08:00:00.000Z",
      fields: {
        focus: "Ship",
        sleep: "7h",
        caffeine: "none",
        top3UpdatedAt: "2026-10-17T07:00:00.000Z",
        mood: 4,
        energy: 4,
        wins: ["Shipped the frame"]
      },
      todos: [{ id: "t1", text: "Call bank", done: false, mit: true, source: "mirror" }],
      habits: { thesis: true, sunlight: null },
      habitStreaks: { thesis: 2, sunlight: 0 }
    }
  }
};

let server = null;

function setupSite() {
  execSync('mkdir -p /tmp/site/ui && ln -sfn "' + process.cwd() + '" /tmp/site/journal');
  try {
    execSync("test -s /tmp/site/ui/shell.css");
  } catch (e) {
    execSync("curl -fsSL -o /tmp/site/ui/shell.css https://dong-xuyong.github.io/ui/shell.css");
  }
}

async function ensureServer() {
  setupSite();
  try {
    const res = await fetch(BASE);
    if (res.status < 500) return;
  } catch (e) {}
  server = spawn("python3", ["-m", "http.server", "8000"], { cwd: "/tmp/site", stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(BASE);
      if (res.status < 500) return;
    } catch (e) {}
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  throw new Error("local server did not start");
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function scrollWidth(page) {
  return page.evaluate(function () {
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  });
}

async function axeSerious(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const bad = results.violations.filter(function (item) {
    return item.impact === "serious" || item.impact === "critical";
  });
  if (bad.length) {
    const brief = bad.map(function (item) {
      return item.id + " (" + item.impact + "): " + item.help + "\n" + item.nodes.slice(0, 2).map(function (node) { return node.target.join(" ") + "\n" + node.failureSummary; }).join("\n");
    }).join("\n");
    throw new Error(label + "\n" + brief);
  }
}

function diffs(actual, expected, path, out) {
  const here = path || "";
  if (here === "entries.2026-10-17.updatedAt") return;
  if (here === "entries.2026-10-17.todos[0].done") return;
  if (expected && typeof expected === "object") {
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        out.push(here + " is not an array");
        return;
      }
      expected.forEach(function (item, index) {
        diffs(actual[index], item, here + "[" + index + "]", out);
      });
      return;
    }
    Object.keys(expected).forEach(function (key) {
      const next = here ? here + "." + key : key;
      if (actual == null || !Object.prototype.hasOwnProperty.call(actual, key)) out.push(next + " missing");
      else diffs(actual[key], expected[key], next, out);
    });
    return;
  }
  if (actual !== expected) out.push(here + " expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
}

async function seed(page) {
  await page.addInitScript(function (raw) {
    localStorage.setItem("journal-next-cache", JSON.stringify(raw));
    localStorage.setItem("journal-folds", JSON.stringify({ "day:morning": true }));
    localStorage.setItem("dong-gh-sync", JSON.stringify({ token: "test-token", repo: "Dong-Xuyong/progress-sync" }));
    localStorage.setItem("dong-ui-theme", "light");
    localStorage.setItem("journal-v1", JSON.stringify({ sentinel: true }));
  }, fixture);
  await page.route("https://fonts.googleapis.com/**", function (route) { return route.fulfill({ status: 200, contentType: "text/css", body: "" }); });
  await page.route("https://fonts.gstatic.com/**", function (route) { return route.abort(); });
  await page.route("https://api.github.com/**", function (route) {
    const req = route.request();
    if (req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sha: "abc123",
          encoding: "base64",
          content: Buffer.from(JSON.stringify(fixture)).toString("base64")
        })
      });
    }
    if (req.method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "def456" } })
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

async function tabThrough(page) {
  await page.evaluate(function () {
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
  });
  const stops = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(function () {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const name = (el.getAttribute("aria-label") || el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        name: name,
        tag: el.tagName,
        outline: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        outlineColor: style.outlineColor,
        width: box.width,
        height: box.height
      };
    });
    if (!info) break;
    if (stops.length && info.name === "Skip to content") break;
    stops.push(info);
  }
  return stops;
}

async function run() {
  await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  const puts = [];
  page.on("request", function (req) {
    if (req.method() === "PUT" && req.url().indexOf("api.github.com") !== -1) puts.push(req.postData() || "");
  });
  await seed(page);
  await page.goto(DAY_URL, { waitUntil: "networkidle" });

  const heading = page.locator("#period-heading");
  assert(await heading.evaluate(function (el) { return document.activeElement === el; }), "day load should focus the period heading");
  assert((await heading.innerText()).indexOf("October 17, 2026") !== -1, "day heading should name 17 October 2026");
  assert((await page.title()).indexOf("October 17, 2026") !== -1, "document title should name the day");
  assert(await page.locator('nav[aria-label="Review period"] a[aria-current="page"]').innerText() === "Day", "Day tab is current");
  assert(await page.locator('details[data-fold="day:morning"]').evaluate(function (el) { return el.open; }) === true, "Robin fold id day:morning stays open");
  assert(await page.locator('details[data-fold="day:todos"]').evaluate(function (el) { return el.open; }) === false, "a fold that was not opened stays closed");
  assert(await scrollWidth(page) <= 360, "day view scrolls sideways: " + await scrollWidth(page));

  const stops = await tabThrough(page);
  const names = stops.map(function (stop) { return stop.name; });
  const expected = ["Skip to content", "Home", "Switch to dark mode", "Day", "Week", "Month", "Quarter", "Year", "Habits"];
  expected.forEach(function (name, index) {
    assert(names[index] === name, "tab " + index + " expected " + name + " got " + names[index] + " full " + JSON.stringify(names));
  });
  assert(names[9].indexOf("Year") === 0, "breadcrumb starts at the year, got " + names[9]);
  assert(names[10].indexOf("Quarter") === 0, "breadcrumb quarter link, got " + names[10]);
  assert(names[11].indexOf("Month") === 0, "breadcrumb month, got " + names[11]);
  assert(names[12].indexOf("Week") === 0, "breadcrumb week, got " + names[12]);
  assert(names[13].indexOf("Day") === 0, "breadcrumb day, got " + names[13]);
  assert(names[14] === "Previous day", "previous control, got " + names[14]);
  assert(names[15] === "Today", "today control, got " + names[15]);
  assert(names[16] === "Next day", "next control, got " + names[16]);
  assert(names[17].indexOf("Morning") === 0, "first fold follows next, got " + names[17]);
  stops.forEach(function (stop) {
    assert(stop.name.length > 0, "control is missing an accessible name: " + stop.tag);
    assert(stop.outline !== "none" && stop.outlineWidth >= 2, "focus ring missing on " + stop.name + " " + stop.outline + " " + stop.outlineWidth);
    assert(stop.width >= 44 && stop.height >= 44, "tap target under 44px on " + stop.name + " " + Math.round(stop.width) + "x" + Math.round(stop.height));
  });

  const todos = page.locator('details[data-fold="day:todos"]');
  await todos.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert(await todos.evaluate(function (el) { return el.open; }) === true, "Enter opens a fold");
  await page.keyboard.press("Enter");
  assert(await todos.evaluate(function (el) { return el.open; }) === false, "Enter closes a fold");
  await page.keyboard.press("Space");
  assert(await todos.evaluate(function (el) { return el.open; }) === true, "Space opens a fold");
  await page.keyboard.press("Space");
  assert(await todos.evaluate(function (el) { return el.open; }) === false, "Space closes a fold");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: /^Quarter/ }).click();
  await page.waitForFunction(function () {
    return location.hash === "#quarter/2026-Q4" && document.activeElement === document.getElementById("period-heading");
  });
  assert((await heading.innerText()).indexOf("Q4") !== -1, "quarter heading should name Q4");
  assert(await scrollWidth(page) <= 360, "quarter view scrolls sideways");

  await page.goto(HABITS_URL, { waitUntil: "networkidle" });
  assert((await heading.innerText()) === "Habits", "habits route heading");
  assert(await heading.evaluate(function (el) { return document.activeElement === el; }), "habits load should focus the heading");
  assert(await page.locator('#tabs a[href="#habits"]').getAttribute("aria-current") === "page", "Habits tab is current");
  assert(await page.locator("#prev").isHidden(), "habits hides previous");
  assert(await scrollWidth(page) <= 360, "habits view scrolls sideways");
  assert(puts.length === 0, "habits load must not PUT");

  await page.goto(DAY_URL, { waitUntil: "networkidle" });
  await page.evaluate(function () {
    const el = document.getElementById("sync-label");
    window.__syncLog = [el.textContent];
    const obs = new MutationObserver(function () { window.__syncLog.push(el.textContent); });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
  });
  await page.locator('details[data-fold="day:todos"] summary').click();
  const putWait = page.waitForRequest(function (req) { return req.method() === "PUT"; });
  await page.getByRole("checkbox", { name: "Call bank" }).click();
  const queue = await page.evaluate(function () { return JSON.parse(localStorage.getItem("journal-next-ops") || "[]"); });
  assert(queue.length === 1, "tick should queue one operation, got " + JSON.stringify(queue));
  assert(queue[0].type === "todoPatch" && queue[0].key === DAY && queue[0].id === "t1" && queue[0].patch.done === true, "queued op should be the tick: " + JSON.stringify(queue[0]));
  await putWait;
  await page.waitForFunction(function () { return document.getElementById("sync-label").textContent === "Saved"; });
  const log = await page.evaluate(function () { return window.__syncLog; });
  const savingAt = log.indexOf("Saving\u2026");
  const savedAt = log.lastIndexOf("Saved");
  assert(savingAt !== -1 && savedAt !== -1 && savingAt < savedAt, "status should read Saving\u2026 then Saved, got " + JSON.stringify(log));
  assert(puts.length === 1, "expected one PUT, got " + puts.length);
  const body = JSON.parse(puts[0]);
  const saved = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
  const problems = [];
  diffs(saved, fixture, "", problems);
  assert(!problems.length, "PUT dropped or changed stored data:\n" + problems.join("\n"));
  const savedTodo = saved.entries[DAY].todos[0];
  assert(savedTodo.done === true, "tick should be the intended edit");
  assert(savedTodo.mit === true && savedTodo.source === "mirror", "todo fields besides the tick should stay");
  assert(await page.evaluate(function () { return localStorage.getItem("journal-v1"); }) === JSON.stringify({ sentinel: true }), "journal-v1 must stay untouched");

  await page.evaluate(function () {
    document.querySelectorAll("details").forEach(function (el) { el.open = false; });
  });
  await axeSerious(page, "axe with folds closed");
  assert(await scrollWidth(page) <= 360, "closed folds scroll sideways");
  await page.evaluate(function () {
    document.querySelectorAll("details").forEach(function (el) { el.open = true; });
  });
  await axeSerious(page, "axe with folds open");
  assert(await scrollWidth(page) <= 360, "open folds scroll sideways");
  const openStops = await tabThrough(page);
  openStops.forEach(function (stop) {
    assert(stop.name.length > 0, "open fold control missing a name");
    assert(stop.outline !== "none" && stop.outlineWidth >= 2, "open fold focus ring missing on " + stop.name);
    assert(stop.width >= 44 && stop.height >= 44, "open fold tap target under 44px on " + stop.name + " " + Math.round(stop.width) + "x" + Math.round(stop.height));
  });

  await page.evaluate(function () {
    if (window.DongUI) window.DongUI.setTheme("dark");
    document.documentElement.classList.add("dark");
    document.querySelectorAll("details").forEach(function (el) { el.open = false; });
  });
  await axeSerious(page, "axe dark with folds closed");
  await page.evaluate(function () {
    document.querySelectorAll("details").forEach(function (el) { el.open = true; });
  });
  await axeSerious(page, "axe dark with folds open");

  await browser.close();
  if (server) server.kill();
}

run().then(function () {
  console.log("frame.spec: passed");
  process.exit(0);
}, function (err) {
  console.error("frame.spec: failed");
  console.error(err && err.stack ? err.stack : err);
  if (server) server.kill();
  process.exit(1);
});
