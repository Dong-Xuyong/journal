/**
 * Whole app at 360px with the real JournalData, JournalOps and JournalUI.
 * Run from anywhere: node next/tests/integration.spec.mjs
 * Needs: npm i --prefix /tmp/jt playwright @axe-core/playwright
 * Serves /tmp/site on :8000 (/journal -> this repo, /ui/shell.css from the live kit).
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "/tmp/jt/node_modules/playwright/index.mjs";
import AxeBuilder from "/tmp/jt/node_modules/@axe-core/playwright/dist/index.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const BASE = process.env.BASE || "http://127.0.0.1:8000/journal/next/";
const FIXTURE_TEXT = readFileSync(new URL("./fixture.json", import.meta.url), "utf8");
const FIXTURE = JSON.parse(FIXTURE_TEXT);
const DAY = "2026-10-17";
const ROUTES = ["#day/2026-10-17", "#week/2026-W42", "#month/2026-10", "#quarter/2026-Q4", "#year/2026", "#habits", "#habits/thesis"];

let server = null;
let failures = 0;

function check(name, ok, detail) {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail && !ok ? " :: " + detail : ""));
}

async function ensureServer() {
  if (process.env.BASE) return;
  execSync('mkdir -p /tmp/site/ui && ln -sfn "' + REPO + '" /tmp/site/journal');
  try {
    execSync("test -s /tmp/site/ui/shell.css");
  } catch (e) {
    execSync("curl -fsSL -o /tmp/site/ui/shell.css https://dong-xuyong.github.io/ui/shell.css");
  }
  try {
    if ((await fetch(BASE)).status < 400) return;
  } catch (e) {}
  server = spawn("python3", ["-m", "http.server", "8000"], { cwd: "/tmp/site", stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).status < 400) return;
    } catch (e) {}
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  throw new Error("local server did not start");
}

function diffs(actual, expected, path, out) {
  if (expected && typeof expected === "object") {
    if (actual == null || typeof actual !== "object") {
      out.push(path + " missing");
      return;
    }
    Object.keys(expected).forEach(function (key) {
      diffs(actual[key], expected[key], path ? path + "." + key : key, out);
    });
    return;
  }
  if (actual !== expected) out.push(path + " expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
}

async function newPage(browser, opts) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  await context.addInitScript(function (args) {
    if (!localStorage.getItem("journal-next-cache")) localStorage.setItem("journal-next-cache", args.raw);
    if (args.token && !localStorage.getItem("dong-gh-sync")) {
      localStorage.setItem("dong-gh-sync", JSON.stringify({ token: "test-token", repo: "Dong-Xuyong/progress-sync" }));
    }
  }, { raw: FIXTURE_TEXT, token: !!(opts && opts.token) });
  const page = await context.newPage();
  page.errors = [];
  page.puts = [];
  page.on("pageerror", function (e) { page.errors.push("pageerror " + e.message); });
  page.on("console", function (m) {
    if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) page.errors.push("console " + m.text());
  });
  await page.route("https://api.github.com/**", function (route) {
    const req = route.request();
    if (!(opts && opts.token)) {
      page.errors.push("github call without a token " + req.method());
      return route.abort();
    }
    if (req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sha: "abc123", encoding: "base64", content: Buffer.from(FIXTURE_TEXT).toString("base64") })
      });
    }
    if (req.method() === "PUT") {
      page.puts.push(JSON.parse(req.postData() || "{}"));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: { sha: "def456" } }) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  return page;
}

async function go(page, hash) {
  await page.goto(BASE + hash);
  await page.waitForSelector("#view > *");
  await page.waitForTimeout(150);
}

async function axeBad(page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return res.violations.filter(function (v) { return v.impact === "serious" || v.impact === "critical"; }).map(function (v) { return v.id + " " + v.nodes[0].target.join(" "); });
}

async function setFolds(page, open) {
  await page.evaluate(function (value) {
    document.querySelectorAll("#view .fold").forEach(function (el) { el.open = value; });
  }, open);
  await page.waitForTimeout(50);
}

function line(page, id) {
  return page.locator('[data-fold="' + id + '"] > .fold-bar .fold-line').first().textContent();
}

async function routes(browser) {
  const page = await newPage(browser);
  for (const hash of ROUTES) {
    await go(page, hash);
    const info = await page.evaluate(function () {
      return {
        sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        focus: document.activeElement && document.activeElement.id,
        open: document.querySelectorAll("#view .fold.is-open").length,
        folds: document.querySelectorAll("#view .fold").length,
        crumbs: Array.from(document.querySelectorAll("#crumbs a, #crumbs [aria-current]")).map(function (a) { return a.textContent.split(" \u00b7 ")[0]; }).join(">")
      };
    });
    check(hash + " fits 360px", info.sw <= 360, String(info.sw));
    check(hash + " focuses the heading", info.focus === "period-heading", info.focus);
    check(hash + " starts with every fold closed", info.folds > 0 && info.open === 0, info.open + "/" + info.folds);
    const closed = await axeBad(page);
    check(hash + " axe AA, folds closed", !closed.length, closed.join("; "));
    await setFolds(page, true);
    const opened = await axeBad(page);
    check(hash + " axe AA, folds open", !opened.length, opened.join("; "));
    const sw = await page.evaluate(function () { return document.documentElement.scrollWidth; });
    check(hash + " fits 360px with folds open", sw <= 360, String(sw));
    await setFolds(page, false);
    if (hash === "#day/2026-10-17") check("day breadcrumb runs year to day", info.crumbs === "Year>Quarter>Month>Week>Day", info.crumbs);
    if (hash === "#quarter/2026-Q4") check("quarter breadcrumb", info.crumbs === "Year>Quarter", info.crumbs);
    if (hash === "#habits/thesis") check("habit breadcrumb", info.crumbs === "Habits>Thesis", info.crumbs);
  }
  check("no page errors or GitHub calls without a token", !page.errors.length, page.errors.join("; "));
  await page.context().close();
}

async function dayCopy(browser) {
  const page = await newPage(browser);
  await go(page, "#day/" + DAY);
  check("morning summary", (await line(page, "day:morning")) === "Morning \u00b7 focus: Ship \u00b7 3 priorities", await line(page, "day:morning"));
  check("evening summary counts wins, not highlights", (await line(page, "day:evening")) === "Evening \u00b7 mood 4 / energy 4 \u00b7 2 wins", await line(page, "day:evening"));
  check("to-do summary", (await line(page, "day:todos")) === "To-dos \u00b7 1 left", await line(page, "day:todos"));
  check("quote summary", /^Quote \u00b7 \S/.test(await line(page, "day:quote")), await line(page, "day:quote"));
  check("reflection summary", /^Reflection \u00b7 today: Q\d \u00b7 \d+ answered$/.test(await line(page, "day:reflection")), await line(page, "day:reflection"));
  await setFolds(page, true);
  const text = await page.locator("#view").textContent();
  ["If I skip #1", "If this happens", "Grateful", "What would make today great", "A line to repeat", "Wins", "Lesson", "Choice or autopilot", "Tomorrow", "Highlights", "What I would change"].forEach(function (label) {
    check("label: " + label, text.indexOf(label) !== -1);
  });
  ["If-then plan", "Daily affirmation", "Chosen or autopilot", "If the first priority is skipped"].forEach(function (label) {
    check("old label gone: " + label, text.indexOf(label) === -1);
  });
  const f = FIXTURE.entries[DAY].fields;
  [f.failureCost, f.ifThen, f.lesson, f.better, f.chosenVsMomentum, f.highlights].forEach(function (answer) {
    check("answer shown exactly once: " + answer.slice(0, 24), text.split(answer).length === 2);
  });

  await go(page, "#day/2026-10-10");
  check("empty morning", (await line(page, "day:morning")) === "Morning \u00b7 nothing yet", await line(page, "day:morning"));
  check("empty evening", (await line(page, "day:evening")) === "Evening \u00b7 nothing yet", await line(page, "day:evening"));
  check("empty to-dos", (await line(page, "day:todos")) === "To-dos \u00b7 none yet", await line(page, "day:todos"));

  await go(page, "#day/2026-10-14");
  check("mood stored only on days[date] shows", (await line(page, "day:evening")) === "Evening \u00b7 mood 4 / energy 3", await line(page, "day:evening"));
  await page.context().close();
}

async function keyboard(browser) {
  const page = await newPage(browser);
  await go(page, "#day/" + DAY);
  const todos = page.locator('[data-fold="day:todos"]');
  await todos.locator(".fold-summary").first().focus();
  await page.keyboard.press("Enter");
  check("Enter opens a fold", await todos.evaluate(function (el) { return el.open; }));
  await page.keyboard.press(" ");
  check("Space closes a fold", !(await todos.evaluate(function (el) { return el.open; })));
  await page.keyboard.press("Enter");

  await page.locator(".todo textarea").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" now", { delay: 40 });
  await page.waitForTimeout(300);
  const typed = await page.evaluate(function () { return { tag: document.activeElement.tagName, value: document.activeElement.value }; });
  check("typing keeps focus and text", typed.tag === "TEXTAREA" && /draft now$/.test(typed.value), JSON.stringify(typed));

  const box = page.locator(".todo input[type=checkbox]").first();
  await box.focus();
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  const ticked = await page.evaluate(function () { return { type: document.activeElement.type, checked: document.activeElement.checked }; });
  check("Space ticks and focus stays on the checkbox", ticked.type === "checkbox" && ticked.checked, JSON.stringify(ticked));
  check("to-do summary follows the tick", (await line(page, "day:todos")) === "To-dos \u00b7 0 left", await line(page, "day:todos"));

  await page.locator(".add-todo").first().click();
  await page.waitForTimeout(300);
  const added = await page.evaluate(function () { return { tag: document.activeElement.tagName, n: document.querySelectorAll(".todo").length }; });
  check("adding a to-do focuses the new box", added.tag === "TEXTAREA" && added.n === 3, JSON.stringify(added));
  await page.keyboard.type("T".repeat(300));
  await page.waitForTimeout(300);
  const sw = await page.evaluate(function () { return document.documentElement.scrollWidth; });
  check("300-character to-do fits 360px", sw <= 360, String(sw));

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: /^Quarter/ }).click();
  await page.waitForTimeout(300);
  const q = await page.evaluate(function () { return { hash: location.hash, focus: document.activeElement.id }; });
  check("breadcrumb goes to the quarter and focuses its heading", q.hash === "#quarter/2026-Q4" && q.focus === "period-heading", JSON.stringify(q));
  await page.locator('[data-fold="quarter:children"] .fold-summary').first().click();
  await page.locator('[data-fold="quarter:children"] a').first().click();
  await page.waitForTimeout(300);
  check("child link goes down to a month", /^#month\/2026-1[0-2]$/.test(await page.evaluate(function () { return location.hash; })));

  await go(page, "#habits");
  await page.locator("#view .fold-summary").nth(3).click();
  const chip = page.locator("#view button[aria-pressed]:visible").nth(1);
  await chip.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const hf = await page.evaluate(function () { return { hash: location.hash, focus: document.activeElement.getAttribute("aria-pressed") }; });
  check("choosing a habit keeps focus on the control", hf.hash.indexOf("#habits/") === 0 && hf.focus === "true", JSON.stringify(hf));
  check("no page errors while using the keyboard", !page.errors.length, page.errors.join("; "));
  await page.context().close();
}

async function reflections(browser) {
  const page = await newPage(browser);
  await go(page, "#day/" + DAY);
  const outer = page.locator('[data-fold="day:reflection"]');
  await outer.locator(".fold-summary").first().click();
  const all = page.locator('[data-fold="day:reflection-all"]');
  await all.locator(".fold-summary").first().click();
  check("opening an inner fold keeps the outer one open", await outer.evaluate(function (el) { return el.open; }));
  async function save(text) {
    const box = outer.locator("textarea").first();
    await box.fill(text);
    await box.press("Control+Enter");
    await page.waitForTimeout(250);
    return page.evaluate(function () { return document.getElementById("announce").textContent; });
  }
  check("first answer saves", /^Answer saved/.test(await save("Answer A")));
  check("second answer saves", /^Answer saved/.test(await save("Answer B")));
  check("same answer twice is kept once", /already saved/.test(await save("Answer A")));
  const ops = await page.evaluate(function () {
    return (JSON.parse(localStorage.getItem("journal-next-ops") || "{}").ops || []).filter(function (o) { return o.type === "appendAnswer"; }).length;
  });
  check("two appendAnswer ops queued", ops === 2, String(ops));
  const history = await outer.locator(".reflect-today").textContent();
  check("both answers listed", history.indexOf("Answer A") !== -1 && history.indexOf("Answer B") !== -1);

  await go(page, "#year/2026");
  const year = page.locator('[data-fold="year:reflection:2026"]');
  check("year reflection digest exists", (await year.count()) === 1);
  check("year reflection digest is read-only", (await year.locator("textarea").count()) === 0);
  await page.context().close();
}

async function saving(browser) {
  const page = await newPage(browser, { token: true });
  await go(page, "#day/" + DAY);
  await page.locator('[data-fold="day:reflection"] .fold-summary').first().click();
  const box = page.locator('[data-fold="day:reflection"] textarea').first();
  await box.fill("Saved through GitHub");
  await box.press("Control+Enter");
  await page.locator('[data-fold="day:todos"] .fold-summary').first().click();
  await page.locator(".todo input[type=checkbox]").first().click();
  await page.waitForFunction(function () { return document.getElementById("sync-label").textContent === "Saved"; }, null, { timeout: 15000 });
  check("one PUT for both edits", page.puts.length === 1, String(page.puts.length));
  const saved = JSON.parse(Buffer.from(page.puts[0].content, "base64").toString("utf8"));
  const expected = JSON.parse(FIXTURE_TEXT);
  expected.entries[DAY].todos[0].done = true;
  delete expected.entries[DAY].updatedAt;
  const problems = [];
  diffs(saved, expected, "", problems);
  check("saved file keeps every stored field", !problems.length, problems.slice(0, 5).join("; "));
  const before = FIXTURE.reflections.answers || {};
  const after = saved.reflections.answers || {};
  let kept = true;
  Object.keys(before).forEach(function (id) {
    if (JSON.stringify((after[id] || []).slice(0, before[id].length)) !== JSON.stringify(before[id])) kept = false;
  });
  check("older answers kept in order", kept);
  const flat = JSON.stringify(after);
  check("new answer appended", flat.indexOf("Saved through GitHub") !== -1);
  check("PUT sends the sha it read", page.puts[0].sha === "abc123", page.puts[0].sha);
  await page.context().close();
}

async function main() {
  await ensureServer();
  const browser = await chromium.launch();
  try {
    await routes(browser);
    await dayCopy(browser);
    await keyboard(browser);
    await reflections(browser);
    if (!process.env.BASE) await saving(browser);
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  console.log(failures ? "integration.spec: " + failures + " failed" : "integration.spec: passed");
  process.exit(failures ? 1 : 0);
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  if (server) server.kill();
  process.exit(1);
});
