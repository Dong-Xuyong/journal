# Journal — reading and saving

Builder 1 notes for `js/data.js` and `js/ops.js`. The file shape in `CONTRACT.md` does not change. These modules do not add, rename, or delete stored keys except through the operations below.

## What stays read-only

Morning, evening, week, and month fields stay Grok-written. There is no operation that edits `fields`. A save can change a to-do or append a reflection answer. It sets `updatedAt` only on an entry whose to-dos it actually changed.

The Habits tab shows plain tracking only (no XP, levels or surprise rolls; Dong, Oct 17 2026). This layer never writes `habitDefs`, `habits`, or `habitStreaks`. Those keys are copied through from the file that was just fetched.

## localStorage

The `journal-next-*` names come from the preview at `/journal/next/` and are kept after the move to the root, so edits queued there are not lost.

| Key | Use |
|---|---|
| `journal-next-ops` | Queue of edits that have not been saved yet. Survives a reload. |
| `journal-next-cache` | Last remote `journal.json` text, before the pending queue is applied. |
| `journal-next-backup` | Exact text of the first remote file this browser loads. Never replaced. |
| `dong-gh-sync` | Existing token store. Read for the GitHub token and repo. Not rewritten here. |

`journal-v1` was the old app's cache. These modules never read it and never write it, so anything left in it stays on the device.

## Reading (`JournalData`)

`load(raw)` keeps an in-memory copy. It does not write the file.

Mood and energy accept only the integers 1, 2, 3, 4, and 5.

- `moodOf` reads `entries[day].fields.mood`, then `days[day].mood` (or `days[day].fields.mood`), then `fields.moodMeter`, then `days[day].moodMeter`.
- `energyOf` reads `entries[day].fields.energy`, then `days[day].energy` (or `days[day].fields.energy`).

`sleepOf` uses the same sources as Health's `journalSleep`: `entries[day].fields.sleep`, then `entries[day].sleep`, then `entries[day].fields.sleepHours`, then the top-level `sleep` map. When both an entry night and `sleep[day]` exist, the newer `updatedAt` wins and the other fills gaps. The return value is `{ bed, wake, hours, quality, note, updatedAt }` or `null`.

Habits: `true` is done, `false` is missed, and `null` or a missing id on a day that has a `habits` object is unknown. A day with no `habits` object is `none`. If `habitDefs` is missing, the seven default ids are used for display only and are not written back.

Reflections fall back to the nine questions in `CONTRACT.md` when the file has none. That fallback is not written until `appendAnswer` runs and `questions` is missing or empty.

Periods:

- A week’s children are its seven days. `2026-W01` is 29 Dec 2025 through 4 Jan 2026.
- A month’s children are the weeks whose Monday falls in that month.
- A quarter’s children are its three months. A year’s children are its four quarters.
- `ancestors` walks parent, then that parent’s parent, up to the year. A day is `week`, `month`, `quarter`, `year`.
- `daysIn(key, through)` lists the calendar days in the period. When `through` is set, later days are left out.
- `rollup(key, { through })` totals those days. Mood, energy, and sleep averages are `null` when there are no numbers, never `NaN`. An empty period (no check-ins, sleep, to-dos, habit log, or reflection answers) returns `null`. `series` has one point per child, with the same totals and a `key`.

## Saving (`JournalOps`)

Edits are queued in `journal-next-ops`:

- `todoAdd(key, todo)`
- `todoPatch(key, id, patch)`
- `todoRemove(key, id)`
- `appendAnswer(qid, { date, text })`

`status()` is `idle`, `pending`, `saving`, `saved`, `error`, or `offline`. `onChange(fn)` hears that string. A save starts 2.5 seconds after the last edit, and at once when the page is hidden.

Each save:

1. GET `journal.json` with the token in `dong-gh-sync`.
2. Apply the queued operations to that parsed JSON. A missing entry is created as `{ updatedAt, fields: {}, todos: [] }`. Each entry whose to-dos changed gets `updatedAt` set to now.
3. `appendAnswer` writes the nine default questions only when `questions` is missing or empty. The same `date` and `text` is stored once. A different text on that day is a new object. Earlier answers are not edited or deleted.
4. PUT with the `sha` from that GET. The message is `Save journal progress`. On 409, GET again and retry once.
5. On success, drop the operations that were saved, store the written JSON in `journal-next-cache`, and refresh the read model.

The PUT body is the file from the GET in that same cycle, plus the queued edits. If the GET fails, nothing is PUT. Keys this layer does not edit — including unknown top-level keys, `days`, `sleep`, `habits`, `habitStreaks`, and Mirror keys such as `top3`, `top3UpdatedAt`, `moodMeter`, `sleep`, `sunlight`, and `caffeine` — stay as they were in that GET.

## Tools

`tools/backup-journal.mjs` copies `journal.json` to `backups/journal-<ISO>.json` in `Dong-Xuyong/progress-sync`. It refuses to overwrite an existing backup and checks the SHA-256 of the copy against the original. Pass `GITHUB_TOKEN` or `DONG_GH_TOKEN`. `--local <src> <destDir>` does the same check on disk.

`tools/verify-roundtrip.mjs <journal.json>` ticks, adds, edits, and removes to-dos and appends two reflection answers (the first text twice). It prints `nothing lost` when every original path is still present and the only changes are those to-dos, the new answers, and `updatedAt` on the touched entry.
