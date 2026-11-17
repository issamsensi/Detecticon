import { describe, expect, test } from 'vitest';
import { formatPointsEarned, pointsForAttempts } from './scoring';

describe('pointsForAttempts', () => {
  test('awards 2 points for a correct first accusation', () => {
    expect(pointsForAttempts(1, true)).toBe(2);
  });

  test('awards 1 point for a correct second accusation', () => {
    expect(pointsForAttempts(2, true)).toBe(1);
  });

  test('awards nothing on the third attempt or after a failed case', () => {
    expect(pointsForAttempts(3, true)).toBe(0);
    expect(pointsForAttempts(3, false)).toBe(0);
    expect(pointsForAttempts(1, false)).toBe(0);
    expect(pointsForAttempts(2, false)).toBe(0);
  });

  test('ignores missing or invalid attempt counts', () => {
    expect(pointsForAttempts(0, true)).toBe(0);
    expect(pointsForAttempts(-1, true)).toBe(0);
  });
});

test('formatPointsEarned handles singular and plural', () => {
  expect(formatPointsEarned(1)).toBe('1 point');
  expect(formatPointsEarned(2)).toBe('2 points');
  expect(formatPointsEarned(0)).toBe('0 points');
});
