# Journal

A private journal for day, week, month, quarter, and year progress, plus habit tracking.

Live: https://dong-xuyong.github.io/journal/

Routes: `#day/YYYY-MM-DD`, `#week/YYYY-Www`, `#month/YYYY-MM`, `#quarter/YYYY-Qn`, `#year/YYYY`, `#habits`, `#habits/<id>`. The old preview at `/journal/next/` redirects here and keeps the hash.

Entries and the quote of the day live in Dong-Xuyong/progress-sync, file journal.json. The quote is `quotes["YYYY-MM-DD"].text`.

The page loads that file on open, on focus, and every 60 seconds.

Morning, evening, week and month fields are read-only on the page; Grok writes them. On the page you can edit to-dos and add reflection answers (append-only). Edits are queued and saved a few seconds later: the app reads the current file, applies only the queued edits, and writes it back, so fields it does not know about are kept.

The Habits tab is read-only tracking: today, streaks, the year in days, and week and month rates.

`CONTRACT.md` is the writer spec for journal.json. `docs/CONTRACT-NOTES.md` covers how the page reads and saves. `docs/PLAN.md` is the redesign plan and `docs/DESIGN-BRIEFS.md` the compact design pass.

## Code

No build step. `index.html` loads `js/data.js`, `js/ops.js`, `js/cites.js`, `js/ui.js`, `js/trends.js`, the views in `js/views/`, then `js/app.js`.

## Tests

Install Playwright and axe once: `npm i --prefix /tmp/jt playwright @axe-core/playwright`, then:

- `node tests/data.test.mjs`
- `node tests/integration.spec.mjs` (set `BASE=https://dong-xuyong.github.io/journal/` to run it against the live site)
- `node tests/frame.spec.mjs`
- `node tests/habits.spec.mjs`
- `node tests/design.spec.mjs` (compact cards, one emoji per fold, no red outside errors, no exclamation points outside Dong's own text; also takes `BASE`)
- `node tests/gh-sync-merge.test.mjs` (the shared `dong-ui/gh-sync.js`, which this page does not load)

## Backup and round-trip check

- `node tools/backup-journal.mjs` copies journal.json to `backups/` in progress-sync and checks the copy's SHA-256.
- `node tools/verify-roundtrip.mjs <journal.json>` runs a scripted edit session and prints `nothing lost` when every original field survives.
