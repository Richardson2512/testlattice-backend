/**
 * Storage Factory
 * Issue #6: Creates appropriate storage provider with fallback
 */

import { StorageProvider, StorageConfig } from './StorageProvider'
import { SupabaseStorageProvider } from './SupabaseStorageProvider'
import { getConfig } from '../config'

/**
 * Fallback storage provider that tries primary, then fallback
 */
export class FallbackStorageProvider implements StorageProvider {
    constructor(
        private primary: StorageProvider,
        private fallback: StorageProvider,
        private primaryName: string,
        private fallbackName: string
    ) { }

    async upload(key: string, data: Buffer, contentType: string): Promise<string> {
        try {
            return await this.primary.upload(key, data, contentType)
        } catch (error: any) {
            console.warn(`[Storage] ${this.primaryName} upload failed, using ${this.fallbackName}:`, error.message)
            return await this.fallback.upload(key, data, contentType)
        }
    }

    async download(key: string): Promise<Buffer> {
        try {
            return await this.primary.download(key)
        } catch (error: any) {
            // Try fallback
            console.warn(`[Storage] ${this.primaryName} download failed, trying ${this.fallbackName}`)
            return await this.fallback.download(key)
        }
    }

    async delete(key: string): Promise<void> {
        // Try to delete from both
        const errors: Error[] = []

        try {
            await this.primary.delete(key)
        } catch (e: any) {
            errors.push(e)
        }

        try {
            await this.fallback.delete(key)
        } catch (e: any) {
            errors.push(e)
        }

        // If both failed, throw
        if (errors.length === 2) {
            throw errors[0]
        }
    }

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
        try {
            return await this.primary.getSignedUrl(key, expiresInSeconds)
        } catch (error: any) {
            console.warn(`[Storage] ${this.primaryName} signed URL failed, using ${this.fallbackName}`)
            return await this.fallback.getSignedUrl(key, expiresInSeconds)
        }
    }

    async exists(key: string): Promise<boolean> {
        // Check both
        const primaryExists = await this.primary.exists(key).catch(() => false)
        if (primaryExists) return true
        return await this.fallback.exists(key).catch(() => false)
    }

    async getMetadata(key: string): Promise<any> {
        try {
            const meta = await this.primary.getMetadata(key)
            if (meta) return meta
        } catch {
            // Try fallback
        }
        return await this.fallback.getMetadata(key)
    }

    async list(prefix: string, limit?: number): Promise<string[]> {
        try {
            return await this.primary.list(prefix, limit)
        } catch (error: any) {
            console.warn(`[Storage] ${this.primaryName} list failed, using ${this.fallbackName}`)
            return await this.fallback.list(prefix, limit)
        }
    }
}

/**
 * Storage factory singleton
 */
let storageInstance: StorageProvider | null = null

/**
 * Create storage provider based on config
 */
export function createStorageProvider(): StorageProvider {
    if (storageInstance) return storageInstance

    const config = getConfig()

    // Create Supabase provider (always available as fallback)
    const supabaseProvider = new SupabaseStorageProvider(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        config.supabase.storageBucket
    )

    // Check if Wasabi is enabled and configured
    if (
        config.features.enableWasabi &&
        config.wasabi.accessKey &&
        config.wasabi.secretKey &&
        config.wasabi.bucket
    ) {
        // Wasabi provider would be implemented here
        // For now, we'll use Supabase as primary
        console.log('[Storage] Wasabi not implemented, using Supabase')
        storageInstance = supabaseProvider
    } else {
        // Use Supabase as primary
        console.log('[Storage] Using Supabase storage')
        storageInstance = supabaseProvider
    }

    return storageInstance
}

/**
 * Get the storage provider instance
 */
export function getStorageProvider(): StorageProvider {
    if (!storageInstance) {
        return createStorageProvider()
    }
    return storageInstance
}

/**
 * Reset storage instance (for testing)
 */
export function resetStorageProvider(): void {
    storageInstance = null
}
