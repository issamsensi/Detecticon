import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { createPost, createTodaysDetectivoPost } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

// Moderator action: create today's Detecticon post on demand (useful for testing/manual posting).
menu.post('/post-create-today', async (c) => {
  try {
    const result = await createTodaysDetectivoPost();
    if (result.skipped) {
      return c.json<UiResponse>(
        {
          showToast: `Today's Detecticon post already exists (${result.date}).`,
        },
        200
      );
    }
    if (result.postId) {
      return c.json<UiResponse>(
        {
          navigateTo: `https://reddit.com/comments/${result.postId}`,
        },
        200
      );
    }
    return c.json<UiResponse>({ showToast: 'Post created.' }, 200);
  } catch (error) {
    console.error(`Error creating today's Detecticon post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create today’s Detecticon post',
      },
      400
    );
  }
});
