# TestLattice - Architecture Documentation

This document describes the complete architecture of the TestLattice platform.

## Architecture Diagram

```mermaid
flowchart LR
  subgraph Frontend
    A[Next.js Web App / Dashboard] -->|GraphQL/REST| B[API Gateway (Edge - Vercel)]
    A -->|Auth| Clerk[Clerk]
  end

  subgraph API
    B --> C[Auth Middleware]
    C --> D[API Server (Node/TS - Express/Fastify)]
    D --> E[Postgres (Supabase)]
    D --> F[Supabase Storage (Artifacts)]
    D --> G[Stripe (Billing)]
    D --> H[Zapier / n8n Integrations]
    D --> I[Sentry]
  end

  subgraph Orchestration
    D --> J[Queue Manager - BullMQ (Redis)]
    J --> K[Worker Pool - Node Workers]
    K --> L[Test Runner Cluster]
    K --> M[LLM Service Adapter (OpenAI)]
    K --> N[Embeddings Store - Pinecone]
    K --> O[Vision Service / OCR]
  end

  subgraph TestRunnerCluster
    L --> Playwright[Playwright Grid (Browserless / Playwright Cloud)]
    L --> Appium[Appium Farm / Device Farm]
    Playwright -->|screenshots| F
    Appium -->|screenshots| F
  end

  subgraph Logging_Monitoring
    D --> Logs[ClickHouse or Postgres Analytics]
    D --> Sentry
    J --> Metrics[Prometheus / Grafana]
  end

  subgraph CI_CD
    Repo[GitHub] -->|push| Actions[GitHub Actions]
    Actions --> D
    Actions --> L
  end

  %% External users
  User[(Customer)] --> A

  %% Secrets and KMS
  D --> KMS[KMS / HashiCorp Vault]

  style Frontend fill:#f9f,stroke:#333,stroke-width:1px
  style API fill:#bbf
  style Orchestration fill:#bfb
  style TestRunnerCluster fill:#ffd
  style Logging_Monitoring fill:#eee
  style CI_CD fill:#fdd
```

## Component Descriptions

### Frontend (Next.js)
- **Technology**: Next.js 14 with App Router, TypeScript
- **Deployment**: Vercel
- **Purpose**: User dashboard for managing test runs, viewing results, billing management
- **Features**:
  - Test run creation and monitoring
  - Real-time status updates
  - Artifact viewing (screenshots, videos, logs)
  - Team management
  - Billing dashboard

### API Server (Fastify)
- **Technology**: Node.js + TypeScript + Fastify
- **Purpose**: Main API server handling business logic
- **Responsibilities**:
  - Authentication (via Clerk)
  - Request validation
  - Database operations (Supabase Postgres)
  - Job queuing (BullMQ)
  - Integration webhooks (GitHub, Zapier)
  - Billing metering (Stripe)

### Worker Service
- **Technology**: Node.js + TypeScript
- **Purpose**: Process test jobs from queue
- **Responsibilities**:
  - Job processing from BullMQ
  - Test runner coordination (Playwright/Appium)
  - LLM coordination (OpenAI)
  - Artifact collection and storage
  - Report generation
  - Embedding creation (Pinecone)

## Data Flow

1. **User triggers test** via dashboard or CI webhook with build URL/artifact
2. **API server** authenticates (Clerk), validates input, creates `TestRun` record in Postgres, enqueues job to BullMQ
3. **Worker** picks up job from queue
4. **Worker** reserves test runner slot (Playwright Grid or Appium)
5. **Worker** initializes session, captures initial screenshot
6. **Worker** sends screenshot to OpenAI + Vision Service for state parsing
7. **LLM** returns next action(s) in structured format (function call)
8. **Worker** executes actions via Playwright/Appium
9. **Worker** collects artifacts (screenshots, DOM, logs) and stores in Supabase Storage
10. **Worker** loops until termination (coverage reached, time limit, error)
11. **Worker** post-processes: video stitching, visual diffs, embedding creation, report generation
12. **API server** updates `TestRun` status, stores final report, notifies user
13. **Billing**: Usage metered → Stripe receives usage record

## API Endpoints

### Test Management
```
POST /api/tests/run
  Body: {
    projectId: "uuid",
    build: { type: "web|android|ios", url: "https://...", artifactId: "..." },
    profile: { device: "chrome-latest", region: "us-east-1", maxMinutes: 10 },
    options: { visualDiff: true, stressTest: true }
  }

GET /api/tests/:runId/status

GET /api/tests/:runId/artifacts

DELETE /api/tests/:runId
```

### Integrations
```
POST /api/integrations/github/webhook
POST /api/integrations/zapier/webhook
```

### Billing
```
GET /api/billing/usage
GET /api/billing/subscription
POST /api/billing/checkout
```

## Worker Pseudocode

```javascript
// Core worker loop (simplified)
while(true) {
  job = queue.getNextJob()
  session = runner.reserve(job.profile)
  
  try {
    state = session.captureScreenshot()
    context = vision.parse(state)
    history = []
    
    while(!job.done) {
      prompt = buildPrompt(job, context, history)
      action = openai.callFunction(prompt)
      session.execute(action)
      
      artifact = session.captureScreenshot()
      storage.save(artifact)
      history.push({action, artifactMeta})
      context = vision.parse(artifact)
      
      // Check termination conditions
      if (coverageReached || timeLimitExceeded || error) {
        job.done = true
      }
    }
    
    report = postProcess(history)
    db.updateRun(job.id, {status: 'completed', reportUrl: report.url})
    
  } catch(err) {
    db.updateRun(job.id, {status: 'failed', error: err.message})
  } finally {
    session.release()
  }
}
```

## Security & Compliance

- **KMS**: Encrypt API keys, tokens, refresh tokens (HashiCorp Vault or cloud KMS)
- **Row-Level Security**: Multi-tenant isolation in Supabase Postgres
- **Least Privilege**: Minimal OAuth scopes for external integrations
- **Audit Logs**: Track all writes to third-party services
- **SOC2/GDPR**: Data retention policies and region hosting options

## Scaling Considerations

- **Test Runner Cost**: Use spot instances and autoscaling
- **LLM Cost**: Batch calls, use cheaper models for simple tasks
- **Embedding Cache**: Reuse Pinecone embeddings for similar runs
- **Concurrency Limits**: Tier test concurrency per subscription plan
- **Worker Pool**: Auto-scale workers based on queue depth

## Monitoring

- **Queue Depth**: Monitor BullMQ queue size
- **Worker Health**: Track worker availability and processing time
- **Test Latency**: Measure end-to-end test execution time
- **Cost Metrics**: Track OpenAI, Pinecone, and runner costs
- **Error Rates**: Monitor failures and retry attempts

