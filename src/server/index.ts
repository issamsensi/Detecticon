import { Hono } from 'hono';
import { serve } from '@hono/node-server';

import { createServer, getServerPort } from '@devvit/web/server';
import { isDevToolsEnabled } from './core/puzzle';
import { menu } from './routes/menu';
import { dev } from './routes/dev';
import { triggers } from './routes/triggers';
import { game } from './routes/game';

const app = new Hono();

const api = new Hono();
api.route('/', game);

const internal = new Hono();
internal.route('/menu', menu);
internal.route('/triggers', triggers);
// Scheduler task handlers are served under /internal/scheduler/* (see devvit.json scheduler.tasks).
internal.route('/scheduler', triggers);
// Dev routes are strictly gated behind DETECTICON_DEV_TOOLS=true (disabled in production).
if (isDevToolsEnabled()) {
  internal.route('/', dev);
}

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer: createServer,
  port: getServerPort(),
});
