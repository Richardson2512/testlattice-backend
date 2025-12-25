// Supabase Storage service for artifacts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { TestArtifact } from '../types'
import { WasabiStorageService } from './wasabiStorage'

export class StorageService {
  private supabase: SupabaseClient
  private bucketName: string
  private wasabiService: WasabiStorageService | null

  constructor(
    supabaseUrl: string,
    storageKey: string,
    bucketName: string = process.env.SUPABASE_STORAGE_BUCKET || 'artifacts',
    wasabiService: WasabiStorageService | null = null
  ) {
    if (!supabaseUrl) {
      throw new Error('Supabase URL is required for storage uploads. Set SUPABASE_URL in worker/.env')
    }
    if (!storageKey) {
      throw new Error('Supabase storage key (service role recommended) is required for uploads. Set SUPABASE_SERVICE_ROLE_KEY in worker/.env')
    }
    if (!bucketName) {
      throw new Error('Supabase storage bucket name is required. Set SUPABASE_STORAGE_BUCKET in worker/.env')
    }

    this.bucketName = bucketName
    this.wasabiService = wasabiService

    this.supabase = createClient(supabaseUrl, storageKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  /**
   * Upload screenshot
   * Returns public URL for database storage
   * Frontend should request pre-signed URL via API for downloads
   * @param metadata - Optional metadata for browser matrix (browser, viewport, orientation)
   */
  async uploadScreenshot(
    runId: string,
    stepNumber: number,
    screenshot: Buffer | string,
    metadata?: {
      browser?: 'chromium' | 'firefox' | 'webkit'
      viewport?: string
      orientation?: 'portrait' | 'landscape'
    }
  ): Promise<string> {
    // Convert string to buffer if needed
    const buffer = Buffer.isBuffer(screenshot)
      ? screenshot
      : Buffer.from(screenshot, 'base64')

    if (this.wasabiService) {
      return this.wasabiService.uploadScreenshot(runId, stepNumber, buffer, {
        browser: metadata?.browser,
        viewport: metadata?.viewport
      })
    }

    // Include browser and viewport in filename for browser matrix support
    const browserSuffix = metadata?.browser ? `-${metadata.browser}` : ''
    const viewportSuffix = metadata?.viewport ? `-${metadata.viewport.replace(/x/g, 'x')}` : ''
    const orientationSuffix = metadata?.orientation ? `-${metadata.orientation}` : ''
    const filename = `screenshots/${runId}/step-${stepNumber}${browserSuffix}${viewportSuffix}${orientationSuffix}-${Date.now()}.png`

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload screenshot: ${error.message}`)
    }

    // Get public URL (for database record)
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Generate pre-signed URL for secure, temporary access
   * Downloads go directly to Supabase (not through API server)
   * URLs expire after specified time for security
   */
  async getPresignedUrl(
    path: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn)

    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message}`)
    }

    return data.signedUrl
  }

  /**
   * Upload video
   * Returns public URL for database storage
   * Frontend should request pre-signed URL via API for streaming
   */
  async uploadVideo(
    runId: string,
    video: Buffer
  ): Promise<string> {
    if (this.wasabiService) {
      return this.wasabiService.uploadVideoBuffer(runId, video)
    }

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

    // Get public URL (for database record)
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Upload trace file (Playwright Time-Travel Debugger)
   * Returns public URL for database storage
   */
  async uploadTrace(
    runId: string,
    trace: Buffer,
    browserType?: string
  ): Promise<string> {
    if (this.wasabiService) {
      return this.wasabiService.uploadTraceBuffer(runId, trace, browserType)
    }

    const browserSuffix = browserType ? `-${browserType}` : ''
    const filename = `traces/${runId}/trace${browserSuffix}-${Date.now()}.zip`

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, trace, {
        contentType: 'application/zip',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload trace: ${error.message}`)
    }

    // Get public URL (for database record)
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Upload visual diff image
   * Returns public URL for database storage
   */
  async uploadVisualDiff(
    runId: string,
    stepNumber: number,
    diffImage: Buffer,
    metadata?: {
      browser?: 'chromium' | 'firefox' | 'webkit'
      viewport?: string
    }
  ): Promise<string> {
    const browserSuffix = metadata?.browser ? `-${metadata.browser}` : ''
    const viewportSuffix = metadata?.viewport ? `-${metadata.viewport.replace('x', '-')}` : ''
    const filename = `visual-diffs/${runId}/step-${stepNumber}${browserSuffix}${viewportSuffix}-diff-${Date.now()}.png`

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, diffImage, {
        contentType: 'image/png',
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload visual diff: ${error.message}`)
    }

    // Get public URL (for database record)
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filename)

    return urlData.publicUrl
  }

  /**
   * Upload generic file
   * Returns public URL for database storage
   * Use getPresignedUrl() for temporary download links
   */
  async uploadFile(
    path: string,
    content: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, content, {
        contentType,
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get public URL (for database record)
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path)

    return urlData.publicUrl
  }

  /**
   * Extract storage path from public URL
   * Used to generate pre-signed URLs from stored public URLs
   */
  extractPathFromUrl(publicUrl: string): string {
    // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const match = publicUrl.match(/\/object\/public\/[^/]+\/(.+)$/)
    if (!match) {
      throw new Error(`Invalid Supabase public URL: ${publicUrl}`)
    }
    return match[1]
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
    if (this.wasabiService) {
      return this.wasabiService.uploadDOMSnapshot(runId, stepNumber, domContent)
    }

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

