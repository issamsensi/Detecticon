import { puzzles } from '../../shared/puzzles';
import type { Puzzle, PublicPuzzle, Suspect } from '../../shared/types';

const START_DATE_UTC = Date.UTC(2026, 10, 20); // 2026-11-20

export const getAllPuzzles = (): Puzzle[] => puzzles;

export const getTodaysPuzzle = (now: Date = new Date()): Puzzle => {
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceStart = Math.floor((nowUtc - START_DATE_UTC) / 86_400_000);
  const index = ((daysSinceStart % puzzles.length) + puzzles.length) % puzzles.length;
  const puzzle = puzzles[index];
  if (!puzzle) {
    throw new Error('No puzzles available');
  }
  return puzzle;
};

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

