# Journal — reading

Notes for `js/data.js` and `js/sync.js`. The file shape in `CONTRACT.md` does not change.

## Read-only

The page never writes `journal.json` (Dong, Oct 17 2026). Robin edits the file; the page only shows it. There are no inputs, checkboxes, edit buttons or saves for habits, reflections, to-dos or mood.

## Presentation

Morning sub-headings, accents, the focus pill, amber time and deadline chips, and `- ` lines drawn as lists are display-only. They do not change `journal.json` or the words that were stored. Info buttons are not shown.

The Habits tab shows plain tracking only (no XP, levels or surprise rolls).

## localStorage

The `journal-next-*` names come from the preview at `/journal/next/` and are kept after the move to the root.

| Key | Use |
|---|---|
| `journal-next-ops` | Edit queue from the old editable page. No longer read or written; any queue left on a device stays as it is. |
| `journal-next-cache` | Last remote `journal.json` text. |
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

Reflections fall back to the nine questions in `CONTRACT.md` when the file has none. The fallback is for display only.

Periods:

- A week’s children are its seven days. `2026-W01` is 29 Dec 2025 through 4 Jan 2026.
- A month’s children are the weeks whose Monday falls in that month.
- A quarter’s children are its three months. A year’s children are its four quarters.
- `ancestors` walks parent, then that parent’s parent, up to the year. A day is `week`, `month`, `quarter`, `year`.
- `daysIn(key, through)` lists the calendar days in the period. When `through` is set, later days are left out.
- `rollup(key, { through })` totals those days. Mood, energy, and sleep averages are `null` when there are no numbers, never `NaN`. An empty period (no check-ins, sleep, to-dos, habit log, or reflection answers) returns `null`. `series` has one point per child, with the same totals and a `key`.

## Syncing (`JournalSync`)

`pull()` GETs `journal.json` with the token in `dong-gh-sync`, stores the text in `journal-next-cache`, keeps the first copy in `journal-next-backup`, and loads it into `JournalData`. It runs on open, when the page becomes visible, and every 60 seconds. `status()` is `idle`, `synced`, `error`, or `offline`; `onChange(fn)` hears it. There is no PUT.

## Tools

`tools/backup-journal.mjs` copies `journal.json` to `backups/journal-<ISO>.json` in `Dong-Xuyong/progress-sync`. It refuses to overwrite an existing backup and checks the SHA-256 of the copy against the original. Pass `GITHUB_TOKEN` or `DONG_GH_TOKEN`. `--local <src> <destDir>` does the same check on disk.
