'use client'

import { useState } from 'react'
import { theme } from '../lib/theme'

interface VideoPlayerProps {
  videoUrl: string
  title?: string
}

export default function VideoPlayer({ videoUrl, title = 'Test Run Video' }: VideoPlayerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  return (
    <div style={{
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      backgroundColor: theme.bg.secondary,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      border: `1px solid ${theme.border.default}`,
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        backgroundColor: theme.bg.primary,
      }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: theme.text.secondary,
            zIndex: 1,
          }}>
            Loading video...
          </div>
        )}
        {error ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: theme.status.error.text,
            textAlign: 'center',
            padding: theme.spacing.md,
            zIndex: 1,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: theme.spacing.sm }}>⚠️</div>
            <div>Failed to load video</div>
            <div style={{ fontSize: '0.875rem', marginTop: theme.spacing.xs, color: theme.text.secondary }}>
              {error}
            </div>
          </div>
        ) : (
          <video
            src={videoUrl}
            controls
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            onLoadedData={() => setLoading(false)}
            onError={(e) => {
              setLoading(false)
              setError('Video failed to load. The file may be corrupted or the URL is invalid.')
            }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>
      {title && (
        <div style={{
          padding: theme.spacing.sm,
          borderTop: `1px solid ${theme.border.default}`,
          fontSize: '0.875rem',
          color: theme.text.secondary,
        }}>
          {title}
        </div>
      )}
    </div>
  )
}

