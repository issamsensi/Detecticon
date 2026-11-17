const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** UTC date string (YYYY-MM-DD) of the Monday that starts the player's week. */
export const getWeekId = (date: Date): string => {
  const weekday = date.getUTCDay(); // 0 = Sunday
  const daysFromMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + daysFromMonday
    )
  );
  return (
    `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-` +
    `${pad2(monday.getUTCDate())}`
  );
};

export const getWeekStartMs = (weekId: string): number => {
  const parts = weekId.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return Date.UTC(year, month - 1, day);
};

/** Elapsed milliseconds since Monday 00:00 UTC, used as the leaderboard tie-break. */
export const getMsSinceWeekStart = (now: Date): number =>
  Math.max(0, Math.min(WEEK_MS, now.getTime() - getWeekStartMs(getWeekId(now))));

/** Whole seconds until the next Monday 00:00 UTC reset. */
export const secondsUntilWeekReset = (now: Date): number =>
  Math.max(0, Math.ceil((getWeekStartMs(getWeekId(now)) + WEEK_MS - now.getTime()) / 1000));

/** Compact countdown shown in the leaderboard scene, e.g. "Resets in 3d 04:12". */
export const formatResetsIn = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `Resets in ${days}d ${pad2(hours)}:${pad2(minutes)}`;
};
