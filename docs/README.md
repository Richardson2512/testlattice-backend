<<<<<<< HEAD
# Rihario Backend

Backend services for the Rihario AI-powered testing platform, including the API server and Worker service.

## Architecture

This repository contains two main backend services:

### 🔌 API Server (`/api`)
- **Technology**: Node.js + TypeScript (Fastify)
- **Purpose**: Main API server handling authentication, test requests, database operations, and job queuing
- **Port**: 3001 (default)

### ⚙️ Worker Service (`/worker`)
- **Technology**: Node.js + TypeScript
- **Purpose**: Worker service that processes test jobs, coordinates with LLM (Llama 4), and executes tests via Playwright/Appium
- **Queue**: BullMQ + Redis

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Fastify (API), BullMQ (Worker)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (S3-compatible)
- **Queue**: BullMQ + Redis
- **AI/ML**: Llama 4 (LLM), Qwen Instruct (Instruction Parsing)
- **Test Runners**: Playwright (Web), Appium (Mobile)
- **Monitoring**: Sentry
- **Authentication**: Supabase Auth

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Redis server (local or cloud)
- Supabase account and project
- Ollama (for local Llama 4 and Qwen models) or API keys for cloud providers


### Installation

1. Clone the repository:
```bash
git clone https://github.com/Richardson2512/Rihario-backend.git
cd Rihario-backend
```

2. Install dependencies for both services:
```bash
cd api && npm install
cd ../worker && npm install
```

3. Set up environment variables:

**API (`api/.env`):**
```env
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:3000

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Sentry (optional)
SENTRY_DSN=your_sentry_dsn
```

**Worker (`worker/.env`):**
```env
NODE_ENV=development

# API
API_URL=http://localhost:3001

# Redis
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Llama 4 (Local Ollama or Cloud)
LLAMA_API_KEY=ollama
LLAMA_API_URL=http://localhost:11434/v1
LLAMA_MODEL=llama3.2:latest

# Qwen Instruct (Local Ollama or Cloud)
QWEN_API_KEY=ollama
QWEN_API_URL=http://localhost:11434/v1
QWEN_MODEL=qwen2.5:latest



# Sentry (optional)
SENTRY_DSN=your_sentry_dsn
```

4. Set up the database:
```bash
# Run the Supabase schema
# Copy the SQL from api/supabase-schema.sql to your Supabase SQL editor
```

5. Start Redis:
```bash
# Using Docker
docker-compose up -d redis

# Or install Redis locally
redis-server
```

6. Start the services:

**Terminal 1 - API Server:**
```bash
cd api
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 - Worker Service:**
```bash
cd worker
npm run dev
# Processes test jobs from queue
```

## Project Structure

```
Rihario-backend/
├── api/                    # API Server
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── lib/            # Database, queue, Supabase clients
│   │   ├── middleware/     # Authentication middleware
│   │   ├── routes/         # API routes
│   │   │   ├── tests.ts    # Test run endpoints
│   │   │   ├── projects.ts  # Project management
│   │   │   ├── billing.ts  # Billing endpoints
│   │   │   └── integrations.ts # Webhooks
│   │   └── types/          # TypeScript types
│   ├── supabase-schema.sql # Database schema
│   └── package.json
│
└── worker/                 # Worker Service
    ├── src/
    │   ├── config/         # Configuration
    │   ├── processors/      # Test job processors
    │   │   └── testProcessor.ts # Main test execution logic
    │   ├── runners/         # Test runners
    │   │   ├── playwright.ts # Web test runner
    │   │   └── appium.ts    # Mobile test runner
    │   ├── services/        # External services
    │   │   ├── llama.ts     # Llama 4 integration
    │   │   ├── qwen.ts      # Qwen Instruct integration

    │   │   ├── storage.ts   # Supabase Storage
    │   │   └── comprehensiveTesting.ts # Comprehensive testing service
    │   ├── utils/           # Utilities
    │   │   └── errorFormatter.ts # Error formatting
    │   └── types/           # TypeScript types
    └── package.json
```

## API Endpoints

### Test Runs
- `POST /api/tests/run` - Create a new test run
- `GET /api/tests/:runId` - Get test run details
- `GET /api/tests/:runId/status` - Get test run status
- `GET /api/tests` - List test runs
- `POST /api/tests/:runId/pause` - Pause a test run
- `POST /api/tests/:runId/resume` - Resume a test run
- `POST /api/tests/:runId/stop` - Stop a test run
- `POST /api/tests/:runId/report` - Generate test report
- `GET /api/tests/:runId/download` - Download test report (ZIP)
- `POST /api/tests/:runId/cancel` - Cancel a test run

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create a project
- `GET /api/projects/:projectId` - Get project details

### Artifacts
- `GET /api/tests/:runId/artifacts` - List test artifacts
- `POST /api/tests/:runId/artifacts` - Upload artifact

## Features

### Comprehensive Testing
The platform includes 9 major feature categories:

1. **Smart UI Interaction Testing** - Auto-detect and interact with UI elements
2. **Visual Validation** - Layout shift detection, visual diffing
3. **DOM Deep Analysis** - Element health, broken links, missing labels
4. **Performance Monitoring** - Page load timing, FCP, resource tracking
5. **Accessibility Testing** - ARIA labels, contrast, keyboard navigation
6. **Console & Network Error Tracking** - JavaScript errors, failed requests
7. **Video Recording & Screenshots** - Full session recording
8. **AI Test Script Generation** - Automatic test plan generation
9. **Exploratory Crawler Testing** - Automatic page discovery

### Test Modes
- **Single Page**: Test a single URL
- **Multi Page**: Test up to 3 specified URLs
- **All Pages**: Automatically discover and test all pages on a site

## Development

### Build for Production

**API:**
```bash
cd api
npm run build
npm start
```

**Worker:**
```bash
cd worker
npm run build
npm start
```

### Database Schema

The database schema is defined in `api/supabase-schema.sql`. Key tables:
- `projects` - Test projects
- `test_runs` - Test run records
- `test_artifacts` - Screenshots, videos, logs
- `test_steps` - Individual test steps

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the Rihario platform.