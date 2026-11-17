export type AttemptResult = 'wrong' | 'correct';

export type CulpritInfo = {
  id: string;
  name: string;
};

export type GameState = {
  puzzleId: string;
  puzzleNumber: number;
  attemptsLeft: number;
  attemptsUsed: number;
  eliminatedIds: string[];
  results: AttemptResult[];
  solved: boolean;
  finished: boolean;
  /** Points earned for this puzzle; derived, never stored in the progress hash. */
  pointsEarned: number;
  sharedToComments: boolean;
  revealedKillerId?: string;
  shareText?: string;
  culprit?: CulpritInfo;
};

export const createInitialGameState = (
  puzzleId: string,
  puzzleNumber: number
): GameState => ({
  puzzleId,
  puzzleNumber,
  attemptsLeft: 3,
  attemptsUsed: 0,
  eliminatedIds: [],
  results: [],
  solved: false,
  finished: false,
  pointsEarned: 0,
  sharedToComments: false,
});

export const buildShareText = (
  state: Pick<GameState, 'puzzleNumber' | 'results'>
): string => {
  const squares = state.results
    .map((result) => (result === 'wrong' ? '🟥' : '🟩'))
    .join('');
  return `Detecticon #${state.puzzleNumber} ${squares}`;
};
