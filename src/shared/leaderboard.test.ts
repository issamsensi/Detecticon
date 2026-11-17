import { describe, expect, test } from 'vitest';
import {
  decodeLeaderboardPoints,
  encodeLeaderboardScore,
  leaderboardKey,
  LEADERBOARD_SCORE_UNIT,
  nextLeaderboardScore,
} from './leaderboard';

describe('leaderboard score encoding', () => {
  test('points outrank elapsed time, and earlier solves outrank later ones', () => {
    const lateSinglePoint = encodeLeaderboardScore(1, 600_000_000);
    const earlySinglePoint = encodeLeaderboardScore(1, 1_000);
    const lateTwoPoints = encodeLeaderboardScore(2, 600_000_000);

    expect(earlySinglePoint).toBeGreaterThan(lateSinglePoint);
    expect(lateTwoPoints).toBeGreaterThan(earlySinglePoint);
  });

  test('the time part never spills into another point bucket', () => {
    const lastMsOfWeek = 7 * 86_400 * 1000;
    expect(encodeLeaderboardScore(1, lastMsOfWeek)).toBeLessThan(2 * LEADERBOARD_SCORE_UNIT);
    expect(decodeLeaderboardPoints(encodeLeaderboardScore(1, lastMsOfWeek))).toBe(1);
    expect(decodeLeaderboardPoints(encodeLeaderboardScore(2, 0))).toBe(2);
  });

  test('adds points to an existing weekly total', () => {
    const now = new Date(Date.UTC(2026, 10, 17, 12));
    const first = nextLeaderboardScore(null, 2, now);
    const second = nextLeaderboardScore(first, 1, now);
    expect(decodeLeaderboardPoints(first)).toBe(2);
    expect(decodeLeaderboardPoints(second)).toBe(3);
  });

  test('uses one sorted set per week', () => {
    expect(leaderboardKey('2026-11-16')).toBe('detecticon:lb:2026-11-16');
  });
});
