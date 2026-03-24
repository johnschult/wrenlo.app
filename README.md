# wrenlo

An SMB AI receptionist platform built with Fastify, TypeScript, SQLite, and Claude. wrenlo handles inbound customer conversations, scores leads, and lets business owners monitor and take over chats in real time — all from a mobile-friendly dashboard.

Live at [wrenlo.app](https://wrenlo.app)

## Setup

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

npm install
npm run dev
```

The server starts on `http://localhost:3000`. The DB is initialized and seeded automatically on startup.

## Docker

```bash
docker-compose up --build
```

SQLite data is persisted in a named volume (`sqlite_data`).

## API

### POST /chat

```json
{
  "businessId": "xdetailing-001",
  "message": "What services do you offer?",
  "conversationId": "optional-uuid-to-continue-a-conversation"
}
```

Response:

```json
{
  "response": "We offer three packages: ...",
  "conversationId": "uuid"
}
```

Pass the returned `conversationId` in subsequent requests to maintain conversation context.

### GET /health

Returns `{ "status": "ok" }`.

## Project Structure

```
src/
  config.ts           — env config
  server.ts           — Fastify entry point
  types/index.ts      — shared types
  routes/chat.ts      — POST /chat handler
  services/llm.ts     — Claude API integration
  services/business.ts — SQLite business loader
  db/schema.sql       — businesses table schema
  db/seed.sql         — sample XDetailing business
  public/             — chat widget (customer-facing)
  public/owner/       — wrenlo owner dashboard
```

## Adding a Business

Insert a row into the `businesses` table:

```sql
INSERT INTO businesses (id, name, system_prompt) VALUES (
  'my-biz-001',
  'My Business',
  'You are the wrenlo receptionist for My Business. ...'
);
```
