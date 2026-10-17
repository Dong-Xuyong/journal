import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { lostReport, scriptSession } from "../tools/verify-roundtrip.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dataPath = path.join(root, "js/data.js");
const opsPath = path.join(root, "js/ops.js");
const data = require(dataPath);
const opsPure = require(opsPath);
const { chromium } = require("/tmp/jt/node_modules/playwright");
const { AxeBuilder } = require("/tmp/jt/node_modules/@axe-core/playwright");

const W01 = ["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
const W41 = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];

function memoryStorage(seed) {
  const map = Object.create(null);
  if (seed) Object.keys(seed).forEach(function (key) { map[key] = seed[key]; });
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; },
    setItem: function (key, value) { map[key] = String(value); },
    removeItem: function (key) { delete map[key]; }
  };
}

function boot(store, fetchImpl, extras) {
  const timers = [];
  let nextId = 1;
  const sandbox = {
    console: console,
    Buffer: Buffer,
    localStorage: store,
    fetch: fetchImpl,
    setTimeout: function (fn, ms) {
      const id = nextId++;
      timers.push({ id: id, fn: fn, ms: ms });
      return id;
    },
    clearTimeout: function (id) {
      const index = timers.findIndex(function (item) { return item.id === id; });
      if (index >= 0) timers.splice(index, 1);
    },
    window: {},
    module: { exports: {} }
  };
  if (extras && extras.document) sandbox.document = extras.document;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(dataPath, "utf8"), sandbox, { filename: dataPath });
  vm.runInContext(fs.readFileSync(opsPath, "utf8"), sandbox, { filename: opsPath });
  return { ops: sandbox.window.JournalOps, data: sandbox.window.JournalData, timers: timers };
}

function encodeFile(text) {
  return Buffer.from(text, "utf8").toString("base64");
}

function decodePut(body) {
  return JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
}

function fakeRes(status, json) {
  return {
    status: status,
    ok: status >= 200 && status < 300,
    json: function () { return Promise.resolve(json); }
  };
}

function githubFetch(state) {
  return function (url, opts) {
    const method = (opts && opts.method) || "GET";
    state.urls.push(String(url));
    state.headers.push(opts && opts.headers);
    if (method === "GET") {
      state.gets += 1;
      const spec = state.onGet(state.gets);
      if (spec instanceof Error) return Promise.reject(spec);
      if (spec.status && spec.status !== 200) return Promise.resolve(fakeRes(spec.status, spec.json || {}));
      return Promise.resolve(fakeRes(200, { sha: spec.sha, content: encodeFile(spec.raw), encoding: "base64" }));
    }
    if (method === "PUT") {
      const body = JSON.parse(opts.body);
      state.puts.push(body);
      const status = state.onPut(state.puts.length, body);
      return Promise.resolve(fakeRes(status, { content: {} }));
    }
    return Promise.resolve(fakeRes(404, {}));
  };
}

function walkPaths(original, edited, allow, pathName, problems) {
  if (allow(pathName)) return;
  if (original === edited) return;
  if (original == null || typeof original !== "object") {
    if (original !== edited) problems.push(pathName || "root");
    return;
  }
  if (Array.isArray(original)) {
    if (!Array.isArray(edited) || edited.length !== original.length) {
      problems.push((pathName || "root") + " length");
      return;
    }
    original.forEach(function (item, index) {
      walkPaths(item, edited[index], allow, pathName + "[" + index + "]", problems);
    });
    return;
  }
  if (!edited || typeof edited !== "object") {
    problems.push(pathName + " missing");
    return;
  }
  Object.keys(original).forEach(function (key) {
    const child = pathName ? pathName + "." + key : key;
    if (!Object.prototype.hasOwnProperty.call(edited, key)) problems.push(child + " missing");
    else walkPaths(original[key], edited[key], allow, child, problems);
  });
}

function remoteFixture() {
  return {
    version: 1,
    mystery: { note: "keep-me", nested: [1, { z: "q" }] },
    days: { "2026-10-17": { mood: 1, hubWeather: { emoji: "☀️" } } },
    sleep: { "2026-10-16": { hours: 7.5, updatedAt: "2026-10-16T08:00:00.000Z" } },
    habitDefs: [{ id: "thesis", label: "Thesis 📝", emoji: "📝" }],
    quotes: { "2026-10-17": { text: "Stay the course.", updatedAt: "2026-10-17T07:00:00.000Z" } },
    reflections: {
      questions: [{ id: "q1", text: "Custom wording that must stay" }],
      answers: { q1: [{ date: "2026-10-16", text: "Earlier" }] }
    },
    entries: {
      "2026-10-17": {
        updatedAt: "2026-10-17T08:00:00.000Z",
        fields: {
          focus: "Grok wrote this",
          sleep: "23:00-07:00",
          caffeine: "none",
          sunlight: "10 min",
          top3: ["Ship"],
          top3UpdatedAt: "2026-10-17T08:00:00.000Z",
          moodMeter: 4
        },
        todos: [{ id: "t1", text: "Call the bank", done: false, mit: true }],
        habits: { thesis: true, training: null },
        habitStreaks: { thesis: 4, training: 0 },
        mirrorOnly: { ok: true }
      },
      "2026-10-18": { updatedAt: "2026-10-18T08:00:00.000Z", fields: { focus: "Untouched" }, todos: [] }
    }
  };
}

function testDates() {
  assert.deepEqual(data.children("2026-W01"), W01);
  assert.deepEqual(data.weekDays("2026-W01"), W01);
  assert.equal(data.label("2026-W01"), "Week 1 · Dec 29, 2025 – Jan 4, 2026");
  assert.equal(data.parentKey("2026-W01"), "2025-12");
  assert.equal(data.children("2026-01").indexOf("2026-W01"), -1);
  assert.ok(data.children("2025-12").indexOf("2026-W01") >= 0);
  assert.deepEqual(data.children("2026-W41"), W41);
  assert.equal(data.label("2026-10-06"), "Tuesday, October 6, 2026");
  assert.equal(data.shift("2026-W53", 1), "2027-W01");
  assert.equal(data.shift("2026-01-01", -1), "2025-12-31");
  assert.equal(data.shift("2026-Q4", 1), "2027-Q1");
  assert.deepEqual(data.ancestors("2026-10-06"), ["2026-W41", "2026-10", "2026-Q4", "2026"]);
  assert.deepEqual(data.children("2026-Q4"), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(data.children("2026"), ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
  data.children("2026-10").forEach(function (week) {
    assert.equal(data.parentKey(week), "2026-10");
  });
  assert.equal(data.daysIn("2026-02").length, 28);
  assert.equal(data.daysIn("2028-02").length, 29);
  assert.deepEqual(data.daysIn("2026-W01", "2025-12-31"), ["2025-12-29", "2025-12-30", "2025-12-31"]);
  assert.equal(data.todayKey("day", new Date(2026, 9, 6)), "2026-10-06");
  assert.equal(data.kindOf("nope"), null);
  assert.deepEqual(data.children("nope"), []);
}

function testReadModel() {
  const raw = {
    version: 1,
    quotes: { "2026-10-17": { text: "Hello", updatedAt: "t", extra: 1 } },
    days: {
      "2026-10-18": { mood: 2, energy: 3 },
      "2026-10-19": { fields: { mood: 3, energy: 4, moodMeter: 1 } },
      "2026-10-20": { moodMeter: 5 }
    },
    entries: {
      "2026-10-17": { fields: { mood: 4, energy: 2, moodMeter: 1, focus: "Ship" }, todos: [{ id: "t1", text: "Call", done: false }] },
      "2026-10-18": { fields: { mood: 9, energy: "4", moodMeter: 1 } },
      "2026-10-19": { fields: { energy: 1.5 } },
      "2026-10-21": { fields: { sleep: "23:00-07:00" }, updatedAt: "2026-10-21T01:00:00.000Z" },
      "2026-10-22": { sleep: { bed: "23:30", wake: "07:00" }, fields: {} },
      "2026-10-23": { fields: { sleepHours: 7 }, updatedAt: "2026-10-23T01:00:00.000Z" },
      "2026-10-24": { fields: { sleep: 6 }, updatedAt: "2026-10-24T09:00:00.000Z" },
      "2026-10-25": { fields: { sleep: 5 }, sleep: { hours: 9 }, updatedAt: "2026-10-25T01:00:00.000Z" },
      "2026-10-26": { habits: { thesis: null, training: false }, fields: {} },
      "2026-10-27": { fields: { mood: 4 } }
    },
    sleep: { "2026-10-24": { hours: 8, updatedAt: "2026-10-24T01:00:00.000Z" } },
    reflections: { questions: [{ id: "q10", text: "Extra question" }], answers: { q10: [{ date: "2026-10-17", text: "Yes" }] } }
  };
  data.load(raw);
  assert.equal(raw.reflections.questions[0].id, "q10");
  assert.equal(data.quote("2026-10-17").text, "Hello");
  assert.equal(data.quote("2026-10-17").extra, 1);
  assert.equal(data.quote("missing"), null);
  assert.equal(data.moodOf("2026-10-17"), 4);
  assert.equal(data.energyOf("2026-10-17"), 2);
  assert.equal(data.moodOf("2026-10-18"), 2);
  assert.equal(data.energyOf("2026-10-18"), 3);
  assert.equal(data.moodOf("2026-10-19"), 3);
  assert.equal(data.energyOf("2026-10-19"), 4);
  assert.equal(data.moodOf("2026-10-20"), 5);
  assert.equal(data.energyOf("2026-10-20"), null);
  assert.equal(data.moodOf("2026-10-27"), 4);
  assert.equal(data.sleepOf("2026-10-21").hours, 8);
  assert.equal(data.sleepOf("2026-10-22").hours, 7.5);
  assert.equal(data.sleepOf("2026-10-23").hours, 7);
  assert.equal(data.sleepOf("2026-10-24").hours, 6);
  assert.equal(data.sleepOf("2026-10-25").hours, 5);
  assert.equal(data.habitStatus("2026-10-26", "thesis"), "unknown");
  assert.equal(data.habitStatus("2026-10-26", "training"), "miss");
  assert.equal(data.habitStatus("2026-10-26", "sunlight"), "unknown");
  assert.equal(data.habitStatus("2026-10-17", "thesis"), "none");
  assert.equal(data.habitStatus("missing", "thesis"), "none");
  const copy = data.entry("2026-10-17");
  copy.fields.focus = "mutated";
  assert.equal(data.fields("2026-10-17").focus, "Ship");
  assert.equal(data.reflections().questions[0].id, "q10");
  assert.equal(data.reflections().answers.q10[0].text, "Yes");
  assert.equal(data.questionOfDay("2026-10-17").text, "Extra question");

  data.load({ version: 1, entries: {} });
  assert.equal(data.reflections().questions.length, 9);
  assert.equal(data.reflections().questions[0].text, "If I knew I couldn't fail, what would I like to do?");
  assert.equal(data.reflections().questions[8].id, "q9");
  const seen = Object.create(null);
  let cursor = "2026-01-01";
  for (let n = 0; n < 9; n++) {
    seen[data.questionOfDay(cursor).id] = true;
    cursor = data.shift(cursor, 1);
  }
  assert.equal(Object.keys(seen).length, 9);
  assert.equal(data.habitDefs().length, 7);
  assert.equal(data.habitDefs()[0].id, "thesis");
}

function testRollup() {
  data.load({ entries: { "2025-12-31": { fields: { mood: 2, energy: 2 } } } });
  assert.equal(data.rollup("2026"), null);
  const prior = data.rollup("2025");
  assert.equal(prior.mood.avg, 2);
  assert.equal(Object.is(prior.mood.avg, NaN), false);
  assert.equal(prior.sleep.avg, null);
  assert.equal(Object.is(prior.energy.avg, NaN), false);

  data.load({
    entries: {
      "2025-12-29": { fields: { mood: 5, energy: 5 } }
    }
  });
  assert.equal(data.rollup("2026-W01").mood.avg, 5);
  assert.equal(data.rollup("2026-W01").days, 7);
  assert.equal(data.rollup("2026"), null);

  data.load({
    habitDefs: [
      { id: "thesis", label: "Thesis", emoji: "x" },
      { id: "training", label: "Training", emoji: "y" }
    ],
    entries: {
      "2026-10-05": {
        fields: { mood: 4, energy: 2 },
        todos: [{ id: "a", text: "A", done: true }, { id: "b", text: "B", done: false }],
        habits: { thesis: true, training: false }
      },
      "2026-10-06": { fields: { mood: 2, energy: 4 } },
      "2026-W41": { todos: [{ id: "w", text: "Week", done: true }] }
    },
    reflections: { answers: { q1: [{ date: "2026-10-05", text: "Noted" }, { date: "2026-11-01", text: "Later" }] } },
    sleep: { "2026-10-05": { hours: 8 }, "2026-10-06": { hours: 6 } }
  });
  const week = data.rollup("2026-W41");
  assert.equal(week.days, 7);
  assert.equal(week.logged, 2);
  assert.equal(week.mood.avg, 3);
  assert.equal(week.mood.n, 2);
  assert.equal(week.mood.min, 2);
  assert.equal(week.mood.max, 4);
  assert.equal(week.energy.avg, 3);
  assert.equal(week.sleep.avg, 7);
  assert.equal(week.todos.done, 2);
  assert.equal(week.todos.total, 3);
  assert.equal(week.habitRate, 0.5);
  assert.equal(week.reflections, 1);
  assert.equal(week.series.length, 7);
  assert.equal(week.series[0].key, "2026-10-05");
  assert.equal(week.series[2].mood.avg, null);
  assert.equal(Object.is(week.series[2].mood.avg, NaN), false);
  const quarter = data.rollup("2026-Q4");
  const october = data.rollup("2026-10");
  const point = quarter.series.filter(function (item) { return item.key === "2026-10"; })[0];
  assert.equal(point.mood.avg, october.mood.avg);
  assert.equal(point.mood.n, october.mood.n);
  assert.equal(point.energy.avg, october.energy.avg);
  assert.equal(point.sleep.avg, october.sleep.avg);
  assert.equal(point.todos.total, october.todos.total);
  const cut = data.rollup("2026-10", { through: "2026-10-05" });
  assert.equal(cut.mood.avg, 4);
  assert.equal(cut.mood.n, 1);

  data.load({ entries: { "2026-01-02": { todos: [{ id: "a", text: "x", done: false }] } } });
  const year = data.rollup("2026");
  assert.notEqual(year, null);
  assert.equal(year.mood.avg, null);
  assert.equal(year.mood.min, null);
  assert.equal(Object.is(year.energy.avg, NaN), false);
  assert.equal(year.todos.total, 1);
  assert.equal(year.series.length, 4);
  assert.equal(JSON.stringify(year).indexOf("NaN"), -1);
}

function testApplyPure() {
  const doc = {
    version: 1,
    mystery: { a: 1 },
    entries: { "2026-10-17": { updatedAt: "old", fields: { focus: "Keep" }, todos: [{ id: "t1", text: "Call", done: false, mit: true }] } },
    reflections: { questions: [{ id: "q1", text: "Keep me" }], answers: { q1: [{ date: "2026-10-16", text: "A" }] } }
  };
  const same = opsPure.applyOps(doc, [{ type: "appendAnswer", qid: "q1", answer: { date: "2026-10-16", text: "A" } }], "2026-10-17T12:00:00.000Z");
  assert.equal(same.reflections.answers.q1.length, 1);
  assert.equal(JSON.stringify(same.reflections.questions), JSON.stringify(doc.reflections.questions));
  const both = opsPure.applyOps(doc, [{ type: "appendAnswer", qid: "q1", answer: { date: "2026-10-17", text: "B" } }], "2026-10-17T12:00:00.000Z");
  assert.equal(both.reflections.answers.q1.length, 2);
  assert.equal(both.reflections.answers.q1[0].text, "A");
  assert.equal(both.reflections.answers.q1[1].text, "B");
  assert.equal(JSON.stringify(both.mystery), JSON.stringify(doc.mystery));
  assert.equal(JSON.stringify(both.entries["2026-10-17"].fields), JSON.stringify(doc.entries["2026-10-17"].fields));
  const created = opsPure.applyOps({ version: 1, entries: {} }, [{ type: "appendAnswer", qid: "q9", answer: { date: "2026-10-17", text: "Path" } }], "now");
  assert.equal(created.reflections.questions.length, 9);
  assert.equal(created.reflections.questions[0].id, "q1");
  assert.equal(created.reflections.answers.q9[0].text, "Path");
  const added = opsPure.applyOps({ version: 1 }, [
    { type: "todoAdd", key: "2026-10-17", todo: { id: "n1", text: "New", done: false } }
  ], "2026-10-17T00:00:00.000Z");
  assert.deepEqual(Object.keys(added.entries["2026-10-17"]).sort(), ["fields", "todos", "updatedAt"]);
  assert.equal(added.entries["2026-10-17"].updatedAt, "2026-10-17T00:00:00.000Z");
  assert.equal(JSON.stringify(doc.entries["2026-10-17"].todos), JSON.stringify([{ id: "t1", text: "Call", done: false, mit: true }]));
}

function roundTripFixture() {
  const doc = remoteFixture();
  doc.entries["2026-10-17"].fields.tomorrow = ["rest"];
  return doc;
}

function testRoundTripTool() {
  const fixture = roundTripFixture();
  const ctx = scriptSession(fixture);
  const edited = opsPure.applyOps(fixture, ctx.ops, "2026-10-17T15:00:00.000Z");
  const losses = lostReport(fixture, edited, ctx);
  assert.deepEqual(losses, []);
  const broken = JSON.parse(JSON.stringify(edited));
  delete broken.days;
  assert.ok(lostReport(fixture, broken, ctx).length > 0);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "journal-rt-"));
  const file = path.join(dir, "journal.json");
  fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
  const ran = spawnSync(process.execPath, [path.join(root, "tools/verify-roundtrip.mjs"), file], { encoding: "utf8" });
  assert.equal(ran.status, 0, ran.stderr || ran.stdout);
  assert.equal(ran.stdout.trim(), "nothing lost");
  assert.equal(fs.readFileSync(file, "utf8"), JSON.stringify(fixture, null, 2));
}

function testBackupTool() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "journal-bak-"));
  const src = path.join(dir, "journal.json");
  const dest = path.join(dir, "backups");
  const text = "{\n  \"version\": 1,\n  \"mystery\": \"café 📝\"\n}\n";
  fs.writeFileSync(src, text);
  const tool = path.join(root, "tools/backup-journal.mjs");
  const first = spawnSync(process.execPath, [tool, "--local", src, dest], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /sha256 match/);
  const second = spawnSync(process.execPath, [tool, "--local", src, dest], { encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  const files = fs.readdirSync(dest).sort();
  assert.equal(files.length, 2);
  files.forEach(function (name) {
    const copy = fs.readFileSync(path.join(dest, name));
    assert.equal(createHash("sha256").update(copy).digest("hex"), createHash("sha256").update(fs.readFileSync(src)).digest("hex"));
  });
  const missing = spawnSync(process.execPath, [tool], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /GITHUB_TOKEN/);
}

async function testSaveQueue() {
  const opsSource = fs.readFileSync(opsPath, "utf8");
  const dataSource = fs.readFileSync(dataPath, "utf8");
  assert.equal(opsSource.includes("journal-v1"), false);
  assert.equal(dataSource.includes("journal-v1"), false);

  const remote = remoteFixture();
  const pretty = JSON.stringify(remote, null, 2);
  const stale = JSON.parse(JSON.stringify(remote));
  stale.entries["2026-10-17"].fields = { focus: "Stale local" };
  const store = memoryStorage({
    "journal-v1": "sentinel",
    "journal-next-cache": JSON.stringify(stale),
    "dong-gh-sync": JSON.stringify({ token: "test-token", repo: "Dong-Xuyong/progress-sync" })
  });
  const state = {
    gets: 0,
    puts: [],
    urls: [],
    headers: [],
    onGet: function () { return { sha: "sha-1", raw: pretty }; },
    onPut: function () { return 200; }
  };
  const first = boot(store, githubFetch(state));
  assert.equal(first.ops.status(), "idle");
  assert.equal(first.data.fields("2026-10-17").focus, "Stale local");
  first.ops.todoPatch("2026-10-17", "t1", { done: true });
  assert.equal(first.ops.status(), "pending");
  assert.equal(first.timers[first.timers.length - 1].ms, 2500);
  assert.equal(first.data.todos("2026-10-17")[0].done, true);
  const queued = store.getItem("journal-next-ops");
  assert.match(queued, /todoPatch/);

  const hidden = [];
  const doc = {
    visibilityState: "visible",
    addEventListener: function (name, fn) { hidden.push(fn); }
  };
  const second = boot(store, githubFetch(state), { document: doc });
  assert.equal(second.ops.status(), "pending");
  assert.match(store.getItem("journal-next-ops"), /todoPatch/);
  doc.visibilityState = "hidden";
  hidden[0]();
  await second.ops.flush();
  assert.equal(state.puts.length, 1);
  assert.equal(state.puts[0].message, "Save journal progress");
  assert.equal(state.puts[0].sha, "sha-1");
  assert.equal(state.headers[0].Authorization, "Bearer test-token");
  assert.match(state.urls[0], /Dong-Xuyong\/progress-sync\/contents\/journal\.json/);
  const put = decodePut(state.puts[0]);
  assert.equal(put.entries["2026-10-17"].fields.focus, "Grok wrote this");
  assert.equal(put.entries["2026-10-17"].todos[0].done, true);
  assert.equal(put.entries["2026-10-17"].todos[0].mit, true);
  assert.equal(JSON.stringify(put.mystery), JSON.stringify(remote.mystery));
  assert.equal(JSON.stringify(put.days), JSON.stringify(remote.days));
  assert.equal(JSON.stringify(put.sleep), JSON.stringify(remote.sleep));
  assert.equal(JSON.stringify(put.entries["2026-10-17"].habits), JSON.stringify(remote.entries["2026-10-17"].habits));
  assert.equal(JSON.stringify(put.entries["2026-10-17"].habitStreaks), JSON.stringify(remote.entries["2026-10-17"].habitStreaks));
  assert.equal(JSON.stringify(put.entries["2026-10-17"].fields), JSON.stringify(remote.entries["2026-10-17"].fields));
  assert.equal(JSON.stringify(put.entries["2026-10-18"]), JSON.stringify(remote.entries["2026-10-18"]));
  assert.equal(put.habitDefs[0].label, "Thesis 📝");
  const problems = [];
  walkPaths(remote, put, function (pathName) {
    return pathName === "entries.2026-10-17.updatedAt" || pathName === "entries.2026-10-17.todos[0].done";
  }, "", problems);
  assert.deepEqual(problems, []);
  assert.equal(store.getItem("journal-v1"), "sentinel");
  assert.equal(store.getItem("journal-next-backup"), pretty);
  assert.equal(store.getItem("journal-next-ops"), null);
  assert.equal(second.ops.status(), "saved");

  const raced = remoteFixture();
  const racedPretty = JSON.stringify(raced, null, 2);
  const racedNext = JSON.parse(racedPretty);
  racedNext.entries["2026-10-17"].fields.tomorrow = ["from grok"];
  const racedRaw = JSON.stringify(racedNext, null, 2);
  const raceState = {
    gets: 0,
    puts: [],
    urls: [],
    headers: [],
    onGet: function (n) { return { sha: "sha-" + n, raw: n === 1 ? racedPretty : racedRaw }; },
    onPut: function (n) { return n === 1 ? 409 : 200; }
  };
  const raceStore = memoryStorage({
    "journal-v1": "sentinel",
    "dong-gh-sync": JSON.stringify({ token: "test-token" })
  });
  const race = boot(raceStore, githubFetch(raceState));
  race.ops.todoPatch("2026-10-17", "t1", { done: true });
  await race.ops.flush();
  assert.equal(raceState.gets, 2);
  assert.equal(raceState.puts.length, 2);
  assert.equal(raceState.puts[1].sha, "sha-2");
  const retried = decodePut(raceState.puts[1]);
  assert.equal(retried.entries["2026-10-17"].fields.focus, "Grok wrote this");
  assert.deepEqual(retried.entries["2026-10-17"].fields.tomorrow, ["from grok"]);
  assert.equal(retried.entries["2026-10-17"].todos[0].done, true);
  assert.equal(JSON.stringify(retried.days), JSON.stringify(raced.days));
  assert.equal(raceStore.getItem("journal-next-backup"), racedPretty);
  assert.equal(race.ops.status(), "saved");

  const offlineState = { gets: 0, puts: [], urls: [], headers: [], onGet: function () { return Promise.reject(new TypeError("failed")); }, onPut: function () { return 500; } };
  const offlineFetch = function () {
    offlineState.gets += 1;
    return Promise.reject(new TypeError("failed"));
  };
  const offlineStore = memoryStorage({ "dong-gh-sync": JSON.stringify({ token: "test-token" }), "journal-v1": "sentinel" });
  const offline = boot(offlineStore, offlineFetch);
  offline.ops.appendAnswer("q1", { date: "2026-10-17", text: "A" });
  offline.ops.appendAnswer("q1", { date: "2026-10-17", text: "A" });
  offline.ops.appendAnswer("q1", { date: "2026-10-17", text: "B" });
  await offline.ops.flush();
  assert.equal(offline.ops.status(), "offline");
  assert.equal(offlineState.gets, 1);
  assert.match(offlineStore.getItem("journal-next-ops"), /appendAnswer/);
  assert.equal(offlineStore.getItem("journal-v1"), "sentinel");

  const noToken = boot(memoryStorage({ "journal-v1": "sentinel" }), function () { throw new Error("should not fetch"); });
  noToken.ops.todoAdd("2026-10-18", { text: "Local only", done: false });
  assert.equal(noToken.ops.status(), "offline");
  assert.equal(noToken.timers.length, 0);
  assert.equal(noToken.data.todos("2026-10-18")[0].text, "Local only");
}

async function testNoPutOnServerError() {
  let puts = 0;
  const store = memoryStorage({ "dong-gh-sync": JSON.stringify({ token: "test-token" }) });
  const booted = boot(store, function (url, opts) {
    if ((opts && opts.method) === "PUT") puts += 1;
    return Promise.resolve(fakeRes(500, {}));
  });
  booted.ops.todoPatch("2026-10-17", "t1", { done: true });
  await booted.ops.flush();
  assert.equal(puts, 0);
  assert.equal(booted.ops.status(), "error");
  assert.match(store.getItem("journal-next-ops"), /todoPatch/);
  assert.equal(store.getItem("dong-gh-sync"), JSON.stringify({ token: "test-token" }));
}

function contentType(file) {
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function startServer(rootDir) {
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(rootDir, rel));
    if (!file.startsWith(rootDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, function (err, buf) {
      if (err) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(file) });
      res.end(buf);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", function () { resolve(server); });
  });
}

async function axeSerious(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  const bad = results.violations.filter(function (item) {
    return item.impact === "serious" || item.impact === "critical";
  });
  if (bad.length) {
    throw new Error(bad.map(function (item) { return item.id + ": " + item.help; }).join("; "));
  }
}

async function testViewport() {
  const remote = remoteFixture();
  const pretty = JSON.stringify(remote, null, 2);
  const stale = JSON.parse(pretty);
  stale.entries["2026-10-17"].fields = { focus: "Stale local" };
  const long = ("Ship the chapter and keep the line short. ").repeat(12);
  fs.mkdirSync("/tmp/site/ui", { recursive: true });
  try { fs.symlinkSync(root, "/tmp/site/journal"); } catch (e) { if (e.code !== "EEXIST") throw e; }
  const shell = spawnSync("curl", ["-fsS", "--max-time", "20", "-o", "/tmp/site/ui/shell.css", "https://dong-xuyong.github.io/ui/shell.css"]);
  const shellLink = shell.status === 0 ? '<link rel="stylesheet" href="/ui/shell.css">' : "";
  const html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Journal next data</title>" + shellLink +
    "<style>" +
    "html,body.dx{margin:0;background:#fff;color:#142033;max-width:100%;}" +
    "body.dx{padding:0 12px 24px;}" +
    "header.dx-header,header.dx-header a,h1.dx-title{color:#142033;background:#fff;}" +
    "a,summary,label{min-height:44px;min-width:44px;display:flex;align-items:center;color:#142033;background:#fff;}" +
    "summary{width:100%;}" +
    "input[type=checkbox]{width:44px;height:44px;margin:0 8px 0 0;}" +
    ":focus{outline:3px solid #0b3a8f;outline-offset:-3px;}" +
    "p{overflow-wrap:anywhere;margin:0 0 12px;}" +
    "h1{font-size:20px;margin:0;}" +
    "</style></head><body class=\"dx\">" +
    "<a href=\"#main\">Skip to content</a>" +
    "<header class=\"dx-header\"><a class=\"dx-home\" href=\"/\" aria-label=\"Home\">Home</a><h1 class=\"dx-title\">Journal</h1></header>" +
    "<main id=\"main\">" +
    "<details><summary>Morning · focus: Ship · 3 priorities</summary><p>" + long + "</p>" +
    "<label><input id=\"tick\" type=\"checkbox\"> Call the bank</label></details>" +
    "<details><summary>Evening · mood 4 / energy 4 · 2 wins</summary><p>Not written yet.</p></details>" +
    "</main>" +
    "<script>localStorage.setItem('dong-gh-sync', JSON.stringify({token:'test-token',repo:'Dong-Xuyong/progress-sync'}));" +
    "localStorage.setItem('journal-v1','sentinel');" +
    "localStorage.setItem('journal-next-cache'," + JSON.stringify(JSON.stringify(stale)) + ");</script>" +
    "<script src=\"/journal/js/data.js\"></script>" +
    "<script src=\"/journal/js/ops.js\"></script>" +
    "<script>document.getElementById('tick').addEventListener('change', function () {" +
    "JournalOps.todoPatch('2026-10-17','t1',{done:document.getElementById('tick').checked});});</script>" +
    "</body></html>";
  fs.writeFileSync("/tmp/site/harness.html", html);
  const server = await startServer("/tmp/site");
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  const puts = [];
  try {
    await page.route("https://api.github.com/**", async function (route) {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sha: "sha-ui", content: encodeFile(pretty), encoding: "base64" })
        });
        return;
      }
      if (req.method() === "PUT") {
        puts.push(JSON.parse(req.postData()));
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        return;
      }
      await route.fulfill({ status: 404, body: "" });
    });
    const got = page.waitForResponse(function (res) {
      return res.url().indexOf("api.github.com") >= 0 && res.request().method() === "GET";
    });
    await page.goto("http://127.0.0.1:" + port + "/harness.html", { waitUntil: "load" });
    await got;
    async function scrollWidth() {
      return page.evaluate(function () {
        return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      });
    }
    assert.ok(await scrollWidth() <= 360, "closed scrollWidth " + await scrollWidth());
    await axeSerious(page);
    await page.evaluate(function () {
      document.querySelectorAll("details").forEach(function (item) { item.open = true; });
    });
    assert.ok(await scrollWidth() <= 360, "open scrollWidth " + await scrollWidth());
    await axeSerious(page);

    await page.evaluate(function () {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    const focusCount = await page.evaluate(function () {
      return document.querySelectorAll("a[href], summary, input, button").length;
    });
    assert.equal(focusCount, 5);
    const seen = [];
    for (let i = 0; i < focusCount; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(function () {
        const el = document.activeElement;
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        let name = el.getAttribute("aria-label") || "";
        if (!name && el.labels && el.labels.length) name = el.labels[0].innerText;
        if (!name) name = (el.innerText || "").trim();
        return {
          tag: el.tagName,
          name: name.trim(),
          outline: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          w: box.width,
          h: box.height
        };
      });
      seen.push(info);
      assert.notEqual(info.tag, "BODY");
      assert.ok(info.name.length > 0, "missing name on " + info.tag);
      assert.notEqual(info.outline, "none");
      assert.ok(info.width >= 2);
      assert.ok(info.w >= 44 && info.h >= 44, info.tag + " " + info.w + "x" + info.h);
    }
    assert.ok(seen.some(function (item) { return item.name.indexOf("Skip") >= 0; }));
    assert.ok(seen.some(function (item) { return item.name.indexOf("Home") >= 0; }));
    assert.ok(seen.some(function (item) { return item.name.indexOf("Morning") >= 0; }));

    await page.locator("summary").first().focus();
    const before = await page.locator("details").first().evaluate(function (el) { return el.open; });
    await page.keyboard.press("Enter");
    const afterEnter = await page.locator("details").first().evaluate(function (el) { return el.open; });
    assert.notEqual(before, afterEnter);
    await page.keyboard.press(" ");
    const afterSpace = await page.locator("details").first().evaluate(function (el) { return el.open; });
    assert.notEqual(afterEnter, afterSpace);

    await page.locator("#tick").check();
    await page.evaluate(function () { return JournalOps.flush(); });
    assert.equal(puts.length, 1);
    const body = decodePut(puts[0]);
    const problems = [];
    walkPaths(remote, body, function (pathName) {
      return pathName === "entries.2026-10-17.updatedAt" || pathName === "entries.2026-10-17.todos[0].done";
    }, "", problems);
    assert.deepEqual(problems, []);
    assert.equal(body.entries["2026-10-17"].fields.focus, "Grok wrote this");
    assert.equal(body.entries["2026-10-17"].todos[0].done, true);
    assert.equal(body.habitDefs[0].label, "Thesis 📝");
    assert.equal(await page.evaluate(function () { return localStorage.getItem("journal-v1"); }), "sentinel");
    assert.equal(await page.evaluate(function () { return localStorage.getItem("journal-next-backup"); }), pretty);
    assert.ok(await scrollWidth() <= 360);
  } finally {
    await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
}

async function main() {
  testDates();
  testReadModel();
  testRollup();
  testApplyPure();
  testRoundTripTool();
  testBackupTool();
  await testSaveQueue();
  await testNoPutOnServerError();
  await testViewport();
  console.log("data.test.mjs ok");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
