import { context, reddit, redis } from '@devvit/web/server';
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

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'detecticon',
  });
};

export const createTodaysDetectivoPost = async (): Promise<DailyPostResult> => {
  const { puzzle, date, displayNumber } = getTodayInfo();
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
