# Journal writer contract

Write the user's journal into the private GitHub repo `Dong-Xuyong/progress-sync`, file `journal.json`, with the GitHub Contents API. Do not write Obsidian notes. The website reads this file itself.

## File shape

```json
{
  "version": 1,
  "quotes": {
    "2026-10-06": { "text": "Quote of the day.", "updatedAt": "<ISO-8601>" }
  },
  "entries": {
    "<key>": {
      "updatedAt": "<ISO-8601>",
      "fields": {},
      "todos": [ { "id": "t1", "text": "Call bank", "done": false } ]
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

`quotes` is a sibling of `entries`. One object per day key. Grok writes this. The website shows `text` at the top of that day. It is not a field inside the day entry.

- Put the words in `text`. Attribution can sit at the end of the same string.
- Set `updatedAt` on the quote object. A newer stamp wins for that day only.
- When you are only writing the quote, leave `entries` unchanged.

## Fields

Every field key below goes inside `fields`. `todos` is a sibling of `fields`.

- Day: `mood` (number 1-5), `energy` (number 1-5), `focus` (string), `grateful` (array of 3 strings), `makeGreat`, `affirmation`, `highlights`, `better`.
- Week: `enjoyment` (`"green"`, `"yellow"`, or `"red"`), `why`, `oneThing`, `wins`, `accomplishments`, `improve`, `rootCause`, `grateful` (array of 3 strings), `lesson`, `watch`.
- Month: `oneThing`, `wins`, `accomplishments`, `improve`, `rootCause`, `goalsReview`.
- Quarter: `q1`, `q2`, `q3`, `q4`, `q5`, `q6`, `mainQuest`, `commit90`, `goingTo`, `wins`, `improve`, `yearProgress`. `q1` is the most important 3-month goal. `q2` is the needle-mover. `q3` is a proud accomplishment. `q4` is what makes everything easier. `q5` is postponed. `q6` is first two hours focus.
- Year: `vision`, `principle`. Year goals are `todos`, and each todo also has `status`: `"none"`, `"progress"`, `"done"`, or `"paused"`. Year review fields: `wins`, `finished`, `differently`, `lessons`.

## Write rules

- Set `updatedAt` to the current UTC ISO-8601 time on every entry you change. The website keeps the entry with the newer `updatedAt`.
- Read the file first, modify it, then PUT with the `sha` from the GET so you never clobber a newer version. On 409, GET again and retry once.
- Never delete an entry you did not intend to change. Preserve every other key and its fields.
- Repo: `Dong-Xuyong/progress-sync`. Path: `journal.json`. API: `PUT https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/journal.json` with `Authorization: Bearer <token>`, `message` `"Save journal progress"`, `content` as base64 of the full JSON, and `sha`.
- Token: a fine-grained PAT with Contents read and write on `Dong-Xuyong/progress-sync` only. Do not put the token in the repo.
