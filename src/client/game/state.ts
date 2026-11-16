export type AttemptResult = 'wrong' | 'correct';

export type GameState = {
  puzzleId: string;
  puzzleNumber: number;
  attemptsLeft: number;
  attemptsUsed: number;
  eliminatedIds: string[];
  results: AttemptResult[];
  solved: boolean;
  revealedKillerId?: string;
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
});

export const buildShareText = (state: GameState): string => {
  const squares = state.results.map((result) => (result === 'wrong' ? '🟥' : '🟩')).join('');
  return `Detectivo #${state.puzzleNumber} ${squares}`;
};
