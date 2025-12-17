// Pinecone service for embeddings and vector search using integrated embeddings
import { Pinecone } from '@pinecone-database/pinecone'
import { TestArtifact } from '../types'

export interface Embedding {
  id: string
  values: number[]
  metadata?: Record<string, any>
}

export class PineconeService {
  private pinecone: Pinecone
  private indexName: string
  private index: any

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
      
      // Use upsert_records with text content - Pinecone generates embeddings automatically
      const record = {
        _id: embeddingId,
        content: text, // This field is mapped to Pinecone's embedding model
        runId,
        stepNumber,
        action,
        timestamp: new Date().toISOString(),
        type: 'test_step',
        ...metadata,
      }

      // Upsert to Pinecone using integrated embeddings
      await this.index.upsert_records(namespace, [record])
      
      console.log(`✅ Pinecone: Stored embedding ${embeddingId} in namespace ${namespace}`)
      return embeddingId
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to store embedding:', error.message)
      throw error
    }
  }

  /**
   * Query similar test runs using integrated embeddings
   * Uses semantic search with text input - Pinecone generates query embedding automatically
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

      // Use search with text input - Pinecone generates embedding automatically
      const searchResponse = await this.index.search({
        namespace,
        query: {
          top_k: topK,
          inputs: {
            text: queryText, // Pinecone generates embedding from this text
          },
        },
      })

      // Map results from new API format
      const results = (searchResponse.result?.hits || []).map((hit: any) => ({
        id: hit._id || hit.id,
        score: hit._score || hit.score || 0,
        metadata: hit.fields || hit.metadata || {},
      }))

      console.log(`✅ Pinecone: Found ${results.length} similar results in namespace ${namespace}`)
      return results
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to query similar:', error.message)
      return []
    }
  }

  /**
   * Store test trace for RAG using integrated embeddings
   * Pinecone automatically generates embeddings from text content
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

      // Create records with text content - Pinecone generates embeddings automatically
      const records = steps.map((step) => {
        const text = `Step ${step.stepNumber}: ${step.action}. Success: ${step.success}`
        return {
          _id: `trace_${runId}_${step.stepNumber}_${Date.now()}`,
          content: text, // Pinecone generates embedding from this
          runId,
          stepNumber: step.stepNumber,
          action: step.action,
          success: step.success,
          timestamp: new Date().toISOString(),
          type: 'test_trace',
        }
      })

      // Batch upsert using integrated embeddings (max 96 records per batch for text)
      if (records.length > 0) {
        const chunkSize = 96 // Pinecone limit for text records
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize)
          await this.index.upsert_records(namespace, chunk)
        }
        
        console.log(`✅ Pinecone: Stored test trace with ${records.length} steps in namespace ${namespace}`)
      }
    } catch (error: any) {
      console.error('❌ Pinecone: Failed to store test trace:', error.message)
      throw error
    }
  }

  /**
   * Detect regressions by comparing with historical runs using integrated embeddings
   * Uses semantic search to find similar test patterns
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

      // Use search with text input and metadata filter
      const searchResponse = await this.index.search({
        namespace,
        query: {
          top_k: 10,
          inputs: {
            text: queryText, // Pinecone generates embedding from this
          },
          filter: {
            projectId: { $eq: projectId },
            type: { $eq: 'test_trace' },
          },
        },
      })

      // Map results to regression format
      const regressions = (searchResponse.result?.hits || [])
        .filter((hit: any) => (hit._score || hit.score || 0) > 0.8) // High similarity threshold
        .map((hit: any) => {
          const fields = hit.fields || hit.metadata || {}
          return {
            runId: fields.runId || '',
            stepNumber: fields.stepNumber || 0,
            similarity: hit._score || hit.score || 0,
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
