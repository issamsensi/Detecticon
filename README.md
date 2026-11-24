# Detecticon

A daily detective puzzle game for Reddit, built with Devvit Web. One puzzle per
day, four suspects, one testimony each, three accusations. Solving on the 1st,
2nd or 3rd try earns **3 / 2 / 1** weekly points; failing earns **0**.

## Architecture

- `src/client/splash.tsx` — inline splash (React + Tailwind).
- `src/client/game/` — Phaser scenes: Intro → Testimony → Accuse → Result.
- `src/server/routes/game.ts` — Hono REST endpoints used by the game client.
- `src/server/core/` — puzzle rotation, game state, Redis, stats, leaderboard.
- `src/shared/` — types, scoring, puzzle JSON, post-data validation.
- `assets/`, `public/assets/` — sprites used by the Phaser scenes.

The game flow uses Hono REST; a small tRPC scaffold is kept from the template
but is not used by gameplay.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — live Devvit playtest (human-run only).
- `npm run build` — build the webview and server bundle.
- `npm run type-check` / `npm run test:types` — TypeScript check.
- `npm run lint` — ESLint.
- `npm run test:unit` — Vitest.
- `npm run test` — types + lint + unit + build.
- `npm run validate` — validate all puzzle JSON files.

`npm run login`, `npm run deploy`, and `npm run launch` are intentionally
human-run only.

## Post-bound puzzles

Every custom post stores `{ date, puzzleId, devOverride? }` in Devvit `postData`.
The server resolves the puzzle from that data, falling back to today's rotation
for older posts that have no post data.

- `date` is the post's UTC day (`YYYY-MM-DD`).
- Old posts remain playable as **practice**: no points, no stats, no comments.
- Dev-override posts are marked `Dev: test puzzle · no points` and are also
  non-scoring / non-sharing.
- The splash and Result screen show that post's own puzzle number and title.

## Redis keys

| Key | Purpose |
| --- | --- |
| `detecticon:progress:{date}:{puzzleId}:{username}` | Per-player attempts/results for one post puzzle. |
| `detecticon:stats:{date}:{puzzleId}` | Aggregate solve counters for one post puzzle. |
| `detecticon:lb:{weekId}` | Current UTC week's scored leaderboard (`ZSET`). |
| `detecticon:daily-post:{date}` | One-post-per-UTC-day reservation. |
| `detecticon:dev:puzzle-override` | Moderator-only puzzle override. |
| `detecticon:howto:{username}` | How-to overlay seen flag. |

Progress and stats use the **post's** date, so an old post can never overwrite
today's game. The leaderboard is only touched for today's non-override posts.
Progress stores `awardedWeekId` so a moderator reset can remove points from the
week they were actually awarded in.

## Moderator/dev actions

Registered menu actions in `devvit.json` allow resetting the current player's
progress, today's stats, the weekly leaderboard, or the test puzzle override.
Resetting progress reads the stored award before deleting the progress hash, then
subtracts those points from `detecticon:lb:{awardedWeekId}`. Clear the override
before public/review posts; the override itself remains available for testing.

## Submission checks

Run `npm run validate`, then `npm run test`. Confirm no dev puzzle override is
active on the public/review post. No login/deploy/launch commands are run by the
agent.
