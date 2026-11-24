import { describe, expect, test } from 'vitest';
import {
  buildPuzzlePostData,
  isUtcDateString,
  parsePuzzlePostData,
} from './post-data';

describe('isUtcDateString', () => {
  test('accepts real UTC dates', () => {
    expect(isUtcDateString('2026-12-05')).toBe(true);
    expect(isUtcDateString('2026-02-28')).toBe(true);
  });

  test('rejects malformed and impossible dates', () => {
    expect(isUtcDateString('2026-2-5')).toBe(false);
    expect(isUtcDateString('2026-02-31')).toBe(false);
    expect(isUtcDateString('not-a-date')).toBe(false);
    expect(isUtcDateString(20261205)).toBe(false);
  });
});

describe('parsePuzzlePostData', () => {
  test('reads stored date and puzzle id', () => {
    expect(parsePuzzlePostData({ date: '2026-11-24', puzzleId: '017' })).toEqual({
      date: '2026-11-24',
      puzzleId: '017',
    });
  });

  test('rejects missing, invalid or array data', () => {
    expect(parsePuzzlePostData(undefined)).toBeNull();
    expect(parsePuzzlePostData(null)).toBeNull();
    expect(parsePuzzlePostData([])).toBeNull();
    expect(parsePuzzlePostData({ date: '2026-11-24' })).toBeNull();
    expect(parsePuzzlePostData({ puzzleId: '017' })).toBeNull();
    expect(parsePuzzlePostData({ date: '2026-13-01', puzzleId: '017' })).toBeNull();
    expect(parsePuzzlePostData({ date: '2026-11-24', puzzleId: '' })).toBeNull();
  });
});

test('buildPuzzlePostData stores date and puzzleId', () => {
  expect(buildPuzzlePostData({ date: '2026-11-24', puzzleId: '017' })).toEqual({
    date: '2026-11-24',
    puzzleId: '017',
  });
});
