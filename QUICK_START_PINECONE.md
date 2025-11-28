# Quick Start: Pinecone Index Setup

## ✅ Your Index is Already Created!

Your Pinecone index is ready:
- **Index Name**: `ghost-tester`
- **Host**: `https://ghost-tester-uxsubej.svc.aped-4627-b74a.pinecone.io`
- **Region**: `us-east-1`

Just configure your environment variables and you're ready to go!

## If You Need to Create a New Index

## Step 1: Install Pinecone CLI

**macOS:**
```bash
brew tap pinecone-io/tap
brew install pinecone-io/tap/pinecone
```

**Windows/Linux:**
Download from: https://github.com/pinecone-io/cli/releases

## Step 2: Authenticate

```bash
export PINECONE_API_KEY="pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr"
pc auth configure --api-key $PINECONE_API_KEY
```

## Step 3: Create Index

**Recommended Configuration (Integrated Embeddings):**

```bash
pc index create \
  -n ghost-tester \
  -m cosine \
  -c aws \
  -r us-east-1 \
  --model llama-text-embed-v2 \
  --field_map text=content
```

**What this creates:**
- Index name: `ghost-tester`
- Metric: `cosine` (for semantic similarity)
- Cloud: AWS
- Region: us-east-1
- Embedding model: `llama-text-embed-v2` (automatically generates embeddings)
- Field mapping: `text=content` (your text field maps to Pinecone's content field)

## Step 4: Verify

```bash
# List all indexes
pc index list

# Describe your index
pc index describe -n ghost-tester

# Check index stats (after adding data)
pc index stats -n ghost-tester
```

## Alternative: Standard Index (Manual Embeddings)

If you prefer to generate embeddings yourself:

```bash
pc index create \
  -n ghost-tester \
  -m cosine \
  -c aws \
  -r us-east-1 \
  -d 1536
```

This creates a standard index with 1536 dimensions (for OpenAI ada-002 embeddings).

## Configuration Summary

**Recommended Setup:**
```
Index Name: ghost-tester
Type: Integrated Embedding Model
Model: llama-text-embed-v2
Metric: cosine
Cloud: aws
Region: us-east-1
Field Map: text=content
```

**Benefits:**
- ✅ No need for separate embedding API
- ✅ Automatic embedding generation
- ✅ Optimized for performance
- ✅ Built-in text preprocessing

For detailed configuration options, see `PINECONE_INDEX_CONFIG.md`.

