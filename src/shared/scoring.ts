/**
 * Weekly leaderboard scoring. Pure so both the client and the server can use it.
 * A solve earns 3, 2 or 1 points when it happens on the first, second or third
 * accusation. A case that is not solved within three tries earns none.
 * `attemptsUsed` counts the winning accusation too, so a correct third guess is
 * `attemptsUsed === 3`.
 */
export const MAX_ATTEMPTS = 3;

/** Points awarded for solving on attempt 1, 2, or 3 (index = attemptsUsed - 1). */
export const POINTS_BY_ATTEMPT = [3, 2, 1] as const;

export const pointsForAttempts = (attemptsUsed: number, solved: boolean): number => {
  if (!solved || !Number.isInteger(attemptsUsed)) return 0;
  return POINTS_BY_ATTEMPT[attemptsUsed - 1] ?? 0;
};

export const formatPointsEarned = (points: number): string =>
  `${points} ${points === 1 ? 'point' : 'points'}`;

export const formatPointsDelta = (points: number): string =>
  `+${formatPointsEarned(points)}`;

export const formatHowToScoringLine = (): string =>
  `3. Three tries: ${formatPointsEarned(POINTS_BY_ATTEMPT[0])} on the 1st, ${POINTS_BY_ATTEMPT[1]} on the 2nd, ${POINTS_BY_ATTEMPT[2]} on the 3rd.`;
