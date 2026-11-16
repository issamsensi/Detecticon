import { context, reddit, redis } from '@devvit/web/server';
import type { Puzzle } from '../../shared/types';
import { buildShareText, type AttemptResult, type GameState } from '../../shared/game';
import { getPuzzleById } from './puzzle';

type StoredProgress = {
  attemptsLeft: number;
  attemptsUsed: number;
  eliminatedIds: string[];
  results: AttemptResult[];
  finished: boolean;
  solved: boolean;
  revealedKillerId?: string;
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

const getScopeIds = () => {
  const postId = context.postId ?? 'no-post';
  return { postId };
};

const getPlayerId = async (): Promise<string> => {
  const username = await reddit.getCurrentUsername();
  return username ?? 'anonymous';
};

// Redis key: detecticon:progress:{postId}:{puzzleId}:{player}
// - "detecticon" namespace avoids collisions with other app/template keys.
// - "progress" identifies per-player puzzle state (not aggregate stats).
// - {postId} scopes data to this specific Reddit post/installation.
// - {puzzleId} scopes to the puzzle/day so multiple days can coexist.
// - {player} (Reddit username, or "anonymous") identifies the player.
// Stored as a Redis hash for atomic field updates and easy partial reads.
const progressKey = (postId: string, puzzleId: string, player: string): string =>
  `detecticon:progress:${postId}:${puzzleId}:${player}`;

// Redis key: detecticon:stats:{postId}:{puzzleId}
// - "detecticon" namespace avoids collisions.
// - "stats" identifies aggregate solve counters.
// - {postId} scopes stats to this post so each post tracks its own audience.
// - {puzzleId} scopes to the puzzle/day being measured.
// Stored as a Redis hash with numeric counter fields (solved1/2/3, failed).
const statsKey = (postId: string, puzzleId: string): string =>
  `detecticon:stats:${postId}:${puzzleId}`;

export const getProgress = async (puzzleId: string): Promise<StoredProgress> => {
  const { postId } = getScopeIds();
  const player = await getPlayerId();
  const data = await redis.hGetAll(progressKey(postId, puzzleId, player));

  if (!data || Object.keys(data).length === 0) {
    return defaultProgress();
  }

  const attemptsUsed = Number(data.attemptsUsed ?? 0);
  const attemptsLeft = Number(data.attemptsLeft ?? 3);
  const results = parseJsonArray<AttemptResult>(data.results, []);
  const eliminatedIds = parseJsonArray<string>(data.eliminatedIds, []);
  const finished = data.finished === '1';
  const solved = data.solved === '1';
  const revealedKillerId = data.revealedKillerId || undefined;

  return {
    attemptsUsed: Number.isFinite(attemptsUsed) ? attemptsUsed : 0,
    attemptsLeft: Number.isFinite(attemptsLeft) ? attemptsLeft : 0,
    eliminatedIds,
    results,
    finished,
    solved,
    ...(revealedKillerId ? { revealedKillerId } : {}),
  };
};

export const saveProgress = async (
  puzzleId: string,
  progress: StoredProgress
): Promise<void> => {
  const { postId } = getScopeIds();
  const player = await getPlayerId();
  await redis.hSet(progressKey(postId, puzzleId, player), {
    attemptsUsed: String(progress.attemptsUsed),
    attemptsLeft: String(progress.attemptsLeft),
    eliminatedIds: JSON.stringify(progress.eliminatedIds),
    results: JSON.stringify(progress.results),
    finished: progress.finished ? '1' : '0',
    solved: progress.solved ? '1' : '0',
    revealedKillerId: progress.revealedKillerId ?? '',
  });
};

export const getStats = async (puzzleId: string): Promise<Stats> => {
  const { postId } = getScopeIds();
  const data = await redis.hGetAll(statsKey(postId, puzzleId));
  return {
    solved1: Number(data?.solved1 ?? 0) || 0,
    solved2: Number(data?.solved2 ?? 0) || 0,
    solved3: Number(data?.solved3 ?? 0) || 0,
    failed: Number(data?.failed ?? 0) || 0,
  };
};

const incrementStat = async (
  puzzleId: string,
  field: keyof Stats
): Promise<void> => {
  const { postId } = getScopeIds();
  await redis.hIncrBy(statsKey(postId, puzzleId), field, 1);
};

export type AccuseResult = {
  correct: boolean;
  reveal: string;
  progress: StoredProgress;
  state: GameState;
  alreadyFinished?: boolean;
};

export const accuseSuspect = async (
  puzzleId: string,
  suspectId: string
): Promise<AccuseResult> => {
  const puzzle = getPuzzleById(puzzleId);
  if (!puzzle) {
    throw new Error('Puzzle not found');
  }
  const suspect = puzzle.suspects.find((s) => s.id === suspectId);
  if (!suspect) {
    throw new Error('Suspect not found');
  }

  const progress = await getProgress(puzzleId);
  if (progress.finished) {
    return {
      correct: suspect.isKiller,
      reveal: suspect.isKiller
        ? (suspect.contradiction ?? 'Contradiction revealed.')
        : (suspect.alibiProof ?? 'Alibi confirmed.'),
      progress,
      state: toGameState(puzzle, progress),
      alreadyFinished: true,
    };
  }

  // ignore duplicate accusations of eliminated suspects
  if (progress.eliminatedIds.includes(suspectId) && !suspect.isKiller) {
    return {
      correct: false,
      reveal: suspect.alibiProof ?? 'Alibi confirmed.',
      progress,
      state: toGameState(puzzle, progress),
    };
  }

  let reveal = '';
  if (suspect.isKiller) {
    progress.attemptsUsed += 1;
    progress.attemptsLeft = Math.max(0, progress.attemptsLeft - 1);
    progress.results = [...progress.results, 'correct'];
    progress.solved = true;
    progress.finished = true;
    reveal = suspect.contradiction ?? 'Contradiction revealed.';
    await incrementStat(puzzleId, attemptsField(progress.attemptsUsed));
  } else {
    progress.attemptsUsed += 1;
    progress.attemptsLeft = Math.max(0, progress.attemptsLeft - 1);
    progress.results = [...progress.results, 'wrong'];
    if (!progress.eliminatedIds.includes(suspectId)) {
      progress.eliminatedIds = [...progress.eliminatedIds, suspectId];
    }
    reveal = suspect.alibiProof ?? 'Alibi confirmed.';
    if (progress.attemptsLeft <= 0) {
      progress.finished = true;
      progress.solved = false;
      const killer = puzzle.suspects.find((s) => s.isKiller);
      if (killer) {
        progress.revealedKillerId = killer.id;
      }
      await incrementStat(puzzleId, 'failed');
    }
  }

  await saveProgress(puzzleId, progress);

  return {
    correct: suspect.isKiller,
    reveal,
    progress,
    state: toGameState(puzzle, progress),
  };
};

const attemptsField = (attemptsUsed: number): keyof Stats => {
  if (attemptsUsed <= 1) return 'solved1';
  if (attemptsUsed === 2) return 'solved2';
  return 'solved3';
};

export const toGameState = (puzzle: Puzzle, progress: StoredProgress): GameState => {
  const killer = puzzle.suspects.find((s) => s.isKiller);
  const showCulprit = progress.finished && killer;
  return {
    puzzleId: puzzle.id,
    puzzleNumber: puzzle.number,
    attemptsLeft: progress.attemptsLeft,
    attemptsUsed: progress.attemptsUsed,
    eliminatedIds: progress.eliminatedIds,
    results: progress.results,
    solved: progress.solved,
    ...(progress.revealedKillerId ? { revealedKillerId: progress.revealedKillerId } : {}),
    finished: progress.finished,
    ...(showCulprit ? { culprit: { id: killer.id, name: killer.name } } : {}),
    ...(progress.finished
      ? {
          shareText: buildShareText({
            puzzleNumber: puzzle.number,
            results: progress.results,
          }),
        }
      : {}),
  };
};
