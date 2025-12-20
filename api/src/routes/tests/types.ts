// Test Routes Types
// Shared types for test route modules

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { TestRun, TestArtifact, CreateTestRunRequest, TestRunStatus } from '../../types'

export type { FastifyInstance, FastifyRequest, FastifyReply }
export { TestRun, TestArtifact, CreateTestRunRequest, TestRunStatus }

export interface RouteParams {
    runId: string
}

export interface StepParams {
    runId: string
    stepNumber: string
}

export interface HeuristicParams {
    id: string
}

export interface ArtifactBody {
    type: string
    url: string
    path: string
    size: number
}

export interface CheckpointBody {
    stepNumber: number
    steps: any[]
    artifacts: string[]
}

export interface ActionBody {
    action: 'click' | 'type' | 'scroll' | 'navigate'
    selector?: string
    value?: string
    description: string
    godModeEvent?: any
}

export interface InstructionsBody {
    instructions: string
}

export interface HeuristicBody {
    projectId: string
    componentHash: string
    userAction: any
    preCondition?: any
    reliabilityScore?: number
    visualAnchor?: string
    functionalAnchor?: string
    structuralAnchor?: string
    domSnapshotBefore?: string
    domSnapshotAfter?: string
    runId?: string
    stepId?: string
}

export interface HeuristicUsageBody {
    success: boolean
}

export interface SimilaritySearchBody {
    projectId: string
    componentHash: string
    anchors?: {
        functionalAnchor?: string
        structuralAnchor?: string
    }
    threshold?: number
}
