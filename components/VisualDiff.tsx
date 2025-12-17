'use client'

import React, { useState, useEffect } from 'react'
import { theme } from '../lib/theme'

interface VisualDiffProps {
  baselineUrl: string
  currentUrl: string
  diffUrl?: string
  diffPercentage: number
  mismatchedPixels: number
  totalPixels: number
  onApproveBaseline?: () => void
  className?: string
}

/**
 * Visual Diff Component
 * Displays pixel-perfect comparison between baseline and current screenshots
 * 
 * Features:
 * - Side-by-side view (baseline vs current vs diff)
 * - Slider to compare before/after
 * - Diff percentage display
 * - "Approve as new baseline" button
 */
export function VisualDiff({
  baselineUrl,
  currentUrl,
  diffUrl,
  diffPercentage,
  mismatchedPixels,
  totalPixels,
  onApproveBaseline,
  className = '',
}: VisualDiffProps) {
  const [viewMode, setViewMode] = useState<'split' | 'slider' | 'diff' | 'flicker'>('split')
  const [sliderPosition, setSliderPosition] = useState(50)
  const [approving, setApproving] = useState(false)
  const [isFlickering, setIsFlickering] = useState(false)
  const [flickerImage, setFlickerImage] = useState<'baseline' | 'current'>('baseline')

  const hasDifference = diffPercentage > 0
  const isAcceptable = diffPercentage <= 1.0 // 1% threshold

  // Flicker mode: Hold spacebar to rapidly toggle between baseline and current
  useEffect(() => {
    if (viewMode !== 'flicker') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFlickering && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault()
        setIsFlickering(true)
        
        // Start flickering every 300ms
        const interval = setInterval(() => {
          setFlickerImage(prev => prev === 'baseline' ? 'current' : 'baseline')
        }, 300)
        
        // Store interval globally to clear on key up
        ;(window as any).__flickerInterval = interval
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        clearInterval((window as any).__flickerInterval)
        setIsFlickering(false)
        setFlickerImage('baseline')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if ((window as any).__flickerInterval) {
        clearInterval((window as any).__flickerInterval)
      }
    }
  }, [viewMode, isFlickering])

  const handleApproveBaseline = async () => {
    if (!onApproveBaseline) return
    setApproving(true)
    try {
      await onApproveBaseline()
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className={`${className}`}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        border: `2px solid ${hasDifference ? (isAcceptable ? '#f59e0b' : '#ef4444') : '#10b981'}`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {hasDifference ? (
                isAcceptable ? '⚠️ Minor Visual Changes' : '❌ Visual Regression Detected'
              ) : (
                '✅ Visual Match'
              )}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              <strong>Difference:</strong> {diffPercentage.toFixed(4)}% 
              ({mismatchedPixels.toLocaleString()} / {totalPixels.toLocaleString()} pixels)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setViewMode('split')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'split' ? '#3b82f6' : '#e5e7eb',
                color: viewMode === 'split' ? '#fff' : '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('slider')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'slider' ? '#3b82f6' : '#e5e7eb',
                color: viewMode === 'slider' ? '#fff' : '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Slider
            </button>
            {diffUrl && (
              <button
                onClick={() => setViewMode('diff')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: viewMode === 'diff' ? '#3b82f6' : '#e5e7eb',
                  color: viewMode === 'diff' ? '#fff' : '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Diff Only
              </button>
            )}
            <button
              onClick={() => setViewMode('flicker')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'flicker' ? '#9333ea' : '#e5e7eb',
                color: viewMode === 'flicker' ? '#fff' : '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              ⚡ Flicker
            </button>
          </div>
        </div>

        {/* Alert */}
        {hasDifference && !isAcceptable && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
            color: '#991b1b',
            fontSize: '0.875rem',
          }}>
            <strong>⚠️ Significant visual changes detected!</strong> This may indicate a CSS regression or unintended layout change.
            Review the differences carefully before approving.
          </div>
        )}

        {/* View Modes */}
        {viewMode === 'split' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: diffUrl ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            gap: '1rem',
          }}>
            <div>
              <div style={{
                padding: '0.5rem',
                backgroundColor: '#10b981',
                color: '#fff',
                textAlign: 'center',
                borderRadius: '0.375rem 0.375rem 0 0',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}>
                Baseline (Expected)
              </div>
              <img
                src={baselineUrl}
                alt="Baseline"
                style={{
                  width: '100%',
                  height: 'auto',
                  border: '2px solid #10b981',
                  borderTop: 'none',
                  borderRadius: '0 0 0.375rem 0.375rem',
                }}
              />
            </div>
            <div>
              <div style={{
                padding: '0.5rem',
                backgroundColor: '#3b82f6',
                color: '#fff',
                textAlign: 'center',
                borderRadius: '0.375rem 0.375rem 0 0',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}>
                Current (Actual)
              </div>
              <img
                src={currentUrl}
                alt="Current"
                style={{
                  width: '100%',
                  height: 'auto',
                  border: '2px solid #3b82f6',
                  borderTop: 'none',
                  borderRadius: '0 0 0.375rem 0.375rem',
                }}
              />
            </div>
            {diffUrl && (
              <div>
                <div style={{
                  padding: '0.5rem',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  textAlign: 'center',
                  borderRadius: '0.375rem 0.375rem 0 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}>
                  Difference (Pink = Changed)
                </div>
                <img
                  src={diffUrl}
                  alt="Diff"
                  style={{
                    width: '100%',
                    height: 'auto',
                    border: '2px solid #ef4444',
                    borderTop: 'none',
                    borderRadius: '0 0 0.375rem 0.375rem',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {viewMode === 'slider' && (
          <div style={{ position: 'relative' }}>
            <div style={{
              padding: '0.5rem',
              backgroundColor: '#6b7280',
              color: '#fff',
              textAlign: 'center',
              borderRadius: '0.375rem 0.375rem 0 0',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}>
              Drag slider to compare
            </div>
            <div style={{
              position: 'relative',
              overflow: 'hidden',
              border: '2px solid #6b7280',
              borderTop: 'none',
              borderRadius: '0 0 0.375rem 0.375rem',
            }}>
              {/* Baseline (underneath) */}
              <img
                src={baselineUrl}
                alt="Baseline"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
              {/* Current (overlay with clip) */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              }}>
                <img
                  src={currentUrl}
                  alt="Current"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                />
              </div>
              {/* Slider handle */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: `${sliderPosition}%`,
                width: '4px',
                height: '100%',
                backgroundColor: '#fff',
                boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                cursor: 'ew-resize',
                transform: 'translateX(-50%)',
              }} />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: '1rem',
              }}
            />
          </div>
        )}

        {viewMode === 'diff' && diffUrl && (
          <div>
            <div style={{
              padding: '0.5rem',
              backgroundColor: '#ef4444',
              color: '#fff',
              textAlign: 'center',
              borderRadius: '0.375rem 0.375rem 0 0',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}>
              Difference Overlay (Pink = Changed Pixels)
            </div>
            <img
              src={diffUrl}
              alt="Diff"
              style={{
                width: '100%',
                height: 'auto',
                border: '2px solid #ef4444',
                borderTop: 'none',
                borderRadius: '0 0 0.375rem 0.375rem',
              }}
            />
          </div>
        )}

        {viewMode === 'flicker' && (
          <div>
            <div style={{
              padding: '0.5rem',
              backgroundColor: '#9333ea',
              color: '#fff',
              textAlign: 'center',
              borderRadius: '0.375rem 0.375rem 0 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}>
              ⚡ Flicker Mode - Hold SPACE to rapidly toggle
              {isFlickering && (
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  animation: 'pulse 0.3s infinite',
                }}/>
              )}
            </div>
            <div style={{
              position: 'relative',
              border: '2px solid #9333ea',
              borderTop: 'none',
              borderRadius: '0 0 0.375rem 0.375rem',
            }}>
              <img
                src={flickerImage === 'baseline' ? baselineUrl : currentUrl}
                alt={flickerImage === 'baseline' ? 'Baseline' : 'Current'}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
              <div style={{
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: flickerImage === 'baseline' ? '#10b981' : '#3b82f6',
                color: '#fff',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}>
                {flickerImage === 'baseline' ? '📸 BASELINE' : '🔴 CURRENT'}
              </div>
            </div>
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f3e8ff',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: '#6b21a8',
            }}>
              <strong>💡 How to use:</strong> Hold down the <kbd style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#fff',
                border: '1px solid #d8b4fe',
                borderRadius: '0.25rem',
                fontFamily: 'monospace',
              }}>SPACE</kbd> key to rapidly switch between baseline and current. 
              Small visual differences (1-2px shifts, subtle color changes) become immediately obvious with this technique.
            </div>
          </div>
        )}

        {/* Actions */}
        {hasDifference && onApproveBaseline && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.375rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '0.875rem', color: '#374151' }}>
              If this change is intentional, approve it as the new baseline for future comparisons.
            </div>
            <button
              onClick={handleApproveBaseline}
              disabled={approving}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: approving ? '#6b7280' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: approving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              {approving ? '⏳ Approving...' : '✓ Approve as New Baseline'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

