// Shared types for the Rihario platform

export enum BuildType {
  WEB = 'web',
  // Deprecated: Mobile testing is disabled
  // ANDROID = 'android',
  // IOS = 'ios',
  ANDROID = 'android', // @deprecated - Mobile testing disabled, set ENABLE_APPIUM=true to enable
  IOS = 'ios', // @deprecated - Mobile testing disabled, set ENABLE_APPIUM=true to enable
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
  // Deprecated: Mobile testing is disabled
  ANDROID_EMULATOR = 'android-emulator', // @deprecated - Mobile testing disabled, set ENABLE_APPIUM=true to enable
  IOS_SIMULATOR = 'ios-simulator', // @deprecated - Mobile testing disabled, set ENABLE_APPIUM=true to enable
}

// Guest Test Types - predefined test flows for guest users
export enum GuestTestType {
  LOGIN = 'login',           // Tests login functionality with provided credentials
  SIGNUP = 'signup',         // Tests registration/signup flow with demo data
  VISUAL = 'visual',         // Visual UI exploration and screenshot capture
  NAVIGATION = 'navigation', // Tests link clicking and page navigation
  FORM = 'form',             // Tests form inputs, validation, and submission
  ACCESSIBILITY = 'accessibility', // Basic accessibility audit (alt tags, aria, contrast)
  RAGE_BAIT = 'rage_bait',   // Edge case stress tests (back button, session timeout, etc.)
}

// Credentials for login/signup test flows (demo data only!)
export interface GuestCredentials {
  username?: string;
  email?: string;
  password?: string;
}

export interface Build {
  type: BuildType;
  url?: string;
  artifactId?: string;
  version?: string;
}

export interface TestProfile {
  device: DeviceProfile;
  region?: string;
  maxMinutes?: number;
  viewport?: {
    width: number;
    height: number;
  };
}

export type TestEnvironment = 'development' | 'staging' | 'production';

export interface ApprovalPolicy {
  mode?: 'manual' | 'auto' | 'auto_on_clean';
  maxBlockers?: number;
  channels?: Array<'dashboard' | 'slack'>;
}

export interface TestOptions {
  visualDiff?: boolean;
  stressTest?: boolean;
  coverage?: string[];
  maxSteps?: number;
  testMode?: 'single' | 'multi' | 'all' | 'monkey' | 'behavior';
  allPages?: boolean;
  monkeyMode?: boolean;
  // Behavior Analysis specific options
  behaviors?: string[];
  monkeyConfig?: {
    randomness?: number;
    maxExplorations?: number;
    allowNavigation?: boolean;
  };
  environment?: TestEnvironment;
  approvalPolicy?: ApprovalPolicy;
  browserMatrix?: Array<'chromium' | 'firefox' | 'webkit'>;
  continuousPopupHandling?: boolean;
  // Registered user test options (multi-select)
  selectedTestTypes?: Array<'visual' | 'login' | 'signup' | 'navigation' | 'form' | 'accessibility' | 'rage_bait'>;
  // Saved credential ID for login/signup tests (paid users)
  credentialId?: string;
  // Guest test specific options (single select - SEPARATE FLOW)
  guestTestType?: 'login' | 'signup' | 'visual' | 'navigation' | 'form' | 'accessibility' | 'rage_bait';
  guestCredentials?: GuestCredentials;
}

export interface CreateTestRunRequest {
  projectId: string;
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
}

// Guest test run request - simplified for quick anonymous testing
export interface CreateGuestTestRunRequest {
  url: string;                        // Target URL to test
  testType?: GuestTestType;           // Type of test to run (defaults to 'visual')
  credentials?: GuestCredentials;     // Optional credentials for login/signup flows
  build?: Partial<Build>;             // Optional build config
  profile?: Partial<TestProfile>;     // Optional profile config
  options?: Partial<TestOptions>;     // Optional test options
}

export interface TestRun {
  id: string;
  projectId: string;
  name?: string; // Custom name
  status: TestRunStatus;
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  finalizedAt?: string; // Explicit timestamp for when report/findings are finalized
  duration?: number;
  error?: string;
  reportUrl?: string;
  artifactsUrl?: string;
  traceUrl?: string; // Fallback for trace URL if artifact save fails
  streamUrl?: string; // WebRTC/live streaming URL for real-time test viewing
  steps?: TestStep[];
  paused?: boolean;
  currentStep?: number;
  diagnosis?: DiagnosisResult;
  diagnosisProgress?: DiagnosisProgress;
  testabilityContract?: TestabilityContract; // NEW: Capability-focused diagnosis output
  perTypeDiagnosis?: any; // NEW: Per-test-type can/cannot test results
  guestSessionId?: string;
  expiresAt?: string; // Expiration timestamp for guest test runs
  // Report sharing settings
  visibility?: 'private' | 'public';
  reportSummary?: any; // Comprehensive report summary (ScoutQA-style)
  findings?: any[]; // Structured findings separate from execution steps
  userId?: string;
  metadata?: Record<string, any>; // Stores tier, usage, and other context
}

export interface DiagnosisComponentInsight {
  name: string;
  selector: string;
  description: string;
  testability: 'high' | 'medium' | 'low';
}

export interface DiagnosisIssueInsight {
  name: string;
  reason: string;
}

export interface DiagnosisPageSummary {
  id: string;
  label?: string;
  url?: string;
  action?: string;
  title?: string;
  screenshotUrl?: string;
  screenshotUrls?: string[]; // All screenshots captured during scrolling
  summary: string;
  testableComponents: DiagnosisComponentInsight[];
  nonTestableComponents: DiagnosisIssueInsight[];
  recommendedTests: string[];
  errors?: string[];
  blockedSelectors?: string[];
}

export interface DiagnosisResult {
  screenshotUrl?: string;
  summary: string;
  testableComponents: DiagnosisComponentInsight[];
  nonTestableComponents: DiagnosisIssueInsight[];
  recommendedTests: string[];
  pages?: DiagnosisPageSummary[];
  blockedSelectors?: string[];
  comprehensiveTests?: {
    consoleErrors?: Array<{ type: string; message: string; source?: string; line?: number }>;
    networkErrors?: Array<{ failed: boolean; url: string; status: number; errorText?: string }>;
  };
}

// Real-time diagnosis progress tracking
export interface DiagnosisProgress {
  step: number;              // Current main step (1-5 for single, 1-6 for multi)
  totalSteps: number;        // Total main steps
  stepLabel: string;         // Human-readable step description
  subStep: number;           // Current sub-step within main step
  totalSubSteps: number;     // Total sub-steps in current main step
  subStepLabel?: string;     // Human-readable sub-step description
  percent: number;           // Overall progress 0-100
}

// ============================================================================
// Testability Contract Types (NEW - replaces health-focused diagnosis)
// ============================================================================

export type TestType =
  | 'login'
  | 'signup'
  | 'checkout'
  | 'form_submission'
  | 'navigation'
  | 'search'
  | 'data_entry'
  | 'file_upload'
  | 'custom'
  | 'visual'
  | 'accessibility'
  | 'performance'
  | 'payment'
  | 'settings'
  | 'logout'

export interface TestabilityContract {
  // Per test type analysis
  testTypeAnalysis: TestTypeCapability[]

  // Global blockers (apply to all tests)
  globalBlockers: GlobalBlocker[]

  // System actions (what we'll adapt)
  systemActions: SystemAction[]

  // Overall confidence
  overallConfidence: 'high' | 'medium' | 'low'
  confidenceReason: string

  // What user must accept
  riskAcceptance: RiskAcceptanceItem[]

  // Can we proceed at all?
  canProceed: boolean
  proceedBlockedReason?: string

  // Metadata
  analyzedAt: string
  duration: number
  url: string
  pageTitle: string
}

export interface TestTypeCapability {
  testType: TestType

  // ✅ Will work reliably
  testable: {
    elements: CapabilityItem[]
    confidence: 'high' | 'medium'
  }

  // ⚠️ Might be flaky
  conditionallyTestable: {
    elements: CapabilityItem[]
    conditions: string[]
    confidence: 'medium' | 'low'
  }

  // ❌ Will not work
  notTestable: {
    elements: CapabilityItem[]
    reasons: string[]
  }
}

export interface CapabilityItem {
  name: string
  selector?: string
  reason: string
  elementType?: 'button' | 'input' | 'link' | 'select' | 'textarea' | 'form' | 'other'
}

export interface GlobalBlocker {
  type: 'captcha' | 'mfa' | 'cross_origin_iframe' | 'native_dialog' | 'email_verification' | 'payment_gateway'
  detected: boolean
  location?: string
  selector?: string
  impact: string
  severity: 'blocking' | 'warning'
}

export interface SystemAction {
  action: 'skip_selector' | 'avoid_page' | 'downgrade_check' | 'use_fallback' | 'wait_extra'
  target: string
  reason: string
}

export interface RiskAcceptanceItem {
  risk: string
  impact: string
  userMustAccept: boolean
}

export interface SelfHealingInfo {
  strategy: 'text' | 'attribute' | 'position' | 'fallback';
  originalSelector?: string;
  healedSelector: string;
  note: string;
}

export interface TestStep {
  id: string;
  stepNumber: number;
  action: string;
  target?: string;
  selector?: string;
  value?: string;
  timestamp: string;
  screenshotUrl?: string;
  domSnapshot?: string;
  success: boolean;
  error?: string;
  mode?: 'llm' | 'speculative' | 'monkey';
  selfHealing?: SelfHealingInfo;
  // Visual annotation data for Iron Man HUD
  elementBounds?: Array<{
    selector: string;
    bounds: { x: number; y: number; width: number; height: number };
    type: string;
    text?: string;
    interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed';
  }>;
  targetElementBounds?: {
    selector: string;
    bounds: { x: number; y: number; width: number; height: number };
    interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed';
  };
  // Additional properties for comprehensive testing
  consoleErrors?: Array<{ message: string; source?: string; line?: number }>;
  networkErrors?: Array<{ url: string; status?: number; error?: string }>;
  accessibilityIssues?: Array<{ type: string; element?: string; message: string }>;
  visualIssues?: Array<{ type: string; severity: string; description: string }>;
  performance?: {
    loadTime?: number;
    domContentLoaded?: number;
    firstPaint?: number;
  };
}

export interface TestArtifact {
  id: string;
  runId: string;
  type: 'screenshot' | 'video' | 'log' | 'dom' | 'network' | 'trace';
  url: string;
  path: string;
  size: number;
  createdAt: string;
}

export interface LLMAction {
  action: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'assert' | 'complete';
  target?: string;
  selector?: string;
  value?: string;
  description: string;
  confidence?: number;
}

export interface VisionContext {
  elements: Array<{
    type: string;
    text?: string;
    selector?: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }>;
  screenshot: string;
  timestamp: string;
}

export interface JobData {
  runId: string;
  projectId: string;
  userTier?: string;
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
  // Parallel browser testing support
  browserType?: 'chromium' | 'firefox' | 'webkit'; // Specific browser for this job
  parentRunId?: string; // Original runId if this is a browser-specific job from a matrix
  browserMatrix?: Array<'chromium' | 'firefox' | 'webkit'>; // Full browser matrix (for reference)
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  teamId?: string;
}

