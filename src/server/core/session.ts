import { context } from '@devvit/web/server';
import type { Puzzle } from '../../shared/types';
import { parsePuzzlePostData } from '../../shared/post-data';
import {
  getDisplayPuzzleNumber,
  getPuzzleById,
  getTodayInfo,
  type TodayPuzzle,
} from './puzzle';

/**
 * Everything a request needs to play one post's puzzle. `practice` is true for
 * posts whose stored UTC date is not today: they are still playable, but they
 * do not count for stats or the weekly leaderboard.
 */
export type PuzzleSession = {
  puzzle: Puzzle;
  date: string;
  displayNumber: number;
  practice: boolean;
};

/**
 * Pure selection logic: stored post data wins; missing or invalid data falls
 * back to today's puzzle (older posts created before post data existed).
 */
export const selectPuzzleSession = (postData: unknown, today: TodayPuzzle): PuzzleSession => {
  const stored = parsePuzzlePostData(postData);
  if (stored !== null) {
    const puzzle = getPuzzleById(stored.puzzleId);
    if (puzzle) {
      return {
        puzzle,
        date: stored.date,
        displayNumber: getDisplayPuzzleNumber(stored.date),
        practice: stored.date !== today.date,
      };
    }
  }

  return {
    puzzle: today.puzzle,
    date: today.date,
    displayNumber: today.displayNumber,
    practice: false,
  };
};

export const resolvePuzzleSession = (now: Date = new Date()): PuzzleSession =>
  selectPuzzleSession(context.postData, getTodayInfo(now));
