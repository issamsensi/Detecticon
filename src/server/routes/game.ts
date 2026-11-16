import { Hono } from 'hono';
import { accuseSuspect, getProgress, getStats, toGameState } from '../core/game';
import { getTodaysPuzzle, toClientPuzzle } from '../core/puzzle';

export const game = new Hono();

game.get('/puzzle/today', async (c) => {
  const puzzle = getTodaysPuzzle();
  const progress = await getProgress(puzzle.id);
  const state = toGameState(puzzle, progress);
  return c.json({
    puzzle: toClientPuzzle(puzzle),
    progress,
    state,
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
    const result = await accuseSuspect(puzzleId, suspectId);
    return c.json({
      correct: result.correct,
      reveal: result.reveal,
      progress: result.progress,
      state: result.state,
      ...(result.alreadyFinished ? { alreadyFinished: true } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Accuse failed';
    const status = message === 'Puzzle not found' || message === 'Suspect not found' ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

game.get('/stats/today', async (c) => {
  const puzzle = getTodaysPuzzle();
  const stats = await getStats(puzzle.id);
  return c.json({
    puzzleId: puzzle.id,
    puzzleNumber: puzzle.number,
    stats,
  });
});
