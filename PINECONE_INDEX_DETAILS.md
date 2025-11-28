# Pinecone Index Details

## Your Index Configuration

Your Pinecone index has been created and is ready to use:

- **Index Name**: `ghost-tester`
- **Host URL**: `https://ghost-tester-uxsubej.svc.aped-4627-b74a.pinecone.io`
- **Region**: `us-east-1`
- **API Key**: `pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr`

## Connection Details

The Pinecone SDK automatically handles the host URL - you only need to provide:
- API Key
- Index Name

The SDK will automatically discover and connect to your index using the host URL.

## Environment Configuration

Make sure your `worker/.env` file has:

```env
PINECONE_API_KEY=pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr
PINECONE_INDEX_NAME=ghost-tester
```

## Verifying Connection

When you start the worker, you should see:

```
Pinecone: Connected to index: ghost-tester
Pinecone: Index stats: { ... }
```

## Index Type

Based on the host URL format (`*.svc.*.pinecone.io`), this appears to be a **serverless index**, which means:
- ✅ Automatic scaling
- ✅ Pay-per-use pricing
- ✅ No infrastructure management
- ✅ High availability

## Next Steps

1. ✅ Index is created
2. ✅ Configuration is set up
3. ⏭️ Test the connection by running the worker
4. ⏭️ Start storing test step embeddings

## Troubleshooting

If you encounter connection issues:

1. **Verify API Key**: Make sure the API key is correct
2. **Check Index Name**: Ensure `PINECONE_INDEX_NAME=ghost-tester` matches exactly
3. **Network Access**: Ensure your network can reach `*.pinecone.io`
4. **Check Index Status**: Use Pinecone CLI:
   ```bash
   pc index describe -n ghost-tester
   ```

## Index Statistics

To check your index stats:

```bash
pc index stats -n ghost-tester
```

Or programmatically:
```typescript
const stats = await index.describeIndexStats()
console.log(stats)
```

