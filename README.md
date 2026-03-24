# wrenlo

An SMB AI receptionist platform built with Fastify, TypeScript, SQLite, and Claude. wrenlo handles inbound customer conversations, scores leads, and lets business owners monitor and take over chats in real time — all from a responsive dashboard.

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

## Routes

### Pages

| Path | Description |
|------|-------------|
| `/` | Landing page (future: onboarding portal) |
| `/w/:businessId` | Customer chat widget for a specific business |
| `/owner/:businessId` | Owner dashboard for managing conversations |

### API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Send a customer message, get AI response |
| `POST` | `/intake/start` | Generate intake questions for a business type |
| `POST` | `/intake/complete` | Generate system prompt from intake answers |
| `GET` | `/conversations/:id` | Load full conversation with messages |
| `POST` | `/conversations/:id/claim` | Owner takes over a conversation |
| `POST` | `/conversations/:id/release` | Release conversation back to AI |
| `POST` | `/conversations/:id/owner-message` | Owner sends a message to customer |
| `GET` | `/customers/:id` | Load customer profile and conversations |
| `GET` | `/api/owner/:businessId/conversations` | List conversations for dashboard |
| `GET` | `/api/owner/:businessId/stats` | Dashboard stats (active, hot leads, today, total) |
| `GET` | `/api/owner/:businessId/settings` | Business settings for dashboard |
| `GET` | `/health` | Health check |

### Examples

**Chat widget**: `http://localhost:3000/w/xdetailing-001`

**Owner dashboard**: `http://localhost:3000/owner/xdetailing-001`

**POST /chat**:

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

## Project Structure

```
src/
  config.ts                — env config
  server.ts                — Fastify entry point, page + API routing
  types/index.ts           — shared TypeScript interfaces
  routes/
    chat.ts                — POST /chat handler
    conversations.ts       — conversation claim/release/messaging
    customers.ts           — customer lookup
    intake.ts              — intake Q&A pipeline
    owner.ts               — owner dashboard API endpoints
  services/
    business.ts            — SQLite database operations
    llm.ts                 — Claude API integration
    intake.ts              — intake question + prompt generation
    lead-detector.ts       — lead scoring logic
    notifications.ts       — owner notification channels
  prompts/
    intake-meta-prompt.ts  — system prompts for intake pipeline
  db/
    schema.sql             — businesses table schema
    migration_001.sql      — customers, conversations, messages tables
    migration_002.sql      — owner fields, lead scoring, handoff
    seed.sql               — sample XDetailing business
  public/
    landing.html           — landing page served at /
    widget.html            — chat widget served at /w/:businessId
    chat.js                — chat widget logic
    styles.css             — chat widget styles
    wrenlo-icon.svg        — square icon mark
    wrenlo-logo.svg        — wide wordmark
    owner/
      index.html           — dashboard served at /owner/:businessId
      dashboard.js         — dashboard logic
      styles.css           — dashboard styles
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

Then visit `http://localhost:3000/w/my-biz-001` to chat and `http://localhost:3000/owner/my-biz-001` to manage.
