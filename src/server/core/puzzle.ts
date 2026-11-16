import { puzzles } from '../../shared/puzzles';
import type { Puzzle, PublicPuzzle, Suspect } from '../../shared/types';

// Past epoch so (days since epoch) stays non-negative for current/future dates.
const START_DATE_UTC = Date.UTC(2026, 0, 1); // 2026-01-01 UTC

export type TodayPuzzle = {
  puzzle: Puzzle;
  date: string; // UTC YYYY-MM-DD
};

const toUtcDateString = (year: number, month: number, day: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const getAllPuzzles = (): Puzzle[] => puzzles;

export const getTodayInfo = (now: Date = new Date()): TodayPuzzle => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const nowUtc = Date.UTC(year, month, day);
  const daysSinceStart = Math.floor((nowUtc - START_DATE_UTC) / 86_400_000);
  const n = puzzles.length;
  const index = ((daysSinceStart % n) + n) % n;
  const puzzle = puzzles[index];
  if (!puzzle) {
    throw new Error('No puzzles available');
  }
  return { puzzle, date: toUtcDateString(year, month, day) };
};

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

