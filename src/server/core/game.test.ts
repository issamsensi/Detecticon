import { expect } from 'vitest';
import { test } from '../test';
import { toGameState, type StoredProgress } from './game';
import type { Puzzle } from '../../shared/types';

const puzzle: Puzzle = {
  id: 'test',
  number: 1,
  title: 'The Test Case',
  scene: 'A test scene.',
  suspects: [
    {
      id: 'cleared',
      name: 'Cleared Suspect',
      role: 'Witness',
      color: 0,
      testimony: 'I saw nothing.',
      alibiProof: 'CLEARED_PROOF_ONE',
      isKiller: false,
    },
    {
      id: 'untouched',
      name: 'Untouched Suspect',
      role: 'Neighbour',
      color: 0,
      testimony: 'I was home.',
      alibiProof: 'HIDDEN_PROOF_TWO',
      isKiller: false,
    },
    {
      id: 'killer',
      name: 'The Killer',
      role: 'Insider',
      color: 0,
      testimony: 'I was elsewhere.',
      contradiction: 'KILLER_SECRET',
      isKiller: true,
    },
    {
      id: 'cleared-too',
      name: 'Another Cleared Suspect',
      role: 'Clerk',
      color: 0,
      testimony: 'I was at the shop.',
      alibiProof: 'CLEARED_PROOF_THREE',
      isKiller: false,
    },
  ],
};

const progress = (overrides: Partial<StoredProgress> = {}): StoredProgress => ({
  attemptsLeft: 3,
  attemptsUsed: 0,
  eliminatedIds: [],
  results: [],
  finished: false,
  solved: false,
  statsCounted: false,
  sharedToComments: false,
  ...overrides,
});

test('a fresh state reveals no alibi proofs or contradiction', () => {
  const state = toGameState(puzzle, progress());
  expect(state.eliminatedAlibis).toBeUndefined();
  const serialized = JSON.stringify(state);
  expect(serialized).not.toContain('CLEARED_PROOF_ONE');
  expect(serialized).not.toContain('HIDDEN_PROOF_TWO');
  expect(serialized).not.toContain('KILLER_SECRET');
});

test('only eliminated suspects expose their alibi proof after a reload', () => {
  const state = toGameState(
    puzzle,
    progress({ attemptsUsed: 2, attemptsLeft: 1, eliminatedIds: ['cleared'], results: ['wrong', 'wrong'] })
  );
  expect(state.eliminatedAlibis).toEqual({ cleared: 'CLEARED_PROOF_ONE' });
  const serialized = JSON.stringify(state);
  expect(serialized).not.toContain('HIDDEN_PROOF_TWO');
  expect(serialized).not.toContain('KILLER_SECRET');
});

test('a finished game still does not reveal the killer contradiction', () => {
  const state = toGameState(
    puzzle,
    progress({
      attemptsUsed: 3,
      attemptsLeft: 0,
      eliminatedIds: ['cleared', 'cleared-too'],
      results: ['wrong', 'wrong', 'correct'],
      finished: true,
      solved: true,
    })
  );
  expect(state.eliminatedAlibis).toEqual({
    cleared: 'CLEARED_PROOF_ONE',
    'cleared-too': 'CLEARED_PROOF_THREE',
  });
  const serialized = JSON.stringify(state);
  expect(serialized).not.toContain('KILLER_SECRET');
});

test('a killer id in eliminated data is never treated as cleared', () => {
  const state = toGameState(
    puzzle,
    progress({ eliminatedIds: ['killer'], attemptsUsed: 1, results: ['wrong'] })
  );
  expect(state.eliminatedAlibis).toBeUndefined();
  expect(JSON.stringify(state)).not.toContain('KILLER_SECRET');
});
