import rawSchedule from './schedule.json';
import { isUtcDateString } from './post-data';

export type PuzzleSchedule = Record<string, string>;

/** Minimum exclusive gap in days: a puzzle may not be scheduled twice within 8 days. */
export const MIN_SCHEDULE_REPEAT_GAP_DAYS = 8;

const DAY_MS = 86_400_000;

export const puzzleSchedule: PuzzleSchedule = rawSchedule;

const toUtcDayNumber = (date: string): number => {
  const [yearStr, monthStr, dayStr] = date.split('-');
  return Math.floor(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)) / DAY_MS);
};

/**
 * Extracts top-level object property keys directly from raw JSON text so
 * duplicate dates can be caught before JSON.parse silently deduplicates them.
 */
const extractTopLevelObjectKeys = (raw: string): string[] => {
  const keys: string[] = [];
  const len = raw.length;
  let i = 0;

  const skipWhitespace = (): void => {
    while (i < len && /\s/.test(raw[i] ?? '')) {
      i += 1;
    }
  };

  skipWhitespace();
  if (raw[i] !== '{') {
    return keys;
  }
  i += 1;

  let depth = 1;
  while (i < len && depth > 0) {
    skipWhitespace();
    const ch = raw[i];
    if (ch === undefined) break;

    if (ch === '}' || ch === ']') {
      depth -= 1;
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '"') {
      const start = i;
      i += 1;
      while (i < len) {
        if (raw[i] === '\\') {
          i += 2;
          continue;
        }
        if (raw[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      const literal = raw.slice(start, i);
      if (depth === 1) {
        skipWhitespace();
        if (raw[i] === ':') {
          try {
            keys.push(JSON.parse(literal) as string);
          } catch {
            // Invalid string escape will be reported by JSON.parse below.
          }
          i += 1;
        }
      }
      continue;
    }
    i += 1;
  }

  return keys;
};

export const validateScheduleJson = (
  raw: string,
  validPuzzleIds: ReadonlySet<string>
): { errors: string[]; entryCount: number } => {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    errors.push(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return { errors, entryCount: 0 };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('schedule must be a JSON object mapping YYYY-MM-DD dates to puzzle ids');
    return { errors, entryCount: 0 };
  }

  const seenDates = new Set<string>();
  const reportedDuplicates = new Set<string>();
  for (const key of extractTopLevelObjectKeys(raw)) {
    if (seenDates.has(key)) {
      if (!reportedDuplicates.has(key)) {
        errors.push(`duplicate schedule date "${key}"`);
        reportedDuplicates.add(key);
      }
    } else {
      seenDates.add(key);
    }
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  const datesByPuzzle = new Map<string, Array<{ date: string; dayNumber: number }>>();

  for (const [date, value] of entries) {
    const validDate = isUtcDateString(date);
    if (!validDate) {
      errors.push(`invalid UTC date "${date}" (expected valid YYYY-MM-DD)`);
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`schedule["${date}"] must be a non-empty puzzle id string`);
      continue;
    }

    if (!validPuzzleIds.has(value)) {
      errors.push(`schedule["${date}"] references unknown puzzle id "${value}"`);
      continue;
    }

    if (validDate) {
      const list = datesByPuzzle.get(value) ?? [];
      list.push({ date, dayNumber: toUtcDayNumber(date) });
      datesByPuzzle.set(value, list);
    }
  }

  for (const [puzzleId, scheduledDates] of datesByPuzzle.entries()) {
    scheduledDates.sort((a, b) => a.dayNumber - b.dayNumber);
    for (let index = 1; index < scheduledDates.length; index += 1) {
      const prev = scheduledDates[index - 1]!;
      const curr = scheduledDates[index]!;
      const gapDays = curr.dayNumber - prev.dayNumber;
      if (gapDays <= MIN_SCHEDULE_REPEAT_GAP_DAYS) {
        errors.push(
          `puzzle "${puzzleId}" is scheduled twice within ${MIN_SCHEDULE_REPEAT_GAP_DAYS} days ` +
            `(${prev.date} and ${curr.date}, ${gapDays} ${gapDays === 1 ? 'day' : 'days'} apart)`
        );
      }
    }
  }

  return { errors, entryCount: entries.length };
};
