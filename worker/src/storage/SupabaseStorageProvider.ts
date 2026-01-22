/**
 * Supabase Storage Provider
 * Issue #6: Implements StorageProvider for Supabase Storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
    StorageProvider,
    FileMetadata,
    StorageError,
    FileNotFoundError,
} from './StorageProvider'

export class SupabaseStorageProvider implements StorageProvider {
    private client: SupabaseClient
    private bucket: string

    constructor(supabaseUrl: string, supabaseKey: string, bucket: string) {
        this.client = createClient(supabaseUrl, supabaseKey)
        this.bucket = bucket
    }

    async upload(key: string, data: Buffer, contentType: string): Promise<string> {
        const { data: result, error } = await this.client.storage
            .from(this.bucket)
            .upload(key, data, {
                contentType,
                upsert: true,
            })

        if (error) {
            throw new StorageError(
                `Upload failed: ${error.message}`,
                'upload',
                key,
                'supabase',
                error as Error
            )
        }

        // Return public URL
        const { data: urlData } = this.client.storage
            .from(this.bucket)
            .getPublicUrl(key)

        return urlData.publicUrl
    }

    async download(key: string): Promise<Buffer> {
        const { data, error } = await this.client.storage
            .from(this.bucket)
            .download(key)

        if (error) {
            if (error.message.includes('not found')) {
                throw new FileNotFoundError(key, 'supabase')
            }
            throw new StorageError(
                `Download failed: ${error.message}`,
                'download',
                key,
                'supabase',
                error as Error
            )
        }

        // Convert Blob to Buffer
        const arrayBuffer = await data.arrayBuffer()
        return Buffer.from(arrayBuffer)
    }

    async delete(key: string): Promise<void> {
        const { error } = await this.client.storage
            .from(this.bucket)
            .remove([key])

        if (error) {
            throw new StorageError(
                `Delete failed: ${error.message}`,
                'delete',
                key,
                'supabase',
                error as Error
            )
        }
    }

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
        const { data, error } = await this.client.storage
            .from(this.bucket)
            .createSignedUrl(key, expiresInSeconds)

        if (error) {
            throw new StorageError(
                `Signed URL failed: ${error.message}`,
                'getSignedUrl',
                key,
                'supabase',
                error as Error
            )
        }

        return data.signedUrl
    }

    async exists(key: string): Promise<boolean> {
        try {
            const { data } = await this.client.storage
                .from(this.bucket)
                .list(this.getDirectory(key), {
                    limit: 1,
                    search: this.getFilename(key),
                })

            return data !== null && data.length > 0
        } catch {
            return false
        }
    }

    async getMetadata(key: string): Promise<FileMetadata | null> {
        try {
            const { data } = await this.client.storage
                .from(this.bucket)
                .list(this.getDirectory(key), {
                    limit: 1,
                    search: this.getFilename(key),
                })

            if (!data || data.length === 0) return null

            const file = data[0]
            return {
                key,
                size: file.metadata?.size || 0,
                contentType: file.metadata?.mimetype || 'application/octet-stream',
                lastModified: new Date(file.updated_at || file.created_at),
            }
        } catch {
            return null
        }
    }

    async list(prefix: string, limit: number = 100): Promise<string[]> {
        const { data, error } = await this.client.storage
            .from(this.bucket)
            .list(prefix, { limit })

        if (error) {
            throw new StorageError(
                `List failed: ${error.message}`,
                'list',
                prefix,
                'supabase',
                error as Error
            )
        }

        return data.map(f => `${prefix}/${f.name}`)
    }

    private getDirectory(key: string): string {
        const parts = key.split('/')
        parts.pop()
        return parts.join('/')
    }

    private getFilename(key: string): string {
        const parts = key.split('/')
        return parts[parts.length - 1]
    }
}
