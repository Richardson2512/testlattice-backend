// Pinecone service for embeddings and vector search
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
      console.log('Pinecone: Connected to index:', this.indexName)
      console.log('Pinecone: Index host:', this.indexName)
      console.log('Pinecone: Index stats:', JSON.stringify(stats, null, 2))
    } catch (error: any) {
      console.error('Pinecone initialization error:', error.message)
      throw new Error(`Failed to connect to Pinecone index: ${error.message}`)
    }
  }

  /**
   * Generate embedding from text (using a simple approach)
   * Note: In production, use a proper embedding model like OpenAI, Cohere, or HuggingFace
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // For now, return a mock embedding
    // In production, call an embedding API:
    // - OpenAI: text-embedding-ada-002
    // - Cohere: embed-english-v3.0
    // - HuggingFace: sentence-transformers
    // - Or use Pinecone's integrated embedding models
    
    console.warn('Pinecone: Using mock embedding. In production, use a real embedding model.')
    
    // Mock embedding vector (1536 dimensions like OpenAI ada-002)
    const dimensions = 1536
    const embedding = new Array(dimensions).fill(0).map(() => Math.random() - 0.5)
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  /**
   * Store embeddings for a test run step
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

      // Generate embedding from action description and metadata
      const text = `Test step ${stepNumber}: ${action}. Run ID: ${runId}`
      const embedding = await this.generateEmbedding(text)

      const embeddingId = `emb_${runId}_${stepNumber}_${Date.now()}`
      
      const record = {
        id: embeddingId,
        values: embedding,
        metadata: {
          runId,
          stepNumber,
          action,
          timestamp: new Date().toISOString(),
          ...metadata,
        }
      }

      // Upsert to Pinecone
      await this.index.upsert([record])
      
      console.log('Pinecone: Stored embedding:', embeddingId)
      return embeddingId
    } catch (error: any) {
      console.error('Pinecone: Failed to store embedding:', error.message)
      throw error
    }
  }

  /**
   * Query similar test runs
   */
  async querySimilar(
    screenshot: string,
    topK: number = 5
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      // Generate embedding from screenshot (in production, use vision model)
      const text = `Screenshot analysis for similarity search`
      const queryEmbedding = await this.generateEmbedding(text)

      // Query Pinecone
      const queryResponse = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      })

      // Map results
      const results = (queryResponse.matches || []).map((match: any) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata || {},
      }))

      console.log('Pinecone: Found', results.length, 'similar results')
      return results
    } catch (error: any) {
      console.error('Pinecone: Failed to query similar:', error.message)
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
    }>
  ): Promise<void> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      // Create embeddings for each step
      const records = await Promise.all(
        steps.map(async (step) => {
          const text = `Step ${step.stepNumber}: ${step.action}. Success: ${step.success}`
          const embedding = await this.generateEmbedding(text)

          return {
            id: `trace_${runId}_${step.stepNumber}_${Date.now()}`,
            values: embedding,
            metadata: {
              runId,
              stepNumber: step.stepNumber,
              action: step.action,
              success: step.success,
              timestamp: new Date().toISOString(),
              type: 'test_trace',
            }
          }
        })
      )

      // Batch upsert
      if (records.length > 0) {
        // Pinecone supports batch upserts, but we'll do it in chunks of 100
        const chunkSize = 100
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize)
          await this.index.upsert(chunk)
        }
        
        console.log('Pinecone: Stored test trace with', records.length, 'steps')
      }
    } catch (error: any) {
      console.error('Pinecone: Failed to store test trace:', error.message)
      throw error
    }
  }

  /**
   * Detect regressions by comparing with historical runs
   */
  async detectRegression(
    currentScreenshot: string,
    projectId: string
  ): Promise<Array<{ runId: string; stepNumber: number; similarity: number }>> {
    try {
      if (!this.index) {
        await this.initialize()
      }

      // Generate embedding from current screenshot
      const text = `Current screenshot for regression detection in project ${projectId}`
      const queryEmbedding = await this.generateEmbedding(text)

      // Query with metadata filter for the same project
      const queryResponse = await this.index.query({
        vector: queryEmbedding,
        topK: 10,
        includeMetadata: true,
        filter: {
          projectId: { $eq: projectId },
          type: { $eq: 'test_trace' },
        }
      })

      // Map results to regression format
      const regressions = (queryResponse.matches || [])
        .filter((match: any) => (match.score || 0) > 0.8) // High similarity threshold
        .map((match: any) => ({
          runId: match.metadata?.runId || '',
          stepNumber: match.metadata?.stepNumber || 0,
          similarity: match.score || 0,
        }))

      console.log('Pinecone: Detected', regressions.length, 'potential regressions')
      return regressions
    } catch (error: any) {
      console.error('Pinecone: Failed to detect regression:', error.message)
      return []
    }
  }
}
