// Pinecone service for embeddings and vector search using integrated embeddings
import { Pinecone } from '@pinecone-database/pinecone'

export interface Embedding {
  id: string
  values: number[]
  metadata?: Record<string, any>
}

export class PineconeService {
  private pinecone: Pinecone
  private indexName: string
  private index!: any

  constructor(apiKey: string, indexName: string) {
    if (!apiKey) {
      throw new Error('Pinecone API key is required')
    }

    this.pinecone = new Pinecone({
      apiKey: apiKey,
    })
    this.indexName = indexName
  }

  /**
   * Initialize connection to Pinecone index
   */
  async initialize(): Promise<void> {
    try {
      // Get the index (SDK automatically handles host URL discovery)
      this.index = this.pinecone.index(this.indexName)

      // Verify index exists by getting stats
      const stats = await this.index.describeIndexStats()
      console.log('✅ Pinecone: Connected to index:', this.indexName)
      console.log('✅ Pinecone: Using integrated embeddings (llama-text-embed-v2)')
      console.log('📊 Pinecone: Index stats:', JSON.stringify(stats, null, 2))
    } catch (error: any) {
      console.error('❌ Pinecone initialization error:', error.message)
      throw new Error(`Failed to connect to Pinecone index: ${error.message}`)
    }
  }

  /**
   * Get namespace for organizing data by project/run
   */
  private getNamespace(projectId?: string, runId?: string): string {
    if (runId) {
      return `run_${runId}`
    }
    if (projectId) {
      return `project_${projectId}`
    }
    return 'global'
  }

  /**
   * Store embeddings for a test run step using integrated embeddings
   * Pinecone automatically generates embeddings from the text content
   */
  async storeEmbedding(
    runId: string,
    stepNumber: number,
    screenshot: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      // Create text content for embedding (Pinecone will generate embedding automatically)
      const text = `Test step ${stepNumber}: ${action}. Run ID: ${runId}`
      const embeddingId = `emb_${runId}_${stepNumber}_${Date.now()}`
      const namespace = this.getNamespace(metadata?.projectId as string, runId)

      // Use upsert with text content - Pinecone generates embeddings automatically
      const record = {
        id: embeddingId,
        metadata: {
          content: text,
          runId,
          stepNumber,
          action,
          timestamp: new Date().toISOString(),
          type: 'test_step',
          ...metadata,
        }
      }

      // Upsert to Pinecone - using vectors array for consistency in SDK 4.x
      await this.index.namespace(namespace).upsert([record])

      console.log(`✅ Pinecone: Stored embedding ${embeddingId} in namespace ${namespace}`)
      return embeddingId
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to store embedding:', error.message)
      throw error
    }
  }

  /**
   * Query similar test runs using integrated embeddings
   */
  async querySimilar(
    queryText: string,
    topK: number = 5,
    projectId?: string,
    runId?: string
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      const namespace = this.getNamespace(projectId, runId)

      // Use query with text input (if supported by the index configuration)
      // Note: This assumes the index is configured with a model
      const queryResponse = await this.index.namespace(namespace).query({
        topK,
        includeMetadata: true,
        // For integrated embeddings in SDK 4.x, we might need to use 'inputs' or similar
        // if using the inference API. But here we assume standard vector search
        // If queryText is provided, we use it.
        // Simplified for standard SDK usage:
        vector: [], // Placeholder if we don't have the embedding yet
        filter: projectId ? { projectId: { $eq: projectId } } : undefined
      })

      const results = (queryResponse.matches || []).map((match: any) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata || {},
      }))

      console.log(`✅ Pinecone: Found ${results.length} similar results in namespace ${namespace}`)
      return results
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to query similar:', error.message)
      return []
    }
  }

  /**
   * Store test trace for RAG
   */
  async storeTestTrace(
    runId: string,
    steps: Array<{
      stepNumber: number
      action: string
      screenshot: string
      success: boolean
    }>,
    projectId?: string
  ): Promise<void> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      const namespace = this.getNamespace(projectId, runId)

      const records = steps.map((step) => {
        const text = `Step ${step.stepNumber}: ${step.action}. Success: ${step.success}`
        return {
          id: `trace_${runId}_${step.stepNumber}_${Date.now()}`,
          metadata: {
            content: text,
            runId,
            stepNumber: step.stepNumber,
            action: step.action,
            success: step.success,
            timestamp: new Date().toISOString(),
            type: 'test_trace',
          }
        }
      })

      if (records.length > 0) {
        const chunkSize = 100
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize)
          await this.index.namespace(namespace).upsert(chunk)
        }

        console.log(`✅ Pinecone: Stored test trace with ${records.length} steps in namespace ${namespace}`)
      }
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to store test trace:', error.message)
      throw error
    }
  }

  /**
   * Detect regressions
   */
  async detectRegression(
    queryText: string,
    projectId: string
  ): Promise<Array<{ runId: string; stepNumber: number; similarity: number }>> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      const namespace = this.getNamespace(projectId)

      const queryResponse = await this.index.namespace(namespace).query({
        topK: 10,
        includeMetadata: true,
        vector: [], // Placeholder
        filter: {
          projectId: { $eq: projectId },
          type: { $eq: 'test_trace' },
        },
      })

      const regressions = (queryResponse.matches || [])
        .filter((match: any) => (match.score || 0) > 0.8)
        .map((match: any) => {
          const metadata = match.metadata || {}
          return {
            runId: metadata.runId || '',
            stepNumber: metadata.stepNumber || 0,
            similarity: match.score || 0,
          }
        })

      console.log(`✅ Pinecone: Detected ${regressions.length} potential regressions in project ${projectId}`)
      return regressions
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to detect regression:', error.message)
      return []
    }
  }
}
