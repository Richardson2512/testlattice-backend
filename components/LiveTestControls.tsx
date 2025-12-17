'use client'

interface LiveTestControlsProps {
  testRunId: string
  status: string
  paused: boolean
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onGodMode?: () => void
  onScreenshot: () => void
  onDownloadLog: () => void
  onFullScreen: () => void
  isPausing: boolean
  isResuming: boolean
  isStopping: boolean
  isFullScreen: boolean
  aiStuck?: boolean  // NEW: Indicates if AI is stuck
}

export function LiveTestControls({
  testRunId,
  status,
  paused,
  onPause,
  onResume,
  onStop,
  onGodMode,
  onScreenshot,
  onDownloadLog,
  onFullScreen,
  isPausing,
  isResuming,
  isStopping,
  isFullScreen,
  aiStuck = false  // Default to false
}: LiveTestControlsProps) {
  const isRunning = status === 'running'
  const isDiagnosing = status === 'diagnosing'
  const isActive = isRunning || isDiagnosing
  
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      padding: '1rem',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-medium)',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      {/* Primary Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Pause/Resume */}
        {isRunning && (
          <button
            onClick={paused ? onResume : onPause}
            disabled={isPausing || isResuming}
            className="btn btn-primary"
            style={{ 
              minWidth: '100px',
              opacity: (isPausing || isResuming) ? 0.6 : 1
            }}
          >
            {isPausing ? 'Pausing...' : 
             isResuming ? 'Resuming...' : 
             paused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
        )}
        
        {/* Stop */}
        {isActive && (
          <button
            onClick={onStop}
            disabled={isStopping}
            className="btn btn-secondary"
            style={{ 
              minWidth: '100px',
              opacity: isStopping ? 0.6 : 1
            }}
          >
            {isStopping ? 'Stopping...' : '⏹️ Stop'}
          </button>
        )}
        
        {/* God Mode - Show when AI is stuck OR when paused */}
        {isRunning && (paused || aiStuck) && onGodMode && (
          <button
            onClick={onGodMode}
            className="btn"
            style={{ 
              minWidth: '120px',
              background: aiStuck 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              fontWeight: '700',
              boxShadow: aiStuck ? '0 4px 12px rgba(239, 68, 68, 0.4)' : 'none',
              animation: aiStuck ? 'pulse 2s infinite' : 'none',
            }}
          >
            {aiStuck ? '🚨 God Mode (AI Stuck!)' : '🎮 God Mode'}
          </button>
        )}
      </div>
      
      {/* Secondary Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Screenshot */}
        <button
          onClick={onScreenshot}
          className="btn btn-secondary"
          title="Capture Screenshot"
          style={{
            width: '40px',
            height: '40px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}
        >
          📸
        </button>
        
        {/* Download Log */}
        <button
          onClick={onDownloadLog}
          className="btn btn-secondary"
          title="Download Test Log"
          style={{
            width: '40px',
            height: '40px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}
        >
          📥
        </button>
        
        {/* Full Screen */}
        <button
          onClick={onFullScreen}
          className="btn btn-secondary"
          title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          style={{
            width: '40px',
            height: '40px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}
        >
          {isFullScreen ? '🗗' : '🗖'}
        </button>
      </div>
    </div>
  )
}

