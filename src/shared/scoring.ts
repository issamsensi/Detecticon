/**
 * Weekly leaderboard scoring. Pure so both the client and the server can use it.
 * A solve earns 3, 2 or 1 points when it happens on the first, second or third
 * accusation. A case that is not solved within three tries earns none.
 * `attemptsUsed` counts the winning accusation too, so a correct third guess is
 * `attemptsUsed === 3`.
 */
export const pointsForAttempts = (attemptsUsed: number, solved: boolean): number => {
  if (!solved) return 0;
  if (attemptsUsed === 1) return 3;
  if (attemptsUsed === 2) return 2;
  if (attemptsUsed === 3) return 1;
  return 0;
};

export const formatPointsEarned = (points: number): string =>
  `${points} ${points === 1 ? 'point' : 'points'}`;
