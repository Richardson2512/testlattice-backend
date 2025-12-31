/**
 * Storage Provider Interface
 * Issue #6: Storage abstraction with fallback chain
 * 
 * Unified interface for storage operations.
 * Supports Wasabi and Supabase with automatic fallback.
 */

export interface StorageProvider {
    /**
     * Upload a file to storage
     */
    upload(key: string, data: Buffer, contentType: string): Promise<string>

    /**
     * Download a file from storage
     */
    download(key: string): Promise<Buffer>

    /**
     * Delete a file from storage
     */
    delete(key: string): Promise<void>

    /**
     * Get a signed URL for temporary access
     */
    getSignedUrl(key: string, expiresInSeconds: number): Promise<string>

    /**
     * Check if a file exists
     */
    exists(key: string): Promise<boolean>

    /**
     * Get file metadata
     */
    getMetadata(key: string): Promise<FileMetadata | null>

    /**
     * List files in a directory
     */
    list(prefix: string, limit?: number): Promise<string[]>
}

export interface FileMetadata {
    key: string
    size: number
    contentType: string
    lastModified: Date
}

export interface StorageConfig {
    provider: 'wasabi' | 'supabase' | 'local'
    bucket: string
    region?: string
    accessKey?: string
    secretKey?: string
    endpoint?: string
    supabaseUrl?: string
    supabaseKey?: string
}

/**
 * Storage error types
 */
export class StorageError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly key: string,
        public readonly provider: string,
        public readonly cause?: Error
    ) {
        super(message)
        this.name = 'StorageError'
    }
}

export class FileNotFoundError extends StorageError {
    constructor(key: string, provider: string) {
        super(`File not found: ${key}`, 'download', key, provider)
        this.name = 'FileNotFoundError'
    }
}
