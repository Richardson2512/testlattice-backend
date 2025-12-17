'use client'

interface BrowserMatrixSelectorProps {
  value: Array<'chromium' | 'firefox' | 'webkit'>
  onChange: (browsers: Array<'chromium' | 'firefox' | 'webkit'>) => void
}

const BROWSERS = [
  { 
    id: 'chromium' as const, 
    name: 'Chrome', 
    icon: '🌐', 
    description: 'Chromium engine (Chrome, Edge)',
    priority: 1
  },
  { 
    id: 'firefox' as const, 
    name: 'Firefox', 
    icon: '🦊', 
    description: 'Gecko engine',
    priority: 3
  },
  { 
    id: 'webkit' as const, 
    name: 'Safari', 
    icon: '🧭', 
    description: 'WebKit engine',
    priority: 2
  },
]

export function BrowserMatrixSelector({ value, onChange }: BrowserMatrixSelectorProps) {
  const toggleBrowser = (browserId: 'chromium' | 'firefox' | 'webkit') => {
    if (value.includes(browserId)) {
      onChange(value.filter(b => b !== browserId))
    } else {
      onChange([...value, browserId])
    }
  }
  
  return (
    <div className="browser-matrix-selector">
      <label className="form-label">
        Cross-Browser Testing
        <span className="badge-new">NEW</span>
      </label>
      <p className="help-text">
        Test your application across multiple browsers in a single run (optional)
      </p>
      
      <div className="browser-options">
        {BROWSERS
          .sort((a, b) => a.priority - b.priority)
          .map((browser) => (
            <label key={browser.id} className="browser-checkbox">
              <input
                type="checkbox"
                checked={value.includes(browser.id)}
                onChange={() => toggleBrowser(browser.id)}
              />
              <span className="browser-info">
                <span className="browser-icon">{browser.icon}</span>
                <div className="browser-details">
                  <span className="browser-name">{browser.name}</span>
                  <span className="browser-description">{browser.description}</span>
                </div>
              </span>
            </label>
          ))}
      </div>
      
      {value.length > 0 && (
        <div className="selected-browsers">
          <p className="selected-text">
            <strong>Selected:</strong> {value.map(b => 
              BROWSERS.find(br => br.id === b)?.name
            ).join(', ')}
          </p>
          <p className="info-text">
            Test will run on {value.length} browser{value.length > 1 ? 's' : ''} sequentially.
            Estimated time: {value.length}× single browser test.
          </p>
        </div>
      )}
      
      {value.length === 0 && (
        <p className="info-text">
          No browsers selected. Test will run on the primary device only.
        </p>
      )}
    </div>
  )
}

