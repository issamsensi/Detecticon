import { redis } from '@devvit/web/server';
import { puzzles } from '../../shared/puzzles';
import { puzzleSchedule, type PuzzleSchedule } from '../../shared/schedule';
import type { Puzzle, PublicPuzzle, Suspect } from '../../shared/types';

// Redis key for the moderator-only test puzzle override. Ignored in production
// unless dev tools are explicitly enabled.
export const DEV_PUZZLE_OVERRIDE_KEY = 'detecticon:dev:puzzle-override';

/**
 * Dev tools (moderator test actions and the Redis puzzle override key) are
 * strictly disabled in production. Enable locally with DETECTICON_DEV_TOOLS=true
 * (also enabled automatically under Vitest).
 */
export const isDevToolsEnabled = (): boolean => {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }
  return process.env.DETECTICON_DEV_TOOLS === 'true' || process.env.NODE_ENV === 'test';
};

// Launch date (UTC) for both puzzle rotation start and displayed puzzle numbering
// so Launch Day (#1) starts cleanly on 001.json.
export const LAUNCH_DATE_UTC = Date.UTC(2026, 10, 24); // 2026-11-24 UTC
const START_DATE_UTC = LAUNCH_DATE_UTC;

export type TodayPuzzle = {
  puzzle: Puzzle;
  date: string; // UTC YYYY-MM-DD
  displayNumber: number;
  isDevOverride: boolean;
};

const toUtcDateString = (year: number, month: number, day: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const utcMidnightFromDateString = (date: string): number => {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return Date.UTC(year, month - 1, day);
};

export const getDisplayPuzzleNumber = (date: string): number => {
  const daysSinceLaunch = Math.floor(
    (utcMidnightFromDateString(date) - LAUNCH_DATE_UTC) / 86_400_000
  );
  return Math.max(1, daysSinceLaunch + 1);
};

export const getAllPuzzles = (): Puzzle[] => puzzles;

/** Pure UTC date string helper, so callers that only need the date don't read Redis. */
export const getUtcDateString = (now: Date = new Date()): string =>
  toUtcDateString(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

export type ResolvePuzzleOptions = {
  overrideId?: string | null;
  schedule?: PuzzleSchedule;
};

/**
 * Single source of truth for picking a UTC date's puzzle:
 * 1. Moderator dev override (when passed by getTodayInfo in dev/test mode)
 * 2. Explicit schedule entry for that UTC date (src/shared/schedule.json)
 * 3. Existing deterministic UTC date-based rotation
 */
export const resolvePuzzleForDate = (
  date: string,
  options: ResolvePuzzleOptions = {}
): TodayPuzzle => {
  const n = puzzles.length;
  const nowUtc = utcMidnightFromDateString(date);
  const daysSinceStart = Math.floor((nowUtc - START_DATE_UTC) / 86_400_000);
  const index = n > 0 ? ((daysSinceStart % n) + n) % n : -1;
  const rotationPuzzle = index >= 0 ? puzzles[index] : undefined;
  if (!rotationPuzzle) {
    throw new Error('No puzzles available');
  }
  const displayNumber = getDisplayPuzzleNumber(date);

  // 1. Moderator dev override.
  if (options.overrideId) {
    const overridePuzzle = getPuzzleById(options.overrideId);
    if (overridePuzzle) {
      console.warn(
        `⚠️  [DETECTICON DEV] PUZZLE OVERRIDE ACTIVE — serving puzzle ${overridePuzzle.id} ` +
          `instead of the daily puzzle for ${date}. ` +
          `Clear it with "Dev: clear puzzle override" (or delete ${DEV_PUZZLE_OVERRIDE_KEY}) before submission.`
      );
      return {
        puzzle: overridePuzzle,
        date,
        displayNumber,
        isDevOverride: true,
      };
    }
    console.warn(
      `⚠️  [DETECTICON DEV] Ignoring invalid puzzle override "${options.overrideId}" at ${DEV_PUZZLE_OVERRIDE_KEY}.`
    );
  }

  // 2. Scheduled puzzle for this UTC date.
  const schedule = options.schedule ?? puzzleSchedule;
  const scheduledId = Object.prototype.hasOwnProperty.call(schedule, date)
    ? schedule[date]
    : undefined;
  if (scheduledId) {
    const scheduledPuzzle = getPuzzleById(scheduledId);
    if (scheduledPuzzle) {
      return {
        puzzle: scheduledPuzzle,
        date,
        displayNumber,
        isDevOverride: false,
      };
    }
    console.warn(
      `⚠️  [DETECTICON] Ignoring unknown scheduled puzzle id "${scheduledId}" for ${date}.`
    );
  }

  // 3. Date-based rotation fallback.
  return {
    puzzle: rotationPuzzle,
    date,
    displayNumber,
    isDevOverride: false,
  };
};

export const getTodayInfo = async (
  now: Date = new Date(),
  schedule: PuzzleSchedule = puzzleSchedule
): Promise<TodayPuzzle> => {
  const date = getUtcDateString(now);
  // A moderator-only Redis key can replace the puzzle for local testing,
  // but is strictly ignored in production.
  const overrideId = isDevToolsEnabled() ? await redis.get(DEV_PUZZLE_OVERRIDE_KEY) : null;
  return resolvePuzzleForDate(date, { overrideId, schedule });
};

export const getTodaysPuzzle = async (now: Date = new Date()): Promise<Puzzle> =>
  (await getTodayInfo(now)).puzzle;

export const toClientPuzzle = (puzzle: Puzzle): PublicPuzzle => ({
  id: puzzle.id,
  number: puzzle.number,
  title: puzzle.title,
  scene: puzzle.scene,
  suspects: puzzle.suspects.map(({ id, name, role, color, testimony }) => ({
    id,
    name,
    role,
    color,
    testimony,
  })),
});

export const getPuzzleById = (id: string): Puzzle | undefined =>
  puzzles.find((puzzle) => puzzle.id === id);

export const getSuspectById = (puzzle: Puzzle, suspectId: string): Suspect | undefined =>
  puzzle.suspects.find((suspect) => suspect.id === suspectId);

