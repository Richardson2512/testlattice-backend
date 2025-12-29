// Re-export types from shared location
// In a real setup, these would be in a shared package

// Import ComprehensiveTestResults type
import {
  ConsoleError,
  NetworkError,
  PerformanceMetrics,
  AccessibilityIssue,
  VisualIssue,
  DOMHealth,
  SecurityIssue,
  SEOIssue,
  ThirdPartyDependency,
  EvaluationStatus,
  EvaluationResult
} from './comprehensive'

export interface ComprehensiveTestResults {
  consoleErrors: ConsoleError[]
  networkErrors: NetworkError[]
  performance: PerformanceMetrics
  accessibility: AccessibilityIssue[]
  visualIssues: VisualIssue[]
  domHealth: DOMHealth
  security?: SecurityIssue[]
  seo?: SEOIssue[]
  thirdPartyDependencies?: ThirdPartyDependency[]
  wcagScore?: {
    level: 'A' | 'AA' | 'AAA' | 'none'
    score: number
    passed: number
    failed: number
    warnings: number
  }
}

export * from './comprehensive'

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
  DIAGNOSING = 'diagnosing',
  WAITING_APPROVAL = 'waiting_approval',
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

export type TestEnvironment = 'development' | 'staging' | 'production'

export interface ApprovalPolicy {
  mode?: 'manual' | 'auto' | 'auto_on_clean'
  maxBlockers?: number
  channels?: Array<'dashboard' | 'slack'>
}

export interface DesignSpec {
  // Color Palette
  primaryColor?: string        // e.g., '#1A73E8'
  secondaryColor?: string     // e.g., '#34A853'
  accentColor?: string        // e.g., '#FBBC04'
  textColor?: string          // e.g., '#202124'
  backgroundColor?: string    // e.g., '#FFFFFF'
  errorColor?: string         // e.g., '#EA4335'
  successColor?: string       // e.g., '#34A853'
  warningColor?: string       // e.g., '#FBBC04'

  // Typography
  primaryFontFamily?: string   // e.g., 'Roboto, sans-serif'
  secondaryFontFamily?: string // e.g., 'Google Sans, sans-serif'
  headingFontFamily?: string   // e.g., 'Google Sans, sans-serif'
  bodyFontSize?: string        // e.g., '14px' or '1rem'
  headingFontSize?: string     // e.g., '24px' or '1.5rem'

  // Spacing
  baseSpacingUnit?: number     // e.g., 8 (for 8px grid system)
  minSpacing?: number          // Minimum spacing between elements (px)

  // Component Standards
  buttonBorderRadius?: string  // e.g., '4px'
  inputBorderRadius?: string   // e.g., '4px'
  cardBorderRadius?: string    // e.g., '8px'

  // Optional: Allow per-component overrides
  componentSpecs?: {
    buttons?: {
      primaryColor?: string
      borderRadius?: string
    }
    links?: {
      color?: string
      hoverColor?: string
    }
    inputs?: {
      borderColor?: string
      focusColor?: string
    }
  }
}

export interface TestOptions {
  visualDiff?: boolean
  visualDiffThreshold?: number  // Acceptable difference percentage (default 1.0%)
  baselineRunId?: string  // Run ID to use as baseline for visual comparison
  stressTest?: boolean
  coverage?: string[]
  maxSteps?: number
  testMode?: 'single' | 'multi' | 'all' | 'monkey' | 'guest' | 'behavior'
  allPages?: boolean
  monkeyMode?: boolean
  monkeyConfig?: {
    randomness?: number
    maxExplorations?: number
    allowNavigation?: boolean
  }
  behaviors?: string[] // Behavior Analysis specific
  environment?: TestEnvironment
  approvalPolicy?: ApprovalPolicy
  designSpec?: DesignSpec  // Optional design specification for visual consistency checks
  browserMatrix?: Array<'chromium' | 'firefox' | 'webkit'>  // Defaults to ['chromium'] for cross-browser testing
  // Registered user test options (multi-select)
  selectedTestTypes?: Array<'visual' | 'login' | 'signup' | 'navigation' | 'form' | 'accessibility' | 'rage_bait'>
  // Guest test options (handled by GuestTestProcessor)
  isGuestRun?: boolean
  guestTestType?: 'login' | 'signup' | 'visual' | 'navigation' | 'form' | 'accessibility' | 'rage_bait'
  guestCredentials?: {
    username?: string
    email?: string
    password?: string
  }
  continuousPopupHandling?: boolean
}

export interface DiagnosisComponentInsight {
  name: string
  selector: string
  description: string
  testability: 'high' | 'medium' | 'low'
}

export interface DiagnosisIssueInsight {
  name: string
  reason: string
}

export interface HighRiskArea {
  name: string
  type: 'third_party_integration' | 'complex_state' | 'flaky_component' | 'security_sensitive' | 'manual_judgment'
  selector?: string
  description: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  requiresManualIntervention: boolean
  reason: string
}

export interface DiagnosisPageSummary {
  id: string
  label?: string
  url?: string
  action?: string
  title?: string
  screenshotUrl?: string
  screenshotUrls?: string[] // All screenshots captured during scrolling
  summary: string
  testableComponents: DiagnosisComponentInsight[]
  nonTestableComponents: DiagnosisIssueInsight[]
  recommendedTests: string[]
  errors?: string[]
  blockedSelectors?: string[]
}

export interface DiagnosisResult {
  screenshotUrl?: string
  summary: string
  testableComponents: DiagnosisComponentInsight[]
  nonTestableComponents: DiagnosisIssueInsight[]
  recommendedTests: string[]
  pages?: DiagnosisPageSummary[]
  blockedSelectors?: string[]
  comprehensiveTests?: ComprehensiveTestResults
  highRiskAreas?: HighRiskArea[]
}

// Real-time diagnosis progress tracking
export interface DiagnosisProgress {
  step: number              // Current main step (1-5 for single, 1-6 for multi)
  totalSteps: number        // Total main steps
  stepLabel: string         // Human-readable step description
  subStep: number           // Current sub-step within main step
  totalSubSteps: number     // Total sub-steps in current main step
  subStepLabel?: string     // Human-readable sub-step description
  percent: number           // Overall progress 0-100
}

export interface LLMAction {
  action: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'assert' | 'complete' | 'setViewport' | 'setDevice' | 'setOrientation'
  target?: string
  selector?: string
  value?: string
  description: string
  confidence?: number
}

export interface VisionElement {
  testability?: 'high' | 'medium' | 'low'
  type: string
  role?: string
  name?: string
  text?: string
  selector?: string
  ariaLabel?: string
  href?: string
  isHidden?: boolean
  inputType?: string
  className?: string | { baseVal: string }
  bounds?: { x: number; y: number; width: number; height: number }
  isRequired?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  elementId?: string
  // Vision validation fields
  visionValidated?: boolean
  visibleOnScreen?: boolean
  interactable?: boolean
  visibilityConfidence?: number
  visibilityReason?: string
}

export interface AccessibilityNode {
  role: string
  name?: string
  selector?: string
  issues?: string[]
}

export interface VisionContext {
  elements: VisionElement[]
  accessibility?: AccessibilityNode[]
  metadata: {
    totalElements: number
    interactiveElements?: number
    hiddenElements?: number
    truncated: boolean
    timestamp?: string
    pageUrl?: string
    pageTitle?: string
    visionValidated?: boolean  // Flag indicating vision was used
  }
}

export interface SemanticAnchors {
  visualAnchor?: string
  functionalAnchor?: string
  structuralAnchor?: string
}

export interface HeuristicRecord {
  projectId: string
  componentHash: string
  userAction: {
    action: string
    selector: string
    value?: string
    description: string
  }
  preCondition?: string
  reliabilityScore: number
  visualAnchor?: string
  functionalAnchor?: string
  structuralAnchor?: string
  domSnapshotBefore?: string
  domSnapshotAfter?: string
  runId: string
  stepId: string
  usageCount: number
  successCount: number
}

export interface GodModeInteraction {
  runId: string
  stepId: string
  interaction: {
    type: string
    targetSelector?: string
    coordinates?: { x: number; y: number }
    value?: string
    domSnapshotBefore?: string
    domSnapshotAfter?: string
  }
  metadata: {
    userIntent?: string
    preCondition?: string
  }
}

export interface BrowserMatrixResult {
  browser: 'chromium' | 'firefox' | 'webkit'
  success: boolean
  steps: TestStep[]
  artifacts: string[]
  error?: string
  executionTime: number
}

export interface ProcessResult {
  success: boolean
  steps: TestStep[]
  artifacts: string[]
  stage?: 'diagnosis' | 'execution'
  browserResults?: BrowserMatrixResult[]
}

export interface SelfHealingInfo {
  strategy: 'text' | 'attribute' | 'position' | 'vision' | 'fallback'
  originalSelector?: string
  healedSelector: string
  note: string
  confidence: number
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
  success?: boolean
  error?: string
  browser?: 'chromium' | 'firefox' | 'webkit'  // Browser for this step (mandatory for parallel browser tests)
  // Comprehensive testing data
  consoleErrors?: Array<{ type: string; message: string; timestamp: string }>
  networkErrors?: Array<{ url: string; status: number; timestamp: string }>
  performance?: { pageLoadTime: number; firstContentfulPaint?: number }
  accessibilityIssues?: Array<{ type: string; message: string; impact: string }>
  visualIssues?: Array<{ type: string; description: string; severity: string }>
  mode?: 'llm' | 'speculative' | 'monkey'
  selfHealing?: SelfHealingInfo
  // Visual annotation data for Iron Man HUD
  elementBounds?: Array<{
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    type: string
    text?: string
    interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
  }>
  targetElementBounds?: {
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
  }
  // Environment metadata for compatibility & responsiveness testing
  environment?: {
    browser: string
    viewport: string
    orientation?: 'portrait' | 'landscape'
  }
  // Visual issue detection results
  visualDiff?: {
    hasDifference: boolean
    diffPercentage: number
    diffImageUrl?: string
    baselineRunId?: string
    threshold?: number
  }
  // Metadata for additional context (failure explanations, AI thinking, etc.)
  metadata?: {
    failureExplanation?: {
      why: string
      userExperience: string
      suggestion: string
      confidence: 'high' | 'medium' | 'low'
    }
    aiThinking?: string // AI reasoning state (e.g., "Analyzing navigation", "Looking for primary CTA")
    errorScreenshotUrl?: string // Screenshot captured at error time (separate from step screenshot)
    [key: string]: any // Allow other metadata
  }
  // Soft warnings (e.g. performance issues) that don't fail the step
  warnings?: Array<{ type: string; message: string; severity: string }>
  // Detailed report on self-healing actions
  healingReport?: {
    originalSelector: string
    healedSelector: string
    reason: string
    confidence: number
  }
}

export interface ActionExecutionResult {
  healing?: SelfHealingInfo
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
  // Parallel browser testing support
  browserType?: 'chromium' | 'firefox' | 'webkit' // Specific browser for this job
  parentRunId?: string // Original runId if this is a browser-specific job from a matrix
  browserMatrix?: Array<'chromium' | 'firefox' | 'webkit'> // Full browser matrix (for reference)
}

