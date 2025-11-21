// Supabase Storage service for artifacts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { TestArtifact } from '../types'

export class StorageService {
  private supabase: SupabaseClient
  private bucketName = 'artifacts'

  constructor(supabaseUrl: string, storageKey: string) {
    this.supabase = createClient(supabaseUrl, storageKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  /**
   * Upload screenshot
   */
  async uploadScreenshot(
    runId: string,
    stepNumber: number,
    screenshot: Buffer | string
  ): Promise<string> {
    const filename = `screenshots/${runId}/step-${stepNumber}-${Date.now()}.png`
    
    // Convert string to buffer if needed
    const buffer = screenshot instanceof Buffer 
      ? screenshot 
      : Buffer.from(screenshot, 'base64')
    
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload screenshot: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Upload video
   */
  async uploadVideo(
    runId: string,
    video: Buffer
  ): Promise<string> {
    // Playwright videos are typically .webm format
    const filename = `videos/${runId}/test-run-${Date.now()}.webm`
    
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, video, {
        contentType: 'video/webm',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload video: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Upload log file
   */
  async uploadLog(
    runId: string,
    logContent: string
  ): Promise<string> {
    const filename = `logs/${runId}/test-run-${Date.now()}.log`
    const buffer = Buffer.from(logContent, 'utf-8')
    
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, buffer, {
        contentType: 'text/plain',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload log: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Upload DOM snapshot
   */
  async uploadDOMSnapshot(
    runId: string,
    stepNumber: number,
    domContent: string
  ): Promise<string> {
    const filename = `dom-snapshots/${runId}/step-${stepNumber}-${Date.now()}.html`
    const buffer = Buffer.from(domContent, 'utf-8')
    
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, buffer, {
        contentType: 'text/html',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload DOM snapshot: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Create artifact record
   * Note: This should be called via API to save to database
   * This is kept for backward compatibility but ideally artifacts should be created via API
   */
  async createArtifact(
    runId: string,
    type: 'screenshot' | 'video' | 'log' | 'dom',
    url: string,
    size: number
  ): Promise<TestArtifact> {
    // Extract path from URL
    const path = url.split('/').slice(-2).join('/') // Get last two segments (folder/filename)
    
    const artifact: TestArtifact = {
      id: `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      runId,
      type,
      url,
      path,
      size,
      createdAt: new Date().toISOString(),
    }
    
    // Note: In production, this should be saved via API call to /api/tests/:runId/artifacts
    // For now, we return the artifact object
    
    return artifact
  }
}

