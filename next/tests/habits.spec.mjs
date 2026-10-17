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
    { id: "thesis", label: "Thesis", emoji: "\uD83D\uDCDD" },
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
    html, body { margin: 0; background: #f6f4ef; }
    #main { box-sizing: border-box; padding: 8px; max-width: 100%; }
    #period { margin: 0 0 8px; }
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

function startServer(html) {
  const server = http.createServer(function (req, res) {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/harness.html") {
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(html);
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
    return item.id + ": " + item.help + " (" + item.nodes.length + ")";
  }), [], where);
}

async function openAll(page) {
  await page.evaluate(function () {
    Array.prototype.forEach.call(document.querySelectorAll("#view .fold"), function (el) { el.open = true; });
  });
}

async function main() {
  assert.ok(fs.existsSync(shellPath), "shell.css missing");
  const data = fixture();
  const html = harness(data);
  const server = await startServer(html);
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
    const todayText = await page.locator("[data-fold='habit-today'] .fold-summary").innerText();
    assert.match(todayText, /Today/);
    assert.match(todayText, /^Today · 4 of 7 done$/);
    assert.equal(await page.locator("[data-fold='habit-effort']").count(), 0, "no Effort fold");
    assert.match(await page.locator("[data-fold='habit-streaks'] .fold-summary").innerText(), /Streaks · 4 on a streak/);
    assert.match(await page.locator("[data-fold='habit-year'] .fold-summary").innerText(), /Year in days · 17 days logged/);
    assert.match(await page.locator("[data-fold='habit-weeks'] .fold-summary").innerText(), /Week by week · \d+% done/);
    assert.match(await page.locator("[data-fold='habit-months'] .fold-summary").innerText(), /Month by month · \d+% done/);
    const pictograph = /\p{Extended_Pictographic}/u;
    const summaries = await page.$$eval("#view .fold-summary", function (nodes) { return nodes.map(function (el) { return el.innerText; }); });
    summaries.forEach(function (text) { assert.equal(pictograph.test(text), false, text); });
    assertNoXScroll(await scrollWidth(page), "closed");
    await axe(page, "axe closed");

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
      assert.ok(control.w >= 43.5 && control.h >= 43.5, "tap target " + control.w.toFixed(1) + "x" + control.h.toFixed(1) + " " + control.name.slice(0, 60));
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
    assert.match(await page.locator("[data-fold='habit-year'] .fold-summary").innerText(), /Training/);
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
    console.log("habits ok");
  } finally {
    if (browser) await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
