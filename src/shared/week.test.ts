import { describe, expect, test } from 'vitest';
import { formatResetsIn, getWeekId, secondsUntilWeekReset } from './week';

const utc = (year: number, month: number, day: number, hour = 0, minute = 0): Date =>
  new Date(Date.UTC(year, month - 1, day, hour, minute));

describe('getWeekId', () => {
  test('returns the same Monday for every day of the week', () => {
    expect(getWeekId(utc(2026, 11, 16))).toBe('2026-11-16'); // Monday
    expect(getWeekId(utc(2026, 11, 17))).toBe('2026-11-16'); // Tuesday
    expect(getWeekId(utc(2026, 11, 22, 23, 59))).toBe('2026-11-16'); // Sunday
  });

  test('handles a Sunday at the start of a month', () => {
    expect(getWeekId(utc(2026, 11, 1))).toBe('2026-10-26');
  });

  test('handles year boundaries in both directions', () => {
    expect(getWeekId(utc(2027, 1, 1))).toBe('2026-12-28'); // Friday
    expect(getWeekId(utc(2027, 1, 3))).toBe('2026-12-28'); // Sunday
    expect(getWeekId(utc(2027, 1, 4))).toBe('2027-01-04'); // Monday
    expect(getWeekId(utc(2025, 12, 31))).toBe('2025-12-29'); // Wednesday
  });
});

test('secondsUntilWeekReset counts down to the next Monday and never goes negative', () => {
  expect(secondsUntilWeekReset(utc(2026, 11, 16))).toBe(7 * 86_400);
  expect(secondsUntilWeekReset(utc(2026, 11, 22, 23, 59))).toBe(60);
  expect(secondsUntilWeekReset(utc(2026, 11, 23))).toBe(7 * 86_400);
});

test('formatResetsIn shows days, hours and minutes', () => {
  expect(formatResetsIn(7 * 86_400)).toBe('Resets in 7d 00:00');
  expect(formatResetsIn(3 * 86_400 + 4 * 3600 + 12 * 60)).toBe('Resets in 3d 04:12');
  expect(formatResetsIn(-1)).toBe('Resets in 0d 00:00');
});
