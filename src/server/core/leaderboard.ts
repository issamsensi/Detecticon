import { redis, reddit } from '@devvit/web/server';
import {
  decodeLeaderboardPoints,
  LEADERBOARD_SCORE_UNIT,
  leaderboardKey,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from '../../shared/leaderboard';
import { getWeekId, secondsUntilWeekReset } from '../../shared/week';

const TOP_LIMIT = 10;

/**
 * Redis key: detecticon:lb:{weekId}
 * - Sorted set, member = Reddit username, score = encoded (points, finish time).
 * - Only players with at least one point are ever added.
 * - A TTL keeps finished weeks from accumulating forever.
 */
export const getLeaderboard = async (now: Date = new Date()): Promise<LeaderboardResponse> => {
  const weekId = getWeekId(now);
  const key = leaderboardKey(weekId);
  // zRange with by:'rank' + reverse:true returns highest scores first.
  const top = await redis.zRange(key, 0, TOP_LIMIT - 1, { by: 'rank', reverse: true });
  const total = await redis.zCard(key);

  const entries: LeaderboardEntry[] = [];
  for (const item of top) {
    const points = decodeLeaderboardPoints(item.score);
    if (points < 1) continue;
    entries.push({ rank: entries.length + 1, username: item.member, points });
  }

  let me: LeaderboardEntry | null = null;
  const username = await reddit.getCurrentUsername();
  if (username) {
    const rankIndex = await redis.zRank(key, username);
    const score = rankIndex === undefined ? undefined : await redis.zScore(key, username);
    if (rankIndex !== undefined && score !== undefined) {
      // zRank is 0-based from the lowest score; the displayed board is reversed.
      me = {
        rank: Math.max(1, total - rankIndex),
        username,
        points: decodeLeaderboardPoints(score),
      };
    }
  }

  return { weekId, entries, me, secondsUntilReset: secondsUntilWeekReset(now) };
};

/** Removes points awarded for one puzzle from the week it was awarded in. */
export const revertAwardedPoints = async (
  username: string,
  points: number,
  weekId: string = getWeekId(new Date())
): Promise<void> => {
  if (points <= 0) return;
  const key = leaderboardKey(weekId);
  const score = await redis.zScore(key, username);
  if (score === undefined) return;

  const remaining = decodeLeaderboardPoints(score) - points;
  if (remaining <= 0) {
    await redis.zRem(key, [username]);
    return;
  }
  // Preserve the weekly timestamp; only remove the point bucket being reverted.
  await redis.zAdd(key, {
    member: username,
    score: score - points * LEADERBOARD_SCORE_UNIT,
  });
};

export const clearWeeklyLeaderboard = async (now: Date = new Date()): Promise<string> => {
  const key = leaderboardKey(getWeekId(now));
  await redis.del(key);
  return key;
};
