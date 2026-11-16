import type { PublicPuzzle } from '../../shared/types';
import type { GameState } from '../../shared/game';

export type ProgressPayload = {
  attemptsLeft: number;
  attemptsUsed: number;
  eliminatedIds: string[];
  results: Array<'wrong' | 'correct'>;
  finished: boolean;
  solved: boolean;
  sharedToComments: boolean;
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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new NetworkError();
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Request failed';
    throw new ApiError(message, response.status);
  }

  return data as T;
};

export const fetchToday = async (): Promise<TodayResponse> =>
  request<TodayResponse>('/api/puzzle/today');

export type ShareResponse = {
  progress: ProgressPayload;
  state: GameState;
};

export const accuse = async (
  puzzleId: string,
  suspectId: string
): Promise<AccuseResponse> =>
  request<AccuseResponse>('/api/accuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ puzzleId, suspectId }),
  });

export const shareResult = async (puzzleId: string): Promise<ShareResponse> =>
  request<ShareResponse>('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ puzzleId }),
  });

export const fetchTodayStats = async (): Promise<StatsResponse> =>
  request<StatsResponse>('/api/stats/today');
