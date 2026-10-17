# Journal writer contract

Write the user's journal into the private GitHub repo `Dong-Xuyong/progress-sync`, file `journal.json`, with the GitHub Contents API. Do not write Obsidian notes. The website reads this file itself.

## File shape

```json
{
  "version": 1,
  "habitDefs": [
    { "id": "thesis", "label": "Thesis", "emoji": "📝" },
    { "id": "training", "label": "Training", "emoji": "💪" },
    { "id": "food_logged", "label": "Food logged", "emoji": "🍽️" },
    { "id": "weigh_in", "label": "Weigh in", "emoji": "⚖️" },
    { "id": "speaking", "label": "Speaking", "emoji": "🗣️" },
    { "id": "sunlight", "label": "Sunlight", "emoji": "☀️" },
    { "id": "protein_breakfast", "label": "Protein breakfast", "emoji": "🥚" }
  ],
  "quotes": {
    "2026-10-06": { "text": "Quote of the day.", "updatedAt": "<ISO-8601>" }
  },
  "entries": {
    "2026-10-06": {
      "updatedAt": "<ISO-8601>",
      "fields": {},
      "todos": [ { "id": "t1", "text": "Call bank", "done": false } ],
      "habits": { "thesis": true, "training": false, "sunlight": null },
      "habitStreaks": { "thesis": 4, "training": 0, "sunlight": 0 }
    }
  }
}
```

## Keys

Keys use the same names as the Obsidian notes.

- Day: `YYYY-MM-DD` (example `2026-10-06`)
- Week: ISO week `GGGG-Www`, zero-padded (example `2026-W41`). `2026-12-31` is `2026-W53`.
- Month: `YYYY-MM` (example `2026-10`)
- Quarter: `YYYY-Q1` through `YYYY-Q4` (example `2026-Q4`)
- Year: `YYYY` (example `2026`)

## Quote of the day

`quotes` is a sibling of `entries`. One object per day key. Grok writes this. The website keeps it and does not render it. It is not a field inside the day entry.

- Put the words in `text`. Attribution can sit at the end of the same string.
- Set `updatedAt` on the quote object. A newer stamp wins for that day only.
- When you are only writing the quote, leave `entries` unchanged.

## Habits

`habitDefs` is a top-level array, a sibling of `entries` and `quotes`. Order is the display order on the Habits tab. Each item is `{ "id", "label", "emoji" }`. Ids stay stable. The current ids are `thesis`, `training`, `food_logged`, `weigh_in`, `speaking`, `sunlight`, and `protein_breakfast`.

`habits` and `habitStreaks` belong on day entries only (`YYYY-MM-DD`). Omit them on week, month, quarter, and year entries. Omit `habits` entirely when that day has no habit log. Do not fill a missing day with `false`.

- `habits[id]` is `true` (done), `false` (not done), or `null` (unknown). Unknown is not the same as not done. Show it as unknown. A missing id on a logged day is also unknown.
- `habitStreaks[id]` is the integer run of consecutive `true` days for that id ending on that day, including that day. `false`, `null`, and a calendar day with no `habits` object all break the run and count as not done. Use `0` when that day is not `true`.
- The website recomputes streaks from `habits`, so a stale `habitStreaks` still displays correctly. Write `habitStreaks` anyway for other readers.
- If `habitDefs` is missing, the website falls back to the seven ids above. It does not write that fallback into the file.

## Fields

Every field key below goes inside `fields`. `todos` is a sibling of `fields`.

- Day: `mood` (number 1-5), `energy` (number 1-5), `focus` (string), `grateful` (array of 3 strings), `makeGreat`, `affirmation`, `highlights`, `better`.
- Week: `enjoyment` (`"green"`, `"yellow"`, or `"red"`), `why`, `oneThing`, `wins`, `accomplishments`, `improve`, `rootCause`, `grateful` (array of 3 strings), `lesson`, `watch`.
- Month: `oneThing`, `wins`, `accomplishments`, `improve`, `rootCause`, `goalsReview`.
- Quarter: `q1`, `q2`, `q3`, `q4`, `q5`, `q6`, `mainQuest`, `commit90`, `goingTo`, `wins`, `improve`, `yearProgress`. `q1` is the most important 3-month goal. `q2` is the needle-mover. `q3` is a proud accomplishment. `q4` is what makes everything easier. `q5` is postponed. `q6` is first two hours focus.
- Year: `vision`, `principle`. Year goals are `todos`, and each todo also has `status`: `"none"`, `"progress"`, `"done"`, or `"paused"`. Year review fields: `wins`, `finished`, `differently`, `lessons`.

## Optional practice fields

Omit any of these when you have nothing to write. The website still shows the prompt. Do not invent empty strings just to fill the template.

Day fields live on the day entry, inside `fields`:

- `priorities`: array of up to 3 strings, the day's top items. If you omit it, the website uses `top3`, then up to 3 to-dos marked `mit: true`, then the first to-dos with text.
- `failureCost`: string. What happens if priority 1 does not get done today.
- `ifThen`: string. The main obstacle and the if-then plan.
- `wins`: array of strings. Name the effort, not only the result. This is not the week `wins` paragraph.
- `lesson`: string. This is not the week `lesson`.
- `feeling`: string. One precise emotion word, shown next to mood and energy.
- `chosenVsMomentum`: string. What was chosen today versus done on autopilot.
- `tomorrow`: array of up to 3 strings.

A day to-do may include `"mit": true` when it is one of the most important tasks. That flag is optional. When `priorities` and `top3` are both empty, the website uses those to-dos as the priorities list.

## Mirror / Morning Brief fields

The Mirror app may write these keys on a day entry, inside `fields`. Leave them in place. Do not delete them, and do not rebuild `fields` from a fixed list.

- `top3`: up to 3 items from the morning brief. Each item is a string, or an object with `text`, `title`, `label`, or `name`. When `priorities` is empty, the website shows `top3` as the priorities list and notes that it came from this morning's top 3.
- `top3UpdatedAt`: when the morning brief last wrote `top3`. The website keeps it and does not render it.
- `moodMeter`: a number. When `mood` is empty and `moodMeter` is 1–5, the website shows and charts it as mood. It does not copy `moodMeter` into `mood`.
- `sleep`, `sunlight`, `caffeine`: morning-brief values. The website keeps them and does not render them.

Week and month fields live on that entry, inside `fields`:

- `goals`: object with `thesis`, `career`, and `health`. Each value is `{ "progress": string, "score": number 1-5, "next": string }`. Omit a goal you are not tracking.
- `difficulty`: string. Too easy, too hard, or about right.
- `audit`: string. A chosen-versus-momentum review for the week or month.

`goals` is not `goalsReview`. Keep the existing review fields as they are.

## Reflections

`reflections` is an optional top-level object, a sibling of `entries` and `quotes`. Omit the key until there is something to store. The website shows the nine questions below when the key is missing, and it writes the key on the first saved answer.

```json
{
  "questions": [ { "id": "q1", "text": "If I knew I couldn't fail, what would I like to do?" } ],
  "answers": { "q1": [ { "date": "2026-10-17", "text": "Write the book." } ] }
}
```

- `questions` is `{ "id", "text" }`. Ids stay stable. The website rotates the question of the day by date through this list.
- `answers` is append-only. Each value is an array of `{ "date", "text" }`. `date` is the day key `YYYY-MM-DD`. Add a new object. Do not edit or delete an earlier answer.
- The same `date` and `text` should appear once. A later different answer on that day is a new object.
- On sync, the website keeps every answer from either copy and keeps the remote question text when both copies have that id.

If `questions` is missing or empty, the website uses these, in order:

1. `q1`. If I knew I couldn't fail, what would I like to do?
2. `q2`. Even if I knew I would fail, what would I like to do anyway?
3. `q3`. If I had all the time and money in the world, but I had to use 40 hours a week to be of service to other people, what would I do?
4. `q4`. If I was giving a TED talk 40 years from now and the audience is giving it a standing ovation, what would I like to have talked about?
5. `q5`. What do I want people to say about me at my funeral?
6. `q6`. What do I want written about myself in my obituary?
7. `q7`. If I continued on this exact path, where would I end up five years from now? And is that where I want to end up?
8. `q8`. If I took a completely different path to what I'm doing right now, where might I end up five years from now?
9. `q9`. If I took a completely different path and did not care about money or what other people thought of me, where might I end up?

## Write rules

- Set `updatedAt` to the current UTC ISO-8601 time on every entry you change. The website keeps the entry with the newer `updatedAt`.
- The user edits `todos` and reflection answers on the website, and it saves them back to this file automatically. Always read the latest file before writing so you keep the user's ticked, added, edited, or deleted to-dos and any reflection answers.
- Read the file first, modify it, then PUT with the `sha` from the GET so you never clobber a newer version. On 409, GET again and retry once.
- Never delete an entry you did not intend to change. Preserve every other key and its fields.
- Preserve top-level `habitDefs`, `reflections`, and any other top-level keys you are not editing. Preserve `habits` and `habitStreaks` on day entries. The website keeps those when it saves, and a save that rebuilds the file without them will wipe the habit log or the reflection answers.
- Repo: `Dong-Xuyong/progress-sync`. Path: `journal.json`. API: `PUT https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/journal.json` with `Authorization: Bearer <token>`, `message` `"Save journal progress"`, `content` as base64 of the full JSON, and `sha`.
- Token: a fine-grained PAT with Contents read and write on `Dong-Xuyong/progress-sync` only. Do not put the token in the repo.
