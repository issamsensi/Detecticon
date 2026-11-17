/**
 * Weekly leaderboard scoring. Pure so both the client and the server can use it.
 * A correct first guess is worth the most; later solves earn fewer points and a
 * failed case earns none.
 */
export const pointsForAttempts = (attemptsUsed: number, solved: boolean): number => {
  if (!solved) return 0;
  if (attemptsUsed === 1) return 2;
  if (attemptsUsed === 2) return 1;
  return 0;
};

export const formatPointsEarned = (points: number): string =>
  `${points} ${points === 1 ? 'point' : 'points'}`;
