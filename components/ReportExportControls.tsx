'use client'

import { useState } from 'react'
import { exportToPDF, copyShareLink, sendToWebhook, downloadReport } from '@/lib/reportExport'
import { TestRun } from '@/lib/api'

interface ReportExportControlsProps {
  testRun: TestRun
}

export function ReportExportControls({ testRun }: ReportExportControlsProps) {
  const [showShareOptions, setShowShareOptions] = useState(false)
  const [showWebhookOptions, setShowWebhookOptions] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookPlatform, setWebhookPlatform] = useState<'slack' | 'discord'>('slack')
  const [sending, setSending] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string>('')
  
  const handleExportPDF = () => {
    exportToPDF()
  }
  
  const handleDownloadReport = () => {
    downloadReport(testRun)
  }
  
  const handleCopyLink = async (isPublic: boolean) => {
    const success = await copyShareLink(testRun.id, isPublic)
    if (success) {
      setCopyStatus(isPublic ? 'Public link copied!' : 'Private link copied!')
      setTimeout(() => setCopyStatus(''), 3000)
    } else {
      setCopyStatus('Failed to copy')
      setTimeout(() => setCopyStatus(''), 3000)
    }
  }
  
  const handleSendWebhook = async () => {
    if (!webhookUrl) {
      alert('Please enter a webhook URL')
      return
    }
    
    setSending(true)
    const success = await sendToWebhook(testRun, webhookUrl, webhookPlatform)
    setSending(false)
    
    if (success) {
      alert(`Report sent to ${webhookPlatform === 'slack' ? 'Slack' : 'Discord'}!`)
      setShowWebhookOptions(false)
      setWebhookUrl('')
    } else {
      alert(`Failed to send report to ${webhookPlatform}`)
    }
  }
  
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      flexWrap: 'wrap',
      padding: '1rem',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-medium)',
      marginBottom: '2rem',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Download Report */}
        <button onClick={handleDownloadReport} className="btn btn-secondary">
          📥 Download Report
        </button>
        
        {/* Export PDF */}
        <button onClick={handleExportPDF} className="btn btn-secondary">
          📄 Export PDF
        </button>
        
        {/* Share Link */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowShareOptions(!showShareOptions)}
            className="btn btn-secondary"
          >
            🔗 Share Link
          </button>
          {showShareOptions && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '0.5rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 10,
              minWidth: '200px'
            }}>
              <button 
                onClick={() => {
                  handleCopyLink(false)
                  setShowShareOptions(false)
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                🔒 Private Link
              </button>
              <button 
                onClick={() => {
                  handleCopyLink(true)
                  setShowShareOptions(false)
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                🌐 Public Link
              </button>
            </div>
          )}
        </div>
        
        {/* Send to Slack/Discord */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowWebhookOptions(!showWebhookOptions)}
            className="btn btn-secondary"
          >
            📤 Send to...
          </button>
          {showWebhookOptions && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '0.5rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 10,
              minWidth: '300px'
            }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                  Platform:
                </label>
                <select 
                  value={webhookPlatform}
                  onChange={(e) => setWebhookPlatform(e.target.value as 'slack' | 'discord')}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    marginTop: '0.25rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                  Webhook URL:
                </label>
                <input 
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder={webhookPlatform === 'slack' 
                    ? 'https://hooks.slack.com/services/...' 
                    : 'https://discord.com/api/webhooks/...'}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    marginTop: '0.25rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
              <button 
                onClick={handleSendWebhook}
                disabled={sending || !webhookUrl}
                className="btn btn-primary"
                style={{ 
                  width: '100%',
                  opacity: (sending || !webhookUrl) ? 0.6 : 1
                }}
              >
                {sending ? 'Sending...' : '📤 Send Report'}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Copy Status */}
      {copyStatus && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'var(--success-bg)',
          color: 'var(--success)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          {copyStatus}
        </div>
      )}
    </div>
  )
}

