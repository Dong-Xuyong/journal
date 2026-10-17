# Journal

A private journal for day, week, month, quarter, and year progress, plus habit tracking.

Live: https://dong-xuyong.github.io/journal/

Routes: `#day/YYYY-MM-DD`, `#week/YYYY-Www`, `#month/YYYY-MM`, `#quarter/YYYY-Qn`, `#year/YYYY`, `#habits`, `#habits/<id>`. The old preview at `/journal/next/` redirects here and keeps the hash.

Entries and the quote of the day live in Dong-Xuyong/progress-sync, file journal.json. The quote is `quotes["YYYY-MM-DD"].text`.

The page loads that file on open, on focus, and every 60 seconds.

The page is read-only. It has no inputs, checkboxes or save buttons: Robin edits journal.json, and the page only shows it. The token from Connect GitHub is used to read the file; the page never writes to GitHub.

The layout follows the nutrition app (`/health/nutrition/`): the period tabs (Day, Week, Month, Quarter, Year) sit in the top bar, a Journal / Habits switch sits under it, then the date card and the section cards. The day's reflection question and its answers are shown on the Day view, and the year's answers on the Year view.

The Habits tab is tracking only: today, streaks, the year in days, and week and month rates.

`CONTRACT.md` is the writer spec for journal.json. `docs/CONTRACT-NOTES.md` covers how the page reads the file. `docs/PLAN.md` is the redesign plan and `docs/DESIGN-BRIEFS.md` the compact design pass.

## Code

No build step. `index.html` loads `js/data.js`, `js/sync.js`, `js/cites.js`, `js/ui.js`, `js/trends.js`, the views in `js/views/`, then `js/app.js`.

## Tests

Install Playwright and axe once: `npm i --prefix /tmp/jt playwright @axe-core/playwright`, then:

- `node tests/data.test.mjs`
- `node tests/integration.spec.mjs` (set `BASE=https://dong-xuyong.github.io/journal/` to run it against the live site)
- `node tests/frame.spec.mjs`
- `node tests/habits.spec.mjs`
- `node tests/design.spec.mjs` (compact cards, one emoji per fold, no red outside errors, no exclamation points outside Dong's own text; also takes `BASE`)
- `node tests/gh-sync-merge.test.mjs` (the shared `dong-ui/gh-sync.js`, which this page does not load)

## Backup

- `node tools/backup-journal.mjs` copies journal.json to `backups/` in progress-sync and checks the copy's SHA-256.
