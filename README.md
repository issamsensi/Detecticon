# Detecticon

A daily detective puzzle for Reddit. Four suspects, four testimonies, three accusations,
and a tiny grid of 🟥🟩 to share in the comments. Built for Reddit's Game of the Day Hackathon.

## Play it

- **Demo post:** <TODO link to a public post>
- **Test subreddit:** r/Detecticon
- **App listing:** https://developers.reddit.com/apps/detecticon

## How to play

1. Read the case, then listen to four suspects, one testimony each.
2. One of them is lying. Find the testimony that doesn't add up. You can reopen the
   Case file at any time.
3. You have three tries. A wrong pick clears that suspect and shows their alibi.
4. Score: **3 points** for solving on the 1st try, **2** on the 2nd, **1** on the 3rd,
   **0** if you fail. Share your result as a comment, e.g. `Detecticon #12 🟥🟩`, and
   climb the weekly ranking.

## Built for Reddit

- A new post is created automatically every day at 00:05 UTC. Each post keeps its own
  puzzle; older posts stay playable as practice (no points).
- Results are shared as comments, once per player per puzzle.
- Weekly leaderboard (resets Monday 00:00 UTC); ties go to whoever finished first.
- Daily solve statistics are shown after each case.

## Credits

Pixel characters were generated with the Universal LPC Spritesheet Character Generator
(Liberated Pixel Cup contributors). Full per-asset credits and licenses are in
[CREDITS.md](./CREDITS.md).

---

# Technical details

## Contents

- [Detecticon](#detecticon)
  - [Play it](#play-it)
  - [How to play](#how-to-play)
  - [Built for Reddit](#built-for-reddit)
  - [Credits](#credits)
- [Technical details](#technical-details)
  - [Contents](#contents)
  - [Scoring and sharing](#scoring-and-sharing)
  - [Post-bound puzzles](#post-bound-puzzles)
  - [Architecture](#architecture)
  - [Getting started](#getting-started)
  - [Commands](#commands)
  - [Adding a puzzle](#adding-a-puzzle)
  - [Redis keys](#redis-keys)

## Scoring and sharing

Scoring is shared by client and server in `src/shared/scoring.ts`:

| Outcome           | Points | Share square |
| ----------------- | ------ | ------------ |
| Correct on try 1  | 3      | 🟩           |
| Correct on try 2  | 2      | 🟥🟩         |
| Correct on try 3  | 1      | 🟥🟥🟩       |
| Failed in 3 tries | 0      | 🟥🟥🟥       |

Example share text: `Detecticon #12 🟥🟥🟩`.

Points go to a weekly leaderboard keyed by the UTC Monday (`getWeekId`). Ties
are broken by finish time. The board resets Monday 00:00 UTC. Only one award is
granted per player per post puzzle via the `statsCounted` progress guard.

Share-to-comments is claimed atomically with Redis `WATCH`/`MULTI` before Reddit
is called, so a double tap cannot post the same result twice. If Reddit rejects
the comment, the claim is rolled back.

## Post-bound puzzles

Every custom post stores its own puzzle in Devvit `postData`:

```json
{
  "date": "2026-11-24",
  "puzzleId": "001"
}
```

- `date` is the UTC day the post was created (`YYYY-MM-DD`).
- `puzzleId` is the puzzle chosen for that post.

`resolvePuzzleSession()` prefers this stored data. Posts created before
`postData` existed fall back to the current daily puzzle.

- If the stored date is not today, the post is **practice**: fully playable, but
  no points, no stats, and no comment share.
- The splash, Case file, and Result screen show that post's own puzzle number
  and title, not whatever the rotation happens to be today.

The daily post is created automatically at 00:05 UTC by the scheduler, and a
moderator can also create today's post on demand from the subreddit menu. A
`detecticon:daily-post:{date}` reservation prevents duplicate posts for the same
UTC day.

## Architecture

- `src/client/splash.tsx` — fast inline splash (React 19 + Tailwind CSS 4).
- `src/client/game/` — Phaser 4 game at 360×640:
  `Preload → Intro → Testimony → Accuse → Result`, with `CaseFile` (opened from
  `Accuse`), `Leaderboard`, and `Credits` scenes.
- `src/server/routes/game.ts` — public Hono REST API used by the game client.
- `src/server/routes/menu.ts`, `triggers.ts` — moderator post-creation, install
  trigger, and daily scheduler endpoints registered in `devvit.json`.
- `src/server/core/` — session resolution, puzzle schedule/rotation, game state,
  stats, leaderboard, post creation, and moderator checks.
- `src/shared/` — types, scoring, schedule, week helpers, post-data validation,
  credits, and puzzle JSON.
- `public/assets/` — pixel sprites and media.
- `devvit.json` — entrypoints, menu action, scheduler, triggers, and permissions.

Gameplay uses REST under `/api`:

| Endpoint                | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `GET /api/puzzle/today` | Resolve this post's puzzle and current progress. |
| `POST /api/accuse`      | Submit a suspect id and get the reveal/progress. |
| `POST /api/share`       | Claim and post the shareable result comment.     |
| `GET /api/stats/today`  | Solve counters for this post's puzzle.           |
| `GET /api/leaderboard`  | Current UTC week's top 10 and the player's rank. |
| `GET /api/seen-howto`   | Read the how-to overlay flag.                    |
| `POST /api/seen-howto`  | Mark the how-to overlay as seen.                 |

## Getting started

Requires Node 24+ (see `package.json` and `.nvmrc`) and the Devvit CLI.

```bash
npm install
npm run validate
npm run test
npm run dev
```

`npm run dev` starts a live Devvit playtest and requires Reddit login.

## Commands

| Command                                                         | What it does                                   |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `npm run validate`                                              | Validate all puzzle JSON files and schedule.   |
| `npm run type-check` / `npm run test:types`                     | TypeScript check.                              |
| `npm run lint`                                                  | ESLint over `src/**/*.{ts,tsx}`.               |
| `npm run test:unit`                                             | Run all Vitest tests.                          |
| `npm run test:unit -- src/server/core/game.integration.test.ts` | Run one test file.                             |
| `npm run test`                                                  | Types + lint + unit + build.                   |
| `npm run build`                                                 | Build the webview and server bundle.           |
| `npm run dev`                                                   | Live Devvit playtest.                          |
| `npm run login`                                                 | Authenticate with the Devvit CLI.              |
| `npm run deploy`                                                | Run checks and upload the app to Devvit.       |
| `npm run launch`                                                | Deploy and publish the app on Devvit.          |

## Adding a puzzle

Add `src/shared/puzzles/NNN.json` and follow the existing files. Puzzles are
loaded in filename order. For a given UTC date, puzzle selection follows this
resolution order:

1. **Schedule** (`src/shared/schedule.json`) — explicit `YYYY-MM-DD` → puzzle id
   mapping for that UTC date.
2. **Date-based rotation** — deterministic UTC day cycle anchored at
   `2026-11-24` UTC. Displayed puzzle numbering (`#1`, `#2`, …) is anchored at
   the `2026-12-05` UTC launch date (`daysSinceLaunch + 1`, clamped to `1`).

Each puzzle has `id`, `number`, `title`, `scene`, and exactly four `suspects`.
Each suspect has `id`, `name`, `role`, `color`, `testimony`, and `isKiller`.

- Exactly one suspect has `isKiller: true`.
- The killer has a `contradiction` and no `alibiProof`.
- Every innocent has an `alibiProof` and no `contradiction`.
- Puzzle ids and suspect names must be unique across the whole set.
- Suspect first names must exist in `src/shared/suspect-sprites.ts` so they can
  be matched to a pixel sprite.
- Text values must be non-empty and at most 160 characters.
- Killer positions must stay balanced; no position may exceed 35% of all
  puzzles.
- The `scene` must not contain the phrase `One of the four`.
- In `src/shared/schedule.json`, every date must be a valid, unique UTC
  `YYYY-MM-DD`, every scheduled puzzle id must exist, and the validator rejects
  any puzzle id scheduled twice within 8 days.

Run `npm run validate` after adding or editing any puzzle or schedule entry.

## Redis keys

| Key                                                | Purpose                                               |
| -------------------------------------------------- | ----------------------------------------------------- |
| `detecticon:progress:{date}:{puzzleId}:{username}` | Per-player attempts, eliminations, and result flags (90-day TTL). |
| `detecticon:stats:{date}:{puzzleId}`               | Aggregate solve counters for one post puzzle (90-day TTL).        |
| `detecticon:lb:{weekId}`                           | Weekly leaderboard sorted set (8-day TTL).                        |
| `detecticon:daily-post:{date}`                     | One-post-per-UTC-day reservation and created post id (90-day TTL). |
| `detecticon:seen-howto:{username}`                 | How-to overlay seen flag.                                         |

Progress and stats use the **post's** date, so old posts can never overwrite
today's game. The weekly board uses the UTC week in which points were earned.
