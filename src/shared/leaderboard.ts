import { getMsSinceWeekStart } from './week';

/**
 * A week is 604,800,000 ms, so a 1,000,000,000-wide sub-score always stays
 * positive and never spills into the next point bucket. The largest possible
 * weekly score (3 points for each of 7 puzzles) is about 2.2e10, still exactly
 * representable as a Redis double. Higher total points rank first; within the
 * same total, the player who reached it earlier (smaller elapsed time) ranks
 * higher.
 */
export const LEADERBOARD_SCORE_UNIT = 1_000_000_000;

// A week lasts seven days; keep last week's set readable for one extra day.
export const LEADERBOARD_TTL_SECONDS = 8 * 86_400;

export type LeaderboardEntry = {
  rank: number;
  username: string;
  points: number;
};

export type LeaderboardResponse = {
  weekId: string;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  secondsUntilReset: number;
};

export const leaderboardKey = (weekId: string): string => `detecticon:lb:${weekId}`;

export const encodeLeaderboardScore = (points: number, msSinceWeekStart: number): number => {
  // Subtract an extra 1 so the sub-score is always < UNIT and never decodes as
  // an extra point, even for a solve at exactly Monday 00:00 UTC.
  const elapsed = Math.min(Math.max(msSinceWeekStart, 0), LEADERBOARD_SCORE_UNIT - 1);
  return points * LEADERBOARD_SCORE_UNIT + (LEADERBOARD_SCORE_UNIT - 1 - elapsed);
};

export const decodeLeaderboardPoints = (score: number): number =>
  Math.floor(score / LEADERBOARD_SCORE_UNIT);

/** Adds points to a player's stored score, stamping the moment they reached it. */
export const nextLeaderboardScore = (
  currentScore: number | null | undefined,
  pointsToAdd: number,
  now: Date
): number =>
  encodeLeaderboardScore(
    decodeLeaderboardPoints(currentScore ?? 0) + pointsToAdd,
    getMsSinceWeekStart(now)
  );
