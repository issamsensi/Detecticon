import { context, reddit, redis } from '@devvit/web/server';
import { buildPuzzlePostData } from '../../shared/post-data';
import { getTodayInfo } from './puzzle';

export type DailyPostResult = {
  created: boolean;
  skipped: boolean;
  date: string;
  title: string;
  postId?: string;
  displayNumber: number;
};

const dailyPostKey = (date: string): string => `detecticon:daily-post:${date}`;

// Every post carries its own UTC date + puzzle id so old posts keep showing
// the puzzle they were created for. Dev override is marked explicitly.
const todayPostData = async () => {
  const { puzzle, date, displayNumber, isDevOverride } = await getTodayInfo();
  return {
    puzzle,
    date,
    displayNumber,
    postData: buildPuzzlePostData({
      date,
      puzzleId: puzzle.id,
      ...(isDevOverride ? { devOverride: true } : {}),
    }),
  };
};

export const createTodaysDetectivoPost = async (): Promise<DailyPostResult> => {
  const { puzzle, date, displayNumber, postData } = await todayPostData();
  const title = `Detecticon #${displayNumber}: ${puzzle.title}`;
  const key = dailyPostKey(date);

  // Prevent duplicates for the same UTC date: store the date/key in Redis before creating, and skip if it exists.
  const reserved = await redis.set(key, '1', { nx: true });
  if (reserved == null) {
    const existingPostId = await redis.get(key);
    return {
      created: false,
      skipped: true,
      date,
      title,
      displayNumber,
      ...(existingPostId && existingPostId !== '1' ? { postId: existingPostId } : {}),
    };
  }

  const subredditName = context.subredditName;
  try {
    const post = await reddit.submitCustomPost({
      ...(subredditName ? { subredditName } : {}),
      title,
      entry: 'default',
      postData,
    });

    // Record the created post id for reference (date was already stored before creation).
    await redis.set(key, post.id);

    return { created: true, skipped: false, date, title, postId: post.id, displayNumber };
  } catch (error) {
    // If creation fails after the nx claim, delete the key so a retry can create the post.
    try {
      await redis.del(key);
    } catch (deleteError) {
      console.error(
        `Failed to clear daily post key after submit error for ${date}: ${deleteError}`
      );
    }
    console.error(`Failed to create daily Detecticon post for ${date}: ${error}`);
    throw error;
  }
};
