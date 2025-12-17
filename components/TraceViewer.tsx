'use client'

import React, { useState } from 'react'

interface TraceViewerProps {
  traceUrl: string
  className?: string
}

/**
 * Playwright Trace Viewer Component
 * Displays the interactive trace viewer for time-travel debugging
 * 
 * Features:
 * - Synchronized video + logs timeline
 * - Network waterfall
 * - DOM snapshots per step
 * - Console logs
 * - Source code view
 */
export function TraceViewer({ traceUrl, className = '' }: TraceViewerProps) {
  const [viewerMode, setViewerMode] = useState<'embedded' | 'external'>('external')
  const [showInstructions, setShowInstructions] = useState(true)

  // Check if trace URL is valid (not a local path)
  const isValidUrl = traceUrl && !traceUrl.startsWith('local:') && (traceUrl.startsWith('http://') || traceUrl.startsWith('https://'))
  
  // Playwright trace viewer can be accessed via:
  // 1. Download the trace.zip and open with `npx playwright show-trace trace.zip`
  // 2. Upload to https://trace.playwright.dev/
  // 3. Embed the official trace viewer (requires serving the trace file)

  // Show error if trace URL is invalid
  if (!isValidUrl) {
    return (
      <div className={`${className}`}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          border: '2px solid #ef4444',
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            padding: '1rem',
            borderRadius: '0.375rem',
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚠️ Trace File Not Available
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>
              {traceUrl && traceUrl.startsWith('local:') 
                ? 'The trace file was stored locally on the server and is not accessible from the browser. This usually happens when the trace file is too large or the upload failed.'
                : 'The trace file is not available. It may not have been generated or uploaded successfully.'}
            </p>
            {traceUrl && traceUrl.startsWith('local:') && (
              <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginTop: '0.5rem', marginBottom: 0 }}>
                <strong>Note:</strong> To access the trace file, you would need to download it directly from the worker server.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        border: '2px solid #3b82f6',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⏱️ Time-Travel Debugger
            <span style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '9999px',
              backgroundColor: '#dbeafe',
              color: '# 1e40af',
              fontWeight: '500',
            }}>
              Powered by Playwright Trace
            </span>
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setViewerMode('external')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewerMode === 'external' ? '#3b82f6' : '#e5e7eb',
                color: viewerMode === 'external' ? '#fff' : '#374151',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              External Viewer
            </button>
            <button
              onClick={() => setViewerMode('embedded')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewerMode === 'embedded' ? '#3b82f6' : '#e5e7eb',
                color: viewerMode === 'embedded' ? '#fff' : '#374151',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Web Viewer
            </button>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          The Time-Travel Debugger lets you scrub through your test execution with full context:
          video, logs, network requests, DOM snapshots, and console output—all perfectly synchronized.
        </p>

        {viewerMode === 'external' && (
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '0.375rem',
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📥 Option 1: Download and View Locally
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  fontWeight: '500',
                }}>
                  Recommended
                </span>
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Best for detailed analysis with full performance and offline access.
              </p>
              <div style={{
                backgroundColor: 'var(--beige-100)',
                borderRadius: '0.375rem',
                padding: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                border: '1px solid var(--beige-300)',
                marginBottom: '1rem',
              }}>
                # Download the trace file, then run:<br />
                npx playwright show-trace trace.zip
              </div>
              <a
                href={traceUrl}
                download="trace.zip"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                }}
              >
                ⬇️ Download Trace File (trace.zip)
              </a>
            </div>

            <div style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: '1.5rem',
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🌐 Option 2: Open in Official Playwright Trace Viewer
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Upload your trace to Playwright's hosted viewer (no data leaves your browser).
              </p>
              <a
                href="https://trace.playwright.dev/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  marginRight: '1rem',
                }}
              >
                🚀 Open Playwright Trace Viewer →
              </a>
              <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                Then drag & drop your trace.zip file
              </span>
            </div>

            {showInstructions && (
              <div style={{
                marginTop: '1.5rem',
                backgroundColor: '#eff6ff',
                borderLeft: '4px solid #3b82f6',
                padding: '1rem',
                borderRadius: '0.375rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
                      💡 What you'll see in the Trace Viewer:
                    </h4>
                    <ul style={{ fontSize: '0.875rem', color: '#1e3a8a', margin: 0, paddingLeft: '1.5rem' }}>
                      <li>📹 Video recording synced with timeline</li>
                      <li>📝 Step-by-step action logs</li>
                      <li>🌐 Network requests with timing waterfall</li>
                      <li>🖥️ DOM snapshots at each step</li>
                      <li>📊 Console logs and errors</li>
                      <li>💻 Source code view</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => setShowInstructions(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      padding: '0',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {viewerMode === 'embedded' && (
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '0.375rem',
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{
              backgroundColor: '#fffbeb',
              borderLeft: '4px solid #f59e0b',
              padding: '1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
            }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e', marginBottom: '0.5rem' }}>
                ⚠️ Web Viewer (Experimental)
              </h4>
              <p style={{ fontSize: '0.875rem', color: '#78350f', margin: 0 }}>
                The embedded web viewer requires additional setup. For the best experience, use the download option above.
              </p>
            </div>
            
            <iframe
              src={`https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`}
              style={{
                width: '100%',
                height: '600px',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
              }}
              title="Playwright Trace Viewer"
            />
          </div>
        )}
      </div>
    </div>
  )
}

