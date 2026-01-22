// Shared test management routes - available to both guest and registered users
import { FastifyInstance } from 'fastify'
import { TestRunStatus, TestRun, TestArtifact } from '../../types'
import { Database } from '../../lib/db'
import { enqueueTestRun } from '../../lib/queue'
import { getTestControlWS } from '../../index'
import { createClient } from '@supabase/supabase-js'
import { config } from '../../config/env'

// Note: fetch is globally available in Node.js 18+

export async function sharedTestManagementRoutes(fastify: FastifyInstance) {
  // Initialize Supabase client for pre-signed URLs (lazy initialization)
  const getSupabaseClient = () => {
    return createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )
  }

  // Get test run status
  fastify.get<{ Params: { runId: string } }>('/:runId/status', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      return reply.send({ testRun })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get test run status' })
    }
  })

  // Get test run details
  fastify.get<{ Params: { runId: string } }>('/:runId', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const artifacts = await Database.getArtifacts(runId)

      return reply.send({
        testRun,
        artifacts,
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get test run' })
    }
  })

  // Get test run artifacts
  fastify.get<{ Params: { runId: string } }>('/:runId/artifacts', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const artifacts = await Database.getArtifacts(runId)

      return reply.send({ artifacts })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get artifacts' })
    }
  })

  // Create artifact (for worker to save artifacts)
  fastify.post<{ Params: { runId: string }; Body: { type: string; url: string; path: string; size: number } }>('/:runId/artifacts', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      const { type, url, path, size } = request.body
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const artifact = await Database.createArtifact({
        runId,
        type: type as any,
        url,
        path,
        size,
      })

      return reply.send({ artifact })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to create artifact' })
    }
  })

  // List test runs
  fastify.get<{ Querystring: { projectId?: string; limit?: number } }>('/', async (request: any, reply: any) => {
    try {
      const { projectId, limit } = request.query
      
      const testRuns = await Database.listTestRuns(projectId, limit ? parseInt(limit.toString()) : 50)

      return reply.send({ testRuns })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to list test runs' })
    }
  })

  // Cancel test run
  fastify.post<{ Params: { runId: string } }>('/:runId/cancel', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (testRun.status === TestRunStatus.COMPLETED || testRun.status === TestRunStatus.FAILED) {
        return reply.code(400).send({ error: 'Cannot cancel completed or failed test run' })
      }

      await Database.updateTestRun(runId, {
        status: TestRunStatus.CANCELLED,
      })

      return reply.send({ success: true, testRun: await Database.getTestRun(runId) })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to cancel test run' })
    }
  })

  // Update test run (for worker updates)
  fastify.patch<{ Params: { runId: string }; Body: Partial<TestRun> }>('/:runId', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      const updates = request.body
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const updated = await Database.updateTestRun(runId, updates)

      return reply.send({ success: true, testRun: updated })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to update test run' })
    }
  })

  // Save checkpoint (for worker to save steps incrementally)
  fastify.post<{ 
    Params: { runId: string }
    Body: { stepNumber: number; steps: any[]; artifacts: string[] }
  }>('/:runId/checkpoint', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      const { stepNumber, steps, artifacts } = request.body
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Update test run with new steps and current step number
      const updated = await Database.updateTestRun(runId, {
        steps: steps,
        currentStep: stepNumber,
      })

      return reply.send({ success: true, testRun: updated })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to save checkpoint' })
    }
  })

  // Pause test run (no auth required - viewing test implies access)
  fastify.post<{ Params: { runId: string } }>('/:runId/pause', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (![TestRunStatus.RUNNING, TestRunStatus.DIAGNOSING].includes(testRun.status)) {
        return reply.code(400).send({ error: 'Can only pause active test runs' })
      }

      const updated = await Database.updateTestRun(runId, {
        paused: true,
      })

      return reply.send({ success: true, testRun: updated })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to pause test run' })
    }
  })

  // Resume test run (no auth required - viewing test implies access)
  fastify.post<{ Params: { runId: string } }>('/:runId/resume', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (![TestRunStatus.RUNNING, TestRunStatus.WAITING_APPROVAL, TestRunStatus.DIAGNOSING].includes(testRun.status)) {
        return reply.code(400).send({ error: 'Can only resume running, diagnosing, or waiting test runs' })
      }

      // If waiting approval, queue it again
      if (testRun.status === TestRunStatus.WAITING_APPROVAL) {
        await enqueueTestRun({
          runId: testRun.id,
          projectId: testRun.projectId,
          build: testRun.build,
          profile: testRun.profile,
          options: testRun.options
        }, { allowDuplicate: true })
        
        await Database.updateTestRun(runId, {
          status: TestRunStatus.QUEUED
        })
      } else {
        // Just resume paused run
        await Database.updateTestRun(runId, {
          paused: false,
        })
      }

      const updatedRun = await Database.getTestRun(runId)
      return reply.send({ success: true, testRun: updatedRun })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to resume test run' })
    }
  })

  // Get stream URL and token for live viewing
  fastify.get<{ Params: { runId: string } }>('/:runId/stream', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Get stream info from worker (via WebSocket or API)
      // For now, return placeholder - worker will notify via WebSocket
      const testControlWS = getTestControlWS()
      if (testControlWS && 'getStats' in testControlWS) {
        // Check if stream is available
        // In production, this would query the worker for stream URL
      }

      // Return stream info (worker will update this via WebSocket)
      return reply.send({
        streamUrl: process.env.FRAME_STREAM_BASE_URL 
          ? `${process.env.FRAME_STREAM_BASE_URL}/stream/${runId}`
          : `http://localhost:8080/stream/${runId}`,
        livekitUrl: process.env.LIVEKIT_URL,
        // Token will be provided via WebSocket when stream starts
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get stream URL' })
    }
  })

  // Inject manual action (God Mode) - Shared
  fastify.post<{ 
    Params: { runId: string }
    Body: { 
      action: string
      selector?: string
      value?: string
      coordinates?: { x: number; y: number }
      godMode?: boolean
    }
  }>('/:runId/inject-action', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      const { action, selector, value, coordinates, godMode } = request.body
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (testRun.status !== TestRunStatus.RUNNING && testRun.status !== TestRunStatus.DIAGNOSING) {
        return reply.code(400).send({ error: 'Can only inject actions into running tests' })
      }

      const testControlWS = getTestControlWS()
      if (!testControlWS) {
        return reply.code(503).send({ error: 'WebSocket not available' })
      }

      // Queue manual action via WebSocket
      const queued = await (testControlWS as any).queueManualAction(runId, {
        action,
        selector,
        value,
        coordinates,
        godMode: godMode || false,
      })

      if (!queued) {
        return reply.code(500).send({ error: 'Failed to queue manual action' })
      }

      return reply.send({ 
        success: true, 
        message: 'Manual action queued successfully' 
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to inject action' })
    }
  })

  // Notify that AI is stuck (triggers God Mode)
  fastify.post<{ 
    Params: { runId: string }
    Body: { message: string; stepNumber: number }
  }>('/:runId/notify-stuck', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      const { message, stepNumber } = request.body
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const testControlWS = getTestControlWS()
      if (!testControlWS) {
        return reply.code(503).send({ error: 'WebSocket not available' })
      }

      // Notify frontend via WebSocket
      await (testControlWS as any).notifyStuck(runId, {
        message,
        stepNumber,
      })

      return reply.send({ 
        success: true, 
        message: 'Stuck notification sent' 
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to notify stuck' })
    }
  })

  // Get manual actions history
  fastify.get<{ Params: { runId: string } }>('/:runId/manual-actions', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Get manual actions from test run metadata or separate table
      const manualActions = (testRun as any).manualActions || []

      return reply.send({ manualActions })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get manual actions' })
    }
  })

  // Get live preview HTML (God Mode)
  fastify.get<{ Params: { runId: string } }>('/:runId/live-preview', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Only allow for running tests
      if (testRun.status !== 'running' && testRun.status !== 'diagnosing') {
        return reply.code(400).send({ error: 'Live preview only available for running tests' })
      }

      // Call worker to get current page HTML
      const workerUrl = process.env.WORKER_URL || 'http://localhost:3002'
      
      try {
        const workerResponse = await fetch(`${workerUrl}/api/test-runs/${runId}/live-preview`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!workerResponse.ok) {
          throw new Error(`Worker returned ${workerResponse.status}`)
        }

        const html = await workerResponse.text()
        
        if (!html) {
          return reply.code(404).send({ error: 'No page HTML available' })
        }

        // Augment HTML with God Mode interaction scripts
        const augmentedHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      /* Highlight interactive elements on hover */
      *:hover {
        outline: 2px solid rgba(16, 185, 129, 0.5) !important;
        cursor: crosshair !important;
      }
      
      /* Prevent actual navigation/form submission */
      a, button, form, input[type="submit"] {
        pointer-events: auto;
      }
    </style>
  </head>
  <body>
    ${html}
    
    <script>
      // Disable actual navigation/form submission
      document.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get click coordinates relative to viewport
        const x = e.clientX;
        const y = e.clientY;
        
        // Send click coordinates to parent (frontend)
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'god_mode_click',
            x: x,
            y: y,
            element: {
              tagName: e.target.tagName,
              id: e.target.id || undefined,
              className: e.target.className || undefined,
              textContent: e.target.textContent?.trim().slice(0, 50) || undefined,
              selector: e.target.id ? '#' + e.target.id : 
                       e.target.className ? '.' + e.target.className.split(' ')[0] : 
                       e.target.tagName.toLowerCase()
            }
          }, '*');
        }
      }, true); // Use capture phase
      
      // Disable form submissions
      document.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      
      // Disable link navigation
      document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
      
      // Prevent default on all interactive elements
      ['mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(eventType => {
        document.addEventListener(eventType, (e) => {
          // Allow the click event to fire for coordinate capture, but prevent default behavior
          if (eventType === 'mousedown' || eventType === 'touchstart') {
            // Don't prevent default here - we want click event to fire
            return;
          }
        }, true);
      });
    </script>
  </body>
</html>`

        reply.type('text/html')
        return reply.send(augmentedHTML)
      } catch (workerError: any) {
        fastify.log.warn(`Failed to get live preview from worker:`, workerError.message)
        // Fallback: return error
        return reply.code(503).send({ 
          error: 'Live preview unavailable',
          message: 'Worker service may not be running or test session not active'
        })
      }
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get live preview' })
    }
  })

  // Stop test run (early termination) - no auth required
  fastify.post<{ Params: { runId: string } }>('/:runId/stop', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (testRun.status !== TestRunStatus.RUNNING) {
        return reply.code(400).send({ error: 'Can only stop running test runs' })
      }

      // Mark as completed with partial status
      const updated = await Database.updateTestRun(runId, {
        status: TestRunStatus.COMPLETED,
        paused: false,
        completedAt: new Date().toISOString(),
      })

      return reply.send({ 
        success: true, 
        testRun: updated,
        message: 'Test stopped. Partial report available.',
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to stop test run' })
    }
  })

  // View report (serves the generated HTML report) - Shared
  fastify.get<{ Params: { runId: string } }>('/:runId/report-view', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const steps = testRun.steps || []
      const artifacts = await Database.getArtifacts(runId)
      const apiBaseUrl = config.apiUrl || process.env.API_URL || `http://localhost:3001`
      
      const html = generateReportHtml(runId, testRun, steps, apiBaseUrl, artifacts)
      
      reply.type('text/html')
      return reply.send(html)
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to generate report view' })
    }
  })

  // Download artifact
  fastify.get<{ Params: { runId: string; artifactId: string } }>(
    '/:runId/artifacts/:artifactId/download',
    async (request: any, reply: any) => {
      try {
        const { runId, artifactId } = request.params
        
        const testRun = await Database.getTestRun(runId)
        if (!testRun) {
          return reply.code(404).send({ error: 'Test run not found' })
        }

        const artifact = await Database.getArtifact(artifactId)
        if (!artifact || artifact.runId !== runId) {
          return reply.code(404).send({ error: 'Artifact not found' })
        }

        // Generate pre-signed URL for download
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.storage
          .from('artifacts')
          .createSignedUrl(artifact.path, 3600) // 1 hour expiry

        if (error || !data) {
          return reply.code(500).send({ error: 'Failed to generate download URL' })
        }

        return reply.redirect(data.signedUrl)
      } catch (error: any) {
        fastify.log.error(error)
        return reply.code(500).send({ error: error.message || 'Failed to download artifact' })
      }
    }
  )

  // Download test run (ZIP of all artifacts)
  fastify.get<{ Params: { runId: string } }>('/:runId/download', async (request: any, reply: any) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // For now, return a placeholder - full ZIP download would require additional implementation
      return reply.code(501).send({ 
        error: 'Not implemented',
        message: 'ZIP download feature coming soon. Use individual artifact downloads for now.'
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to download test run' })
    }
  })

  // Get step details
  fastify.get<{ Params: { runId: string; stepNumber: string } }>('/:runId/steps/:stepNumber', async (request: any, reply: any) => {
    try {
      const { runId, stepNumber } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const steps = testRun.steps || []
      const stepNum = parseInt(stepNumber)
      
      if (stepNum < 1 || stepNum > steps.length) {
        return reply.code(404).send({ error: 'Step not found' })
      }

      const step = steps[stepNum - 1]

      return reply.send({ step })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get step' })
    }
  })
}

// Generate report HTML (works with partial steps) - for report-view endpoint
function generateReportHtml(
  runId: string,
  testRun: TestRun,
  steps: any[],
  apiBaseUrl: string,
  artifacts: TestArtifact[] = []
): string {
  const modeLabel = (() => {
    switch (testRun.options?.testMode) {
      case 'all':
        return 'All Pages Crawl'
      case 'multi':
        return 'Multi-page Flow'
      case 'monkey':
        return 'Monkey Explorer'
      default:
        return 'Single Flow'
    }
  })()

  const healingSteps = steps.filter((step) => step?.selfHealing)
  const videoArtifact = artifacts.find((artifact) => artifact.type === 'video')
  const videoUrl = videoArtifact?.url || testRun.artifactsUrl || ''

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${runId}</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; background-color: #f9fafb; color: #1f2937; }
    .container { background-color: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1 { color: #111827; font-size: 2rem; margin-bottom: 1rem; }
    h2 { color: #374151; font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; }
    .status-completed { background-color: #dcfce7; color: #065f46; }
    .status-running { background-color: #dbeafe; color: #1e40af; }
    .status-failed { background-color: #fee2e2; color: #991b1b; }
    .status-paused { background-color: #fef3c7; color: #92400e; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .info-item strong { display: block; color: #4b5563; font-size: 0.875rem; margin-bottom: 0.25rem; }
    .info-item span { font-size: 1rem; color: #1f2937; }
    .step { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 1rem; margin-bottom: 1rem; }
    .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .step-header h3 { margin: 0; font-size: 1.125rem; color: #1f2937; }
    .step-status { font-weight: 600; }
    .step-details { font-size: 0.875rem; color: #4b5563; }
    .artifact-link { display: inline-block; margin-top: 0.5rem; color: #3b82f6; text-decoration: none; font-weight: 500; }
    .partial-notice { background-color: #fef3c7; border: 1px solid #fbbf24; color: #92400e; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report for Run: ${runId.substring(0, 8)}...</h1>
    <p class="status-badge ${testRun.status === 'completed' ? 'status-completed' : testRun.status === 'running' ? (testRun.paused ? 'status-paused' : 'status-running') : 'status-failed'}">
      ${testRun.status.toUpperCase()}${testRun.paused ? ' (PAUSED)' : ''}
    </p>

    ${testRun.paused || steps.length < (testRun.options?.maxSteps || 10) ? `
    <div class="partial-notice">
      <strong>⚠️ Partial Report</strong>
      <p>This report contains data up to step ${steps.length} of ${testRun.options?.maxSteps || 10} maximum steps.${testRun.paused ? ' The test is currently paused.' : ' The test may still be running.'}</p>
    </div>
    ` : ''}

    <h2>Summary</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Project ID</strong>
        <span>${testRun.projectId.substring(0, 8)}...</span>
      </div>
      <div class="info-item">
        <strong>Build URL</strong>
        <span>${testRun.build?.url || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Test Mode</strong>
        <span>${modeLabel}</span>
      </div>
      <div class="info-item">
        <strong>Total Steps</strong>
        <span>${steps.length}</span>
      </div>
      ${healingSteps.length > 0 ? `
      <div class="info-item">
        <strong>Self-Healing Steps</strong>
        <span>${healingSteps.length}</span>
      </div>
      ` : ''}
    </div>

    ${videoUrl ? `
    <h2>Video Recording</h2>
    <video controls width="100%" style="max-width: 800px;">
      <source src="${videoUrl}" type="video/webm">
      Your browser does not support the video tag.
    </video>
    ` : ''}

    <h2>Test Steps</h2>
    ${steps.map((step, index) => `
    <div class="step">
      <div class="step-header">
        <h3>Step ${index + 1}: ${step.action || 'Unknown'}</h3>
        <span class="step-status ${step.success ? 'status-completed' : 'status-failed'}">
          ${step.success ? '✅ Success' : '❌ Failed'}
        </span>
      </div>
      <div class="step-details">
        ${step.selector ? `<p><strong>Selector:</strong> ${step.selector}</p>` : ''}
        ${step.value ? `<p><strong>Value:</strong> ${step.value}</p>` : ''}
        ${step.error ? `<p><strong>Error:</strong> ${step.error}</p>` : ''}
        ${step.selfHealing ? `<p><strong>Self-Healing:</strong> ${step.selfHealing.strategy} - ${step.selfHealing.note}</p>` : ''}
        ${step.screenshot ? `<a href="${step.screenshot}" target="_blank" class="artifact-link">View Screenshot</a>` : ''}
      </div>
    </div>
    `).join('')}
  </div>
</body>
</html>
  `
}

