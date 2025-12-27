'use client'

import { useEffect, useState } from 'react'

export function VercelAnalytics() {
  const [Analytics, setAnalytics] = useState<any>(null)
  const [SpeedInsights, setSpeedInsights] = useState<any>(null)

  useEffect(() => {
    // Dynamically import analytics only on client side
    Promise.all([
      import('@vercel/analytics/react').catch(() => null),
      import('@vercel/speed-insights/next').catch(() => null),
    ]).then(([analytics, speedInsights]) => {
      if (analytics) setAnalytics(() => analytics.Analytics)
      if (speedInsights) setSpeedInsights(() => speedInsights.SpeedInsights)
    })
  }, [])

  if (!Analytics && !SpeedInsights) return null

  return (
    <>
      {Analytics && <Analytics />}
      {SpeedInsights && <SpeedInsights />}
    </>
  )
}

