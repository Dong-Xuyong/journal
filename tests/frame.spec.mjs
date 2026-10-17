import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
import { chromium } from "/tmp/jt/node_modules/playwright/index.mjs";
import AxeBuilder from "/tmp/jt/node_modules/@axe-core/playwright/dist/index.mjs";

const DAY = "2026-10-17";
const BASE = "http://127.0.0.1:8000/journal/";
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
      const by = (el.getAttribute("aria-labelledby") || "").split(/\s+/).map(function (id) { const n = id && document.getElementById(id); return n ? n.textContent : ""; }).join(" ");
      const label = el.labels && el.labels.length ? el.labels[0].textContent : "";
      const clone = el.cloneNode(true);
      clone.querySelectorAll("[aria-hidden='true']").forEach(function (node) { node.remove(); });
      const visible = (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
      const name = (el.getAttribute("aria-label") || by.trim() || label || visible).replace(/\s+/g, " ").trim();
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        name: name,
        tag: el.tagName,
        outline: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        outlineColor: style.outlineColor,
        width: box.width,
        height: box.height,
        type: (el.getAttribute("type") || "").toLowerCase(),
        fold: !!(el.classList && el.classList.contains("fold-summary")),
        control: el.matches("button, select, textarea, input:not([type=checkbox]):not([type=radio]), a.dx-btn, [role=button], #tabs a")
      };
    });
    if (!info) break;
    if (stops.length && info.name === "Skip to content") break;
    stops.push(info);
  }
  return stops;
}

// Nutrition-style targets: fold rows and frame buttons 44px, small buttons 32px, anything else 24px.
const TAP = { row: 44, control: 32, floor: 24 };

function checkTap(stop, where) {
  const floor = stop.fold || stop.control ? TAP.control : TAP.floor;
  assert(stop.width >= floor - 0.5 && stop.height >= floor - 0.5, where + " tap target under " + floor + "px on " + stop.name + " " + Math.round(stop.width) + "x" + Math.round(stop.height));
  if (stop.fold) assert(stop.height >= TAP.row - 0.5, where + " fold row under " + TAP.row + "px on " + stop.name + " " + Math.round(stop.height));
}

async function run() {
  await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  const writes = [];
  page.on("request", function (req) {
    if (req.method() !== "GET") writes.push(req.method() + " " + req.url());
  });
  await seed(page);
  await page.goto(DAY_URL, { waitUntil: "networkidle" });

  const heading = page.locator("#period-heading");
  assert(await heading.evaluate(function (el) { return document.activeElement === el; }), "day load should focus the period heading");
  assert((await heading.innerText()).indexOf("October 17, 2026") !== -1, "day heading should name 17 October 2026");
  assert((await page.title()).indexOf("October 17, 2026") !== -1, "document title should name the day");
  assert(await page.locator('nav[aria-label="Review period"] a[aria-current="page"]').innerText() === "Day", "Day tab is current");
  assert(await page.locator('[data-fold="day:morning"]').evaluate(function (el) { return el.open; }) === true, "Robin fold id day:morning stays open");
  assert(await page.locator('[data-fold="day:todos"]').evaluate(function (el) { return el.open; }) === false, "a fold that was not opened stays closed");
  assert(await scrollWidth(page) <= 360, "day view scrolls sideways: " + await scrollWidth(page));

  const frameBox = await page.evaluate(function () {
    function box(el) {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    }
    const tabBar = document.getElementById("tabs");
    const links = Array.prototype.map.call(tabBar.querySelectorAll("a"), function (el) {
      const r = box(el);
      r.text = el.textContent.replace(/\s+/g, " ").trim();
      return r;
    });
    const crumbLinks = Array.prototype.map.call(document.querySelectorAll("#crumbs a"), function (el) {
      const r = box(el);
      r.text = el.textContent.replace(/\s+/g, " ").trim();
      r.label = el.getAttribute("aria-label") || "";
      return r;
    });
    const period = document.getElementById("hero");
    const header = document.querySelector("header.dx-header");
    const sections = Array.prototype.map.call(document.querySelectorAll("#sections a"), function (el) {
      const r = box(el);
      r.text = el.textContent.replace(/\s+/g, " ").trim();
      r.current = el.getAttribute("aria-current") || "";
      return r;
    });
    const buttons = Array.prototype.map.call(period.querySelectorAll("button"), box);
    const heading = box(document.getElementById("period-heading"));
    const tabStyle = getComputedStyle(tabBar.querySelector("a"));
    const crumbStyle = getComputedStyle(document.querySelector("#crumbs a"));
    return {
      tabs: box(tabBar),
      tabsInHeader: header.contains(tabBar),
      header: box(header),
      sections: sections,
      links: links,
      crumbs: crumbLinks,
      period: box(period),
      heading: heading,
      buttons: buttons,
      tabDecoration: tabStyle.textDecorationLine,
      crumbDecoration: crumbStyle.textDecorationLine,
      sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    };
  });
  assert(frameBox.tabsInHeader, "period tabs sit in the top bar, like nutrition");
  assert(frameBox.tabs.top < 120, "period tabs are at the top: " + frameBox.tabs.top);
  assert(frameBox.tabs.right <= 360, "tab bar overflows the page: " + frameBox.tabs.right);
  assert(frameBox.links.map(function (link) { return link.text; }).join(",") === "Day,Week,Month,Quarter,Year", "period tabs " + JSON.stringify(frameBox.links));
  assert(frameBox.links.every(function (link) { return Math.abs(link.top - frameBox.links[0].top) < 1; }), "tabs wrap onto a second row");
  assert(frameBox.links.every(function (link) { return link.height >= 44 && link.height <= 48; }), "a tab is the wrong height " + JSON.stringify(frameBox.links));
  assert(frameBox.sections.map(function (link) { return link.text + ":" + link.current; }).join(",") === "Journal:page,Habits:", "section nav " + JSON.stringify(frameBox.sections));
  assert(frameBox.tabDecoration === "none" && frameBox.crumbDecoration === "none", "tabs or breadcrumbs are underlined");
  assert(frameBox.crumbs.map(function (link) { return link.text; }).join(">") === "2026>Q4>Oct>W42>Sat 17", "breadcrumb labels " + frameBox.crumbs.map(function (link) { return link.text; }).join(">"));
  assert(frameBox.crumbs.every(function (link) { return Math.abs(link.top - frameBox.crumbs[0].top) < 1; }), "breadcrumb wraps");
  assert(frameBox.crumbs.every(function (link) { return link.label.indexOf(link.text) !== -1 && link.right <= 360; }), "breadcrumb name or overflow " + JSON.stringify(frameBox.crumbs));
  assert(frameBox.period.height <= 140, "date card is too tall: " + frameBox.period.height);
  assert(frameBox.buttons.length === 3 && frameBox.buttons.every(function (button) { return button.height >= 44 && button.height <= 46 && Math.abs(button.top - frameBox.buttons[0].top) < 1; }), "period buttons should be one 44px row " + JSON.stringify(frameBox.buttons));
  assert(frameBox.heading.bottom <= frameBox.buttons[0].top + 1, "date heading sits above the buttons");
  assert(frameBox.sw <= 360, "frame scrolls sideways");

  const stops = await tabThrough(page);
  const names = stops.map(function (stop) { return stop.name; });
  const expected = ["Skip to content", "Home", "Switch to dark mode", "Day", "Week", "Month", "Quarter", "Year", "Journal", "Habits"];
  expected.forEach(function (name, index) {
    assert(names[index] === name, "tab " + index + " expected " + name + " got " + names[index] + " full " + JSON.stringify(names));
  });
  assert(names[10].indexOf("Year") === 0, "breadcrumb starts at the year, got " + names[10]);
  assert(names[11].indexOf("Quarter") === 0, "breadcrumb quarter link, got " + names[11]);
  assert(names[12].indexOf("Month") === 0, "breadcrumb month, got " + names[12]);
  assert(names[13].indexOf("Week") === 0, "breadcrumb week, got " + names[13]);
  assert(names[14].indexOf("Day") === 0, "breadcrumb day, got " + names[14]);
  assert(names[15] === "Previous day", "previous control, got " + names[15]);
  assert(names[16] === "Next day", "next control (Today is disabled on today), got " + names[16]);
  assert(names[17].indexOf("Morning") === 0, "morning fold follows next, got " + names[17]);
  assert(await page.locator("#today").isDisabled(), "Today is disabled while on today");
  stops.forEach(function (stop) {
    assert(stop.name.length > 0, "control is missing an accessible name: " + stop.tag);
    assert(stop.outline !== "none" && stop.outlineWidth >= 2, "focus ring missing on " + stop.name + " " + stop.outline + " " + stop.outlineWidth);
    checkTap(stop, "closed");
  });

  const todos = page.locator('[data-fold="day:todos"]');
  await todos.locator(".fold-summary").focus();
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
  assert(await page.locator('#sections a[href="#habits"]').getAttribute("aria-current") === "page", "Habits section is current");
  assert(await page.locator("#prev").isHidden(), "habits hides previous");
  assert(await scrollWidth(page) <= 360, "habits view scrolls sideways");
  assert(writes.length === 0, "habits load must not write: " + writes.join(", "));

  await page.goto(DAY_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(function () { return document.getElementById("sync-label").textContent === "Synced"; });
  await page.locator('[data-fold="day:todos"] .fold-summary').click();
  const readOnly = await page.evaluate(function () {
    const todo = document.querySelector('[data-todo] [data-own="todo"]');
    return {
      controls: document.querySelectorAll("#main input, #main textarea, #main select, #main [contenteditable], #main [role=checkbox]").length,
      todo: todo ? todo.textContent : null,
      reflection: !!document.querySelector('#view [data-reflect="day"] .reflect-question')
    };
  });
  assert(readOnly.controls === 0, "the day view has edit controls: " + readOnly.controls);
  assert(readOnly.todo === "Call bank", "to-do shows as stored, got " + readOnly.todo);
  assert(readOnly.reflection, "the reflection shows on the day view");
  const cached = await page.evaluate(function () { return JSON.parse(localStorage.getItem("journal-next-cache")); });
  const problems = [];
  diffs(cached, fixture, "", problems);
  assert(!problems.length, "sync changed stored data:\n" + problems.join("\n"));
  assert(await page.evaluate(function () { return localStorage.getItem("journal-v1"); }) === JSON.stringify({ sentinel: true }), "journal-v1 must stay untouched");
  assert(writes.length === 0, "the app must not write: " + writes.join(", "));

  await page.evaluate(function () {
    document.querySelectorAll(".fold").forEach(function (el) { el.open = false; });
  });
  await axeSerious(page, "axe with folds closed");
  assert(await scrollWidth(page) <= 360, "closed folds scroll sideways");
  await page.evaluate(function () {
    document.querySelectorAll(".fold").forEach(function (el) { el.open = true; });
  });
  await axeSerious(page, "axe with folds open");
  assert(await scrollWidth(page) <= 360, "open folds scroll sideways");
  const openStops = await tabThrough(page);
  openStops.forEach(function (stop) {
    assert(stop.name.length > 0, "open fold control missing a name: " + stop.tag + " " + JSON.stringify(stop));
    assert(stop.outline !== "none" && stop.outlineWidth >= 2, "open fold focus ring missing on " + stop.name);
    checkTap(stop, "open");
  });

  await page.evaluate(function () {
    if (window.DongUI) window.DongUI.setTheme("dark");
    document.documentElement.classList.add("dark");
    document.querySelectorAll(".fold").forEach(function (el) { el.open = false; });
  });
  await axeSerious(page, "axe dark with folds closed");
  await page.evaluate(function () {
    document.querySelectorAll(".fold").forEach(function (el) { el.open = true; });
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
