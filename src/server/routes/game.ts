import { Hono } from 'hono';
import {
  GameError,
  accuseSuspect,
  getProgress,
  getStats,
  shareResultToComments,
  toGameState,
} from '../core/game';
import { toClientPuzzle } from '../core/puzzle';
import { resolvePuzzleSession } from '../core/session';
import { getLeaderboard } from '../core/leaderboard';
import { getSeenHowTo, markHowToSeen } from '../core/howto';

export const game = new Hono();

// Every route resolves the puzzle from this post's stored date/id (with a
// fallback to today's rotation for posts created before post data existed).
game.get('/puzzle/today', async (c) => {
  const session = await resolvePuzzleSession();
  const progress = await getProgress(session.puzzle.id, session.date);
  const state = toGameState(session.puzzle, progress, session);
  return c.json({
    puzzle: toClientPuzzle(session.puzzle),
    progress,
    state,
    practice: session.practice,
    devOverride: session.devOverride,
  });
});

game.post('/accuse', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { puzzleId, suspectId } =
    typeof body === 'object' && body !== null
      ? (body as { puzzleId?: unknown; suspectId?: unknown })
      : {};

  if (typeof puzzleId !== 'string' || typeof suspectId !== 'string') {
    return c.json({ error: 'puzzleId and suspectId are required' }, 400);
  }

  try {
    const session = await resolvePuzzleSession();
    if (puzzleId !== session.puzzle.id) {
      return c.json({ error: 'This post plays a different puzzle' }, 400);
    }
    const result = await accuseSuspect(session, suspectId);
    return c.json({
      correct: result.correct,
      reveal: result.reveal,
      progress: result.progress,
      state: result.state,
    });
  } catch (error) {
    if (error instanceof GameError) {
      return c.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Accuse failed';
    return c.json({ error: message }, { status: 400 });
  }
});

game.post('/share', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { puzzleId } =
    typeof body === 'object' && body !== null ? (body as { puzzleId?: unknown }) : {};

  if (typeof puzzleId !== 'string') {
    return c.json({ error: 'puzzleId is required' }, 400);
  }

  try {
    const session = await resolvePuzzleSession();
    if (puzzleId !== session.puzzle.id) {
      return c.json({ error: 'This post plays a different puzzle' }, 400);
    }
    const result = await shareResultToComments(session);
    return c.json({
      progress: result.progress,
      state: result.state,
    });
  } catch (error) {
    if (error instanceof GameError) {
      return c.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Could not post result';
    return c.json({ error: message }, { status: 400 });
  }
});

game.get('/seen-howto', async (c) => c.json({ seen: await getSeenHowTo() }));

game.post('/seen-howto', async (c) => {
  await markHowToSeen();
  return c.json({ seen: true });
});

game.get('/stats/today', async (c) => {
  const session = await resolvePuzzleSession();
  const stats = await getStats(session.puzzle.id, session.date);
  return c.json({
    puzzleId: session.puzzle.id,
    puzzleNumber: session.displayNumber,
    stats,
  });
});

// Current UTC week (Monday 00:00) only. Nothing is cached on the client.
game.get('/leaderboard', async (c) => c.json(await getLeaderboard()));
