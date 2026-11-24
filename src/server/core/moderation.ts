import { createMiddleware } from 'hono/factory';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';

/**
 * Server-side moderator verification.
 *
 * `forUserType: "moderator"` in devvit.json only controls who *sees* a menu item.
 * Every privileged endpoint must verify the caller itself, so this helper checks
 * the request's user against the current subreddit's moderator list. Fails closed.
 */
export const isCurrentUserModerator = async (): Promise<boolean> => {
  const { userId, subredditName } = context;

  if (!userId || !subredditName) {
    return false;
  }

  try {
    const user = await reddit.getUserById(userId);
    if (!user) {
      return false;
    }
    // An empty array means the user has no moderator permissions in this subreddit.
    const permissions = await user.getModPermissionsForSubreddit(subredditName);
    return permissions.length > 0;
  } catch (error) {
    console.warn(`[DETECTICON] Moderator check failed for ${subredditName}: ${error}`);
    return false;
  }
};

export const requireModerator = createMiddleware(async (c, next) => {
  if (!(await isCurrentUserModerator())) {
    console.warn(`[DETECTICON] Blocked non-moderator request: ${c.req.path}`);
    return c.json<UiResponse>(
      { showToast: 'Only subreddit moderators can use this Detecticon action.' },
      403
    );
  }
  await next();
});
