import type { PublicPuzzle } from '../../shared/types';
import type { GameState } from '../../shared/game';

export type ProgressPayload = {
  attemptsLeft: number;
  attemptsUsed: number;
  eliminatedIds: string[];
  results: Array<'wrong' | 'correct'>;
  finished: boolean;
  solved: boolean;
  revealedKillerId?: string;
};

export type TodayResponse = {
  puzzle: PublicPuzzle;
  progress: ProgressPayload;
  state: GameState;
};

export type AccuseResponse = {
  correct: boolean;
  reveal: string;
  progress: ProgressPayload;
  state: GameState;
  alreadyFinished?: boolean;
  error?: string;
};

export type StatsResponse = {
  puzzleId: string;
  puzzleNumber: number;
  stats: {
    solved1: number;
    solved2: number;
    solved3: number;
    failed: number;
  };
};

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? 'Request failed');
  }
  return data;
};

export const fetchToday = async (): Promise<TodayResponse> =>
  request<TodayResponse>('/api/puzzle/today');

export const accuse = async (
  puzzleId: string,
  suspectId: string
): Promise<AccuseResponse> =>
  request<AccuseResponse>('/api/accuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ puzzleId, suspectId }),
  });

export const fetchTodayStats = async (): Promise<StatsResponse> =>
  request<StatsResponse>('/api/stats/today');
