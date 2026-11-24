import { puzzles } from '../../shared/puzzles';
import { puzzleSchedule, type PuzzleSchedule } from '../../shared/schedule';
import type { Puzzle, PublicPuzzle, Suspect } from '../../shared/types';

// Rotation epoch (UTC) for the deterministic daily puzzle cycle.
const START_DATE_UTC = Date.UTC(2026, 10, 24); // 2026-11-24 UTC

// Launch date (UTC) for displayed puzzle numbering (daysSinceLaunch + 1, clamped to 1).
export const LAUNCH_DATE_UTC = Date.UTC(2026, 10, 26); // 2026-11-26 UTC

export type TodayPuzzle = {
  puzzle: Puzzle;
  date: string; // UTC YYYY-MM-DD
  displayNumber: number;
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

/** Pure UTC date string helper. */
export const getUtcDateString = (now: Date = new Date()): string =>
  toUtcDateString(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

export type ResolvePuzzleOptions = {
  schedule?: PuzzleSchedule;
};

/**
 * Single source of truth for picking a UTC date's puzzle:
 * 1. Explicit schedule entry for that UTC date (src/shared/schedule.json)
 * 2. Deterministic UTC date-based rotation
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

  // 1. Scheduled puzzle for this UTC date.
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
      };
    }
    console.warn(
      `⚠️  [DETECTICON] Ignoring unknown scheduled puzzle id "${scheduledId}" for ${date}.`
    );
  }

  // 2. Date-based rotation fallback.
  return {
    puzzle: rotationPuzzle,
    date,
    displayNumber,
  };
};

export const getTodayInfo = (
  now: Date = new Date(),
  schedule: PuzzleSchedule = puzzleSchedule
): TodayPuzzle => resolvePuzzleForDate(getUtcDateString(now), { schedule });

export const getTodaysPuzzle = (now: Date = new Date()): Puzzle => getTodayInfo(now).puzzle;

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

