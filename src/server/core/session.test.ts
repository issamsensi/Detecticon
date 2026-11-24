import { redis } from '@devvit/web/server';
import { expect } from 'vitest';
import { test } from '../test';
import {
  DEV_PUZZLE_OVERRIDE_KEY,
  getAllPuzzles,
  getDisplayPuzzleNumber,
  getTodayInfo,
} from './puzzle';
import { selectPuzzleSession } from './session';

test('stored post data selects that post’s puzzle and date', async () => {
  const today = await getTodayInfo();
  const other = getAllPuzzles().find((puzzle) => puzzle.id !== today.puzzle.id);
  if (other === undefined) throw new Error('Need at least two puzzles');

  const session = selectPuzzleSession({ date: today.date, puzzleId: other.id }, today);
  expect(session.puzzle.id).toBe(other.id);
  expect(session.date).toBe(today.date);
  expect(session.displayNumber).toBe(getDisplayPuzzleNumber(today.date));
  expect(session.practice).toBe(false);
});

test('an old post is practice and numbers itself from its own date', async () => {
  const today = await getTodayInfo();
  const oldDate = '2026-11-01';
  const oldPuzzle = getAllPuzzles()[3];
  if (oldPuzzle === undefined) throw new Error('Need at least four puzzles');

  const session = selectPuzzleSession({ date: oldDate, puzzleId: oldPuzzle.id }, today);
  expect(session.puzzle.id).toBe(oldPuzzle.id);
  expect(session.date).toBe(oldDate);
  expect(session.displayNumber).toBe(getDisplayPuzzleNumber(oldDate));
  expect(session.practice).toBe(true);
});

test('missing or invalid post data falls back to today’s puzzle and date', async () => {
  const today = await getTodayInfo();

  for (const postData of [undefined, {}, { date: 'nope', puzzleId: today.puzzle.id }, { date: today.date, puzzleId: 'unknown' }]) {
    const session = selectPuzzleSession(postData, today);
    expect(session.puzzle.id).toBe(today.puzzle.id);
    expect(session.date).toBe(today.date);
    expect(session.displayNumber).toBe(today.displayNumber);
    expect(session.practice).toBe(false);
  }
});

test('dev override is marked both from stored data and from the active key', async () => {
  const today = await getTodayInfo();
  expect(
    selectPuzzleSession(
      { date: today.date, puzzleId: today.puzzle.id, devOverride: true },
      today
    ).devOverride
  ).toBe(true);

  const other = getAllPuzzles().find((puzzle) => puzzle.id !== today.puzzle.id);
  if (other === undefined) throw new Error('Need at least two puzzles');
  await redis.set(DEV_PUZZLE_OVERRIDE_KEY, other.id);
  const overrideToday = await getTodayInfo();
  expect(overrideToday.isDevOverride).toBe(true);
  expect(overrideToday.puzzle.id).toBe(other.id);

  const fallback = selectPuzzleSession(undefined, overrideToday);
  expect(fallback.puzzle.id).toBe(other.id);
  expect(fallback.devOverride).toBe(true);
  expect(fallback.practice).toBe(false);
});
