# Pinecone Index Configuration Guide

This guide explains the recommended Pinecone index configuration for the Ghost Tester platform.

## ✅ Your Index is Already Created!

Your Pinecone index has been created:
- **Index Name**: `ghost-tester`
- **Host**: `https://ghost-tester-uxsubej.svc.aped-4627-b74a.pinecone.io`
- **Region**: `us-east-1`

See `PINECONE_INDEX_DETAILS.md` for your specific index details.

## Recommended Index Configuration

### Option 1: Index with Integrated Embedding Model (Recommended)

This is the **best option** for most use cases. Pinecone handles embedding generation automatically.

```bash
pc index create \
  -n ghost-tester \
  -m cosine \
  -c aws \
  -r us-east-1 \
  --model llama-text-embed-v2 \
  --field_map text=content
```

**Configuration Details:**
- **Name**: `ghost-tester`
- **Metric**: `cosine` (best for semantic similarity)
- **Cloud**: `aws` (or `gcp`, `azure`)
- **Region**: `us-east-1` (choose closest to your users)
- **Embedding Model**: `llama-text-embed-v2` (high-performance, recommended)
- **Field Map**: `text=content` (maps your text field to Pinecone's content field)

**Benefits:**
- ✅ Automatic embedding generation
- ✅ No need to manage embedding models separately
- ✅ Optimized for performance
- ✅ Built-in text preprocessing

**Usage:**
```typescript
// When upserting, just provide text - embeddings generated automatically
await index.upsert_records("namespace", [
  {
    "_id": "step1",
    "content": "Click login button",
    "runId": "run123",
    "stepNumber": 1
  }
])
```

### Option 2: Standard Index (Manual Embeddings)

Use this if you want to generate embeddings yourself (e.g., using OpenAI, Cohere, or HuggingFace).

```bash
pc index create \
  -n ghost-tester \
  -m cosine \
  -c aws \
  -r us-east-1 \
  -d 1536
```

**Configuration Details:**
- **Name**: `ghost-tester`
- **Metric**: `cosine`
- **Cloud**: `aws`
- **Region**: `us-east-1`
- **Dimensions**: `1536` (for OpenAI ada-002) or `1024` (for Cohere)

**When to Use:**
- You want to use a specific embedding model (OpenAI, Cohere, etc.)
- You need more control over embedding generation
- You're already using embeddings in other parts of your system

**Usage:**
```typescript
// Generate embeddings yourself, then upsert vectors
const embedding = await generateEmbedding("Click login button")
await index.upsert([
  {
    id: "step1",
    values: embedding, // 1536-dimensional vector
    metadata: {
      runId: "run123",
      stepNumber: 1,
      action: "Click login button"
    }
  }
])
```

## Index Configuration Parameters

### Metric Types

- **`cosine`** (Recommended): Best for semantic similarity, text embeddings
- **`euclidean`**: For distance-based similarity
- **`dotproduct`**: For normalized vectors

### Cloud Providers

- **`aws`**: Amazon Web Services
- **`gcp`**: Google Cloud Platform
- **`azure`**: Microsoft Azure

Choose based on:
- Your existing infrastructure
- Geographic location of your users
- Cost considerations

### Regions

Common regions:
- **`us-east-1`**: US East (N. Virginia)
- **`us-west-2`**: US West (Oregon)
- **`eu-west-1`**: Europe (Ireland)
- **`ap-southeast-1`**: Asia Pacific (Singapore)

Choose the region closest to your users for lowest latency.

### Embedding Models (Integrated Indexes)

Available models:
- **`llama-text-embed-v2`**: Recommended, high performance, configurable dimensions
- **`multilingual-e5-large`**: For multilingual content (1024 dims)
- **`pinecone-sparse-english-v0`**: For keyword/hybrid search

## Recommended Configuration for Ghost Tester

Based on your use case (test automation with embeddings), here's the recommended setup:

### Primary Index: Test Step Embeddings

```bash
pc index create \
  -n ghost-tester \
  -m cosine \
  -c aws \
  -r us-east-1 \
  --model llama-text-embed-v2 \
  --field_map text=content
```

**Purpose**: Store embeddings of test steps, actions, and screenshots for:
- Similarity search (find similar test patterns)
- Regression detection (compare current vs historical screenshots)
- RAG (Retrieval-Augmented Generation) for test patterns

**Data Structure:**
```typescript
{
  "_id": "emb_run123_step1_1234567890",
  "content": "Step 1: Click login button. Run ID: run123",
  "runId": "run123",
  "stepNumber": 1,
  "action": "click",
  "target": "login-button",
  "timestamp": "2025-01-15T10:30:00Z",
  "success": true,
  "type": "test_step"
}
```

### Namespace Strategy

Use namespaces to organize data:

- **`project_{projectId}`**: All test runs for a project
- **`run_{runId}`**: All steps for a specific test run
- **`global`**: Cross-project patterns and regressions

**Example:**
```typescript
// Store in project namespace
await index.upsert_records(`project_${projectId}`, records)

// Query within project
await index.search({
  namespace: `project_${projectId}`,
  query: { top_k: 10, inputs: { text: "login flow" } }
})
```

## Index Settings

### Replicas

For production, configure replicas for high availability:

```bash
pc index configure -n ghost-tester --replicas 2
```

- **1 replica**: Basic setup (single point of failure)
- **2+ replicas**: High availability (recommended for production)

### Pod Type and Size

For serverless indexes (default), Pinecone manages scaling automatically.

For pod-based indexes:
- **Pod Type**: `s1.x1` (1GB), `s1.x2` (2GB), `p1.x1` (1GB, higher performance)
- **Pods**: Number of pods for scaling

## Verification

After creating the index, verify it:

```bash
# List indexes
pc index list

# Describe index
pc index describe -n ghost-tester

# Check stats
pc index stats -n ghost-tester
```

## Current Implementation Notes

The current `PineconeService` implementation:

1. **Uses mock embeddings** - Replace with real embedding generation
2. **Manual vector upsert** - For Option 2 (standard index)
3. **Can be updated** - To use integrated embeddings (Option 1)

### To Use Integrated Embeddings (Option 1)

Update `worker/src/services/pinecone.ts`:

```typescript
// Instead of generating embeddings manually:
const embedding = await this.generateEmbedding(text)

// Use Pinecone's integrated model:
await this.index.upsert_records("namespace", [
  {
    "_id": embeddingId,
    "content": text, // Pinecone generates embedding automatically
    "runId": runId,
    "stepNumber": stepNumber,
    // ... other metadata
  }
])
```

## Summary

**Recommended Setup:**
- **Index Name**: `ghost-tester`
- **Type**: Integrated embedding model (`llama-text-embed-v2`)
- **Metric**: `cosine`
- **Cloud**: `aws`
- **Region**: `us-east-1` (or closest to users)
- **Replicas**: 2+ for production

**Command to Create:**
```bash
export PINECONE_API_KEY="pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr"
pc index create -n ghost-tester -m cosine -c aws -r us-east-1 --model llama-text-embed-v2 --field_map text=content
```

This configuration will:
- ✅ Automatically generate embeddings from text
- ✅ Optimize for semantic similarity search
- ✅ Support regression detection
- ✅ Enable RAG for test patterns
- ✅ Scale automatically with serverless architecture

