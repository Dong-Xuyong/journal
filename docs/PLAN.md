> Historical plan. Since the cutover, everything that was under `next/` lives at the repo root (`js/`, `css/`, `tests/`, `tools/`), and `/journal/next/` redirects to `/journal/`.

Rebuilding is the better design, but only for the app itself. The data file should keep its current shape, so no migration is needed. It's still a plan only: no code changes, branches or PR.

## Decision

**Rebuild the app, and keep the `journal.json` format exactly as it is.**

**Why the format must not change.** At least five other programs read or write this file:

| Program | What it uses |
|---|---|
| Hub (`hub.js`) | Morning and evening fields from today's entry, `quotes`, `habitDefs`, `days[today]` |
| Health (`core.js`) | Sleep from `entries[*].fields.sleep`, `entry.sleep` and the top-level `sleep` map; it never writes |
| Mirror / Morning Brief | Reads `entries[day].fields` and `todos`; writes `top3`, `moodMeter`, sleep, sunlight and caffeine |
| Grok | Writes everything, following `CONTRACT.md` |
| Hub links | `/journal/#day/<date>` and `/journal/#habits` |

Changing the shape would break all of them. The only real defect in the data layer is how it saves, and that can be fixed without touching the format. "Lossless" then becomes a property of how the app saves, not a migration.

**Why rebuild the app.** `app.js` (about 1,200 lines) and `habits.js` mix rendering, sync and data rules in one place. Robin's in-flight PR is a careful patch over that. A clean set of modules makes the folds, accessibility, rollups and day-to-year navigation simple, and lets six builders work in separate folders.

**How to roll it out safely:**
1. Let Robin's PR merge, so Dong gets folds and plain copy now.
2. Build the new app in `next/`, live at https://dong-xuyong.github.io/journal/next/, next to the current app. Port Robin's copy and summary formats into it.
3. Dong uses `/journal/next/` for a few days.
4. Cut over in one PR: move `next/*` to the root and remove the old app files. The old app stays in git history, so rollback is reverting that PR.

## 1. Plan summary

**A new way of saving that can't lose data.** Today the app saves by merging the whole file and writing it back, which can drop fields. The new app never writes back what it has in memory. Every edit becomes a small queued operation:
- add, edit or remove a to-do (by id)
- add a reflection answer

To save, it fetches the latest remote file, applies only the queued operations to that raw JSON, and writes it back, retrying on 409. Everything it doesn't own is kept byte for byte, including Grok, Mirror and Health keys and anything not yet known. The queue survives reloads in localStorage until the save succeeds. This fixes the dropped-fields race structurally, not by patching the merge.

**Reading is separate from saving.** One read-only module turns the raw file into what the screens need:
- mood and energy, read from the entry's `fields`, then `days[date]`, then `moodMeter`
- sleep, read where Health reads it
- the links between periods: child periods, parent periods, and the days inside a period
- per-period totals: mood and energy averages, habit rate, to-dos done, reflection answers
- habits and quotes

**UI:**
- Landmarks, a skip link, the `.dx-tabs` period tabs, and a breadcrumb (day › week › month › quarter › year) with every level a link. Focus moves to the period heading on every navigation.
- Every section is a `<details>` fold, closed by default, with a one-line summary such as "Morning · focus: Ship · 3 priorities". Open state is kept under the same `journal-folds` key Robin uses, so Dong's choices carry over.
- The shared kit stays: `body.dx`, `header.dx-header` with `a.dx-home` and `h1.dx-title`, `.dx-card` and `.dx-tabs`.
- Health, Study and Thesis links appear where they're relevant.
- Hub links keep working because the `#day/`, `#week/`, `#month/`, `#quarter/`, `#year/` and `#habits` routes stay the same.

**Backup first.** Before Dong opens `next/` with his token:
- Robin or Dong runs `next/tools/backup-journal.mjs`. It copies `journal.json` to a new file `backups/journal-<ISO>.json` in `progress-sync`, never overwriting, and checks the SHA-256 of the copy against the original.
- The new app also keeps the first raw remote file it loads in localStorage (`journal-next-backup`), and never edits or deletes the old `journal-v1` cache.

**A round-trip check before cutover.** `next/tools/verify-roundtrip.mjs` takes a local copy of the real file and runs a scripted session (tick, add, edit and remove to-dos; answer reflections). It must report "nothing lost": every original path and value is still present, and the only changes are in the edited to-dos, the new answers and the `updatedAt` of touched entries. Robin runs it, because I can't read `progress-sync`.

**If the format ever has to change** (not planned):
- Add new keys only, alongside the old ones. Never move or rename.
- The app reads the old shape first.
- The writer contract changes before the app does.
- Take a backup and pass the round-trip check first.
- A migration produces a new file and leaves `journal.json` untouched until Robin approves.

## 2. Opinions

- **Cut:**
  - the header completion ring and "✍️ x/y" counter
  - the duplicate 7-day and 30-day sparklines
  - the prompt blocks for empty fields inside an opened fold (use one "Not written yet: …" line instead)
  - the "carry unfinished from yesterday" copy step; show yesterday's unfinished to-dos as a list with an "Add to today" button per item instead
- **Merge, in display only.** Every stored key stays.
  - Older day keys appear inside the new groups: `makeGreat` and `affirmation` under Morning, `highlights` with Wins, `better` with Lesson.
  - Week and month: `wins` + `accomplishments`, and `improve` + `rootCause`.
- **What matters:**
  - Saving by small operations. It ends the whole category of "a save wiped X" bugs, which the current contract fends off with five "preserve this key" rules.
  - The day-to-year links and totals.
  - Answers that can only be added to.
- **Deleting a to-do stays** because it's Dong's own action, but it gets a 10-second Undo and sends a single remove operation. It never rewrites the list.

## 3. Questions for Dong (only ones that block a part)

1. **Should Dong be able to edit Morning, Evening, week and month fields on the page?** This blocks the field-editing part of builders 1, 3 and 5. With the new saving model it's one extra operation type. But if Grok writes the same field later, one version overwrites the other, so a design choice is needed: keep both copies, or keep Grok's. The default is that they stay Grok-written and read-only. **Dong (Oct 17 2026): keep them auto-written and read-only.**
2. **Keep or cut XP, levels and surprise rolls on the Habits tab?** This blocks part of builder 6. The default is to keep them. **Dong (Oct 17 2026): cut them; `next/js/gamify.js` is removed and Habits shows plain tracking. Stored keys are unchanged.**
3. **Approval to cut over** once the round-trip check passes, and who runs the backup (Robin or Dong). This blocks only the final cutover PR, not the builders.

## 4. Builder briefs (grok-4.7, parallel; every builder works only inside `next/`)

**Shared rules for every builder:**
- **Branch:** from `main` after Robin's PR (`cursor/plain-collapsible-journal-ef7a`) has merged, as `cursor/journal-next-<brief>-354a`.
- **Data:**
  - Never change the `journal.json` shape. Never write the file except through the save-operations module (`JournalOps`).
  - Never delete, rename or rewrite stored keys or answers. Never touch the `journal-v1` localStorage key.
- **Files:** only touch files under `next/` that you own. Root files are read-only reference; port code from them by copying.
- **Code:** ES5 IIFE style, no build step, no `package.json` in the repo. Install tooling in `/tmp/jt` with `npm i --prefix /tmp/jt playwright @axe-core/playwright`, and commit specs to `next/tests/<brief>.spec.mjs` with inline fixtures.
- **Kit:** `body.dx`, `header.dx-header` with `a.dx-home` and `h1.dx-title`, `.dx-card`, `.dx-tabs`, loaded from `/ui/shell.css`.
- **Folds:** each section is a `<details>` containing a `<summary>` with a heading. All start closed, open state lives in `localStorage["journal-folds"]`, and the copy is plain words, ported from Robin's PR.
- **Local server:**

```bash
mkdir -p /tmp/site/ui && ln -sfn "$PWD" /tmp/site/journal && curl -so /tmp/site/ui/shell.css https://dong-xuyong.github.io/ui/shell.css && cd /tmp/site && python3 -m http.server 8000
# http://localhost:8000/journal/next/ at 360x740. Seed localStorage "journal-next-cache" with a raw journal.json fixture; mock GitHub with page.route for api.github.com.
```

- **Every spec at 360px must check:**
  - no horizontal scroll (`scrollWidth <= 360`)
  - axe finds no serious or critical issues with the `wcag2aa` tag, with folds both closed and all open
  - every control is reachable with Tab, has a visible focus ring and an accessible name, and every summary toggles with Enter and Space
  - tap targets are at least 44px
  - every PUT body sent to the mocked GitHub is a deep superset of the fixture, except for intended edits
- **Shared interfaces:**
  - `JournalData` (builder 1): `load(raw)`, `entry(key)`, `fields(key)`, `todos(key)`, `quote(day)`, `moodOf(day)`, `energyOf(day)`, `sleepOf(day)`, `habitDefs()`, `habitStatus(day, id)`, `reflections()`, `questionOfDay(day)`, `children(key)`, `ancestors(key)`, `daysIn(key, through)`, `rollup(key, {through})`, `shift`, `label`, `kindOf`, `todayKey`.
  - `JournalOps` (builder 1): `todoAdd(key, todo)`, `todoPatch(key, id, patch)`, `todoRemove(key, id)`, `appendAnswer(qid, {date, text})`, `onChange(fn)`, `status()` (one of `idle`, `pending`, `saving`, `saved`, `error`, `offline`).
  - `JournalUI` (builder 2): `el`, `fold({id, title, level, summary}) → {root, body}`, `info(citeKey)`, `todoList(container, key, opts)`, `announce(text)`.
  - `JournalViews[kind](root, {key, today})` is registered by each view.
  - If a dependency isn't merged yet, write a local stub with the same signature and remove it before the PR.

**Builder 1 — Reading, saving and data safety.** Owns `next/js/data.js`, `next/js/ops.js`, `next/tools/backup-journal.mjs`, `next/tools/verify-roundtrip.mjs`, `next/tests/data.test.mjs`, and `next/CONTRACT-NOTES.md`.
- `data.js`:
  - Port the date logic from root `core.js`: ISO weeks, `shift`, `label`, `parentKey`, `weekDays`.
  - `children`: week gives 7 days; month gives the weeks whose Monday is in that month; quarter gives 3 months; year gives 4 quarters.
  - `moodOf` and `energyOf` read the entry's `fields`, then `days[date]`, then `moodMeter` from `fields`, then from `days`, accepting only integers 1–5.
  - `sleepOf` uses the same sources as Health's `journalSleep`.
  - `rollup` returns `{days, logged, mood:{avg,n,min,max}, energy, sleep, series per child, todos:{done,total}, habitRate, reflections}`.
  - The habit logic is ported from `core.js`, including that null and a missing id mean unknown.
  - Reflections fall back to the 9 default questions.
- `ops.js` keeps a queue under `localStorage["journal-next-ops"]`. To save:
  1. GET `journal.json` (token from `localStorage["dong-gh-sync"]`).
  2. Apply the queued operations to the parsed remote JSON. A missing entry is created as `{updatedAt, fields:{}, todos:[]}`. Each touched entry gets `updatedAt = now`.
  3. `appendAnswer` writes the default `questions` only when they're missing, and skips an exact repeat of the same date and text.
  4. PUT with the `sha`. On 409, retry once.
  5. On success, clear the queue and refresh the cache.
- Saving runs 2.5 seconds after the last edit, and immediately when the page is hidden.
- Never PUT anything you didn't GET in the same cycle.
- `backup-journal.mjs` and `verify-roundtrip.mjs` work as described in the plan summary.
- **Acceptance:**
  - `node next/tests/data.test.mjs` passes, including:
    - Simulated race: Grok's fields are written remotely after the page loaded, then a to-do is ticked; the PUT keeps Grok's fields.
    - Unknown top-level keys, `days`, `sleep`, `habits`/`habitStreaks` and the Mirror keys come through byte for byte.
    - The operation queue survives a reload.
    - `rollup` of an empty year gives `null`, not NaN.
    - `2026-W01` gives Dec 29 to Jan 4.
  - `verify-roundtrip` against the fixture reports "nothing lost".

**Builder 2 — Frame, navigation and the accessibility base.** Owns `next/index.html`, `next/js/app.js`, `next/js/ui.js`, `next/css/base.css`, and `next/manifest.webmanifest`.
- **Landmarks:** skip link to `#main`; the kit header plus a sync status (`aria-live="polite"`, text from `JournalOps.status()`) and the theme toggle (`../dong-ui/theme.js`); `nav.dx-tabs[aria-label="Review period"]` with `<a href>` tabs (Day, Week, Month, Quarter, Year, Habits) using `aria-current="page"`; `nav[aria-label="Breadcrumb"]` built from `ancestors()`; `main#main` with the period `h2` (`tabindex=-1`) and Previous, Today and Next ("Previous week" and so on); a footer with a Connect GitHub button.
- **Routing:** `#kind/key` and `#habits[/id]`, identical to today. On each route change, move focus to the `h2` and update `document.title`.
- **`ui.js`:**
  - `fold` (the `journal-folds` key, Robin's `oneLine` summaries).
  - `todoList`: real checkboxes labelled with the to-do text, auto-growing textareas, delete with a 10-second Undo, an optional year-status chip group as a `radiogroup`, all sent through `JournalOps`.
  - `info` used to open a citation tooltip. Those circled info buttons are not rendered. `JournalUI.info` returns nothing.
- `base.css`: 4.5:1 for text and 3:1 for non-text on `--dx-card`, in light and dark; focus rings; `.sr-only`; reduced motion.
- **Acceptance at 360px:**
  - Tab order: skip link → Home → theme toggle → tabs → breadcrumb → Previous / Today / Next → first fold.
  - The "Quarter" link in the breadcrumb on a day opens `#quarter/2026-Q4` with focus on the `h2`.
  - `/journal/next/#habits` and `#day/2026-10-17` load directly.
  - A fold opened under Robin's id is still open.
  - Ticking a to-do puts exactly one operation in the queue, the status reads "Saving…" then "Saved", and the PUT is a deep superset of the fixture.

**Builder 3 — Day view.** Owns `next/js/views/day.js` and `next/css/day.css`.
- **Quote:** `quotes[day]` stays in the file. The Day view does not render it.
- **Morning** fold: `focus`, priorities (falling back to `top3`, then to-dos marked `mit`, with a source note), `failureCost`, `ifThen`, `grateful`, and any older `makeGreat` and `affirmation`. Summary: "Morning · focus: X · N priorities".
- **Evening** fold: mood and energy from `moodOf` and `energyOf`, written as "Mood 4 of 5" with emoji `aria-hidden`; `feeling`; "Wins" (`wins` + `highlights`); "Lesson" (`lesson` + `better`) with a Study link; `chosenVsMomentum`; `tomorrow`. Summary: "Evening · mood 4 / energy 4 · 2 wins".
- **Reflection:** a fold slot for `JournalReflect.mount(slot, {mode: "day", day})`.
- **To-dos** fold: `todoList`, plus yesterday's unfinished to-dos each with "Add to today". Summary: "To-dos · 2 of 5 done".
- **Other apps** fold: Health, Study, Thesis.
- **Acceptance at 360px:**
  - All folds start closed and the summaries match the formats above.
  - Every day field in the fixture appears exactly once.
  - Mood present only in `days[date]` still shows.
  - Fields the app doesn't know (`top3UpdatedAt`, `sleep`, `caffeine`) are never shown and survive saves.
  - 300-character text causes no horizontal scroll.

**Builder 4 — Reflections.** Owns `next/js/views/reflect.js` and `next/css/reflect.css`.
- Export `JournalReflect.mount(container, {mode: "day" | "year", day | year})`.
  - The outer fold's summary reads "Reflection · today: Q5 · 3 answered".
  - Day mode: the question of the day, a textarea whose label contains the question, and Save, which calls `appendAnswer` and announces it. Past answers show newest first, with dates.
  - A nested "All 9 questions" fold holds one fold per question showing its count, each with its own labelled textarea.
  - Year mode is a read-only digest: the latest answer from that year for each question, plus a count.
- There is no edit or delete control. Ctrl+Enter or Cmd+Enter saves.
- **Acceptance at 360px:**
  - Saving "A" then "B" on the same day keeps both. Saving "A" twice keeps one.
  - An extra seeded question id shows as question 10.
  - The PUT keeps every seeded answer byte for byte.
  - Opening an inner fold doesn't toggle the outer one.

**Builder 5 — Week, month, quarter and year views, and trends.** Owns `next/js/views/period.js`, `next/js/trends.js` and `next/css/period.css`.
- Folds, in order:
  - **At a glance**, from `rollup` and compared with the previous period. Summary: "At a glance · mood 3.8 (↑0.4) · energy 3.2".
  - **Children:** links with accessible labels like "Week 41, mood 3.8, energy 3.2, 5 of 7 days logged".
  - **Plan**, then **Review** with the display merges.
  - **Goals** (`goals.{thesis,career,health}` with `progress`, `score` and `next`; Thesis and Health links). Summary: "Goals · thesis 3/5 · health 4/5".
  - **Difficulty and choices** (`difficulty`, `audit`).
  - Habit summary linking to `#habits`, then the previous period's to-dos (read-only), then to-dos.
  - Quarter: `mainQuest`, `q1`–`q6`, `commit90`, `goingTo`, and review.
  - Year: `vision`, `principle`, goal to-dos with status, review, and `JournalReflect.mount(…, {mode: "year"})`.
- `trends.js`: an SVG chart with `role="img"` and a one-sentence `aria-label`, plus a "Data table" fold containing a real `<table>`. Mood and energy must differ by line pattern as well as colour, at 3:1 or better. Missing values show as gaps, never 0.
- **Acceptance at 360px:**
  - On `2026-W01`, the children are Dec 29 to Jan 4.
  - An empty year shows "No check-ins yet", with no NaN.
  - The quarter's month averages match `rollup`.
  - Every stored field appears exactly once.
  - The data table is reachable by keyboard.

**Builder 6 — Habits view.** Owns `next/js/views/habits.js`, `next/js/gamify.js` (ported) and `next/css/habits.css`.
- Port from root `habits.js` and `gamify.js`, keeping Robin's folds and plain copy. Read-only: no operations, no writes.
- Replace the opacity dimming with colours that reach 3:1.
- Heatmap: a text or shape cue for done, missed and unknown (keep the stripes for unknown), plus a legend.
- Charts: arrow-key navigation inside a single Tab stop (roving tabindex), with an announced label.
- Body-habit names link to https://dong-xuyong.github.io/health/.
- XP follows Dong's answer to question 2: cut. `js/cites.js` still holds the short notes, and the page does not show them.
- `#habits/<id>` selects a habit.
- **Acceptance at 360px:**
  - The whole view works with Tab, the arrow keys, Enter and Escape.
  - Missed (`false`) and unknown (`null`) look different in a grayscale screenshot.
  - Zero GitHub PUTs during a full click-through.

**Merge order:** Robin's PR, then builder 1, then builder 2, then builders 3 to 6 in any order. Then Robin runs the backup and round-trip check, Dong tries `/journal/next/`, and I open the cutover PR once Dong approves.