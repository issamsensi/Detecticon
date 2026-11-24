import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';

import { createTodaysDetectivoPost } from '../core/post';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const result = await createTodaysDetectivoPost();

    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: result.skipped
          ? `Today's post already exists in subreddit ${context.subredditName} (${result.date}, trigger: ${input.type})`
          : `Post created in subreddit ${context.subredditName} with id ${result.postId ?? 'unknown'} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

// Scheduled task: runs daily at 00:00 UTC (configured in devvit.json) to create today's Detecticon post.
// Idempotent: createTodaysDetectivoPost skips if the UTC date key already exists.
triggers.post('/daily-post', async (c) => {
  try {
    const result = await createTodaysDetectivoPost();
    console.log(
      `Daily Detecticon post handler: date=${result.date} postId=${result.postId ?? 'none'} skipped=${result.skipped}`
    );
    return c.json({ status: 'ok' }, 200);
  } catch (error) {
    console.error(`Error creating daily Detecticon post: ${error}`);
    return c.json({ status: 'error', message: 'Failed to create daily post' }, 500);
  }
});
