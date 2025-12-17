'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Redirect old route to new route for backward compatibility
export default function OldTestRunPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string

  useEffect(() => {
    // Redirect to new route structure
    router.replace(`/test/run/${runId}`)
  }, [runId, router])

  return <div style={{ padding: '2rem', textAlign: 'center' }}>Redirecting...</div>
}
