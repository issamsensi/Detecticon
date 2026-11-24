import { Context, reddit, redis, runWithContext } from '@devvit/web/server';
import { expect } from 'vitest';
import { test } from '../test';
import { formatPointsDelta, pointsForAttempts } from '../../shared/scoring';
import { decodeLeaderboardPoints, leaderboardKey } from '../../shared/leaderboard';
import { getWeekId } from '../../shared/week';
import { getLeaderboard } from './leaderboard';
import { statsKey } from './game';
import {
  accuseSuspect,
  getStats,
  shareResultToComments,
  toGameState,
} from './game';
import { getTodayInfo } from './puzzle';
import type { PuzzleSession } from './session';

const makeSession = (overrides: Partial<PuzzleSession> = {}): PuzzleSession => {
  const today = getTodayInfo();
  return {
    puzzle: today.puzzle,
    date: today.date,
    displayNumber: today.displayNumber,
    practice: false,
    ...overrides,
  };
};

const killerId = (session: PuzzleSession): string => {
  const killer = session.puzzle.suspects.find((suspect) => suspect.isKiller);
  if (killer === undefined) throw new Error('Puzzle has no killer');
  return killer.id;
};

const innocentIds = (session: PuzzleSession, count: number): string[] => {
  const ids = session.puzzle.suspects
    .filter((suspect) => !suspect.isKiller)
    .slice(0, count)
    .map((suspect) => suspect.id);
  if (ids.length !== count) throw new Error(`Puzzle needs ${count} innocent suspects`);
  return ids;
};

test('a first-attempt solve awards 3 points in both the result and the weekly board', async ({ username }) => {
  const session = await makeSession();
  const result = await accuseSuspect(session, killerId(session));
  const weekId = getWeekId(new Date());
  const rawScore = await redis.zScore(leaderboardKey(weekId), username);

  expect(result.correct).toBe(true);
  expect(result.state.attemptsUsed).toBe(1);
  expect(result.state.pointsEarned).toBe(3);
  expect(formatPointsDelta(result.state.pointsEarned)).toBe('+3 points');
  expect(pointsForAttempts(1, true)).toBe(3);
  expect(rawScore).toBeDefined();
  expect(decodeLeaderboardPoints(rawScore!)).toBe(3);
  expect((await getLeaderboard()).me?.points).toBe(3);
  expect(await getStats(session.puzzle.id, session.date)).toMatchObject({ solved1: 1 });
});

test('a second-attempt solve awards 2 points in both the result and the weekly board', async ({ username }) => {
  const session = await makeSession();
  const [wrong] = innocentIds(session, 1);
  if (wrong === undefined) throw new Error('Missing innocent suspect');

  await accuseSuspect(session, wrong);
  const result = await accuseSuspect(session, killerId(session));
  const weekId = getWeekId(new Date());
  const rawScore = await redis.zScore(leaderboardKey(weekId), username);

  expect(result.state.attemptsUsed).toBe(2);
  expect(result.state.pointsEarned).toBe(2);
  expect(formatPointsDelta(result.state.pointsEarned)).toBe('+2 points');
  expect(pointsForAttempts(2, true)).toBe(2);
  expect(rawScore).toBeDefined();
  expect(decodeLeaderboardPoints(rawScore!)).toBe(2);
  expect((await getLeaderboard()).me?.points).toBe(2);
  expect(await getStats(session.puzzle.id, session.date)).toMatchObject({ solved2: 1 });
});

test('a correct third accusation awards 1 point in both the result and the weekly board', async ({ username }) => {
  const session = await makeSession();
  const [firstWrong, secondWrong] = innocentIds(session, 2);
  if (firstWrong === undefined || secondWrong === undefined) {
    throw new Error('Missing innocent suspects');
  }

  await accuseSuspect(session, firstWrong);
  await accuseSuspect(session, secondWrong);
  const result = await accuseSuspect(session, killerId(session));
  const weekId = getWeekId(new Date());
  const rawScore = await redis.zScore(leaderboardKey(weekId), username);

  expect(result.state.attemptsUsed).toBe(3);
  expect(result.state.solved).toBe(true);
  expect(result.state.pointsEarned).toBe(1);
  expect(formatPointsDelta(result.state.pointsEarned)).toBe('+1 point');
  expect(pointsForAttempts(3, true)).toBe(1);
  expect(rawScore).toBeDefined();
  expect(decodeLeaderboardPoints(rawScore!)).toBe(1);
  expect((await getLeaderboard()).me?.points).toBe(1);
  expect(await getStats(session.puzzle.id, session.date)).toMatchObject({ solved3: 1 });
});

test('a failed case awards 0 points and counts as failed', async ({ username }) => {
  const session = await makeSession();
  const wrongIds = innocentIds(session, 3);
  let result;
  for (const id of wrongIds) {
    result = await accuseSuspect(session, id);
  }

  if (result === undefined) throw new Error('No accusations were made');
  const weekId = getWeekId(new Date());
  const rawScore = await redis.zScore(leaderboardKey(weekId), username);

  expect(result.state.finished).toBe(true);
  expect(result.state.solved).toBe(false);
  expect(result.state.attemptsUsed).toBe(3);
  expect(result.state.pointsEarned).toBe(0);
  expect(formatPointsDelta(result.state.pointsEarned)).toBe('+0 points');
  expect(rawScore).toBeUndefined();
  expect((await getLeaderboard()).me).toBeNull();
  expect(await getStats(session.puzzle.id, session.date)).toMatchObject({ failed: 1 });
});

test('sharing is claimed once so the same result cannot be posted twice', async ({ headers }) => {
  const session = await makeSession();
  const finished = await accuseSuspect(session, killerId(session));
  expect(finished.state.finished).toBe(true);

  const postContext = Context({ ...headers, 'devvit-post': 't3_testpost' });
  const submitted: string[] = [];
  const submitComment = async (
    options: Parameters<typeof reddit.submitComment>[0]
  ): Promise<void> => {
    submitted.push('text' in options ? options.text : '');
  };
  const shared = await runWithContext(postContext, () =>
    shareResultToComments(session, submitComment)
  );
  expect(shared.progress.sharedToComments).toBe(true);
  expect(shared.state.sharedToComments).toBe(true);
  expect(submitted).toHaveLength(1);

  await expect(
    runWithContext(postContext, () => shareResultToComments(session, submitComment))
  ).rejects.toMatchObject({
    status: 409,
    message: 'Result already posted',
  });
  expect(submitted).toHaveLength(1);
});

test('practice posts score no points, increment no stats and cannot share', async () => {
  const session = await makeSession({ date: '2026-11-01', practice: true });
  const result = await accuseSuspect(session, killerId(session));

  expect(result.state.pointsEarned).toBe(0);
  expect(result.state.practice).toBe(true);
  expect(result.state.puzzleNumber).toBe(session.displayNumber);
  expect((await getLeaderboard()).me).toBeNull();
  expect(Object.keys(await redis.hGetAll(statsKey(session.date, session.puzzle.id)))).toHaveLength(
    0
  );

  await expect(shareResultToComments(session)).rejects.toMatchObject({
    status: 400,
    message: 'Practice puzzles cannot be shared to comments',
  });
});

test('practice state also hides points when built from stored progress', async () => {
  const session = makeSession({ date: '2026-11-01', practice: true });
  const finished = await accuseSuspect(session, killerId(session));
  const state = toGameState(session.puzzle, finished.progress, session);

  expect(state.pointsEarned).toBe(0);
  expect(state.practice).toBe(true);
});
