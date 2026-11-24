import { expect } from 'vitest';
import { test } from '../test';
import {
  getAllPuzzles,
  getDisplayPuzzleNumber,
  getTodayInfo,
  resolvePuzzleForDate,
} from './puzzle';
import { selectPuzzleSession } from './session';

test('stored post data selects that post’s puzzle and date', () => {
  const today = getTodayInfo();
  const other = getAllPuzzles().find((puzzle) => puzzle.id !== today.puzzle.id);
  if (other === undefined) throw new Error('Need at least two puzzles');

  const session = selectPuzzleSession({ date: today.date, puzzleId: other.id }, today);
  expect(session.puzzle.id).toBe(other.id);
  expect(session.date).toBe(today.date);
  expect(session.displayNumber).toBe(getDisplayPuzzleNumber(today.date));
  expect(session.practice).toBe(false);
});

test('an old post is practice and numbers itself from its own date', () => {
  const today = getTodayInfo();
  const oldDate = '2026-11-01';
  const oldPuzzle = getAllPuzzles()[3];
  if (oldPuzzle === undefined) throw new Error('Need at least four puzzles');

  const session = selectPuzzleSession({ date: oldDate, puzzleId: oldPuzzle.id }, today);
  expect(session.puzzle.id).toBe(oldPuzzle.id);
  expect(session.date).toBe(oldDate);
  expect(session.displayNumber).toBe(getDisplayPuzzleNumber(oldDate));
  expect(session.practice).toBe(true);
});

test('missing or invalid post data falls back to today’s puzzle and date', () => {
  const today = getTodayInfo();

  for (const postData of [
    undefined,
    {},
    { date: 'nope', puzzleId: today.puzzle.id },
    { date: today.date, puzzleId: 'unknown' },
  ]) {
    const session = selectPuzzleSession(postData, today);
    expect(session.puzzle.id).toBe(today.puzzle.id);
    expect(session.date).toBe(today.date);
    expect(session.displayNumber).toBe(today.displayNumber);
    expect(session.practice).toBe(false);
  }
});

test('display puzzle number anchors at 2026-11-26 launch date and clamps pre-launch dates to 1', () => {
  const preLaunch = getTodayInfo(new Date(Date.UTC(2026, 10, 24, 12, 0, 0)));
  expect(preLaunch.date).toBe('2026-11-24');
  expect(preLaunch.displayNumber).toBe(1);
  expect(preLaunch.puzzle.id).toBe('001');

  const launchDay = getTodayInfo(new Date(Date.UTC(2026, 10, 26, 12, 0, 0)));
  expect(launchDay.date).toBe('2026-11-26');
  expect(launchDay.displayNumber).toBe(1);
  expect(launchDay.puzzle.id).toBe('004');

  const dayTwo = getTodayInfo(new Date(Date.UTC(2026, 10, 27, 12, 0, 0)));
  expect(dayTwo.date).toBe('2026-11-27');
  expect(dayTwo.displayNumber).toBe(2);
  expect(dayTwo.puzzle.id).toBe('005');
});

test('two-level resolution: schedule entry beats date-based rotation', () => {
  const date = new Date(Date.UTC(2026, 11, 9, 12, 0, 0)); // 2026-12-09
  const dateStr = '2026-12-09';
  const schedule = { [dateStr]: '007' };

  // Level 2: without a matching schedule entry, falls back to rotation.
  const rotation = getTodayInfo(date, {});
  expect(rotation.date).toBe(dateStr);
  expect(rotation.puzzle.id).toBe(resolvePuzzleForDate(dateStr, { schedule: {} }).puzzle.id);
  expect(rotation.puzzle.id).not.toBe('007');

  // Level 1: schedule entry overrides the date-based rotation.
  const scheduled = getTodayInfo(date, schedule);
  expect(scheduled.puzzle.id).toBe('007');
  expect(scheduled.displayNumber).toBe(getDisplayPuzzleNumber(dateStr));
});

test('dates without a schedule entry fall back cleanly to the date rotation', () => {
  const schedule = { '2026-12-09': '007' };
  const unscheduledDate = new Date(Date.UTC(2026, 11, 10, 12, 0, 0)); // 2026-12-10
  const result = getTodayInfo(unscheduledDate, schedule);
  const expectedRotation = resolvePuzzleForDate('2026-12-10', { schedule: {} });

  expect(result.date).toBe('2026-12-10');
  expect(result.puzzle.id).toBe(expectedRotation.puzzle.id);
});
