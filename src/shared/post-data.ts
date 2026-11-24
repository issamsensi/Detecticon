import type { JsonObject } from '@devvit/web/shared';

/**
 * Data attached to each Detecticon custom post. It is sent to the client, so it
 * must only contain non-sensitive values.
 */
export type PuzzlePostData = {
  date: string; // UTC YYYY-MM-DD of this post's puzzle instance
  puzzleId: string;
};

export const isUtcDateString = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

/** Accepts only well-formed post data; anything else falls back to today's puzzle. */
export const parsePuzzlePostData = (raw: unknown): PuzzlePostData | null => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  if (!('date' in raw) || !('puzzleId' in raw)) return null;
  if (!isUtcDateString(raw.date) || typeof raw.puzzleId !== 'string' || raw.puzzleId === '') {
    return null;
  }

  return { date: raw.date, puzzleId: raw.puzzleId };
};

export const buildPuzzlePostData = (data: PuzzlePostData): JsonObject => ({
  date: data.date,
  puzzleId: data.puzzleId,
});
