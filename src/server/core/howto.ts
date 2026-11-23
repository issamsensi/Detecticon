import { reddit, redis } from '@devvit/web/server';

// Redis key: detecticon:seen-howto:{player}
// - "detecticon": app namespace to avoid collisions.
// - "seen-howto": one flag per Reddit user; no date, so it is remembered
//   across days. Logged-out users have no key and see the overlay every time.
// Value: the string "1" once the player taps "Got it".
export const seenHowToKey = (player: string): string => `detecticon:seen-howto:${player}`;

export const getSeenHowTo = async (): Promise<boolean> => {
  const player = await reddit.getCurrentUsername();
  if (!player) {
    return false;
  }
  return (await redis.get(seenHowToKey(player))) === '1';
};

export const markHowToSeen = async (): Promise<void> => {
  const player = await reddit.getCurrentUsername();
  if (!player) {
    return; // never persist anything for logged-out users
  }
  await redis.set(seenHowToKey(player), '1');
};
