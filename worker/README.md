# TestLattice Worker

Worker service that processes test jobs from the queue.

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- Redis: Connection to BullMQ queue
- Supabase: Storage for artifacts
- OpenAI: LLM for test reasoning
- Pinecone: Vector embeddings storage
- Test Runners: Playwright Grid and Appium URLs

## Project Structure

```
worker/
├── src/
│   ├── index.ts           # Entry point
│   ├── worker.ts          # Main worker loop
│   ├── processors/        # Job processors
│   ├── runners/           # Test runner adapters (Playwright/Appium)
│   ├── services/          # LLM, vision, storage services
│   ├── lib/               # Utilities
│   └── types/             # TypeScript types
└── dist/                  # Compiled output
```

## Core Functionality

1. **Job Processing**: Picks up test jobs from BullMQ queue
2. **Test Execution**: Coordinates with Playwright/Appium to run tests
3. **AI Coordination**: Uses OpenAI to determine test actions
4. **Artifact Management**: Captures and stores screenshots, videos, logs
5. **Result Processing**: Generates reports and embeddings

## Development

- `npm run dev` - Start with hot reload (tsx watch)
- `npm run build` - Build TypeScript
- `npm start` - Run production build
- `npm run lint` - Run ESLint

