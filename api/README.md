# TestLattice API

Fastify-based API server for the TestLattice platform.

## Getting Started

```bash
npm install
npm run dev
```

Server will start on `http://localhost:3001` (or PORT from .env).

## Environment Variables

Copy `.env.example` to `.env` and configure:

- Database: Supabase PostgreSQL connection
- Redis: For BullMQ job queue
- Supabase: Authentication (JWT-based)
- Stripe: Billing
- Llama 4: LLM service (via Ollama or cloud API)
- Pinecone: Vector embeddings
- Sentry: Error tracking

## Project Structure

```
api/
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Fastify app setup
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── lib/               # Utilities
│   ├── types/             # TypeScript types
│   └── config/            # Configuration
└── dist/                  # Compiled output
```

## API Endpoints

### Test Management
- `POST /api/tests/run` - Start a new test run
- `GET /api/tests/:runId/status` - Get test run status
- `GET /api/tests/:runId/artifacts` - Get test artifacts

### Integrations
- `POST /api/integrations/github/webhook` - GitHub webhook handler

## Development

- `npm run dev` - Start with hot reload (tsx watch)
- `npm run build` - Build TypeScript
- `npm start` - Run production build
- `npm run lint` - Run ESLint

