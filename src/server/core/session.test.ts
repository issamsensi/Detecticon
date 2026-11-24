import { redis } from '@devvit/web/server';
import { expect } from 'vitest';
import { test } from '../test';
import {
  DEV_PUZZLE_OVERRIDE_KEY,
  getAllPuzzles,
  getDisplayPuzzleNumber,
  getTodayInfo,
  resolvePuzzleForDate,
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

test('dev override key in Redis is ignored in production mode', async () => {
  const today = await getTodayInfo();
  const other = getAllPuzzles().find((puzzle) => puzzle.id !== today.puzzle.id);
  if (other === undefined) throw new Error('Need at least two puzzles');
  await redis.set(DEV_PUZZLE_OVERRIDE_KEY, other.id);

  const prevNodeEnv = process.env.NODE_ENV;
  const prevDevTools = process.env.DETECTICON_DEV_TOOLS;
  process.env.NODE_ENV = 'production';
  delete process.env.DETECTICON_DEV_TOOLS;
  try {
    const prodToday = await getTodayInfo();
    expect(prodToday.isDevOverride).toBe(false);
    expect(prodToday.puzzle.id).toBe(today.puzzle.id);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevDevTools !== undefined) {
      process.env.DETECTICON_DEV_TOOLS = prevDevTools;
    }
  }
});

test('display puzzle number anchors at 2026-11-26 launch date and clamps pre-launch dates to 1', async () => {
  const preLaunch = await getTodayInfo(new Date(Date.UTC(2026, 10, 24, 12, 0, 0)));
  expect(preLaunch.date).toBe('2026-11-24');
  expect(preLaunch.displayNumber).toBe(1);
  expect(preLaunch.puzzle.id).toBe('001');

  const launchDay = await getTodayInfo(new Date(Date.UTC(2026, 10, 26, 12, 0, 0)));
  expect(launchDay.date).toBe('2026-11-26');
  expect(launchDay.displayNumber).toBe(1);
  expect(launchDay.puzzle.id).toBe('004');

  const dayTwo = await getTodayInfo(new Date(Date.UTC(2026, 10, 27, 12, 0, 0)));
  expect(dayTwo.date).toBe('2026-11-27');
  expect(dayTwo.displayNumber).toBe(2);
  expect(dayTwo.puzzle.id).toBe('005');
});

test('three-level resolution: dev override > schedule > date rotation', async () => {
  const date = new Date(Date.UTC(2026, 11, 9, 12, 0, 0)); // 2026-12-09
  const dateStr = '2026-12-09';
  const schedule = { [dateStr]: '007' };

  // Level 3: without override or matching schedule entry, falls back to rotation.
  const rotation = await getTodayInfo(date, {});
  expect(rotation.date).toBe(dateStr);
  expect(rotation.isDevOverride).toBe(false);
  expect(rotation.puzzle.id).toBe(resolvePuzzleForDate(dateStr, { schedule: {} }).puzzle.id);
  expect(rotation.puzzle.id).not.toBe('007');

  // Level 2: schedule entry overrides the date-based rotation without marking devOverride.
  const scheduled = await getTodayInfo(date, schedule);
  expect(scheduled.puzzle.id).toBe('007');
  expect(scheduled.isDevOverride).toBe(false);
  expect(scheduled.displayNumber).toBe(getDisplayPuzzleNumber(dateStr));

  // Level 1: active moderator dev override beats both schedule and rotation.
  await redis.set(DEV_PUZZLE_OVERRIDE_KEY, '012');
  const overridden = await getTodayInfo(date, schedule);
  expect(overridden.puzzle.id).toBe('012');
  expect(overridden.isDevOverride).toBe(true);

  // In production mode, the dev override is ignored and resolution falls back to schedule.
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDevTools = process.env.DETECTICON_DEV_TOOLS;
  process.env.NODE_ENV = 'production';
  delete process.env.DETECTICON_DEV_TOOLS;
  try {
    const prodScheduled = await getTodayInfo(date, schedule);
    expect(prodScheduled.puzzle.id).toBe('007');
    expect(prodScheduled.isDevOverride).toBe(false);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevDevTools !== undefined) {
      process.env.DETECTICON_DEV_TOOLS = prevDevTools;
    }
  }
});

test('dates without a schedule entry fall back cleanly to the date rotation', async () => {
  const schedule = { '2026-12-09': '007' };
  const unscheduledDate = new Date(Date.UTC(2026, 11, 10, 12, 0, 0)); // 2026-12-10
  const result = await getTodayInfo(unscheduledDate, schedule);
  const expectedRotation = resolvePuzzleForDate('2026-12-10', { schedule: {} });

  expect(result.date).toBe('2026-12-10');
  expect(result.puzzle.id).toBe(expectedRotation.puzzle.id);
  expect(result.isDevOverride).toBe(false);
});
