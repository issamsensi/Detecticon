import { context, reddit, redis } from '@devvit/web/server';
import type { Puzzle } from '../../shared/types';
import { buildShareText, type AttemptResult, type GameState } from '../../shared/game';
import {
  leaderboardKey,
  LEADERBOARD_TTL_SECONDS,
  nextLeaderboardScore,
} from '../../shared/leaderboard';
import { pointsForAttempts } from '../../shared/scoring';
import { getWeekId } from '../../shared/week';
import { getDisplayPuzzleNumber, getUtcDateString } from './puzzle';
import type { PuzzleSession } from './session';

export type StoredProgress = {
  attemptsLeft: number;
  attemptsUsed: number;
  eliminatedIds: string[];
  results: AttemptResult[];
  finished: boolean;
  solved: boolean;
  revealedKillerId?: string;
  statsCounted: boolean;
  /** Week the weekly award was added to, so moderator resets target that board. */
  awardedWeekId?: string;
  sharedToComments: boolean;
};

type Stats = {
  solved1: number;
  solved2: number;
  solved3: number;
  failed: number;
};

const defaultProgress = (): StoredProgress => ({
  attemptsLeft: 3,
  attemptsUsed: 0,
  eliminatedIds: [],
  results: [],
  finished: false,
  solved: false,
  statsCounted: false,
  sharedToComments: false,
});

const parseJsonArray = <T>(value: string | undefined, fallback: T[]): T[] => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const getPlayerId = async (): Promise<string | null> => {
  const username = await reddit.getCurrentUsername();
  return username ?? null;
};

// Redis key: detecticon:progress:{date}:{puzzleId}:{player}
// - "detecticon": app namespace to avoid collisions.
// - "progress": per-player puzzle state.
// - {date}: UTC day (YYYY-MM-DD) for the puzzle instance, so each day is isolated.
// - {puzzleId}: puzzle identifier for that day.
// - {player}: logged-in Reddit username; anonymous users are never persisted.
// Value: hash of attempts/results/elimination/finish flags.
export const progressKey = (date: string, puzzleId: string, player: string): string =>
  `detecticon:progress:${date}:${puzzleId}:${player}`;

// Redis key: detecticon:stats:{date}:{puzzleId}
// - "detecticon": app namespace.
// - "stats": aggregate solve counters.
// - {date}: UTC day (YYYY-MM-DD) matching today's puzzle instance.
// - {puzzleId}: puzzle identifier.
// Value: hash counters solved1/solved2/solved3/failed.
export const statsKey = (date: string, puzzleId: string): string =>
  `detecticon:stats:${date}:${puzzleId}`;

const readProgressRecord = (data: Record<string, string> | undefined): StoredProgress => {
  if (!data || Object.keys(data).length === 0) {
    return defaultProgress();
  }
  const attemptsUsed = Number(data.attemptsUsed ?? 0);
  const attemptsLeft = Number(data.attemptsLeft ?? 3);
  const results = parseJsonArray<AttemptResult>(data.results, []);
  const eliminatedIds = parseJsonArray<string>(data.eliminatedIds, []);
  const finished = data.finished === '1';
  const solved = data.solved === '1';
  const statsCounted = data.statsCounted === '1';
  const sharedToComments = data.sharedToComments === '1';
  const revealedKillerId = data.revealedKillerId || undefined;
  const awardedWeekId = data.awardedWeekId || undefined;

  return {
    attemptsUsed: Number.isFinite(attemptsUsed) ? attemptsUsed : 0,
    attemptsLeft: Number.isFinite(attemptsLeft) ? attemptsLeft : 0,
    eliminatedIds,
    results,
    finished,
    solved,
    statsCounted,
    sharedToComments,
    ...(revealedKillerId ? { revealedKillerId } : {}),
    ...(awardedWeekId ? { awardedWeekId } : {}),
  };
};

const progressHash = (progress: StoredProgress): Record<string, string> => ({
  attemptsUsed: String(progress.attemptsUsed),
  attemptsLeft: String(progress.attemptsLeft),
  eliminatedIds: JSON.stringify(progress.eliminatedIds),
  results: JSON.stringify(progress.results),
  finished: progress.finished ? '1' : '0',
  solved: progress.solved ? '1' : '0',
  statsCounted: progress.statsCounted ? '1' : '0',
  sharedToComments: progress.sharedToComments ? '1' : '0',
  revealedKillerId: progress.revealedKillerId ?? '',
  awardedWeekId: progress.awardedWeekId ?? '',
});

export const getProgress = async (puzzleId: string, date: string): Promise<StoredProgress> => {
  const player = await getPlayerId();
  if (!player) {
    return defaultProgress();
  }
  return getStoredProgress(date, puzzleId, player);
};

/** Used by moderator dev actions to work out which points to remove. */
export const getStoredProgress = async (
  date: string,
  puzzleId: string,
  player: string
): Promise<StoredProgress> => {
  const data = await redis.hGetAll(progressKey(date, puzzleId, player));
  return readProgressRecord(data);
};

export const saveProgress = async (
  puzzleId: string,
  date: string,
  progress: StoredProgress
): Promise<void> => {
  const player = await getPlayerId();
  if (!player) {
    return; // do not persist anonymous/logged-out users
  }
  await redis.hSet(progressKey(date, puzzleId, player), progressHash(progress));
};

export const getStats = async (puzzleId: string, date: string): Promise<Stats> => {
  const data = await redis.hGetAll(statsKey(date, puzzleId));
  return {
    solved1: Number(data?.solved1 ?? 0) || 0,
    solved2: Number(data?.solved2 ?? 0) || 0,
    solved3: Number(data?.solved3 ?? 0) || 0,
    failed: Number(data?.failed ?? 0) || 0,
  };
};

const attemptsField = (attemptsUsed: number): keyof Stats => {
  if (attemptsUsed <= 1) return 'solved1';
  if (attemptsUsed === 2) return 'solved2';
  return 'solved3';
};

export type AccuseResult = {
  correct: boolean;
  reveal: string;
  progress: StoredProgress;
  state: GameState;
};

export type GameErrorStatus = 400 | 401 | 404 | 409;

export class GameError extends Error {
  status: GameErrorStatus;
  constructor(message: string, status: GameErrorStatus = 400) {
    super(message);
    this.status = status;
  }
}

const applyAccusation = (
  puzzle: Puzzle,
  progress: StoredProgress,
  suspectId: string
): { correct: boolean; reveal: string; next: StoredProgress; finishedNow: boolean; statField?: keyof Stats } => {
  if (progress.finished) {
    throw new GameError('Game is already finished', 400);
  }
  if (progress.eliminatedIds.includes(suspectId)) {
    throw new GameError('Suspect already eliminated', 400);
  }

  const suspect = puzzle.suspects.find((s) => s.id === suspectId);
  if (!suspect) {
    throw new GameError('Suspect not found', 404);
  }

  const next: StoredProgress = {
    ...progress,
    eliminatedIds: [...progress.eliminatedIds],
    results: [...progress.results],
  };

  next.attemptsUsed += 1;
  next.attemptsLeft = Math.max(0, next.attemptsLeft - 1);

  if (suspect.isKiller) {
    next.results.push('correct');
    next.solved = true;
    next.finished = true;
    return {
      correct: true,
      reveal: suspect.contradiction ?? 'Contradiction revealed.',
      next,
      finishedNow: true,
      statField: attemptsField(next.attemptsUsed),
    };
  }

  next.results.push('wrong');
  next.eliminatedIds.push(suspectId);
  const reveal = suspect.alibiProof ?? 'Alibi confirmed.';
  if (next.attemptsLeft <= 0) {
    next.finished = true;
    next.solved = false;
    const killer = puzzle.suspects.find((s) => s.isKiller);
    if (killer) {
      next.revealedKillerId = killer.id;
    }
    return { correct: false, reveal, next, finishedNow: true, statField: 'failed' };
  }

  return { correct: false, reveal, next, finishedNow: false };
};

export const accuseSuspect = async (
  session: PuzzleSession,
  suspectId: string
): Promise<AccuseResult> => {
  const player = await getPlayerId();
  if (!player) {
    throw new GameError('Log in to play', 401);
  }

  const { puzzle, date } = session;
  const pKey = progressKey(date, puzzle.id, player);
  const sKey = statsKey(date, puzzle.id);

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date();
    const weekId = getWeekId(now);
    const lbKey = leaderboardKey(weekId);
    // Watch the progress hash (the statsCounted guard) and the weekly set: the
    // set score is read before multi, so concurrent finishers must retry.
    const txn = await redis.watch(pKey, lbKey);
    try {
      const data = await redis.hGetAll(pKey);
      const current = readProgressRecord(data);
      const { correct, reveal, next, finishedNow, statField } = applyAccusation(
        puzzle,
        current,
        suspectId
      );

      // Old posts and dev-override posts stay fully playable but never touch
      // stats or the weekly leaderboard.
      const shouldCount =
        finishedNow &&
        statField &&
        !current.statsCounted &&
        !session.practice &&
        !session.devOverride;
      let leaderboardScore: number | null = null;
      if (shouldCount) {
        next.statsCounted = true;
        next.awardedWeekId = weekId;
        const points = pointsForAttempts(next.attemptsUsed, next.solved);
        if (points > 0) {
          const currentScore = await redis.zScore(lbKey, player);
          leaderboardScore = nextLeaderboardScore(currentScore, points, now);
        }
      }

      await txn.multi();
      await txn.hSet(pKey, progressHash(next));
      if (shouldCount && statField) {
        await txn.hIncrBy(sKey, statField, 1);
      }
      if (leaderboardScore !== null) {
        await txn.zAdd(lbKey, { member: player, score: leaderboardScore });
        await txn.expire(lbKey, LEADERBOARD_TTL_SECONDS);
      }
      const execResult = await txn.exec();
      // If transaction aborted (watched key modified), retry.
      if (execResult == null) {
        continue;
      }

      return {
        correct,
        reveal,
        progress: next,
        state: toGameState(puzzle, next, session),
      };
    } catch (error) {
      try {
        await txn.unwatch();
      } catch {
        // ignore
      }
      throw error;
    }
  }

  throw new GameError('Could not save progress, please try again', 409);
};

type GameStateSession = Pick<
  PuzzleSession,
  'date' | 'displayNumber' | 'practice' | 'devOverride'
>;

export const toGameState = (
  puzzle: Puzzle,
  progress: StoredProgress,
  session?: GameStateSession
): GameState => {
  const killer = puzzle.suspects.find((s) => s.isKiller);
  const showCulprit = progress.finished && killer;
  // Only cleared (wrongly accused, non-killer) suspects get their alibi proof.
  // The killer's contradiction is never part of the state, even after the game ends.
  const eliminatedAlibis: Record<string, string> = {};
  for (const suspect of puzzle.suspects) {
    if (
      !suspect.isKiller &&
      suspect.alibiProof &&
      progress.eliminatedIds.includes(suspect.id)
    ) {
      eliminatedAlibis[suspect.id] = suspect.alibiProof;
    }
  }
  // Numbering comes from the post's own UTC date, not the date of the request.
  const date = session?.date ?? getUtcDateString();
  const displayNumber = session?.displayNumber ?? getDisplayPuzzleNumber(date);
  const practice = session?.practice ?? false;
  const devOverride = session?.devOverride ?? false;
  return {
    puzzleId: puzzle.id,
    puzzleNumber: displayNumber,
    attemptsLeft: progress.attemptsLeft,
    attemptsUsed: progress.attemptsUsed,
    eliminatedIds: progress.eliminatedIds,
    ...(Object.keys(eliminatedAlibis).length > 0 ? { eliminatedAlibis } : {}),
    results: progress.results,
    solved: progress.solved,
    pointsEarned:
      practice || devOverride ? 0 : pointsForAttempts(progress.attemptsUsed, progress.solved),
    practice,
    devOverride,
    sharedToComments: progress.sharedToComments,
    ...(progress.revealedKillerId ? { revealedKillerId: progress.revealedKillerId } : {}),
    finished: progress.finished,
    ...(showCulprit ? { culprit: { id: killer.id, name: killer.name } } : {}),
    ...(progress.finished
      ? {
          shareText: buildShareText({
            puzzleNumber: displayNumber,
            results: progress.results,
          }),
        }
      : {}),
  };
};

export type ShareResult = {
  progress: StoredProgress;
  state: GameState;
};

type ShareSubmitter = (options: Parameters<typeof reddit.submitComment>[0]) => Promise<unknown>;

export const shareResultToComments = async (
  session: PuzzleSession,
  submitComment: ShareSubmitter = (options) => reddit.submitComment(options)
): Promise<ShareResult> => {
  const player = await getPlayerId();
  if (!player) {
    throw new GameError('Log in to play', 401);
  }
  if (session.practice) {
    throw new GameError('Practice puzzles cannot be shared to comments', 400);
  }
  if (session.devOverride) {
    throw new GameError('Dev test puzzles cannot be shared to comments', 400);
  }

  const { puzzle, date } = session;
  const pKey = progressKey(date, puzzle.id, player);
  const postId = context.postId;
  if (!postId) {
    throw new GameError('Post context unavailable', 400);
  }

  const txn = await redis.watch(pKey);
  try {
    const data = await redis.hGetAll(pKey);
    const current = readProgressRecord(data);

    if (!current.finished) {
      throw new GameError('Finish the puzzle before sharing', 400);
    }
    if (current.sharedToComments) {
      throw new GameError('Result already posted', 409);
    }

    // Comment must contain only attempts and the puzzle number (no killer/evidence/puzzle text).
    const text = buildShareText({
      puzzleNumber: session.displayNumber,
      results: current.results,
    });

    // Claim the share atomically before calling Reddit. A concurrent request
    // watching the same progress hash will abort and get a 409 instead of
    // posting a second copy of the comment.
    const next: StoredProgress = {
      ...current,
      sharedToComments: true,
    };
    await txn.multi();
    await txn.hSet(pKey, progressHash(next));
    if ((await txn.exec()) == null) {
      throw new GameError('Result already posted', 409);
    }

    try {
      await submitComment({
        id: postId,
        text,
        runAs: 'USER',
      });
    } catch (submitError) {
      // If Reddit rejected the comment, release the claim so the player can
      // retry. If this rollback fails, the progress hash stays claimed rather
      // than risking a duplicate comment.
      try {
        await redis.hSet(pKey, progressHash(current));
      } catch {
        // Keep the claim; a moderator reset can clear it.
      }
      throw submitError;
    }

    return {
      progress: next,
      state: toGameState(puzzle, next, session),
    };
  } catch (error) {
    try {
      await txn.unwatch();
    } catch {
      // Already unwatched by exec(); ignore.
    }
    if (error instanceof GameError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Could not post result';
    throw new GameError(message, 400);
  }
};
