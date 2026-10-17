/**
 * Design pass checks for the rebuilt journal.
 * Helper and frame checks, then the route contract for the day, period, and habits views.
 * Any failure fails the process.
 * Run: node next/tests/design.spec.mjs
 */
import { spawn, execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "/tmp/jt/node_modules/playwright/index.mjs";
import AxeBuilder from "/tmp/jt/node_modules/@axe-core/playwright/dist/index.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const BASE = "http://127.0.0.1:8000/journal/next/";
const FIXTURE_TEXT = readFileSync(new URL("./fixture.json", import.meta.url), "utf8");
const ROUTES = ["#day/2026-10-17", "#day/2026-10-10", "#day/2026-10-14", "#week/2026-W42", "#month/2026-10", "#quarter/2026-Q4", "#year/2026", "#habits", "#habits/thesis"];
const SHOTS = "/opt/cursor/artifacts/screenshots";

let server = null;
let own = 0;
let routeFailures = 0;

function check(bucket, name, ok, detail) {
  if (!ok) {
    if (bucket === "route") routeFailures += 1;
    else own += 1;
  }
  console.log((ok ? "PASS " : "FAIL ") + name + (detail && !ok ? " :: " + detail : ""));
}

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
    if ((await fetch(BASE)).status < 500) return;
  } catch (e) {}
  server = spawn("python3", ["-m", "http.server", "8000"], { cwd: "/tmp/site", stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).status < 500) return;
    } catch (e) {}
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  throw new Error("local server did not start");
}

async function axeBad(page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return res.violations.filter(function (item) {
    return item.impact === "serious" || item.impact === "critical";
  }).map(function (item) { return item.id + " " + item.nodes[0].target.join(" "); });
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 });
  await context.addInitScript(function (raw) {
    localStorage.setItem("journal-next-cache", raw);
    localStorage.setItem("journal-folds", "{}");
    localStorage.setItem("dong-ui-theme", "light");
  }, FIXTURE_TEXT);
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", function (route) { return route.fulfill({ status: 200, contentType: "text/css", body: "" }); });
  await page.route("https://fonts.gstatic.com/**", function (route) { return route.abort(); });
  await page.route("https://api.github.com/**", function (route) { return route.abort(); });
  return page;
}

async function go(page, hash) {
  await page.goto(BASE + hash, { waitUntil: "networkidle" });
  await page.waitForSelector("#view > *");
}

const SCAN = `function emojiCount(text) {
  if (!text) return 0;
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    var seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    var n = 0;
    Array.from(seg.segment(String(text))).forEach(function (part) {
      if (/\\p{Extended_Pictographic}/u.test(part.segment)) n += 1;
    });
    return n;
  }
  var found = String(text).match(/\\p{Extended_Pictographic}/gu);
  return found ? found.length : 0;
}
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var h = 0;
  var s = 0;
  var l = (max + min) / 2;
  var d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: h, s: s * 100, l: l * 100 };
}
function isRed(color) {
  var match = String(color || "").match(/rgba?\\(([^)]+)\\)/);
  if (!match) return false;
  var parts = match[1].split(",").map(function (part) { return parseFloat(part); });
  if (parts.length > 3 && parts[3] === 0) return false;
  var tone = hsl(parts[0], parts[1], parts[2]);
  var hue = tone.h >= 330 || tone.h <= 25;
  return hue && tone.s >= 35 && tone.l >= 20 && tone.l <= 80;
}
function hidden(el) {
  if (!el || el.closest("[hidden]")) return true;
  var style = getComputedStyle(el);
  return style.display === "none" || style.visibility === "hidden";
}`;

async function helpers(page) {
  const plain = await page.evaluate(function () {
    return {
      a: JournalUI.plain("Great week!!"),
      b: JournalUI.plain("Ship it! Then rest"),
      c: JournalUI.plain("Really?!"),
      d: JournalUI.plain("Yahoo!Mail"),
      e: JournalUI.plain("Really!?"),
      f: JournalUI.plain("Yes!")
    };
  });
  check("own", "plain Great week!!", plain.a === "Great week.", JSON.stringify(plain.a));
  check("own", "plain Ship it! Then rest", plain.b === "Ship it. Then rest", JSON.stringify(plain.b));
  check("own", "plain Really?!", plain.c === "Really?", JSON.stringify(plain.c));
  check("own", "plain Yahoo!Mail", plain.d === "YahooMail", JSON.stringify(plain.d));
  check("own", "plain Really!?", plain.e === "Really?", JSON.stringify(plain.e));
  check("own", "plain leaves a sentence bang as a period", plain.f === "Yes.", JSON.stringify(plain.f));

  const api = await page.evaluate(function () {
    var holder = document.createElement("div");
    holder.id = "helper-probe";
    var made = JournalUI.fold({ id: "probe-quote", title: "Quote", summary: "Quote · Keep going.", emoji: "💬" });
    var bare = JournalUI.fold({ id: "probe-bare", title: "Bare", summary: "Bare" });
    var mood = JournalUI.chip({ emoji: "🙂", label: "Mood", value: 4, max: 5 });
    var energy = JournalUI.dots(null, 5, "Energy");
    var textChip = JournalUI.chip({ label: "Average", text: "3.3" });
    holder.appendChild(made.root);
    holder.appendChild(bare.root);
    holder.appendChild(mood);
    holder.appendChild(energy);
    holder.appendChild(textChip);
    document.body.appendChild(holder);
    var button = made.root.querySelector(".fold-summary");
    var line = made.root.querySelector(".fold-line");
    var emoji = made.root.querySelector(".fold-emoji");
    var chipBox = mood.getBoundingClientRect();
    var foldBox = made.root.getBoundingClientRect();
    var dot = energy.querySelector(".jn-dot");
    var dotStyle = getComputedStyle(dot);
    var dotsStyle = getComputedStyle(energy);
    var on = mood.querySelectorAll(".jn-dot.on").length;
    var off = mood.querySelectorAll(".jn-dot:not(.on)").length;
    var rootStyle = getComputedStyle(document.documentElement);
    var result = {
      emojiCount: made.root.querySelectorAll(".fold-emoji").length,
      emojiHidden: emoji ? emoji.getAttribute("aria-hidden") : "",
      emojiText: emoji ? emoji.textContent : "",
      line: line ? line.textContent : "",
      lineEmoji: emoji && line ? line.textContent.indexOf(emoji.textContent) : -1,
      name: (function () {
        var clone = button.cloneNode(true);
        clone.querySelectorAll("[aria-hidden='true']").forEach(function (node) { node.remove(); });
        return (clone.textContent || "").replace(/\s+/g, " ").trim();
      })(),
      bareEmoji: bare.root.querySelectorAll(".fold-emoji").length,
      chipClass: mood.className,
      chipHeight: chipBox.height,
      chipLabel: mood.querySelector("[role='img']") ? mood.querySelector("[role='img']").getAttribute("aria-label") : "",
      emptyClass: energy.className,
      emptyLabel: energy.getAttribute("aria-label"),
      emptyOn: energy.querySelectorAll(".jn-dot.on").length,
      dotCount: energy.querySelectorAll(".jn-dot").length,
      on: on,
      off: off,
      dotWidth: parseFloat(dotStyle.width),
      dotGap: dotsStyle.gap,
      foldHeight: foldBox.height,
      pad: rootStyle.getPropertyValue("--jn-pad").trim(),
      gap: rootStyle.getPropertyValue("--jn-gap").trim(),
      row: rootStyle.getPropertyValue("--jn-row").trim(),
      tap: rootStyle.getPropertyValue("--jn-tap").trim(),
      error: rootStyle.getPropertyValue("--jn-error").trim(),
      s0: rootStyle.getPropertyValue("--jn-s0").trim(),
      s6: rootStyle.getPropertyValue("--jn-s6").trim(),
      status: JournalUI.STATUS
    };
    return result;
  });
  const probe = page.locator("#helper-probe");
  const accessible = await probe.getByRole("button", { name: /Quote · Keep going\./ }).count();
  const namedEmoji = await probe.getByRole("button", { name: /💬/ }).count();
  check("own", "fold button accessible name omits the emoji", accessible === 1 && namedEmoji === 0, accessible + " emoji " + namedEmoji);
  await page.evaluate(function () {
    var holder = document.getElementById("helper-probe");
    if (holder) holder.remove();
  });
  check("own", "fold renders one emoji before the line", api.emojiCount === 1 && api.emojiText === "💬" && api.emojiHidden === "true" && api.line === "Quote · Keep going." && api.lineEmoji === -1, JSON.stringify(api));
  check("own", "fold name stays the summary", api.name.indexOf("Quote · Keep going.") !== -1 && api.name.indexOf("💬") === -1, api.name);
  check("own", "fold without emoji has no emoji slot", api.bareEmoji === 0, String(api.bareEmoji));
  check("own", "chip is at most 28px with mood dots", api.chipClass === "jn-chip" && api.chipHeight <= 28 && api.chipLabel === "Mood 4 of 5" && api.on === 4 && api.off === 1, JSON.stringify(api));
  check("own", "empty dots say not logged", api.emptyClass === "jn-dots is-empty" && api.emptyLabel === "Energy not logged" && api.emptyOn === 0 && api.dotCount === 5, JSON.stringify(api));
  check("own", "dots are 8px with a 3px gap", api.dotWidth === 8 && (api.dotGap === "3px" || api.dotGap === "3px 3px"), api.dotWidth + " " + api.dotGap);
  check("own", "closed probe fold is at most 48px", api.foldHeight <= 48, String(api.foldHeight));
  check("own", "tokens are set", api.pad === "10px" && api.gap === "8px" && api.row === "40px" && api.tap === "32px" && api.error === "#b91c1c" && api.s0 === "#1d4ed8" && api.s6 === "#4d7c0f", JSON.stringify(api));
  check("own", "status class names", api.status.error === "is-error" && api.status.done === "is-done" && api.status.miss === "is-miss" && api.status.unknown === "is-unknown", JSON.stringify(api.status));

  const colors = await page.evaluate(function () {
    var label = document.getElementById("sync-label");
    var previous = label.textContent;
    label.textContent = "Could not save";
    label.classList.add("is-error");
    var error = getComputedStyle(label).color;
    label.classList.remove("is-error");
    label.textContent = "Not synced";
    var neutral = getComputedStyle(label).color;
    label.textContent = "Offline";
    var offline = getComputedStyle(label).color;
    label.textContent = previous;
    document.documentElement.classList.add("dark");
    var darkError = getComputedStyle(document.documentElement).getPropertyValue("--jn-error").trim();
    var darkS3 = getComputedStyle(document.documentElement).getPropertyValue("--jn-s3").trim();
    document.documentElement.classList.remove("dark");
    return { error: error, neutral: neutral, offline: offline, darkError: darkError, darkS3: darkS3 };
  });
  check("own", "save error is red and offline stays neutral", colors.error !== colors.neutral && colors.neutral === colors.offline && colors.darkError === "#fca5a5" && colors.darkS3 === "#fcd34d", JSON.stringify(colors));
}

async function frame(page) {
  await go(page, "#day/2026-10-17");
  const box = await page.evaluate(function () {
    function rect(el) {
      var r = el.getBoundingClientRect();
      return { top: r.top, right: r.right, left: r.left, height: r.height, width: r.width };
    }
    var links = Array.prototype.map.call(document.querySelectorAll("#tabs a"), function (el) {
      var item = rect(el);
      item.text = el.textContent.trim();
      return item;
    });
    var crumbs = Array.prototype.map.call(document.querySelectorAll("#crumbs a"), function (el) {
      var item = rect(el);
      item.text = el.textContent.trim();
      item.label = el.getAttribute("aria-label") || "";
      return item;
    });
    var period = document.querySelector(".period");
    var buttons = Array.prototype.map.call(period.querySelectorAll("button"), rect);
    var heading = rect(document.getElementById("period-heading"));
    return {
      tabs: rect(document.getElementById("tabs")),
      links: links,
      crumbs: crumbs,
      period: rect(period),
      heading: heading,
      buttons: buttons,
      tabDecoration: getComputedStyle(document.querySelector("#tabs a")).textDecorationLine,
      crumbDecoration: getComputedStyle(document.querySelector("#crumbs a")).textDecorationLine,
      sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      own: document.querySelector(".todo textarea") ? document.querySelector(".todo textarea").getAttribute("data-own") : ""
    };
  });
  const sameRow = Math.abs((box.heading.top + box.heading.top + box.heading.height) / 2 - (box.buttons[0].top + box.buttons[0].top + box.buttons[0].height) / 2) < 4;
  check("own", "six tabs are one slim pill row", box.tabs.height <= 40 && box.tabs.right <= 360 && box.tabDecoration === "none" && box.links.length === 6 && box.links.every(function (link) { return Math.abs(link.top - box.links[0].top) < 1 && link.height >= 32 && link.height <= 40; }), JSON.stringify({ h: box.tabs.height, decoration: box.tabDecoration, links: box.links.map(function (link) { return link.text + " " + Math.round(link.height); }) }));
  check("own", "breadcrumb is one short line", box.crumbs.map(function (link) { return link.text; }).join(">") === "2026>Q4>Oct>W42>Sat 17" && box.crumbDecoration === "none" && box.crumbs.every(function (link) { return Math.abs(link.top - box.crumbs[0].top) < 1 && link.label.indexOf(link.text) !== -1 && link.right <= 360; }), box.crumbs.map(function (link) { return link.text + "=" + link.label; }).join(" | "));
  check("own", "date and period buttons share one row", box.period.height <= 56 && sameRow && box.buttons.length === 3 && box.buttons.every(function (button) { return button.height >= 31 && button.height <= 36 && Math.abs(button.top - box.buttons[0].top) < 1; }), JSON.stringify({ h: box.period.height, sameRow: sameRow, buttons: box.buttons }));
  check("own", "day frame does not scroll sideways", box.sw <= 360, String(box.sw));
  check("own", "to-do text is marked as Dong's own", box.own === "todo", String(box.own));

  const closed = await axeBad(page);
  check("own", "axe AA light, folds closed", !closed.length, closed.join("; "));
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: SHOTS + "/journal-360-light-closed.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  const narrow = await page.evaluate(function () {
    function rect(el) {
      var r = el.getBoundingClientRect();
      return { top: r.top, right: r.right, height: r.height };
    }
    var links = Array.prototype.map.call(document.querySelectorAll("#tabs a"), rect);
    var crumbs = Array.prototype.map.call(document.querySelectorAll("#crumbs a"), rect);
    var buttons = Array.prototype.map.call(document.querySelectorAll(".period button"), rect);
    var heading = rect(document.getElementById("period-heading"));
    return {
      tabs: rect(document.getElementById("tabs")),
      links: links,
      crumbs: crumbs,
      period: rect(document.querySelector(".period")),
      heading: heading,
      buttons: buttons,
      sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    };
  });
  const narrowRow = Math.abs((narrow.heading.top + narrow.heading.height / 2) - (narrow.buttons[0].top + narrow.buttons[0].height / 2)) < 4;
  check("own", "320px frame stays one scrolling row", narrow.sw <= 320 && narrow.tabs.height <= 40 && narrow.tabs.right <= 320 && narrow.links.every(function (link) { return Math.abs(link.top - narrow.links[0].top) < 1; }) && narrow.crumbs.every(function (link) { return Math.abs(link.top - narrow.crumbs[0].top) < 1 && link.right <= 320; }) && narrow.period.height <= 56 && narrowRow, JSON.stringify({ sw: narrow.sw, tabs: narrow.tabs, period: narrow.period.height, crumbRights: narrow.crumbs.map(function (link) { return Math.round(link.right); }) }));
  await page.screenshot({ path: SHOTS + "/journal-320-light-closed.png", fullPage: true });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.locator('[data-fold="day:quote"] .fold-summary').click();
  await page.screenshot({ path: SHOTS + "/journal-360-light-quote-open.png", fullPage: true });
  await page.evaluate(function () {
    document.querySelectorAll("#view .fold").forEach(function (el) { el.open = true; });
  });
  const open = await axeBad(page);
  check("own", "axe AA light, folds open", !open.length, open.join("; "));
  await page.evaluate(function () {
    document.documentElement.classList.add("dark");
    document.querySelectorAll("#view .fold").forEach(function (el) { el.open = false; });
  });
  const darkClosed = await axeBad(page);
  check("own", "axe AA dark, folds closed", !darkClosed.length, darkClosed.join("; "));
  await page.evaluate(function () {
    document.querySelectorAll("#view .fold").forEach(function (el) { el.open = true; });
  });
  const darkOpen = await axeBad(page);
  check("own", "axe AA dark, folds open", !darkOpen.length, darkOpen.join("; "));
  await page.evaluate(function () { document.documentElement.classList.remove("dark"); });
}

async function scanRoute(page, hash) {
  return page.evaluate(new Function(SCAN + `
    var rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var bangs = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || node.nodeValue.indexOf("!") === -1) continue;
      var el = node.parentElement;
      if (!el || hidden(el) || el.closest("[data-own], textarea, input, select, option")) continue;
      bangs.push((el.className || el.tagName) + ": " + node.nodeValue.trim().slice(0, 80));
    }
    var reds = [];
    Array.prototype.forEach.call(document.body.querySelectorAll("*"), function (el) {
      if (hidden(el) || el.closest(".is-error")) return;
      var style = getComputedStyle(el);
      ["color", "borderTopColor", "backgroundColor"].forEach(function (prop) {
        if (isRed(style[prop])) reds.push(prop + " " + style[prop] + " " + (el.className || el.tagName));
      });
    });
    var emoji = [];
    Array.prototype.forEach.call(document.querySelectorAll(".fold-summary"), function (button) {
      var fold = button.closest(".fold");
      var nested = !!(fold && fold.parentElement && fold.parentElement.closest(".fold"));
      var question = !!(fold && fold.hasAttribute("data-question-id"));
      var count = button.querySelectorAll(".fold-emoji").length;
      var line = button.querySelector(".fold-line");
      if (line && emojiCount(line.textContent)) emoji.push("line " + line.textContent.slice(0, 40));
      if (!nested && count !== 1) emoji.push("top " + count + " " + (line ? line.textContent : "").slice(0, 40));
      if (nested && question && count !== 0) emoji.push("question " + count);
      if (nested && !question && count > 1) emoji.push("nested " + count);
    });
    Array.prototype.forEach.call(document.querySelectorAll("li, p, .jn-chip"), function (el) {
      if (hidden(el)) return;
      if (emojiCount(el.textContent) > 1) emoji.push("many " + (el.className || el.tagName) + " " + el.textContent.trim().slice(0, 40));
    });
    var compact = [];
    Array.prototype.forEach.call(document.querySelectorAll("#view .fold"), function (el) {
      if (el.classList.contains("is-open") || hidden(el)) return;
      if (el.getBoundingClientRect().height > 48) compact.push("fold " + Math.round(el.getBoundingClientRect().height) + " " + (el.getAttribute("data-fold") || ""));
      var style = getComputedStyle(el);
      ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].forEach(function (prop) {
        if (parseFloat(style[prop]) > 12) compact.push("pad " + prop + " " + style[prop]);
      });
    });
    var tops = Array.prototype.filter.call(document.querySelectorAll("#view > * > .fold, #view .fold"), function (el) {
      return !el.parentElement.closest(".fold");
    });
    for (var i = 0; i < tops.length - 1; i++) {
      var gap = tops[i + 1].getBoundingClientRect().top - tops[i].getBoundingClientRect().bottom;
      if (gap > 10.5) compact.push("gap " + gap.toFixed(1));
    }
    Array.prototype.forEach.call(document.querySelectorAll("button, a[href], input, textarea, select, [role='radio']"), function (el) {
      if (hidden(el) || el.classList.contains("sr-only")) return;
      var box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;
      if (box.width < 24 || box.height < 24) compact.push("target " + Math.round(box.width) + "x" + Math.round(box.height) + " " + (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30));
    });
    var rings = [];
    Array.prototype.forEach.call(document.querySelectorAll("#view *"), function (el) {
      if (hidden(el)) return;
      var name = el.getAttribute("class") || "";
      if (name.toLowerCase().indexOf("ring") !== -1) rings.push(name);
      var box = el.getBoundingClientRect();
      var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      if (box.width > 24 && box.height > 24 && Math.abs(box.width - box.height) < 4 && radius >= box.width / 2 - 0.5 && radius >= box.height / 2 - 0.5) rings.push("circle " + Math.round(box.width) + " " + name);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#view *"), function (el) {
      if (hidden(el) || el.tagName === "H2") return;
      var size = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (size > rootSize * 1.25 + 0.5 && (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)) rings.push("type " + size + " " + (el.className || el.tagName));
    });
    var habits = document.body.getAttribute("data-kind") === "habits" ? document.getElementById("view").innerText : "";
    return {
      bangs: bangs.slice(0, 6),
      reds: reds.slice(0, 6),
      emoji: emoji.slice(0, 8),
      compact: compact.slice(0, 8),
      rings: rings.slice(0, 6),
      height: (function () {
        var nodes = [document.querySelector(".dx-header"), document.getElementById("tabs"), document.getElementById("crumbs"), document.getElementById("main"), document.getElementById("connect")];
        var bottom = 0;
        nodes.forEach(function (el) {
          if (!el || el.hidden) return;
          var box = el.getBoundingClientRect();
          if (box.height < 1) return;
          bottom = Math.max(bottom, box.bottom + window.scrollY);
        });
        return Math.ceil(bottom);
      })(),
      habits: /\\bXP\\b|\\blevel \\d|win day|surprise|linchpin/i.test(habits),
      sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    };
  `));
}

async function routes(page) {
  for (const hash of ROUTES) {
    await go(page, hash);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(function (mode) {
        document.documentElement.classList.toggle("dark", mode === "dark");
        document.querySelectorAll("#view .fold").forEach(function (el) { el.open = false; });
      }, theme);
      await page.waitForTimeout(30);
      for (const open of [false, true]) {
        if (open) {
          await page.evaluate(function () {
            document.querySelectorAll("#view .fold").forEach(function (el) { el.open = true; });
          });
          await page.waitForTimeout(30);
        }
        const state = theme + (open ? " open" : " closed");
        const found = await scanRoute(page, hash);
        check("route", hash + " " + state + " no exclamation outside own text", !found.bangs.length, found.bangs.join("; "));
        check("route", hash + " " + state + " no red outside errors", !found.reds.length, found.reds.join("; "));
        check("route", hash + " " + state + " one emoji on a fold", !found.emoji.length, found.emoji.join("; "));
        check("route", hash + " " + state + " compact", !found.compact.length, found.compact.join("; "));
        check("route", hash + " " + state + " no rings or big type", !found.rings.length, found.rings.join("; "));
        check("route", hash + " " + state + " fits 360", found.sw <= 360, String(found.sw));
        if (!open && theme === "light") {
          if (hash === "#day/2026-10-17") check("route", "day page height", found.height <= 760, String(found.height));
          if (hash === "#week/2026-W42") check("route", "week page height", found.height <= 900, String(found.height));
          if (hash === "#habits") check("route", "habits page height", found.height <= 520, String(found.height));
        }
        if (hash === "#habits" || hash === "#habits/thesis") check("route", hash + " " + state + " no gamification", !found.habits);
        const axe = await axeBad(page);
        check("route", hash + " " + state + " axe AA", !axe.length, axe.join("; "));
      }
    }
  }
  await go(page, "#day/2026-10-17");
  await page.evaluate(function () {
    document.querySelectorAll("#view .fold").forEach(function (el) { el.open = true; });
  });
  const mine = await page.evaluate(function () {
    return {
      todos: Array.prototype.map.call(document.querySelectorAll("#view textarea[data-own]"), function (el) { return el.value; }),
      answers: Array.prototype.map.call(document.querySelectorAll("#view .reflect-answer[data-own]"), function (el) { return el.textContent; })
    };
  });
  check("route", "Dong's to-do shows as typed", mine.todos.indexOf("Call mum!") !== -1, mine.todos.join(" | "));
  check("route", "Dong's answer shows as typed", mine.answers.indexOf("Yes!") !== -1, mine.answers.join(" | "));
}

async function main() {
  await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const page = await newPage(browser);
  try {
    await go(page, "#day/2026-10-17");
    await helpers(page);
    await frame(page);
    await routes(page);
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  console.log(own ? "design.spec: " + own + " helper or frame check(s) failed" : "design.spec: passed");
  console.log(routeFailures ? "design.spec routes: " + routeFailures + " failed" : "design.spec routes: passed");
  if (own || routeFailures) process.exit(1);
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  if (server) server.kill();
  process.exit(1);
});
