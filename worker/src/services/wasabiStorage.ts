// Wasabi Storage Service - S3-compatible object storage for heavy artifacts
// Stores: videos, screenshots, traces, DOM snapshots
// Structure: runs/{runId}/video.webm, trace.json.gz, screenshots/step-{N}.png

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createReadStream } from 'fs'
import { gzipSync, gunzipSync } from 'zlib'
import { Readable } from 'stream'

export interface WasabiConfig {
    accessKey: string
    secretKey: string
    bucket: string
    region: string
    endpoint: string
}

export interface TraceStep {
    id: number
    ts: number                    // Timestamp in ms since start
    videoOffset: number           // Seconds into video (for seek)
    action: string
    selector?: string
    value?: string
    target?: string
    description?: string
    success: boolean
    error?: string
    dom?: string                  // Compressed DOM snapshot
    console?: string[]            // Console logs at this step
    network?: Array<{             // Network requests
        url: string
        method: string
        status?: number
        timing?: number
    }>
    screenshotPath?: string       // Reference to screenshot file
}

export interface TraceData {
    runId: string
    url: string
    startedAt: string
    completedAt?: string
    duration: number              // Total duration in ms
    status: 'running' | 'completed' | 'failed'
    browser: string
    viewport: string
    steps: TraceStep[]
    failure?: {
        stepId: number
        error: string
        stack?: string
    }
}

/**
 * Wasabi Storage Service
 * S3-compatible storage for heavy test artifacts
 */
export class WasabiStorageService {
    private client: S3Client
    private bucket: string
    private baseUrl: string

    constructor(config: WasabiConfig) {
        this.bucket = config.bucket
        this.baseUrl = `${config.endpoint}/${config.bucket}`

        this.client = new S3Client({
            region: config.region,
            endpoint: config.endpoint,
            credentials: {
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
            },
            forcePathStyle: true, // Required for Wasabi
        })

        console.log(`✅ Wasabi storage initialized (bucket: ${config.bucket})`)
    }

    /**
     * Upload video file
     * Uses multipart upload for large files
     */
    async uploadVideo(runId: string, videoPath: string): Promise<string> {
        const key = `runs/${runId}/video.webm`

        const upload = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: key,
                Body: createReadStream(videoPath),
                ContentType: 'video/webm',
            },
        })

        await upload.done()
        console.log(`[Wasabi] Video uploaded: ${key}`)

        return `${this.baseUrl}/${key}`
    }

    /**
     * Upload video from buffer
     */
    async uploadVideoBuffer(runId: string, buffer: Buffer): Promise<string> {
        const key = `runs/${runId}/video.webm`

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: 'video/webm',
        }))

        console.log(`[Wasabi] Video uploaded: ${key}`)
        return `${this.baseUrl}/${key}`
    }

    /**
     * Upload screenshot
     */
    async uploadScreenshot(
        runId: string,
        stepNumber: number,
        screenshot: Buffer,
        metadata?: { browser?: string; viewport?: string }
    ): Promise<string> {
        const suffix = metadata?.browser ? `-${metadata.browser}` : ''
        const key = `runs/${runId}/screenshots/step-${stepNumber}${suffix}.png`

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: screenshot,
            ContentType: 'image/png',
        }))

        return `${this.baseUrl}/${key}`
    }

    /**
     * Upload trace data (gzipped JSON)
     */
    async uploadTrace(runId: string, traceData: TraceData): Promise<string> {
        const key = `runs/${runId}/trace.json.gz`

        // Gzip the trace data
        const jsonString = JSON.stringify(traceData)
        const compressed = gzipSync(Buffer.from(jsonString, 'utf-8'))

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: compressed,
            ContentType: 'application/gzip',
            ContentEncoding: 'gzip',
        }))

        console.log(`[Wasabi] Trace uploaded: ${key} (${(compressed.length / 1024).toFixed(1)}KB compressed)`)
        return `${this.baseUrl}/${key}`
    }

    /**
     * Download and decompress trace data
     */
    async getTrace(runId: string): Promise<TraceData | null> {
        const key = `runs/${runId}/trace.json.gz`

        try {
            const response = await this.client.send(new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }))

            const chunks: Buffer[] = []
            for await (const chunk of response.Body as Readable) {
                chunks.push(chunk)
            }

            const compressed = Buffer.concat(chunks)
            const decompressed = gunzipSync(compressed)

            return JSON.parse(decompressed.toString('utf-8'))
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                return null
            }
            throw error
        }
    }

    /**
     * Upload DOM snapshot (gzipped)
     */
    async uploadDOMSnapshot(
        runId: string,
        stepNumber: number,
        domContent: string
    ): Promise<string> {
        const key = `runs/${runId}/dom/step-${stepNumber}.html.gz`

        const compressed = gzipSync(Buffer.from(domContent, 'utf-8'))

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: compressed,
            ContentType: 'text/html',
            ContentEncoding: 'gzip',
        }))

        return `${this.baseUrl}/${key}`
    }

    /**
     * Generate pre-signed URL for secure temporary access
     */
    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        })

        return await getSignedUrl(this.client, command, { expiresIn })
    }

    /**
     * Generate pre-signed URL for video streaming
     */
    async getVideoSignedUrl(runId: string, expiresIn: number = 7200): Promise<string> {
        return this.getSignedUrl(`runs/${runId}/video.webm`, expiresIn)
    }

    /**
     * Generate pre-signed URL for trace download
     */
    async getTraceSignedUrl(runId: string, expiresIn: number = 3600): Promise<string> {
        return this.getSignedUrl(`runs/${runId}/trace.json.gz`, expiresIn)
    }

    /**
     * Check if artifact exists
     */
    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }))
            return true
        } catch {
            return false
        }
    }

    /**
     * Delete all artifacts for a run
     */
    async deleteRun(runId: string): Promise<void> {
        // Note: For production, use ListObjectsV2 + batch delete
        const keys = [
            `runs/${runId}/video.webm`,
            `runs/${runId}/trace.json.gz`,
        ]

        for (const key of keys) {
            try {
                await this.client.send(new DeleteObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                }))
            } catch {
                // Ignore deletion errors
            }
        }

        console.log(`[Wasabi] Deleted artifacts for run: ${runId}`)
    }

    /**
     * Extract storage path from URL
     */
    extractKeyFromUrl(url: string): string {
        return url.replace(`${this.baseUrl}/`, '')
    }
}

/**
 * Create Wasabi storage service from environment
 */
export function createWasabiStorage(): WasabiStorageService | null {
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY
    const bucket = process.env.WASABI_BUCKET
    const region = process.env.WASABI_REGION || 'us-east-1'
    const endpoint = process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com'

    if (!accessKey || !secretKey || !bucket) {
        console.warn('⚠️  Wasabi storage not configured (missing credentials)')
        return null
    }

    return new WasabiStorageService({
        accessKey,
        secretKey,
        bucket,
        region,
        endpoint,
    })
}
