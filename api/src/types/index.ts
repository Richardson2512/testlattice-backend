// Shared types for the TestLattice platform

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

export interface TestOptions {
  visualDiff?: boolean;
  stressTest?: boolean;
  coverage?: string[];
  maxSteps?: number;
}

export interface CreateTestRunRequest {
  projectId: string;
  build: Build;
  profile: TestProfile;
  options?: TestOptions;
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
  steps?: TestStep[];
  paused?: boolean;
  currentStep?: number;
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
}

export interface TestArtifact {
  id: string;
  runId: string;
  type: 'screenshot' | 'video' | 'log' | 'dom' | 'network';
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

