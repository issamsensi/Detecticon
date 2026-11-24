# Detecticon

A daily detective puzzle game for Reddit, built for Reddit's Game of the Day
Hackathon. Four suspects give one testimony each as pixel characters, then the
player has three chances to identify the killer.

Built with Devvit Web: React + Tailwind for the inline splash, Phaser for the
expanded game, Hono + Redis on the server, and TypeScript shared between client
and server. The game is English-only, mobile-first, and plays inside a fixed
360×640 canvas.

> The detective is original: **Inspector Quill**. Do not reuse names,
> characters, or traits from existing detective franchises.

## Contents

- [How a round works](#how-a-round-works)
- [Scoring and sharing](#scoring-and-sharing)
- [Post-bound puzzles](#post-bound-puzzles)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Adding a puzzle](#adding-a-puzzle)
- [Redis keys](#redis-keys)
- [Moderator tools](#moderator-tools)
- [Submission checklist](#submission-checklist)

## How a round works

1. The inline splash shows the post's puzzle number and title, plus any
   practice/dev badge.
2. The expanded Phaser game opens the case file, then plays each testimony in
   order with a typewriter speech bubble.
3. After all four testimonies, the suspects line up and the player picks the
   killer.
4. A wrong pick reveals that suspect's `alibiProof`, removes them from the line,
   and costs one attempt.
5. The Result screen shows the outcome, the share text, today's solve stats, and
   the weekly leaderboard.

The player has **three attempts**. A correct pick ends the case immediately.

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
  "date": "2026-12-05",
  "puzzleId": "001",
  "devOverride": true
}
```

- `date` is the UTC day the post was created (`YYYY-MM-DD`).
- `puzzleId` is the puzzle chosen for that post.
- `devOverride` is optional and only marks moderator test posts.

`resolvePuzzleSession()` prefers this stored data. Posts created before
`postData` existed fall back to the current daily rotation.

- If the stored date is not today, the post is **practice**: fully playable, but
  no points, no stats, and no comment share.
- If a dev override was active when the post was created, it is marked
  `Dev: test puzzle · no points` and is also non-scoring and non-sharing.
- The splash and Result screen show that post's own puzzle number and title,
  not whatever the rotation happens to be today.

The daily post is created at 00:05 UTC by the scheduler, or on demand from the
moderator menu. A `detecticon:daily-post:{date}` reservation prevents duplicate
posts for the same UTC day.

## Architecture

- `src/client/splash.tsx` — fast inline splash (React + Tailwind).
- `src/client/game/` — Phaser game at 360×640:
  `Preload → Intro → CaseFile → Testimony → Accuse → Result`, with
  `Leaderboard` and `Credits` scenes.
- `src/server/routes/game.ts` — public Hono REST API used by the game client.
- `src/server/routes/menu.ts`, `dev.ts`, `triggers.ts` — moderator, dev, and
  scheduler endpoints registered in `devvit.json`.
- `src/server/core/` — session resolution, puzzle rotation, game state, stats,
  leaderboard, post creation, and dev actions.
- `src/shared/` — types, scoring, week helpers, post-data validation, and
  puzzle JSON.
- `assets/`, `public/assets/` — pixel sprites and media.
- `devvit.json` — entrypoints, menu actions, scheduler, forms, and permissions.

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

A tRPC scaffold remains from the Devvit template but is not used by gameplay.

## Getting started

Requires Node 24+ (see `package.json`) and the Devvit CLI.

```bash
npm install
npm run validate
npm run test
npm run dev
```

`npm run dev` starts a live Devvit playtest and requires a human with Reddit
login. Agent workflows do not run `login`, `deploy`, `launch`, or any reset
action.

## Commands

| Command                                                         | What it does                           |
| --------------------------------------------------------------- | -------------------------------------- |
| `npm run validate`                                              | Validate every puzzle JSON file.       |
| `npm run type-check` / `npm run test:types`                     | TypeScript check.                      |
| `npm run lint`                                                  | ESLint over `src/**/*.{ts,tsx}`.       |
| `npm run test:unit`                                             | Run all Vitest tests.                  |
| `npm run test:unit -- src/server/core/game.integration.test.ts` | Run one test file.                     |
| `npm run test`                                                  | Types + lint + unit + build.           |
| `npm run build`                                                 | Build the webview and server bundle.   |
| `npm run dev`                                                   | Live Devvit playtest (human-run only). |
| `npm run login`, `npm run deploy`, `npm run launch`             | Human-run only.                        |

## Adding a puzzle

Add `src/shared/puzzles/NNN.json` and follow the existing files. Puzzles are
loaded in filename order and the daily rotation cycles by UTC day from
2026-01-01. Display numbering is anchored to the planned launch date,
2026-12-05.

Each puzzle has `id`, `number`, `title`, `scene`, and exactly four `suspects`.
Each suspect has `id`, `name`, `role`, `color`, `testimony`, and `isKiller`.

- Exactly one suspect has `isKiller: true`.
- The killer has a `contradiction` and no `alibiProof`.
- Every innocent has an `alibiProof` and no `contradiction`.
- Puzzle ids and suspect names must be unique across the whole set.
- Suspect first names must exist in `src/shared/suspect-sprites.ts` so they can
  be matched to a pixel sprite.
- Text values must be non-empty and under 160 characters.
- Killer positions should stay balanced; no position may exceed 35% of all
  puzzles.
- The `scene` must not contain the template phrase `One of the four`.

Run `npm run validate` after adding or editing any puzzle. Do not change the
JSON schema without discussing it first.

## Redis keys

| Key                                                | Purpose                                               |
| -------------------------------------------------- | ----------------------------------------------------- |
| `detecticon:progress:{date}:{puzzleId}:{username}` | Per-player attempts, eliminations, and result flags.  |
| `detecticon:stats:{date}:{puzzleId}`               | Aggregate solve counters for one post puzzle.         |
| `detecticon:lb:{weekId}`                           | Weekly leaderboard sorted set.                        |
| `detecticon:daily-post:{date}`                     | One-post-per-UTC-day reservation and created post id. |
| `detecticon:dev:puzzle-override`                   | Moderator-only puzzle override.                       |
| `detecticon:howto:{username}`                      | How-to overlay seen flag.                             |

Progress and stats use the **post's** date, so old posts can never overwrite
today's game. The weekly board uses the UTC week in which points were earned.
Progress stores `awardedWeekId`, so a reset after a week rollover still removes
points from the correct board.

## Moderator tools

Menu actions are registered in `devvit.json`:

- Create a new post / create today's post.
- Reset my progress for today.
- Reset today's stats.
- Set or clear the test puzzle override.
- Reset this week's leaderboard.

Resetting progress reads the stored `awardedWeekId` and points before deleting
the progress hash, then subtracts those points from the right weekly board.
Clear the puzzle override before public or review posts. Test plays made while
the override is active are visibly marked and never score.

## Submission checklist

1. Clear the dev puzzle override.
2. Confirm the review post's `postData` has the expected `date`, `puzzleId`, and
   no `devOverride`.
3. Run `npm run validate`.
4. Run `npm run test`.
5. Confirm a full play through Intro → Testimony → Accuse → Result on a
   phone-sized view.
6. A human runs the final login/deploy/launch commands.
