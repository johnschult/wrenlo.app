import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { config } from './config.js';
import { chatRoutes } from './routes/chat.js';
import { conversationRoutes } from './routes/conversations.js';
import { customerRoutes } from './routes/customers.js';
import { intakeRoutes } from './routes/intake.js';
import { ownerRoutes } from './routes/owner.js';
import { initDb, seedDb, getBusinessById } from './services/business.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Initialize DB on startup
initDb();
seedDb();

// Serve static assets (CSS, JS, SVGs, images)
app.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
  wildcard: false,
  index: false,
});

// ── Page routes ─────────────────────────────────────────────────────────────

// Landing page
app.get('/', async (_req, reply) => {
  return reply.sendFile('landing.html');
});

// Per-business chat widget
app.get('/w/:businessId', async (req, reply) => {
  const { businessId } = req.params as { businessId: string };
  const business = getBusinessById(businessId);
  if (!business) {
    reply.code(404);
    return reply.sendFile('landing.html');
  }
  return reply.sendFile('widget.html');
});

// Owner dashboard
app.get('/owner/:businessId', async (req, reply) => {
  const { businessId } = req.params as { businessId: string };
  const business = getBusinessById(businessId);
  if (!business) {
    reply.code(404);
    return reply.sendFile('landing.html');
  }
  return reply.sendFile('owner/index.html');
});

// Bare /owner redirects to landing
app.get('/owner', async (_req, reply) => reply.redirect('/'));

// ── API routes ──────────────────────────────────────────────────────────────

app.register(chatRoutes);
app.register(conversationRoutes);
app.register(customerRoutes);
app.register(intakeRoutes);
app.register(ownerRoutes);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Start
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
