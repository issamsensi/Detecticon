import puzzle001 from './001.json';
import type { Puzzle } from '../types';

export const puzzles: Puzzle[] = [puzzle001 as Puzzle];

export const getPuzzleById = (id: string): Puzzle | undefined =>
  puzzles.find((puzzle) => puzzle.id === id);
