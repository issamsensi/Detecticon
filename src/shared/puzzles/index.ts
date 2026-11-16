/// <reference types="vite/client" />

import type { Puzzle } from '../types';

const modules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Puzzle>;

const byFile = (a: string, b: string): number => a.localeCompare(b);

export const puzzles: Puzzle[] = Object.entries(modules)
  .filter(([path]) => path.endsWith('.json'))
  .sort(([a], [b]) => byFile(a, b))
  .map(([, puzzle]) => puzzle);

export const getPuzzleById = (id: string): Puzzle | undefined =>
  puzzles.find((puzzle) => puzzle.id === id);

