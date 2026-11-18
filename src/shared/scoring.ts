/**
 * Weekly leaderboard scoring. Pure so both the client and the server can use it.
 * A solve earns 3 points on the first accusation, 2 on the second, and 1 on the
 * third. A failed case earns none.
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
