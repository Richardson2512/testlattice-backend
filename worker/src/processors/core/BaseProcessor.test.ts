
import { BaseProcessor, BaseProcessorConfig, ProcessorDependencies } from './BaseProcessor';
import { ProcessResult } from '../../types';
import { TestMode } from '../../config/constants';

// Mock observability to avoid side effects
jest.mock('../../observability', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    testEvents: {
        started: jest.fn(),
        completed: jest.fn(),
        failed: jest.fn(),
        stepCompleted: jest.fn(),
        stepFailed: jest.fn(),
    },
    metrics: {
        testsStarted: jest.fn(),
        testsCompleted: jest.fn(),
        testDuration: jest.fn(),
        errors: jest.fn(),
    },
    withTraceAsync: (ctx: any, fn: any) => fn(),
    getTraceId: () => 'test-trace-id'
}));

jest.mock('../../observability/metrics', () => ({
    metrics: {
        testsStarted: jest.fn(),
        testsCompleted: jest.fn(),
        testDuration: jest.fn(),
        errors: jest.fn(),
    }
}));

jest.mock('../../services/StateManager', () => ({
    StateManager: jest.fn().mockImplementation(() => ({
        updateRunStatus: jest.fn(),
        getRunState: jest.fn()
    }))
}));

class TestImplProcessor extends BaseProcessor {
    public async execute(): Promise<ProcessResult> {
        this.recordStep('test_action', true, 100, { detail: 'foo' });
        return {
            success: true,
            steps: this.steps,
            artifacts: [],
            stage: 'execution'
        };
    }
}

describe('BaseProcessor', () => {
    let processor: TestImplProcessor;
    let mockDeps: ProcessorDependencies;
    let mockConfig: BaseProcessorConfig;

    beforeEach(() => {
        mockConfig = {
            runId: 'test-run-1',
            userTier: 'free',
            testMode: 'single' as TestMode,
            url: 'http://example.com',
            maxSteps: 10,
            timeout: 5000
        };

        mockDeps = {
            page: {
                goto: jest.fn().mockResolvedValue(null),
                close: jest.fn().mockResolvedValue(null),
                isClosed: jest.fn().mockReturnValue(false),
                screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-image'))
            } as any,
            supabase: {
                from: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({}),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: {} })
            } as any,
            redis: {} as any,
            storage: {
                upload: jest.fn().mockResolvedValue('http://storage.com/image.jpg')
            } as any,
            brain: {} as any
        };

        processor = new TestImplProcessor(mockConfig, mockDeps);
    });

    it('should execute lifecycle methods correctly', async () => {
        const result = await processor.process();

        // Assertions
        expect(result.success).toBe(true);
        expect(result.steps).toHaveLength(1);

        // Setup called
        expect(mockDeps.page.goto).toHaveBeenCalledWith('http://example.com', expect.objectContaining({ timeout: 30000 }));

        // Cleanup called
        expect(mockDeps.page.close).toHaveBeenCalled();

        // Status updates (Setup -> running, Success -> completed?)
        // process() updates status on error, but maybe not success explicitly? 
        // BaseProcessor.process calls setup->execute->cleanup.
        // It calls updateStatus('running') in setup.
        // It does NOT call updateStatus('completed') in process() success path?
        // Let's check BaseProcessor.ts again.
    });
});
