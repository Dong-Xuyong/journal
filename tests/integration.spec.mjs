/**
 * Whole app at 360px with the real JournalData, JournalSync and JournalUI.
 * The app is read-only: it must never show an edit control or send a write.
 * Run from anywhere: node tests/integration.spec.mjs (BASE=<url> to test a deployed copy)
 * Needs: npm i --prefix /tmp/jt playwright @axe-core/playwright
 * Serves /tmp/site on :8000 (/journal -> this repo, /ui/shell.css from the live kit).
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "/tmp/jt/node_modules/playwright/index.mjs";
import AxeBuilder from "/tmp/jt/node_modules/@axe-core/playwright/dist/index.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const BASE = process.env.BASE || "http://127.0.0.1:8000/journal/";
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
  execSync('mkdir -p /tmp/site/ui /tmp/site/assets/art && ln -sfn "' + REPO + '" /tmp/site/journal');
  try {
    execSync("test -s /tmp/site/ui/shell.css");
  } catch (e) {
    execSync("curl -fsSL -o /tmp/site/ui/shell.css https://dong-xuyong.github.io/ui/shell.css");
  }
  try {
    execSync("test -s /tmp/site/assets/art/bg.webp");
  } catch (e) {
    execSync("curl -fsSL -o /tmp/site/assets/art/bg.webp https://dong-xuyong.github.io/assets/art/bg.webp");
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
  page.writes = [];
  page.on("request", function (req) {
    if (req.method() !== "GET" && req.method() !== "HEAD") page.writes.push(req.method() + " " + req.url());
  });
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
        controls: document.querySelectorAll("#main input, #main textarea, #main select, #main [contenteditable], #main [role=checkbox], #main [role=textbox]").length,
        crumbs: Array.from(document.querySelectorAll("#crumbs a")).map(function (a) { return a.textContent.replace(/\s+/g, " ").trim(); }).join(">")
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
    const openControls = await page.evaluate(function () {
      const buttons = Array.from(document.querySelectorAll("#main button")).map(function (b) { return b.textContent.trim(); });
      return {
        n: document.querySelectorAll("#main input, #main textarea, #main select, #main [contenteditable], #main [role=checkbox], #main [role=textbox]").length,
        edit: buttons.filter(function (t) { return /^(save|edit|add|delete|undo|remove)\b/i.test(t); })
      };
    });
    check(hash + " is read-only", info.controls === 0 && openControls.n === 0 && !openControls.edit.length, JSON.stringify(openControls));
    if (hash.indexOf("#habits") !== 0) {
      const apps = await page.evaluate(function () { return document.querySelectorAll('#view a[href*="dong-xuyong.github.io"], #view a[href^="../"], #view a[href^="/"]').length; });
      check(hash + " has no other-app links", apps === 0, String(apps));
    }
    await setFolds(page, false);
    if (hash === "#day/2026-10-17") check("day breadcrumb runs year to day", info.crumbs === "2026>Q4>Oct>W42>Sat 17", info.crumbs);
    if (hash === "#quarter/2026-Q4") check("quarter breadcrumb", info.crumbs === "2026>Q4", info.crumbs);
    if (hash === "#habits/thesis") check("habit breadcrumb", info.crumbs === "Habits>Thesis", info.crumbs);
    if (hash === "#habits") {
      const plain = await page.locator("#view").innerText();
      check("habits has no XP, levels, win days or surprises", !/\bXP\b|\blevel \d|win day|surprise|linchpin/i.test(plain));
      check("habits has five folds", info.folds === 5, String(info.folds));
    }
  }
  check("JournalGamify is gone", (await page.evaluate(function () { return typeof window.JournalGamify; })) === "undefined");
  check("no page errors or GitHub calls without a token", !page.errors.length, page.errors.join("; "));
  await page.context().close();
}

async function dayCopy(browser) {
  const page = await newPage(browser);
  await go(page, "#day/" + DAY);
  check("morning summary", /^Morning \u00b7 focus: Ship it[.!] \u00b7 3 priorities$/.test(await line(page, "day:morning")), await line(page, "day:morning"));
  check("evening summary counts wins, not highlights", (await line(page, "day:evening")) === "Evening \u00b7 mood 4 / energy 4 \u00b7 2 wins", await line(page, "day:evening"));
  check("to-do summary", (await line(page, "day:todos")) === "To-dos \u00b7 1 left", await line(page, "day:todos"));
  check("quote summary", /^Quote \u00b7 \S/.test(await line(page, "day:quote")), await line(page, "day:quote"));
  const reflect = await page.evaluate(function () {
    const card = document.querySelector('#view [data-reflect="day"]');
    return card ? { fold: !!card.closest("details"), visible: card.getBoundingClientRect().height > 60, title: card.querySelector(".jn-card-title").textContent, q: card.querySelector(".reflect-question").textContent } : null;
  });
  check("reflection shows on the day view without opening anything", !!reflect && !reflect.fold && reflect.visible && reflect.title.indexOf("Reflection") !== -1 && reflect.q.length > 10, JSON.stringify(reflect));
  await setFolds(page, true);
  const text = await page.locator("#view").textContent();
  ["If I skip #1", "If this happens", "Grateful", "What would make today great", "A line to repeat", "Wins", "Lesson", "Choice or autopilot", "Tomorrow", "Highlights", "What I would change"].forEach(function (label) {
    check("label: " + label, text.indexOf(label) !== -1);
  });
  ["If-then plan", "Daily affirmation", "Chosen or autopilot", "If the first priority is skipped"].forEach(function (label) {
    check("old label gone: " + label, text.indexOf(label) === -1);
  });
  await page.locator('[data-field="failureCost"] .info-btn').click();
  const tip = await page.evaluate(function () {
    const field = document.querySelector('[data-field="failureCost"]');
    return {
      label: field.querySelector(".day-label").getBoundingClientRect().width,
      tip: field.querySelector(".info-tip").getBoundingClientRect().width,
      sw: document.documentElement.scrollWidth,
      text: field.querySelector(".info-text").textContent
    };
  });
  check("tip text comes from cites.js", tip.text === "Seeing what you lose if you skip it makes you more likely to do it.", tip.text);
  check("open tip sits under the label at full width", tip.label > 150 && tip.tip > 250 && tip.sw <= 360, JSON.stringify(tip));
  const tipAxe = await axeBad(page);
  check("axe AA with a tip open", !tipAxe.length, tipAxe.join("; "));
  await page.keyboard.press("Escape");
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

  const todoText = await page.locator('[data-fold="day:todos"] [data-own="todo"]').allTextContents();
  check("to-dos show as stored", JSON.stringify(todoText.slice(0, 3)) === JSON.stringify(FIXTURE.entries[DAY].todos.map(function (t) { return t.text; })), JSON.stringify(todoText));
  const marks = await page.locator('[data-fold="day:todos"] .todo .sr-only').allTextContents();
  check("done state is read out", marks.slice(0, 3).join("|") === "Open: |Done: |Done: ", marks.join("|"));

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
  await go(page, "#day/2026-10-15");
  const card = page.locator('#view [data-reflect="day"]');
  const qid = await card.getAttribute("data-question-id");
  const stored = (FIXTURE.reflections.answers[qid] || []).map(function (a) { return a.text; });
  const shown = await card.locator('.reflect-answer').allTextContents();
  check("day reflection answers show verbatim", JSON.stringify(shown) === JSON.stringify(stored.slice().reverse()) && (stored.length || /No answer yet/.test(await card.textContent())), qid + " " + JSON.stringify(shown));
  await go(page, "#day/" + DAY);
  const today = await page.locator('#view [data-reflect="day"]').getAttribute("data-question-id");
  check("day reflection picks a question", /^q\d$/.test(today || ""), today);

  await go(page, "#year/2026");
  const year = page.locator('#view [data-reflect="year"]');
  check("year reflection digest is on the year view", (await year.count()) === 1 && !(await year.evaluate(function (el) { return !!el.closest("details"); })));
  const digest = await year.locator(".reflect-answer").allTextContents();
  check("year digest shows Dong's answers verbatim", ["Write a book on Portuguese law for engineers.", "That he was kind and kept his word.", "Yes!"].every(function (t) { return digest.indexOf(t) !== -1; }), JSON.stringify(digest));
  await page.context().close();
}

async function readOnly(browser) {
  const page = await newPage(browser, { token: true });
  for (const hash of ROUTES) {
    await go(page, hash);
    await setFolds(page, true);
  }
  await go(page, "#day/" + DAY);
  await page.waitForFunction(function () { return document.getElementById("sync-label").textContent === "Synced"; }, null, { timeout: 15000 });
  check("sync reads the file", true);
  check("no write requests at all", !page.writes.length, page.writes.join("; "));
  const cached = await page.evaluate(function () { return localStorage.getItem("journal-next-cache"); });
  const problems = [];
  diffs(JSON.parse(cached), FIXTURE, "", problems);
  check("cached copy keeps every stored field", !problems.length, problems.slice(0, 5).join("; "));
  check("no ops queue is created", (await page.evaluate(function () { return localStorage.getItem("journal-next-ops"); })) === null);
  check("no page errors while syncing", !page.errors.length, page.errors.join("; "));
  await page.context().close();
}

async function links(browser) {
  const page = await newPage(browser);
  async function landed(url) {
    await page.goto(url);
    await page.waitForSelector("#view > *");
    await page.waitForTimeout(150);
    return page.evaluate(function () {
      return { path: location.pathname, hash: location.hash, heading: document.getElementById("period-heading").textContent };
    });
  }
  const root = new URL(BASE).pathname;
  let at = await landed(BASE + "#day/2026-10-17");
  check("hub link /journal/#day/<date> opens that day", at.hash === "#day/2026-10-17" && /October 17, 2026/.test(at.heading), JSON.stringify(at));
  at = await landed(BASE + "#habits");
  check("hub link /journal/#habits opens Habits", at.hash === "#habits" && at.heading === "Habits", JSON.stringify(at));
  at = await landed(BASE + "#habits/all");
  check("old #habits/all still opens Habits", at.heading === "Habits", JSON.stringify(at));
  at = await landed(BASE);
  check("bare /journal/ opens today", /^#day\/\d{4}-\d{2}-\d{2}$/.test(at.hash), JSON.stringify(at));
  for (const hash of ["#week/2026-W42", "#month/2026-10", "#quarter/2026-Q4", "#year/2026"]) {
    at = await landed(BASE + hash);
    check("route " + hash + " opens", at.hash === hash, JSON.stringify(at));
  }
  if (process.env.REDIRECT !== "0") {
    at = await landed(BASE + "next/#week/2026-W42");
    check("/journal/next/ redirects to /journal/ and keeps the hash", at.path === root && at.hash === "#week/2026-W42", JSON.stringify(at));
  }
  check("no page errors on old links", !page.errors.length, page.errors.join("; "));
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
    await links(browser);
    if (!process.env.BASE) await readOnly(browser);
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
