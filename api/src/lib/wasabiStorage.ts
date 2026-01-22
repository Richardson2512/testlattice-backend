
import {
    S3Client,
    DeleteObjectCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3'

export interface WasabiConfig {
    accessKey: string
    secretKey: string
    bucket: string
    region: string
    endpoint: string
}

export class WasabiStorageService {
    private client: S3Client
    private bucket: string

    constructor(config: WasabiConfig) {
        this.bucket = config.bucket

        this.client = new S3Client({
            region: config.region,
            endpoint: config.endpoint,
            credentials: {
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
            },
            forcePathStyle: true, // Required for Wasabi
        })
    }

    /**
     * Delete all artifacts for a run
     */
    async deleteRun(runId: string): Promise<void> {
        try {
            // List all objects with prefix 'runs/{runId}/'
            const prefix = `runs/${runId}/`

            let continuationToken: string | undefined
            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                })

                const response = await this.client.send(command)

                if (response.Contents && response.Contents.length > 0) {
                    // Delete objects one by one (or could use DeleteObjectsCommand for batch)
                    await Promise.all(response.Contents.map(obj =>
                        this.client.send(new DeleteObjectCommand({
                            Bucket: this.bucket,
                            Key: obj.Key,
                        }))
                    ))

                    console.log(`[Wasabi] Deleted ${response.Contents.length} objects for run ${runId}`)
                }

                continuationToken = response.NextContinuationToken
            } while (continuationToken)

        } catch (error: any) {
            console.error(`[Wasabi] Error deleting run ${runId}:`, error.message)
            // Don't throw, just log
        }
    }
}

/**
* Create Wasabi storage service from environment
*/
export function createWasabiStorage(): WasabiStorageService | null {
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY
    const bucket = process.env.WASABI_BUCKET
    const region = process.env.WASABI_REGION || 'us-central-1'
    const endpoint = process.env.WASABI_ENDPOINT || `https://s3.${region}.wasabisys.com`

    if (!accessKey || !secretKey || !bucket) {
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
