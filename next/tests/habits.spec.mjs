import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("/tmp/jt/package.json");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const shellPath = "/tmp/site/ui/shell.css";
const TODAY = "2026-10-17";

function fixture() {
  const defs = [
    { id: "thesis", label: "Read!", emoji: "\uD83D\uDCDD" },
    { id: "training", label: "Training", emoji: "\uD83D\uDCAA" },
    { id: "food_logged", label: "Food logged", emoji: "\uD83C\uDF7D\uFE0F" },
    { id: "weigh_in", label: "Weigh in", emoji: "\u2696\uFE0F" },
    { id: "speaking", label: "Speaking", emoji: "\uD83D\uDDE3\uFE0F" },
    { id: "sunlight", label: "Sunlight", emoji: "\u2600\uFE0F" },
    {
      id: "protein_breakfast",
      label: "Protein breakfast before the first meeting and again after a long training session outdoors",
      emoji: "\uD83E\uDD5A"
    }
  ];
  const entries = {};
  function dayKey(n) {
    return "2026-10-" + (n < 10 ? "0" : "") + n;
  }
  function habitsFor(n) {
    return {
      thesis: true,
      training: n === 17 ? false : n === 16 ? null : true,
      food_logged: true,
      weigh_in: n % 2 === 0,
      speaking: n % 3 !== 0,
      sunlight: n === 17 ? null : n % 4 === 0 ? false : true,
      protein_breakfast: true
    };
  }
  let n;
  for (n = 1; n <= 17; n++) {
    entries[dayKey(n)] = {
      updatedAt: "2026-10-17T08:00:00.000Z",
      fields: { mood: 4, sleep: "7h", caffeine: "mirror-secret-xyz", top3UpdatedAt: "mirror-secret-xyz" },
      todos: [{ id: "t" + n, text: "Keep this todo", done: false }],
      habits: habitsFor(n),
      habitStreaks: { thesis: n }
    };
  }
  entries["2026-10-01"].habits = {
    thesis: null,
    training: null,
    food_logged: null,
    weigh_in: null,
    speaking: null,
    sunlight: null,
    protein_breakfast: null
  };
  return {
    version: 1,
    habitDefs: defs,
    quotes: { "2026-10-17": { text: "A quote that habits must not rewrite.", updatedAt: "2026-10-17T08:00:00.000Z" } },
    entries: entries,
    days: { "2026-10-17": { mood: 2 } },
    sleep: { "2026-10-17": { hours: 7 } },
    extra: { keep: "mirror-secret-xyz" }
  };
}

function harness(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en" data-theme="light" style="color-scheme: light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Habits</title>
  <link rel="stylesheet" href="/ui/shell.css" />
  <link rel="stylesheet" href="/journal/next/css/base.css" />
  <link rel="stylesheet" href="/journal/next/css/habits.css" />
  <style>
    html, body { margin: 0; background: #f6f4ef; color: #0d0b08; }
    html.dark, html.dark body { background: #141414; color: #efeeec; }
    #main { box-sizing: border-box; padding: 8px; max-width: 100%; }
    #period { margin: 0 0 8px; color: inherit; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
  </style>
</head>
<body class="dx">
  <main id="main">
    <h2 id="period" tabindex="-1">Habits</h2>
    <div id="view"></div>
  </main>
  <div id="announce" class="sr-only" aria-live="polite"></div>
  <script>
    window.__fixture = ${json};
    window.__seal = JSON.stringify(window.__fixture);
    (function freeze(value) {
      if (!value || typeof value !== "object") return;
      Object.freeze(value);
      Object.keys(value).forEach(function (key) { freeze(value[key]); });
    })(window.__fixture);
    window.__puts = 0;
    var origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (opts && String(opts.method || "GET").toUpperCase() === "PUT") window.__puts += 1;
      return origFetch.apply(this, arguments);
    };
  </script>
  <script src="/journal/next/js/data.js"></script>
  <script src="/journal/next/js/ops.js"></script>
  <script src="/journal/next/js/ui.js"></script>
  <script>
    JournalData.load(JSON.parse(window.__seal));
    window.__bootHabits = function () {
      var hash = location.hash.replace(/^#/, "");
      var key = "";
      if (hash.indexOf("habits/") === 0) {
        try { key = decodeURIComponent(hash.slice(7)); } catch (e) { key = ""; }
      }
      JournalViews.habits(document.getElementById("view"), { key: key, today: ${JSON.stringify(TODAY)} });
    };
    window.addEventListener("hashchange", window.__bootHabits);
  </script>
  <script src="/journal/next/js/views/habits.js"></script>
  <script>window.__bootHabits();</script>
</body>
</html>`;
}

function contentType(file) {
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function startServer(pages) {
  const server = http.createServer(function (req, res) {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (pages[url.pathname]) {
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(pages[url.pathname]);
        return;
      }
      let file = null;
      if (url.pathname === "/ui/shell.css") file = shellPath;
      else if (url.pathname.indexOf("/journal/") === 0) {
        file = path.resolve(repo, decodeURIComponent(url.pathname.slice("/journal/".length)));
        if (file !== repo && file.indexOf(repo + path.sep) !== 0) file = null;
      }
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.statusCode = 404;
        res.end("missing");
        return;
      }
      res.setHeader("content-type", contentType(file));
      res.end(fs.readFileSync(file));
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  });
  return new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", function () { resolve(server); });
  });
}

function decodePNG(buf) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    offset += 4;
    const type = buf.toString("ascii", offset, offset + 4);
    offset += 4;
    const data = buf.subarray(offset, offset + len);
    offset += len + 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let i = 0;
  let y;
  for (y = 0; y < height; y++) {
    const filter = raw[i++];
    const row = raw.subarray(i, i + stride);
    i += stride;
    const recon = Buffer.alloc(stride);
    let x;
    for (x = 0; x < stride; x++) {
      const left = x >= bpp ? recon[x - bpp] : 0;
      const up = prev[x];
      const ul = x >= bpp ? prev[x - bpp] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        const p = left + up - ul;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
        value = (value + pred) & 255;
      }
      recon[x] = value;
    }
    prev = recon;
    for (x = 0; x < width; x++) {
      const src = x * bpp;
      const dest = (y * width + x) * 4;
      if (bpp === 4) {
        out[dest] = recon[src];
        out[dest + 1] = recon[src + 1];
        out[dest + 2] = recon[src + 2];
        out[dest + 3] = recon[src + 3];
      } else {
        out[dest] = recon[src];
        out[dest + 1] = recon[src + 1];
        out[dest + 2] = recon[src + 2];
        out[dest + 3] = 255;
      }
    }
  }
  return out;
}

function grayMAD(a, b) {
  const left = decodePNG(a);
  const right = decodePNG(b);
  const pixels = Math.floor(Math.min(left.length, right.length) / 4);
  let sum = 0;
  let i;
  for (i = 0; i < pixels; i++) {
    const ga = 0.2126 * left[i * 4] + 0.7152 * left[i * 4 + 1] + 0.0722 * left[i * 4 + 2];
    const gb = 0.2126 * right[i * 4] + 0.7152 * right[i * 4 + 1] + 0.0722 * right[i * 4 + 2];
    sum += Math.abs(ga - gb);
  }
  return sum / pixels;
}

async function scrollWidth(page) {
  return page.evaluate(function () {
    return {
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    };
  });
}

function assertNoXScroll(box, where) {
  assert.ok(box.scroll <= 360, where + " scrollWidth " + box.scroll);
  assert.ok(box.scroll <= box.client + 1, where + " horizontal scroll " + box.scroll + " > " + box.client);
}

async function axe(page, where) {
  const results = await new AxeBuilder({ page: page }).withTags(["wcag2aa"]).analyze();
  const bad = results.violations.filter(function (item) {
    return item.impact === "serious" || item.impact === "critical";
  });
  assert.deepEqual(bad.map(function (item) {
    const node = item.nodes[0] || {};
    return item.id + ": " + item.help + " (" + item.nodes.length + ") " + (node.target || []).join(" ") + " " + String(node.html || "").slice(0, 180);
  }), [], where);
}

async function openAll(page) {
  await page.evaluate(function () {
    Array.prototype.forEach.call(document.querySelectorAll("#view .fold"), function (el) { el.open = true; });
  });
}

async function assertNoBannedColor(page, where) {
  const hits = await page.evaluate(function () {
    var banned = [
      [159, 18, 57],
      [154, 52, 18]
    ];
    var props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "fill", "stroke", "boxShadow", "caretColor"];
    var found = [];
    function listed(value) {
      var text = String(value || "");
      var i;
      for (i = 0; i < banned.length; i++) {
        var rgb = banned[i][0] + ", " + banned[i][1] + ", " + banned[i][2];
        var tight = banned[i][0] + "," + banned[i][1] + "," + banned[i][2];
        if (text.indexOf(rgb) !== -1 || text.indexOf(tight) !== -1) return rgb;
      }
      return "";
    }
    Array.prototype.forEach.call(document.querySelectorAll("#view, #view *"), function (el) {
      var style = getComputedStyle(el);
      props.forEach(function (prop) {
        var hit = listed(style[prop]);
        if (hit) found.push(prop + " " + hit + " " + (el.className || el.tagName));
      });
    });
    return found.slice(0, 8);
  });
  assert.deepEqual(hits, [], where + " banned colour");
}

function reflectHarness() {
  const data = {
    version: 1,
    habitDefs: [],
    entries: {},
    quotes: {},
    reflections: {
      questions: [
        { id: "q1", text: "Really?!" },
        { id: "q2", text: "Ship it! Then rest" }
      ],
      answers: {
        q1: [{ date: "2026-10-16", text: "Yes!" }]
      }
    }
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en" data-theme="light" style="color-scheme: light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reflections</title>
  <link rel="stylesheet" href="/ui/shell.css" />
  <link rel="stylesheet" href="/journal/next/css/base.css" />
  <link rel="stylesheet" href="/journal/next/css/reflect.css" />
  <style>
    html, body { margin: 0; background: #f6f4ef; color: #0d0b08; }
    html.dark, html.dark body { background: #141414; color: #efeeec; }
    #main { box-sizing: border-box; padding: 8px; max-width: 100%; }
    h2 { margin: 0 0 8px; font-size: 1.25rem; color: inherit; }
  </style>
</head>
<body class="dx">
  <main id="main">
    <h2 id="period" tabindex="-1">Day</h2>
    <div id="view"></div>
  </main>
  <div id="announce" class="sr-only" aria-live="polite"></div>
  <script>localStorage.setItem("journal-next-cache", ${JSON.stringify(json)});</script>
  <script src="/journal/next/js/data.js"></script>
  <script src="/journal/next/js/ops.js"></script>
  <script src="/journal/next/js/ui.js"></script>
  <script src="/journal/next/js/views/reflect.js"></script>
  <script>
    window.__mode = "day";
    window.__show = function (mode) {
      window.__mode = mode;
      var slot = document.getElementById("view");
      if (mode === "year") JournalReflect.mount(slot, { mode: "year", year: "2026" });
      else JournalReflect.mount(slot, { mode: "day", day: "2026-10-17" });
    };
    JournalOps.onChange(function () { window.__show(window.__mode); });
    window.__show("day");
  </script>
</body>
</html>`;
}

async function reflections(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  page.on("pageerror", function (err) { errors.push(String(err)); });
  await page.goto(origin + "/reflect.html", { waitUntil: "networkidle" });
  assert.deepEqual(errors, []);
  const outer = page.locator("[data-fold='day:reflection']");
  await outer.waitFor();
  assert.equal(await outer.locator(".fold-bar").first().locator(".fold-emoji").textContent(), "🪞");
  assert.match(await outer.locator(".fold-line").first().innerText(), /^Reflection · today: Q\d · \d+ answered$/);
  assertNoXScroll(await scrollWidth(page), "reflect closed");
  await axe(page, "reflect axe closed");
  const closedHeight = await outer.evaluate(function (el) { return el.getBoundingClientRect().height; });
  assert.ok(closedHeight <= 48, "reflection fold " + closedHeight);
  await outer.locator(".fold-summary").first().click();
  const box = outer.locator("textarea").first();
  const save = outer.locator(".reflect-save").first();
  assert.equal(await box.getAttribute("rows"), "4");
  const saveBox = await save.boundingBox();
  assert.ok(saveBox && saveBox.height >= 31.5 && saveBox.height <= 36, "save height " + (saveBox && saveBox.height));
  assert.ok(saveBox && saveBox.width >= 31.5, "save width");
  await page.locator("[data-fold='day:reflection-all'] .fold-summary").first().click();
  const innerEmoji = await page.$$eval("#view .fold-summary", function (nodes) {
    return nodes.filter(function (el) {
      var fold = el.closest(".fold");
      return fold && fold.getAttribute("data-fold") !== "day:reflection";
    }).map(function (el) { return el.querySelectorAll(".fold-emoji").length; });
  });
  assert.ok(innerEmoji.length >= 3, "inner folds " + innerEmoji.length);
  innerEmoji.forEach(function (count) { assert.equal(count, 0); });
  const questions = await page.locator(".reflect-question").allTextContents();
  assert.ok(questions.indexOf("Really?") !== -1, questions.join(" | "));
  assert.ok(questions.indexOf("Ship it. Then rest") !== -1, questions.join(" | "));
  questions.forEach(function (text) { assert.equal(text.indexOf("!"), -1, text); });
  assert.ok((await page.locator("[data-own]").allTextContents()).indexOf("Yes!") !== -1);
  await save.click();
  const note = outer.locator(".reflect-note").first();
  assert.equal(await note.textContent(), "Write an answer first.");
  const noteColor = await note.evaluate(function (el) { return getComputedStyle(el).color; });
  assert.equal(/rgba?\(\s*159\s*,\s*18\s*,\s*57|rgba?\(\s*185\s*,\s*28\s*,\s*28|rgba?\(\s*220\s*,\s*38\s*,\s*38/.test(noteColor), false, noteColor);
  await box.fill("Answer A");
  await box.press("Control+Enter");
  await page.waitForTimeout(80);
  await box.fill("Answer B");
  await box.press("Control+Enter");
  await page.waitForTimeout(80);
  let own = await page.locator(".reflect-today [data-own]").allTextContents();
  assert.equal(own.filter(function (text) { return text === "Answer A"; }).length, 1);
  assert.equal(own.filter(function (text) { return text === "Answer B"; }).length, 1);
  await box.fill("Answer A");
  await box.press("Control+Enter");
  await page.waitForTimeout(80);
  assert.match(await page.locator("#announce").innerText(), /already saved/);
  own = await page.locator(".reflect-today [data-own]").allTextContents();
  assert.equal(own.filter(function (text) { return text === "Answer A"; }).length, 1, own.join(" | "));
  assert.equal(own.filter(function (text) { return text === "Answer B"; }).length, 1, own.join(" | "));
  const savedNote = await outer.locator(".reflect-note").first().textContent();
  assert.equal(savedNote, "That answer is already saved.");
  assertNoXScroll(await scrollWidth(page), "reflect open");
  await axe(page, "reflect axe open");
  await page.evaluate(function () { document.documentElement.classList.add("dark"); });
  await page.emulateMedia({ colorScheme: "dark" });
  await axe(page, "reflect axe dark");
  await page.evaluate(function () { window.__show("year"); });
  const year = page.locator("[data-fold='year:reflection:2026']");
  assert.equal(await year.locator(".fold-bar").first().locator(".fold-emoji").textContent(), "🪞");
  assert.equal(await year.locator("textarea").count(), 0);
  assert.ok((await page.locator("[data-own]").allTextContents()).indexOf("Yes!") !== -1);
  const yearInner = await page.$$eval("[data-fold='year:reflection:2026'] .fold .fold-summary", function (nodes) {
    return nodes.map(function (el) { return el.querySelectorAll(".fold-emoji").length; });
  });
  yearInner.forEach(function (count) { assert.equal(count, 0); });
  assert.deepEqual(errors, []);
  await context.close();
  console.log("reflections ok");
}

async function main() {
  assert.ok(fs.existsSync(shellPath), "shell.css missing");
  const data = fixture();
  const html = harness(data);
  const reflectHtml = reflectHarness();
  const server = await startServer({ "/harness.html": html, "/reflect.html": reflectHtml });
  const origin = "http://127.0.0.1:" + server.address().port;
  const puts = [];
  const errors = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    page.on("pageerror", function (err) { errors.push(String(err)); });
    await page.addInitScript(function () {
      localStorage.setItem("journal-v1", "{\"sentinel\":1}");
    });
    await page.route("https://api.github.com/**", function (route) {
      if (route.request().method() === "PUT") puts.push(route.request().postData() || "");
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(origin + "/harness.html#habits", { waitUntil: "networkidle" });
    assert.deepEqual(errors, []);
    await page.locator("[data-fold='habit-today']").waitFor();

    const closed = await page.$$eval("#view .fold", function (nodes) { return nodes.map(function (el) { return el.open; }); });
    assert.ok(closed.length === 5 && closed.every(function (open) { return open === false; }), "folds start closed");
    const todayText = await page.locator("[data-fold='habit-today'] .fold-line").innerText();
    assert.match(todayText, /Today/);
    assert.equal(todayText, "Today · 4 of 7 done");
    assert.equal(await page.locator("[data-fold='habit-effort']").count(), 0, "no Effort fold");
    assert.match(await page.locator("[data-fold='habit-streaks'] .fold-line").innerText(), /Streaks · 4 on a streak/);
    assert.match(await page.locator("[data-fold='habit-year'] .fold-line").innerText(), /Year in days · 17 days logged/);
    assert.match(await page.locator("[data-fold='habit-weeks'] .fold-line").innerText(), /Week by week · \d+% done/);
    assert.match(await page.locator("[data-fold='habit-months'] .fold-line").innerText(), /Month by month · \d+% done/);
    const pictograph = /\p{Extended_Pictographic}/u;
    const lines = await page.$$eval("#view .fold-line", function (nodes) { return nodes.map(function (el) { return el.textContent; }); });
    lines.forEach(function (text) { assert.equal(pictograph.test(text), false, text); });
    const emojiCounts = await page.$$eval("#view .fold-summary", function (nodes) {
      return nodes.map(function (el) { return el.querySelectorAll(".fold-emoji").length; });
    });
    assert.deepEqual(emojiCounts, [1, 1, 1, 1, 1]);
    const todayDots = page.locator("[data-fold='habit-today'] .fold-summary .jn-dots");
    assert.equal(await todayDots.getAttribute("aria-hidden"), "true");
    assert.equal(await todayDots.locator(".jn-dot").count(), 7);
    assert.equal(await todayDots.locator(".jn-dot.on").count(), 4);
    assert.equal(await page.locator("[data-today-habit='thesis'] .today-name").textContent(), "Read.");
    assert.equal((await page.locator("#view").textContent()).indexOf("Read!"), -1);
    assert.match(await page.locator("[data-habit='thesis'] .streak-text").textContent(), /^Read\. · \d+ days? · best \d+ · today /);
    const geometry = await page.evaluate(function () {
      var folds = Array.prototype.slice.call(document.querySelectorAll("#view > .fold"));
      var heights = folds.map(function (el) { return el.getBoundingClientRect().height; });
      var pads = folds.map(function (el) { return parseFloat(getComputedStyle(el).paddingTop); });
      var gaps = [];
      var i;
      var bottom = 0;
      for (i = 1; i < folds.length; i++) gaps.push(folds[i].getBoundingClientRect().top - folds[i - 1].getBoundingClientRect().bottom);
      Array.prototype.forEach.call(document.querySelectorAll("#main > *"), function (el) {
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
      });
      return { heights: heights, pads: pads, gaps: gaps, page: bottom };
    });
    geometry.heights.forEach(function (h) { assert.ok(h <= 48, "closed fold " + h); });
    geometry.pads.forEach(function (pad) { assert.ok(pad <= 12, "padding " + pad); });
    geometry.gaps.forEach(function (gap) { assert.ok(gap <= 10, "gap " + gap); });
    assert.ok(geometry.page <= 520, "closed page " + geometry.page);
    assertNoXScroll(await scrollWidth(page), "closed");
    await axe(page, "axe closed");
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await page.screenshot({ path: "/opt/cursor/artifacts/habits-360-closed-light.png" });
    await page.locator("[data-fold='habit-today'] .fold-summary").click();
    await page.screenshot({ path: "/opt/cursor/artifacts/habits-360-today-open-light.png" });
    await page.locator("[data-fold='habit-today'] .fold-summary").click();
    await page.locator("[data-fold='habit-streaks'] .fold-summary").click();
    await page.screenshot({ path: "/opt/cursor/artifacts/habits-360-streaks-open-light.png" });
    await page.locator("[data-fold='habit-streaks'] .fold-summary").click();

    const summariesLoc = page.locator("#view .fold-summary");
    const summaryCount = await summariesLoc.count();
    let s;
    for (s = 0; s < summaryCount; s++) {
      const summary = summariesLoc.nth(s);
      await summary.focus();
      const before = await summary.evaluate(function (el) { return el.closest(".fold").open; });
      await page.keyboard.press("Enter");
      assert.equal(await summary.evaluate(function (el) { return el.closest(".fold").open; }), !before, "Enter toggles summary " + s);
      await page.keyboard.press("Enter");
      assert.equal(await summary.evaluate(function (el) { return el.closest(".fold").open; }), before, "Enter toggles back " + s);
      await page.keyboard.press("Space");
      assert.equal(await summary.evaluate(function (el) { return el.closest(".fold").open; }), !before, "Space toggles summary " + s);
      await page.keyboard.press("Space");
      assert.equal(await summary.evaluate(function (el) { return el.closest(".fold").open; }), before, "Space toggles back " + s);
    }

    await openAll(page);
    assertNoXScroll(await scrollWidth(page), "open");
    await axe(page, "axe open");
    assert.equal(await page.locator("text=mirror-secret-xyz").count(), 0);
    assert.equal(await page.locator("a[href='https://dong-xuyong.github.io/health/']").count(), 5);
    assert.equal(await page.locator("[data-habit='thesis'] a, [data-habit='speaking'] a").count(), 0);

    const controls = await page.$$eval("button, a[href], summary, [tabindex='0']", function (nodes) {
      return nodes.filter(function (el) {
        if (el.classList && el.classList.contains("trend-stop") && el.getAttribute("tabindex") === "-1") return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return true;
      }).map(function (el, index) {
        el.setAttribute("data-tab-id", String(index));
        const box = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        return { id: String(index), name: name, w: box.width, h: box.height, tag: el.tagName };
      });
    });
    assert.ok(controls.length > 40, "expected many controls, got " + controls.length);
    controls.forEach(function (control) {
      assert.ok(control.name.length > 0, "missing name " + control.tag + " " + control.id);
      assert.ok(control.w >= 23.5 && control.h >= 23.5, "24px floor " + control.w.toFixed(1) + "x" + control.h.toFixed(1) + " " + control.name.slice(0, 60));
      if (control.tag === "BUTTON" || control.tag === "A" || control.tag === "SUMMARY" || control.tag === "INPUT" || control.tag === "TEXTAREA") {
        assert.ok(control.w >= 31.5 && control.h >= 31.5, "32px target " + control.w.toFixed(1) + "x" + control.h.toFixed(1) + " " + control.name.slice(0, 60));
      }
    });

    await page.locator("#period").focus();
    const seen = new Set();
    let guard;
    for (guard = 0; guard < controls.length + 5; guard++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(function () {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return null;
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return {
          id: el.getAttribute("data-tab-id"),
          outline: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth) || 0,
          shadow: style.boxShadow,
          w: box.width,
          h: box.height,
          name: (el.getAttribute("aria-label") || el.innerText || "").trim()
        };
      });
      if (!info || !info.id) continue;
      if (seen.has(info.id)) break;
      seen.add(info.id);
      const ring = info.outline !== "none" && info.outlineWidth >= 1;
      assert.ok(ring || (info.shadow && info.shadow !== "none"), "focus ring " + info.name.slice(0, 40));
      assert.ok(info.name.length > 0, "focused control has a name");
    }
    assert.ok(seen.size >= controls.length - 2, "Tab reached " + seen.size + " of " + controls.length);
    console.log("controls " + controls.length + ", tabbed " + seen.size);

    const weekStops = page.locator("[data-span='week'] .trend-stop");
    assert.equal(await weekStops.evaluateAll(function (nodes) {
      return nodes.filter(function (el) { return el.getAttribute("tabindex") === "0"; }).length;
    }), 1);
    const currentLabel = await page.locator("[data-span='week'] .trend-stop[tabindex='0']").getAttribute("aria-label");
    await page.locator("[data-span='week'] .trend-stop[tabindex='0']").focus();
    await page.keyboard.press("ArrowLeft");
    const movedLabel = await page.evaluate(function () { return document.activeElement.getAttribute("aria-label"); });
    assert.notEqual(movedLabel, currentLabel);
    await page.waitForTimeout(80);
    assert.ok(movedLabel.indexOf(await page.locator("#announce").innerText()) !== -1, "announcement is part of " + movedLabel);
    assert.equal(await page.locator("[data-span='week'] .trend-stop[tabindex='0']").count(), 1);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(80);
    assert.ok(movedLabel.indexOf(await page.locator("#announce").innerText()) !== -1, "announcement is part of " + movedLabel);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(function () { return document.activeElement.classList.contains("trend-stop"); }), false);

    const cell = page.locator("[data-fold='habit-year'] button.hcell").first();
    await cell.focus();
    const startCol = await cell.getAttribute("data-col");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(function () { return document.activeElement.getAttribute("data-col"); }), String(Number(startCol) + 1));
    await page.keyboard.press("Enter");
    assert.ok((await page.locator(".heat-detail").innerText()).length > 8);

    const plain = await page.locator("#view").innerText();
    assert.doesNotMatch(plain, /\bXP\b|\blevel \d|win day|surprise|linchpin|milestone|21-day|automaticity/i, "no gamification left");
    assert.equal(await page.locator("#view .info-btn, #view .badge, #view .nudge, #view .day-ring").count(), 0);
    assert.equal(await page.locator("[data-today-habit]").count(), 7);
    assert.equal(await page.evaluate(function () { return typeof window.JournalGamify; }), "undefined");

    await page.locator("[data-habit='thesis'] .habit-open").click();
    assert.equal(new URL(page.url()).hash, "#habits/thesis");
    assert.equal(await page.locator("[data-habit='thesis'] .habit-open").getAttribute("aria-pressed"), "true");
    await openAll(page);
    await page.locator("[data-habit='thesis'] .habit-open").click();
    assert.equal(new URL(page.url()).hash, "#habits");

    await page.goto(origin + "/harness.html#habits/training", { waitUntil: "networkidle" });
    await openAll(page);
    assert.equal(await page.locator("[data-select='training']").first().getAttribute("aria-pressed"), "true");
    assert.match(await page.locator("[data-fold='habit-year'] .fold-line").innerText(), /Training/);
    const miss = page.locator("button.hcell.miss").first();
    const unknown = page.locator("button.hcell.unknown").first();
    assert.equal(await miss.getAttribute("data-status"), "miss");
    assert.equal(await unknown.getAttribute("data-status"), "unknown");
    await page.evaluate(function () { document.documentElement.style.filter = "grayscale(1)"; });
    const missShot = await miss.screenshot();
    const unknownShot = await unknown.screenshot();
    const mad = grayMAD(missShot, unknownShot);
    assert.ok(mad > 12, "missed and unknown differ in grayscale, mad " + mad.toFixed(2));
    await page.evaluate(function () { document.documentElement.style.filter = ""; });

    await page.evaluate(function () {
      document.querySelectorAll("a[href*='health']").forEach(function (link) {
        link.addEventListener("click", function (event) { event.preventDefault(); });
      });
      Array.prototype.forEach.call(document.querySelectorAll("#view .fold-summary, #view button, #view a[href]"), function (el) {
        el.click();
      });
    });
    assert.equal(puts.length, 0, "GitHub PUTs " + puts.length);
    assert.equal(await page.evaluate(function () { return window.__puts; }), 0);
    assert.equal(await page.evaluate(function () { return localStorage.getItem("journal-v1"); }), "{\"sentinel\":1}");
    assert.equal(await page.evaluate(function () { return localStorage.getItem("journal-next-ops"); }), null);
    assert.equal(await page.evaluate(function () { return JSON.stringify(window.__fixture) === window.__seal; }), true);
    assertNoXScroll(await scrollWidth(page), "after click-through");

    await page.evaluate(function () {
      localStorage.setItem("journal-folds", JSON.stringify({ "habit-today": true }));
    });
    await page.goto(origin + "/harness.html#habits/sunlight", { waitUntil: "networkidle" });
    assert.equal(await page.locator("[data-fold='habit-today']").evaluate(function (el) { return el.open; }), true);
    assert.equal(await page.locator("[data-habit='sunlight'] button").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("[data-habit='sunlight'] a").getAttribute("href"), "https://dong-xuyong.github.io/health/");
    const othersClosed = await page.$$eval("#view .fold:not([data-fold='habit-today'])", function (nodes) {
      return nodes.every(function (el) { return !el.open; });
    });
    assert.equal(othersClosed, true);
    await page.locator("[data-fold='habit-streaks'] .fold-summary").click();
    await page.waitForTimeout(20);
    const parsed = await page.evaluate(function () { return JSON.parse(localStorage.getItem("journal-folds") || "{}"); });
    assert.equal(parsed["habit-streaks"], true);
    assert.equal(parsed["habit-today"], true);
    assert.equal(puts.length, 0);
    assert.deepEqual(errors, []);
    await openAll(page);
    const rowEmoji = await page.$$eval("[data-today-habit], .streak-row", function (nodes) {
      return nodes.map(function (el) { return el.querySelectorAll(".habit-emoji").length; });
    });
    rowEmoji.forEach(function (count) { assert.equal(count, 1); });
    await assertNoBannedColor(page, "light");
    const bigType = await page.evaluate(function () {
      var bad = [];
      Array.prototype.forEach.call(document.querySelectorAll("#view *"), function (el) {
        var size = parseFloat(getComputedStyle(el).fontSize);
        if (size > 20.5) bad.push((el.className || el.tagName) + " " + size);
      });
      return bad;
    });
    assert.deepEqual(bigType, []);
    assert.equal(await page.locator("#view [class*='ring']").count(), 0);
    const stopSize = await page.$$eval(".trend-stop", function (nodes) {
      return nodes.filter(function (el) {
        var box = el.getBoundingClientRect();
        return box.width < 31.5 || box.height < 31.5;
      }).length;
    });
    assert.equal(stopSize, 0, "trend stops are 32px");
    await page.evaluate(function () { document.documentElement.classList.add("dark"); });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    assertNoXScroll(await scrollWidth(page), "dark open");
    await assertNoBannedColor(page, "dark");
    await axe(page, "axe dark open");
    await page.evaluate(function () {
      Array.prototype.forEach.call(document.querySelectorAll("#view .fold"), function (el) { el.open = false; });
    });
    await axe(page, "axe dark closed");
    console.log("habits ok");
    await reflections(browser, origin);
  } finally {
    if (browser) await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
