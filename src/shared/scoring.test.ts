import { describe, expect, test } from 'vitest';
import {
  formatHowToScoringLine,
  formatPointsDelta,
  formatPointsEarned,
  POINTS_BY_ATTEMPT,
  pointsForAttempts,
} from './scoring';

describe('pointsForAttempts', () => {
  test('exposes the 3/2/1 scoring constants', () => {
    expect(POINTS_BY_ATTEMPT).toEqual([3, 2, 1]);
  });

  test('awards 3 points for a correct first accusation', () => {
    expect(pointsForAttempts(1, true)).toBe(3);
  });

  test('awards 2 points for a correct second accusation', () => {
    expect(pointsForAttempts(2, true)).toBe(2);
  });

  test('awards 1 point for a correct third accusation', () => {
    expect(pointsForAttempts(3, true)).toBe(1);
  });

  test('awards nothing after a failed case', () => {
    expect(pointsForAttempts(1, false)).toBe(0);
    expect(pointsForAttempts(2, false)).toBe(0);
    expect(pointsForAttempts(3, false)).toBe(0);
  });

  test('ignores missing or invalid attempt counts', () => {
    expect(pointsForAttempts(0, true)).toBe(0);
    expect(pointsForAttempts(-1, true)).toBe(0);
    expect(pointsForAttempts(1.5, true)).toBe(0);
    expect(pointsForAttempts(4, true)).toBe(0);
  });
});

test('formatPointsEarned and formatPointsDelta handle singular and plural', () => {
  expect(formatPointsEarned(0)).toBe('0 points');
  expect(formatPointsEarned(1)).toBe('1 point');
  expect(formatPointsEarned(2)).toBe('2 points');
  expect(formatPointsEarned(3)).toBe('3 points');

  expect(formatPointsDelta(0)).toBe('+0 points');
  expect(formatPointsDelta(1)).toBe('+1 point');
  expect(formatPointsDelta(2)).toBe('+2 points');
  expect(formatPointsDelta(3)).toBe('+3 points');
});

test('formatHowToScoringLine derives from POINTS_BY_ATTEMPT', () => {
  expect(formatHowToScoringLine()).toBe(
    '3. Three tries: 3 points on the 1st, 2 on the 2nd, 1 on the 3rd.'
  );
});
