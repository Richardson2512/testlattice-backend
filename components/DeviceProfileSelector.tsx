'use client'

import { DeviceProfile } from '@/lib/api'

interface DeviceOption {
  value: DeviceProfile
  label: string
  description: string
  viewport: string
  icon: string
  priority: 1 | 2 | 3
}

const DEVICE_OPTIONS: DeviceOption[] = [
  // Desktop Browsers
  {
    value: DeviceProfile.CHROME_LATEST,
    label: 'Chrome Desktop',
    description: '90% of users',
    viewport: '1920×1080',
    icon: '🌐',
    priority: 1
  },
  {
    value: DeviceProfile.SAFARI_LATEST,
    label: 'Safari Desktop',
    description: 'CSS differences from Chrome',
    viewport: '1440×900',
    icon: '🧭',
    priority: 2
  },
  {
    value: DeviceProfile.FIREFOX_LATEST,
    label: 'Firefox',
    description: 'Form handling differences',
    viewport: '1920×1080',
    icon: '🦊',
    priority: 3
  },
  
  // Mobile Browsers
  {
    value: DeviceProfile.MOBILE_CHROME,
    label: 'Mobile Chrome',
    description: '60% of mobile traffic',
    viewport: '390×844 (iPhone 12)',
    icon: '📱',
    priority: 2
  },
  {
    value: DeviceProfile.MOBILE_SAFARI,
    label: 'Mobile Safari',
    description: 'iOS-specific quirks',
    viewport: '390×844 (iPhone 12)',
    icon: '📱',
    priority: 2
  },
  {
    value: DeviceProfile.MOBILE_CHROME_ANDROID,
    label: 'Mobile Chrome (Android)',
    description: 'Android viewport',
    viewport: '360×640',
    icon: '🤖',
    priority: 3
  },
]

interface DeviceProfileSelectorProps {
  value: DeviceProfile
  onChange: (device: DeviceProfile) => void
}

export function DeviceProfileSelector({ value, onChange }: DeviceProfileSelectorProps) {
  const desktopDevices = DEVICE_OPTIONS.filter(opt => 
    !opt.value.includes('mobile') && !opt.value.includes('android') && !opt.value.includes('ios')
  )
  const mobileDevices = DEVICE_OPTIONS.filter(opt => 
    opt.value.includes('mobile') || opt.value.includes('android') || opt.value.includes('ios')
  )
  
  return (
    <div className="device-profile-selector">
      <label className="form-label">
        Device Profile
        <span className="help-text">Select the browser and viewport for testing</span>
      </label>
      
      {/* Desktop Browsers */}
      <div className="device-group">
        <h4 className="device-group-title">Desktop Browsers</h4>
        <div className="device-grid">
          {desktopDevices
            .sort((a, b) => a.priority - b.priority)
            .map((option) => (
              <button
                key={option.value}
                type="button"
                className={`device-option ${value === option.value ? 'selected' : ''}`}
                onClick={() => onChange(option.value)}
              >
                <span className="device-icon">{option.icon}</span>
                <div className="device-info">
                  <span className="device-label">{option.label}</span>
                  <span className="device-viewport">{option.viewport}</span>
                  <span className="device-description">{option.description}</span>
                </div>
                {option.priority === 1 && (
                  <span className="priority-badge">Priority 1</span>
                )}
              </button>
            ))}
        </div>
      </div>
      
      {/* Mobile Browsers */}
      <div className="device-group">
        <h4 className="device-group-title">Mobile Browsers</h4>
        <div className="device-grid">
          {mobileDevices
            .sort((a, b) => a.priority - b.priority)
            .map((option) => (
              <button
                key={option.value}
                type="button"
                className={`device-option ${value === option.value ? 'selected' : ''}`}
                onClick={() => onChange(option.value)}
              >
                <span className="device-icon">{option.icon}</span>
                <div className="device-info">
                  <span className="device-label">{option.label}</span>
                  <span className="device-viewport">{option.viewport}</span>
                  <span className="device-description">{option.description}</span>
                </div>
                {option.priority === 2 && (
                  <span className="priority-badge priority-2">Priority 2</span>
                )}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

