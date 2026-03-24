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
import { initDb, seedDb } from './services/business.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Initialize DB on startup
initDb();
seedDb();

// Serve static files from src/public
app.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

// Routes
app.register(chatRoutes);
app.register(conversationRoutes);
app.register(customerRoutes);
app.register(intakeRoutes);
app.register(ownerRoutes);

// Redirect /owner → /owner/index.html
app.get('/owner', async (_req, reply) => reply.redirect('/owner/index.html'));

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Start
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
