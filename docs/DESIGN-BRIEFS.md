> Historical briefs. Since the cutover, the `next/` paths below live at the repo root (`js/`, `css/`, `tests/`), and `/journal/next/` redirects to `/journal/`.

# Morning presentation (Dong, Oct 17 2026)

Presentation only. The `journal.json` shape does not change, stored text is not rewritten, and the page stays read-only.

1. **No info buttons.** Do not render the circled ⓘ, or any similar info icon, on any day or period field. `JournalUI.info` returns nothing.
2. **Morning sub-heading emoji.** Each of these has one emoji in `.day-sub-emoji` (`aria-hidden`), in addition to the Morning fold emoji 🌅. This relaxes "one emoji per section" for these sub-headings. The emoji is not a `.fold-emoji`, and each `.fold-summary` still has exactly one `.fold-emoji`. A sub-heading, list item, or chip still has at most one emoji.
   - Focus 🎯
   - Priorities 📌
   - If I skip #1 🔁
   - Grateful 🙏
   - What would make today great 🌟
3. **Accent per morning sub-section.** A left border and a tinted background, one hue each, including If this happens and A line to repeat. Text stays the normal text colour. Never red text. The hues come from `--jn-s0` … `--jn-s6`.
4. **Focus is a pill.** The focus value is `.day-focus-pill`, coloured, not a second line of plain text.
5. **Amber chips for times and deadlines.** `.jn-mark` wraps matches in rendered field text. The characters inside the chip are the stored characters. Nothing is written back. Match:
   - 24-hour times `H:MM` or `HH:MM`, with optional seconds
   - dates: `YYYY-MM-DD`, `28 Oct`, `28 October 2026`, `Oct 28`, `28/10/2026`
   - a deadline phrase — `expires`, `due`, or `deadline`, plus a date — as one chip, for example `expires 28 Oct`
6. **Dashed lines are lists.** Any rendered field whose lines start with `- ` is a real list. The marker is not shown. The words after it stay verbatim. To-dos and reflection answers are Dong's own text and are not rewritten.

# Journal next — design pass briefs

Dong's feedback on the Day view (Oct 17 2026), applied to all of `next/`, Journal and Habits:

1. **Compact cards.** Tighter padding, smaller row height.
2. **No red text** except real errors.
3. **One emoji per fold,** for example Quote 💬, Mood 🙂, Morning 🌅, Evening 🌙, Reflection 🪞, To-dos ✅. Morning sub-headings are the exception in the section above.
4. **No exclamation points** in UI copy or in the generated text the page shows.
5. **New visuals:** mood and energy chips, and small progress dots instead of big rings or big numbers.

Habits stays plain tracking, with no XP, levels or surprise rolls. That is already true on `main`; keep it that way.

There are four parallel builders, for grok-4.7. Each one owns only the files listed in its brief. The cutover to `/journal/` is on hold until this pass lands; see "After the pass" at the end.

## Rules for every builder

- **Data:** never write, rename or delete anything in `journal.json`, and never change a localStorage key.
  - The views stay read-only, except for the existing to-do and reflection operations through `JournalOps`.
  - Dong's own text is never rewritten. That means to-do text he typed and reflection answers, both in storage and on screen.
- **Code:** work only inside `next/` and only in the files you own. Use the plain ES5 IIFE style, with no build step and no `package.json`.
- **Tooling:** install it in `/tmp/jt`: `npm i --prefix /tmp/jt playwright @axe-core/playwright`.
- **Local server:** serve `/tmp/site` on `:8000`, with `/tmp/site/journal` linked to the repo and `/tmp/site/ui/shell.css` copied from https://dong-xuyong.github.io/ui/shell.css. The page is at `http://localhost:8000/journal/next/`.
- **No stubs.** Builders 2–4 depend on the helpers builder 1 adds to `JournalUI` (contract below).
  - Code against that contract. To test, merge builder 1's branch into yours locally with `git merge origin/<b1-branch>`.
  - Don't write stand-in versions of `JournalData`, `JournalOps` or `JournalUI`. Last round, those stubs were the main integration cost.
- **Copy:** plain words, no exclamation points, and no emoji inside summary text. The emoji goes in the fold's emoji slot.
- **Accessibility floor**, which still applies:
  - axe AA has zero serious or critical issues, in light and dark, with folds closed and open.
  - Full keyboard use, with a visible focus ring.
  - Every control has a name that contains its visible text.
  - Nothing scrolls sideways at 360px.
- **Tap targets:** WCAG 2.2 AA (2.5.8) asks for at least 24×24px.
  - The compact sizes are 40px for fold rows, 32px for buttons, links styled as buttons, and inputs, and 24px for checkboxes inside a row that is at least 32px tall.
  - The current specs assert 44px; each owner updates its spec to these numbers.
- **Finish line:** before the PR, all of these pass with your branch merged with builder 1's branch:
  - `node next/tests/data.test.mjs`
  - `node next/tests/integration.spec.mjs`
  - `node next/tests/frame.spec.mjs`
  - `node next/tests/habits.spec.mjs`
  - `node next/tests/design.spec.mjs`
  - Attach 360×740 screenshots: light, with folds closed and with one fold open.

## Shared contract (builder 1 implements it; builders 2–4 use it)

Additions to `next/js/ui.js`:

- **`JournalUI.fold({ id, title, level, summary, emoji })`** works as today, plus an optional `emoji`.
  - The emoji renders as `<span class="fold-emoji" aria-hidden="true">` inside the summary button, before `.fold-line`.
  - The button's accessible name stays the summary text, without the emoji.
- **`JournalUI.dots(value, max, label)`** returns `<span class="jn-dots" role="img" aria-label="<label> <value> of <max>">` containing `max` children `span.jn-dot`. The first `value` of them get the class `on`.
  - If `value` is null, no dot is on, the label reads "<label> not logged", and the class is `jn-dots is-empty`.
  - The dots are 8px with a 3px gap. An "on" dot uses `--jn-dot-on`. An "off" dot is a hollow ring in `--jn-dot-off` that reaches 3:1 against the card.
- **`JournalUI.chip({ emoji, label, value, max, text })`** returns a non-interactive `span.jn-chip`, at most 28px tall.
  - It holds the optional emoji (`aria-hidden`), the label, and either `dots(value, max, label)` or `text`.
  - Example: `chip({ emoji: "🙂", label: "Mood", value: 4, max: 5 })`.
- **`JournalUI.plain(text)`** is a display-only filter for generated text: Grok-written fields, quotes, habit labels, cite texts and period fields.
  - "!!" or "!" at the end of a sentence (followed by a space or the end of the text) becomes ".".
  - "?!" or "!?" becomes "?".
  - Any other "!" is removed.
  - It returns a string and never touches stored data.
  - Don't apply it to Dong's own text (to-dos, reflection answers). Mark those elements with `data-own`.
- **`JournalUI.STATUS`** CSS classes are `is-error`, `is-done`, `is-miss` and `is-unknown`.
  - Only `is-error` may use the error colour.
  - Done is the accent colour, miss is neutral (solid slate outline), and unknown is a dashed neutral outline.

Tokens in `next/css/base.css` (`:root` and `html.dark`):

- `--jn-pad: 10px`: card padding.
- `--jn-gap: 8px`: space between cards.
- `--jn-row: 40px`: fold row.
- `--jn-tap: 32px`: buttons and inputs.
- `--jn-radius: 12px`.
- `--jn-dot-on`, `--jn-dot-off`.
- `--jn-ok`, `--jn-miss`, `--jn-unknown`.
- `--jn-error: #b91c1c` light and `#fca5a5` dark: errors only.
- `--jn-s0` … `--jn-s6`: chart and habit series, with no red or orange hues. In light: `#1d4ed8 #0f766e #6d28d9 #a16207 #334155 #0369a1 #4d7c0f`. In dark, lighter versions. Each must reach 3:1 against the card (WCAG 1.4.11).

Emoji map (one per fold; rows inside a fold get at most one each):

| View | Fold or row | Emoji |
|---|---|---|
| Day | Quote | 💬 |
| Day | Morning | 🌅 |
| Day | Evening | 🌙 |
| Day | Mood chip | the face for the score: 😞 😕 😐 🙂 😄 (none if not logged) |
| Day | Energy chip | ⚡ |
| Day | Reflection | 🪞 |
| Day | To-dos | ✅ |
| Day | Still open from yesterday (row) | ↩️ |
| Day | Other apps | 🔗 |
| Period | At a glance | 📈 |
| Period | Days, Weeks, Months, Quarters | 🗓️ |
| Period | Plan, Focus, Vision | 🧭 |
| Period | Goals | 🎯 |
| Period | Review | 🔍 |
| Period | Choices | 🔀 |
| Period | Habits | 🔁 |
| Period | Last …'s to-dos | ↩️ |
| Period | To-dos | ✅ |
| Year | Reflection | 🪞 |
| Habits | Today | 📅 |
| Habits | Streaks | 🔥 |
| Habits | Year in days | 🗓️ |
| Habits | Week by week | 📊 |
| Habits | Month by month | 📈 |
| Habits | Each habit row | the habit's own emoji from `habitDefs` |

## Builder 1 — Tokens, frame, UI helpers and the copy guard

**Owns:**
- `next/css/base.css`
- `next/index.html`
- `next/js/ui.js`
- `next/js/app.js`
- `next/js/cites.js`
- `next/tests/frame.spec.mjs`
- `next/tests/integration.spec.mjs`
- `next/tests/fixture.json`
- new: `next/tests/design.spec.mjs`

**Do:**
- Add the tokens and the shared contract above. Unit-check `plain()` in `design.spec.mjs` with these cases:
  - "Great week!!" becomes "Great week."
  - "Ship it! Then rest" becomes "Ship it. Then rest"
  - "Really?!" becomes "Really?"
  - "Yahoo!Mail" becomes "YahooMail"
- **Compact frame:**
  - Tabs in one row, at most 44px tall at 360px, all six visible with no sideways scroll.
  - The breadcrumb on one line at 360px, using short visible labels ("2026 › Q4 › Oct › W42 › 17") with the full name in each link's `aria-label`.
  - The heading and Previous/Today/Next on at most two rows, about 80px in total. The buttons are 32px tall.
- **Folds:** a 40px row, `--jn-pad` padding, `--jn-gap` between cards, and line-height 1.35. Remove the 44px minimums, using `--jn-tap` instead.
- **Sync status:**
  - "Could not save" and a failed load use `.is-error`, the only red on the page.
  - "Offline" and "Not synced" stay neutral.
  - Statuses are plain words with no punctuation, as now.
- **Copy:** remove every "!" from `app.js`, `ui.js` and `cites.js` strings, and run `plain()` on the cite texts.
- **Fixture:** add generated text with "!" so the views can prove the filter works.
  - Quote "Keep going!"
  - `focus: "Ship it!"`
  - The week field `why: "Great week!!"`
  - A habit label "Read!" (id `read`)
  - Dong's own text that must stay as typed: a to-do "Call mum!" and the reflection answer "Yes!"
- **`design.spec.mjs`** covers all 7 routes at 360×740, light and dark, with folds closed and all open, using the fixture and no token:
  - **Exclamation points:** no "!" in visible text outside `[data-own]` elements and form-field values.
  - **No red:** no element outside `.is-error` whose computed `color`, `border-color` or `background-color` is red or orange (hue 330–360° or 0–25°, saturation at least 35%, lightness 20–80%).
  - **Emoji:**
    - Every `.fold-summary` has exactly one `.fold-emoji`.
    - `.fold-line` contains no emoji.
    - No `li`, `p` or `.jn-chip` contains more than one emoji. A Morning sub-heading may contain its one `.day-sub-emoji`.
  - No `.info-btn` anywhere.
  - **Compact sizes:**
    - A closed `.fold` is at most 48px tall.
    - The gap between adjacent cards is at most 10px.
    - Card padding is at most 12px.
    - Every control is at least 24×24px.
  - **No rings or big numbers:**
    - No element with "ring" in its class.
    - No `border-radius: 50%` element wider than 24px.
    - No text inside `#view` larger than 1.25rem, except the h2.
  - **Page height with folds closed:** Day at most 760px (1113 today), Week at most 900px (1321 today), Habits at most 520px (771 today).
  - **Habits text** doesn't match `/\bXP\b|\blevel \d|win day|surprise|linchpin/i`.
  - **axe AA:** zero serious or critical issues in every state above.
  - **Scope:** builders 2–4 must pass the checks for their routes. Builder 1's own acceptance is the frame and the helpers.
- **Acceptance at 360px:**
  - `frame.spec` passes with the new sizes (tabs one row, breadcrumb one line, focus rings visible) and with axe clean in light and dark.
  - `design.spec`'s helper and frame checks pass.
  - `integration.spec` passes, including the mocked save that keeps every stored field.

## Builder 2 — Day view

**Owns:** `next/js/views/day.js` and `next/css/day.css`.

**Do:**
- **Emoji:** pass the fold emoji from the map to every `JournalUI.fold` call: Quote 💬, Morning 🌅, Evening 🌙, To-dos ✅, Other apps 🔗.
  - Reflection 🪞 is set by builder 4 inside `reflect.js`. Leave the slot in `day.js` empty.
- **Mood and energy chips:** replace the two `.day-meter` rows with one row of two chips at the top of the Evening fold.
  - `chip({emoji: face, label: "Mood", value, max: 5})` and `chip({emoji: "⚡", label: "Energy", value, max: 5})`.
  - A missing score shows the "not logged" dots.
  - Show the same two chips, small, at the end of the closed Evening row, as dots without labels and `aria-hidden`. The text summary stays "Evening · mood 4 / energy 4 · 2 wins".
- **Priorities:** show the three priorities as a compact numbered list, with one line each at 360px and wrapping only if needed.
- **Compact fields:** label and value on tight lines (label 0.85rem, 600 weight, muted but still at least 4.5:1). 6px between fields. No info buttons.
- **"Not written yet: …" line:** neutral muted text, not red or orange.
- **"Still open from yesterday":** each row is `↩️ text [Add]`, with a 32px Add button.
- **Text filtering:** run every Grok-written value through `JournalUI.plain()`: quote, focus, priorities, failureCost, ifThen, grateful, makeGreat, affirmation, feeling, wins, lesson, chosenVsMomentum, tomorrow, highlights and better.
  - To-do text comes from `JournalUI.todoList`. It is Dong's own text and is shown unchanged, with the `data-own` marker set by builder 1.
- **Copy:** keep Robin's labels and summaries exactly. Remove any "!".
- **Acceptance at 360px, with the fixture:**
  - The Day view with folds closed is at most 760px tall.
  - Every fold summary has one emoji.
  - "Ship it!" shows as "Ship it.", and "Keep going!" as "Keep going." in both the quote summary and the body.
  - "Call mum!" shows unchanged.
  - The evening chips read "Mood 4 of 5" and "Energy 4 of 5" to a screen reader.
  - `design.spec` passes for `#day/2026-10-17`, `#day/2026-10-10` (empty) and `#day/2026-10-14` (mood only on `days[]`).
  - axe AA passes with folds closed and open, light and dark.
  - Keyboard flow is unchanged: Enter and Space toggle folds, ticking keeps focus, and adding focuses the new box.

## Builder 3 — Periods and trends

**Owns:** `next/js/views/period.js`, `next/js/trends.js` and `next/css/period.css`.

**Do:**
- **Emoji:** add the fold emoji from the map to every fold: At a glance 📈, children 🗓️, Plan, Focus or Vision 🧭, Goals 🎯, Review 🔍, Choices 🔀, Habits 🔁, last period's to-dos ↩️, To-dos ✅.
- **At a glance:** two chips for the period averages, mood and energy, each rounded to the nearest dot. The exact average shows as text, for example "3.3".
  - Check-ins appear as a dot row of `max = days in the period so far`, labelled "Check-ins 4 of 7".
- **Children list** (Days, Weeks, Months, Quarters): one compact 36px row per child: link text, then a mood dot (filled when there's a check-in), then "mood 4" or "no check-in". Remove any big number.
- **Goals:** each goal row is `Thesis` + `dots(score, 5, "Thesis score")` + `next` text.
  - The closed summary stays "Goals · thesis 3/5".
- **Enjoyment:** green, yellow and red stay as the words Good, Mixed and Rough, with a neutral chip. Never use red colour.
- **Trends chart:** take the series colours from `--jn-s0…--jn-s6`.
  - Mood is a solid line, energy is dashed (keep the shape cue), and the points are small dots (r ≤ 3).
  - Keep the data-table fold and keyboard access.
- **Text filtering:** run all Grok-written period fields through `JournalUI.plain()`: enjoyment, why, oneThing, wins, accomplishments, improve, rootCause, grateful, lesson, watch, goals.*.progress and .next, difficulty, audit, and the quarter and year fields.
- **Acceptance at 360px, with the fixture:**
  - Week with folds closed is at most 900px tall.
  - "Great week!!" shows as "Great week.".
  - The glance chips read "Mood 3 of 5" and "Energy 3 of 5", with the exact average next to each.
  - The children rows link to the right child keys.
  - `design.spec` passes for `#week/2026-W42`, `#month/2026-10`, `#quarter/2026-Q4` and `#year/2026`.
  - axe AA passes with folds closed and open, light and dark.
  - The breadcrumb and child-link keyboard flow are unchanged.

## Builder 4 — Habits and reflections

**Owns:**
- `next/js/views/habits.js`
- `next/css/habits.css`
- `next/js/views/reflect.js`
- `next/css/reflect.css`
- `next/tests/habits.spec.mjs`

**Do:**
- **Habits, emoji:** fold emoji Today 📅, Streaks 🔥, Year in days 🗓️, Week by week 📊, Month by month 📈.
- **Habits, Today:** the closed row shows "Today · 5 of 7 done" plus a row of 7 small dots (`aria-hidden`; the text says it).
  - The open list is compact 32px rows of `emoji Label … status`.
  - Done is filled accent, Not done is a neutral solid outline (not red), Unknown is a dashed outline.
- **Habits, Streaks:** replace the big tiles (1.6rem number) with compact rows: `emoji Label · 4 days · best 7 · today Done`, where the whole row is the 32px+ select button with `aria-pressed`.
  - The Health link for body habits stays as a separate link in the row.
  - No big numbers and no rings.
- **Habits, charts and heatmap:**
  - Remove every `#9f1239` and `#9a3412`. A missed heat cell gets a neutral slate outline.
  - The series use `--jn-s0…--jn-s6`, and rate bars use the same series colours.
  - Keep the stripes for unknown, the legend and the roving-tabindex keyboard model.
- **Habits, text:** run habit labels through `JournalUI.plain()` ("Read!" shows as "Read."). Keep the "no XP, levels, win days, surprises or linchpin" guard in `habits.spec`.
- **Reflections:**
  - Fold emoji 🪞 on `day:reflection` and `year:reflection:<year>`. Inner question folds carry no emoji.
  - The answer box has 4 rows at 360px, and the Save button is 32px.
  - "That answer is already saved." and "Write an answer first." are neutral notes, not error-coloured.
  - Saved answers render with `data-own` and unchanged text ("Yes!" shows as typed).
  - Question texts come from data, so run them through `plain()`.
- **Acceptance at 360px, with the fixture:**
  - Habits with folds closed is at most 520px tall.
  - No `#9f1239` or `#9a3412` anywhere in computed styles.
  - Every habit row has exactly one emoji.
  - `habits.spec` passes with 32px targets (24px floor), Tab reaching every control, and arrow keys working in the charts.
  - `design.spec` passes for `#habits`, `#habits/thesis` and the day and year reflection folds.
  - Reflections: saving A then B keeps both, and saving A twice keeps one ("already saved").
  - axe AA passes with folds closed and open, light and dark.

## Merge order

1. Builder 1 goes first: its helpers and tokens are what the others build on.
2. Builders 2, 3 and 4 follow, in any order. Each rebases on `main` after builder 1 merges.
3. The integrator runs every spec and checks `/journal/next/` live at 360px, then merges.

## After the pass: redoing the cutover

PR #20 was merged and then reverted on `main` (revert commit `4f73154`). Git won't re-apply a reverted merge from the same branch.

To redo the cutover, open a new PR that either reverts the revert (`git revert 4f73154`) on a fresh branch from `main` and then adjusts paths for files added since, or repeats the move (`next/*` to the root) from scratch. Then repeat the pre-merge checks:
- the backup
- `verify-roundtrip` with "nothing lost"
- the old app showing "Saved" on each device
- every spec, run with `REDIRECT=1 BASE=https://dong-xuyong.github.io/journal/` after the merge
