import type { AnalystSession } from '../types';

// Survive Next.js hot reload in development
declare global {
  // eslint-disable-next-line no-var
  var _analystSessions: Map<string, AnalystSession> | undefined;
}

export const sessions: Map<string, AnalystSession> =
  globalThis._analystSessions ?? new Map();

if (process.env.NODE_ENV !== 'production') {
  globalThis._analystSessions = sessions;
}

// Prune sessions older than 2 hours
setInterval(
  () => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, s] of sessions) {
      if (new Date(s.createdAt).getTime() < cutoff) sessions.delete(id);
    }
  },
  60_000
);
