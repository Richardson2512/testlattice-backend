// Shared types for the TestLattice platform

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
  MOBILE_CHROME = 'mobile-chrome',
  MOBILE_SAFARI = 'mobile-safari',
  MOBILE_CHROME_ANDROID = 'mobile-chrome-android',
  // Deprecated: Mobile testing is disabled
  ANDROID_EMULATOR = 'android-emulator', // @deprecated - Mobile testing disabled, set ENABLE_APPIUM=true to enable
  IOS_SIMULATOR = 'ios-simulator', // @deprecated - Mobile testing disabled, set ENABLE_APPIUM=true to enable
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

// Viewport presets for responsive testing
export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
  category: 'mobile' | 'tablet' | 'desktop';
  description: string;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  // Mobile devices
  { name: 'iPhone SE', width: 375, height: 667, category: 'mobile', description: 'Small mobile device' },
  { name: 'iPhone 12/13/14', width: 390, height: 844, category: 'mobile', description: 'Standard iPhone' },
  { name: 'iPhone 14 Pro', width: 393, height: 851, category: 'mobile', description: 'iPhone Pro model' },
  
  // Tablet devices
  { name: 'iPad', width: 768, height: 1024, category: 'tablet', description: 'iPad portrait' },
  { name: 'iPad Air', width: 820, height: 1180, category: 'tablet', description: 'iPad Air portrait' },
  
  // Desktop
  { name: 'Laptop', width: 1366, height: 768, category: 'desktop', description: 'Standard laptop' },
  { name: 'Desktop', width: 1920, height: 1080, category: 'desktop', description: 'Full HD desktop' },
];

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
  testMode?: 'single' | 'multi' | 'all' | 'monkey';
  browserMatrix?: Array<'chromium' | 'firefox' | 'webkit'>;
  allPages?: boolean;
  monkeyMode?: boolean;
  monkeyConfig?: {
    randomness?: number;
    maxExplorations?: number;
    allowNavigation?: boolean;
  };
  criticalPath?: {
    enabled: boolean;
    flowType?: 'ecommerce' | 'saas' | 'social' | 'custom';
    customFlow?: string;
  };
  environment?: TestEnvironment;
  approvalPolicy?: ApprovalPolicy;
  // Guest/Quick Start options
  skipDiagnosis?: boolean; // Skip diagnosis phase for quick tests
  isGuestRun?: boolean; // Mark as guest run for rate limiting
  guestSessionId?: string; // Guest session identifier
}

export interface CreateTestRunRequest {
  projectId: string;
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
}

export interface CreateGuestTestRunRequest {
  url: string; // Single URL for quick test
  build?: Omit<Build, 'url'>; // Optional build config (type, etc.)
  profile?: TestProfile; // Optional profile (defaults to chrome-latest)
  options?: Omit<TestOptions, 'isGuestRun' | 'guestSessionId'>; // Guest options are set automatically
  email?: string; // Optional email for results notification
}

export interface TestRun {
  id: string;
  projectId: string;
  status: TestRunStatus;
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
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
  // Guest run fields
  guestSessionId?: string; // Guest session identifier
  expiresAt?: string; // Expiration timestamp for guest runs (24 hours)
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
  criticalPathResult?: any;  // FlowExecutionResult from criticalPathTesting
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
  action: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'assert' | 'complete' | 'check' | 'uncheck' | 'select' | 'goBack' | 'goForward' | 'submit';
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
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
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

