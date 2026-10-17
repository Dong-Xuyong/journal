/* Apply a scripted to-do and reflection session to a local journal.json.
   Prints "nothing lost" when every original path is still present and the
   only changes are the edited to-dos, the new answers, and updatedAt on the
   touched entry. Usage: node next/tools/verify-roundtrip.mjs <journal.json> */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ops = require("../js/ops.js");

const KEEP_ID = "verify-roundtrip-keep";
const DROP_ID = "verify-roundtrip-drop";
const ANSWER_A = "Round trip answer";
const ANSWER_B = "Round trip answer two";

function isDay(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function scriptSession(doc) {
  var entries = doc && doc.entries && typeof doc.entries === "object" && !Array.isArray(doc.entries) ? doc.entries : {};
  var keys = Object.keys(entries).filter(isDay).sort();
  var key = keys[0] || "2026-10-17";
  var entry = entries[key];
  var todos = entry && Array.isArray(entry.todos) ? entry.todos : [];
  var tickId = null;
  var i;
  for (i = 0; i < todos.length; i++) {
    if (todos[i] && typeof todos[i].id === "string" && todos[i].id) {
      tickId = todos[i].id;
      break;
    }
  }
  var list = [];
  if (tickId) list.push({ type: "todoPatch", key: key, id: tickId, patch: { done: true } });
  list.push({ type: "todoAdd", key: key, todo: { id: KEEP_ID, text: "Round trip add", done: false } });
  list.push({ type: "todoPatch", key: key, id: KEEP_ID, patch: { text: "Round trip edit", done: true } });
  list.push({ type: "todoAdd", key: key, todo: { id: DROP_ID, text: "Round trip drop", done: false } });
  list.push({ type: "todoRemove", key: key, id: DROP_ID });
  list.push({ type: "appendAnswer", qid: "q1", answer: { date: key, text: ANSWER_A } });
  list.push({ type: "appendAnswer", qid: "q1", answer: { date: key, text: ANSWER_A } });
  list.push({ type: "appendAnswer", qid: "q1", answer: { date: key, text: ANSWER_B } });
  return { key: key, tickId: tickId, ops: list };
}

function walk(original, edited, path, losses, skip) {
  if (skip(path)) return;
  if (original === edited) return;
  if (original == null || typeof original !== "object") {
    if (original !== edited) losses.push(path + " changed");
    return;
  }
  if (Array.isArray(original)) {
    if (!Array.isArray(edited) || edited.length !== original.length) {
      losses.push(path + " length");
      return;
    }
    var i;
    for (i = 0; i < original.length; i++) walk(original[i], edited[i], path + "[" + i + "]", losses, skip);
    return;
  }
  if (!edited || typeof edited !== "object" || Array.isArray(edited)) {
    losses.push(path + " missing");
    return;
  }
  var keys = Object.keys(original);
  var n;
  for (n = 0; n < keys.length; n++) {
    var child = path ? path + "." + keys[n] : keys[n];
    if (!Object.prototype.hasOwnProperty.call(edited, keys[n])) losses.push(child + " missing");
    else walk(original[keys[n]], edited[keys[n]], child, losses, skip);
  }
}

function countText(map, day, text) {
  var list = map && Array.isArray(map.q1) ? map.q1 : [];
  var n = 0;
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i] && list[i].date === day && list[i].text === text) n += 1;
  }
  return n;
}

function todoLosses(originalTodos, editedTodos, tickId, losses) {
  var orig = Array.isArray(originalTodos) ? originalTodos : [];
  var edited = Array.isArray(editedTodos) ? editedTodos : [];
  var byId = Object.create(null);
  var i;
  for (i = 0; i < edited.length; i++) {
    if (edited[i] && typeof edited[i].id === "string") byId[edited[i].id] = edited[i];
  }
  for (i = 0; i < orig.length; i++) {
    var item = orig[i];
    if (!item || typeof item.id !== "string") {
      losses.push("todo without id");
      continue;
    }
    var found = byId[item.id];
    if (!found) {
      losses.push("todo removed " + item.id);
      continue;
    }
    var left = JSON.parse(JSON.stringify(item));
    var right = JSON.parse(JSON.stringify(found));
    if (item.id === tickId) {
      delete left.done;
      delete right.done;
    }
    if (JSON.stringify(left) !== JSON.stringify(right)) losses.push("todo changed " + item.id);
  }
  var keep = byId[KEEP_ID];
  if (!keep || keep.text !== "Round trip edit" || keep.done !== true) losses.push("added todo not edited");
  if (byId[DROP_ID]) losses.push("removed todo still present");
}

export function lostReport(original, edited, ctx) {
  var losses = [];
  var key = ctx.key;
  var touchedTodos = "entries." + key + ".todos";
  var touchedStamp = "entries." + key + ".updatedAt";
  walk(original, edited, "", losses, function (path) {
    return path === touchedTodos || path === touchedStamp || path === "reflections.answers" || path === "reflections.questions";
  });
  var originalEntry = original && original.entries ? original.entries[key] : null;
  var editedEntry = edited && edited.entries ? edited.entries[key] : null;
  todoLosses(originalEntry && originalEntry.todos, editedEntry && editedEntry.todos, ctx.tickId, losses);
  if (!editedEntry || typeof editedEntry.updatedAt !== "string" || !editedEntry.updatedAt) losses.push("updatedAt missing");
  var origRef = original && original.reflections && typeof original.reflections === "object" ? original.reflections : null;
  var editRef = edited && edited.reflections && typeof edited.reflections === "object" ? edited.reflections : null;
  if (origRef && Array.isArray(origRef.questions) && origRef.questions.length) {
    if (!editRef || JSON.stringify(origRef.questions) !== JSON.stringify(editRef.questions)) losses.push("questions changed");
  }
  var origAnswers = origRef && origRef.answers ? origRef.answers : {};
  var editAnswers = editRef && editRef.answers ? editRef.answers : {};
  var ids = Object.keys(origAnswers);
  var q;
  for (q = 0; q < ids.length; q++) {
    var list = Array.isArray(origAnswers[ids[q]]) ? origAnswers[ids[q]] : [];
    var next = editAnswers && Array.isArray(editAnswers[ids[q]]) ? editAnswers[ids[q]] : [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (JSON.stringify(list[i]) !== JSON.stringify(next[i])) losses.push("answer changed " + ids[q]);
    }
  }
  var already = countText(origAnswers, key, ANSWER_A);
  var expectedA = already + (already > 0 ? 0 : 1);
  if (countText(editAnswers, key, ANSWER_A) !== expectedA) losses.push("answer A count");
  if (countText(editAnswers, key, ANSWER_B) !== countText(origAnswers, key, ANSWER_B) + 1) losses.push("answer B count");
  return losses;
}

function ranAsMain() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

function main() {
  var file = process.argv[2];
  if (!file || file.indexOf("--") === 0) {
    console.error("Usage: node next/tools/verify-roundtrip.mjs <journal.json>");
    process.exit(1);
  }
  var original = JSON.parse(readFileSync(file, "utf8"));
  var ctx = scriptSession(original);
  var edited = ops.applyOps(original, ctx.ops, new Date().toISOString());
  var losses = lostReport(original, edited, ctx);
  if (losses.length) {
    var i;
    for (i = 0; i < losses.length; i++) console.error(losses[i]);
    process.exit(1);
  }
  console.log("nothing lost");
}

if (ranAsMain()) main();
