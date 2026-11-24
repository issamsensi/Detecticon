import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { getStoredProgress, progressKey, statsKey } from '../core/game';
import { requireModerator } from '../core/moderation';
import { clearWeeklyLeaderboard, revertAwardedPoints } from '../core/leaderboard';
import { pointsForAttempts } from '../../shared/scoring';
import {
  DEV_PUZZLE_OVERRIDE_KEY,
  getAllPuzzles,
  getPuzzleById,
  getTodayInfo,
  isDevToolsEnabled,
} from '../core/puzzle';

/**
 * Moderator-only developer testing endpoints. Mounted under /internal only when
 * DETECTICON_DEV_TOOLS=true (disabled in production).
 */
export const dev = new Hono();

const requireDevTools = createMiddleware(async (c, next) => {
  if (!isDevToolsEnabled()) {
    return c.json<UiResponse>(
      { showToast: 'Detecticon dev actions are disabled in production.' },
      404
    );
  }
  await next();
});

dev.use('/*', requireDevTools);
dev.use('/*', requireModerator);

const successToast = (text: string): UiResponse => ({
  showToast: { text, appearance: 'success' },
});

const actor = (): string => context.username ?? 'unknown user';

// Dev: reset my progress for today — deleting the whole hash also clears
// sharedToComments and statsCounted, so the replay/share flow can be retested.
dev.post('/menu/dev-reset-progress', async (c) => {
  try {
    const { date, puzzle } = await getTodayInfo();
    const player = await reddit.getCurrentUsername();
    if (!player) {
      return c.json<UiResponse>({ showToast: 'Log in to Reddit to reset your progress.' }, 400);
    }
    const key = progressKey(date, puzzle.id, player);
    // Read the awarded points before deleting the hash so today's test play does
    // not stay on this week's board after a reset/replay.
    const stored = await getStoredProgress(date, puzzle.id, player);
    const awardedPoints = stored.statsCounted
      ? pointsForAttempts(stored.attemptsUsed, stored.solved)
      : 0;
    await redis.del(key);
    if (awardedPoints > 0) {
      await revertAwardedPoints(player, awardedPoints, stored.awardedWeekId);
    }
    console.warn(
      `[DETECTICON DEV] Progress reset by ${actor()}: ${key} (removed ${awardedPoints} leaderboard points)`
    );
    return c.json<UiResponse>(
      successToast("Your progress for today's puzzle was reset, including weekly points.")
    );
  } catch (error) {
    console.error(`[DETECTICON DEV] Failed to reset progress: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not reset progress.' }, 400);
  }
});

// Dev: reset today's stats — removes the aggregate counters for the active puzzle.
dev.post('/menu/dev-reset-stats', async (c) => {
  try {
    const { date, puzzle } = await getTodayInfo();
    const key = statsKey(date, puzzle.id);
    await redis.del(key);
    console.warn(`[DETECTICON DEV] Stats reset by ${actor()}: ${key}`);
    return c.json<UiResponse>(successToast("Today's Detecticon stats were reset."));
  } catch (error) {
    console.error(`[DETECTICON DEV] Failed to reset stats: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not reset stats.' }, 400);
  }
});

// Dev: test puzzle override — opens a form to pick any known puzzle id.
dev.post('/menu/dev-set-override', (c) =>
  c.json<UiResponse>({
    showForm: {
      name: 'devPuzzleOverride',
      form: {
        title: 'Dev: test puzzle override',
        description: 'Replaces today’s puzzle for everyone until the override is cleared.',
        fields: [
          {
            type: 'select',
            name: 'puzzleId',
            label: 'Puzzle id',
            required: true,
            options: getAllPuzzles().map((puzzle) => ({
              label: `${puzzle.id} — ${puzzle.title}`,
              value: puzzle.id,
            })),
          },
        ],
        acceptLabel: 'Set override',
        cancelLabel: 'Cancel',
      },
    },
  })
);

type DevOverrideFormRequest = { puzzleId?: string | string[] };

// Form submit target declared in devvit.json ("forms": { "devPuzzleOverride": ... }).
dev.post('/form/dev-puzzle-override', async (c) => {
  try {
    const body = await c.req.json<DevOverrideFormRequest>();
    const raw = body.puzzleId;
    const puzzleId = Array.isArray(raw) ? raw[0] : raw;

    if (!puzzleId || !getPuzzleById(puzzleId)) {
      return c.json<UiResponse>({ showToast: 'Unknown puzzle id. Override not changed.' }, 400);
    }

    await redis.set(DEV_PUZZLE_OVERRIDE_KEY, puzzleId);
    console.warn(
      `⚠️  [DETECTICON DEV] PUZZLE OVERRIDE SET to ${puzzleId} by ${actor()}. ` +
        `Today's puzzle is replaced for ALL players. Clear it before submission.`
    );
    return c.json<UiResponse>(successToast(`Puzzle override set to ${puzzleId}.`));
  } catch (error) {
    console.error(`[DETECTICON DEV] Failed to set puzzle override: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not set puzzle override.' }, 400);
  }
});

// Dev: clear puzzle override — removes the key entirely; rotation resumes.
dev.post('/menu/dev-clear-override', async (c) => {
  try {
    await redis.del(DEV_PUZZLE_OVERRIDE_KEY);
    console.warn(`[DETECTICON DEV] Puzzle override CLEARED by ${actor()}; daily rotation restored.`);
    return c.json<UiResponse>(successToast('Puzzle override cleared. Daily rotation restored.'));
  } catch (error) {
    console.error(`[DETECTICON DEV] Failed to clear puzzle override: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not clear puzzle override.' }, 400);
  }
});

// Dev: clear only the current week's leaderboard; stats and progress are untouched.
dev.post('/menu/dev-reset-weekly-leaderboard', async (c) => {
  try {
    const key = await clearWeeklyLeaderboard();
    console.warn(`[DETECTICON DEV] Weekly leaderboard reset by ${actor()}: ${key}`);
    return c.json<UiResponse>(successToast("This week's Detecticon leaderboard was reset."));
  } catch (error) {
    console.error(`[DETECTICON DEV] Failed to reset weekly leaderboard: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not reset the weekly leaderboard.' }, 400);
  }
});
