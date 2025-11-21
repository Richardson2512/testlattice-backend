// Re-export types from shared location
// In a real setup, these would be in a shared package

export enum BuildType {
  WEB = 'web',
  ANDROID = 'android',
  IOS = 'ios',
}

export enum TestRunStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum DeviceProfile {
  CHROME_LATEST = 'chrome-latest',
  FIREFOX_LATEST = 'firefox-latest',
  SAFARI_LATEST = 'safari-latest',
  ANDROID_EMULATOR = 'android-emulator',
  IOS_SIMULATOR = 'ios-simulator',
}

export interface Build {
  type: BuildType
  url?: string
  artifactId?: string
  version?: string
}

export interface TestProfile {
  device: DeviceProfile
  region?: string
  maxMinutes?: number
  viewport?: {
    width: number
    height: number
  }
}

export interface TestOptions {
  visualDiff?: boolean
  stressTest?: boolean
  coverage?: string[]
  maxSteps?: number
  testMode?: 'single' | 'multi' | 'all'
  allPages?: boolean
}

export interface LLMAction {
  action: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'assert' | 'complete'
  target?: string
  selector?: string
  value?: string
  description: string
  confidence?: number
}

export interface VisionContext {
  elements: Array<{
    type: string
    text?: string
    selector?: string
    bounds?: { x: number; y: number; width: number; height: number }
  }>
  screenshot: string
  timestamp: string
}

export interface TestStep {
  id: string
  stepNumber: number
  action: string
  target?: string
  value?: string
  timestamp: string
  screenshotUrl?: string
  domSnapshot?: string
  success: boolean
  error?: string
  // Comprehensive testing data
  consoleErrors?: Array<{ type: string; message: string; timestamp: string }>
  networkErrors?: Array<{ url: string; status: number; timestamp: string }>
  performance?: { pageLoadTime: number; firstContentfulPaint?: number }
  accessibilityIssues?: Array<{ type: string; message: string; impact: string }>
  visualIssues?: Array<{ type: string; description: string; severity: string }>
}

export interface TestArtifact {
  id: string
  runId: string
  type: 'screenshot' | 'video' | 'log' | 'dom'
  url: string
  path: string
  size: number
  createdAt: string
}

export interface JobData {
  runId: string
  projectId: string
  build: Build
  profile: TestProfile
  options?: TestOptions
}

