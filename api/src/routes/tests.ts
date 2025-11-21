// Test routes
import { FastifyInstance } from 'fastify'
import { CreateTestRunRequest, TestRunStatus } from '../types'
import { Database } from '../lib/db'
import { enqueueTestRun } from '../lib/queue'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'

export async function testRoutes(fastify: FastifyInstance) {
  // Create a new test run (requires authentication)
  fastify.post<{ Body: CreateTestRunRequest }>('/run', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId, build, profile, options } = request.body

      // Validate project exists
      const project = await Database.getProject(projectId)
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      // Create test run record (associate with authenticated user)
      const testRun = await Database.createTestRun({
        projectId,
        build,
        profile,
        options,
        status: TestRunStatus.PENDING,
      }, request.user?.id) // Pass authenticated user ID

      // Enqueue job
      try {
        await enqueueTestRun({
          runId: testRun.id,
          projectId,
          build,
          profile,
          options,
        })
        
        // Update status to queued only if enqueue succeeded
        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.QUEUED,
        })
        
        fastify.log.info(`Test run ${testRun.id} enqueued successfully`)
      } catch (queueError: any) {
        fastify.log.error(`Failed to enqueue test run ${testRun.id}:`, queueError)
        // Update status to failed if queue is unavailable
        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.FAILED,
          error: `Failed to enqueue: ${queueError.message}`,
        })
        return reply.code(500).send({ 
          error: 'Failed to enqueue test run. Please ensure Redis is running and worker service is started.',
          details: queueError.message 
        })
      }

      return reply.code(201).send({
        success: true,
        runId: testRun.id,
        testRun: await Database.getTestRun(testRun.id),
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to create test run' })
    }
  })

  // Get test run status
  fastify.get<{ Params: { runId: string } }>('/:runId/status', async (request, reply) => {
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
  fastify.get<{ Params: { runId: string } }>('/:runId', async (request, reply) => {
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
  fastify.get<{ Params: { runId: string } }>('/:runId/artifacts', async (request, reply) => {
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
  fastify.post<{ Params: { runId: string }; Body: { type: string; url: string; path: string; size: number } }>('/:runId/artifacts', async (request, reply) => {
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
  fastify.get<{ Querystring: { projectId?: string; limit?: number } }>('/', async (request, reply) => {
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
  fastify.post<{ Params: { runId: string } }>('/:runId/cancel', async (request, reply) => {
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
  fastify.patch<{ Params: { runId: string }; Body: Partial<TestRun> }>('/:runId', async (request, reply) => {
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

  // Pause test run (no auth required - viewing test implies access)
  fastify.post<{ Params: { runId: string } }>('/:runId/pause', async (request, reply) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (testRun.status !== TestRunStatus.RUNNING) {
        return reply.code(400).send({ error: 'Can only pause running test runs' })
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
  fastify.post<{ Params: { runId: string } }>('/:runId/resume', async (request, reply) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (testRun.status !== TestRunStatus.RUNNING) {
        return reply.code(400).send({ error: 'Can only resume running test runs' })
      }

      const updated = await Database.updateTestRun(runId, {
        paused: false,
      })

      return reply.send({ success: true, testRun: updated })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to resume test run' })
    }
  })

  // Stop test run (early termination) - no auth required
  fastify.post<{ Params: { runId: string } }>('/:runId/stop', async (request, reply) => {
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

  // Generate report (works with partial data)
  fastify.post<{ Params: { runId: string } }>('/:runId/report', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Generate report from current steps (partial or complete)
      const steps = testRun.steps || []
      const { config } = await import('../config/env')
      const apiBaseUrl = config.apiUrl || process.env.API_URL || `http://localhost:3001`
      const reportUrl = `${apiBaseUrl}/api/tests/${runId}/report-view`

      const updated = await Database.updateTestRun(runId, {
        reportUrl,
      })

      return reply.send({ 
        success: true, 
        testRun: updated,
        reportUrl,
        message: `Report generated with ${steps.length} steps`,
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to generate report' })
    }
  })

  // View report (serves the generated HTML report)
  fastify.get<{ Params: { runId: string } }>('/:runId/report-view', async (request, reply) => {
    try {
      const { runId } = request.params
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const steps = testRun.steps || []
      const { config } = await import('../config/env')
      const apiBaseUrl = config.apiUrl || process.env.API_URL || `http://localhost:3001`
      
      // Generate HTML report
      const reportHtml = generateReportHtml(runId, testRun, steps, apiBaseUrl)
      
      reply.type('text/html')
      return reply.send(reportHtml)
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to generate report view' })
    }
  })

  // Download report as ZIP
  fastify.get<{ Params: { runId: string } }>('/:runId/download', async (request, reply) => {
    try {
      const { runId } = request.params
      
      fastify.log.info(`Report download requested for run: ${runId}`)
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        fastify.log.warn(`Test run not found: ${runId}`)
        return reply.code(404).send({ error: 'Test run not found' })
      }

      const artifacts = await Database.getArtifacts(runId)
      const steps = testRun.steps || []

      // Import archiver dynamically
      const archiver = (await import('archiver')).default
      
      // Use global fetch (Node 18+) or fallback to node-fetch
      let fetchFn: any
      if (typeof globalThis.fetch !== 'undefined') {
        fetchFn = globalThis.fetch
      } else {
        // Fallback to node-fetch for Node < 18
        const nodeFetch = await import('node-fetch')
        fetchFn = (nodeFetch as any).default || nodeFetch
      }

      // Create ZIP archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      })

      // Set response headers BEFORE piping
      reply.header('Content-Type', 'application/zip')
      reply.header('Content-Disposition', `attachment; filename="test-report-${runId.substring(0, 8)}.zip"`)

      // Pipe archive to response - use reply.raw for streaming
      const rawResponse = reply.raw
      if (!rawResponse) {
        return reply.code(500).send({ error: 'Streaming not supported' })
      }

      // Handle archive errors BEFORE piping
      archive.on('error', (err: any) => {
        fastify.log.error('Archive error:', err)
        if (!reply.sent) {
          try {
            reply.code(500).send({ error: 'Failed to create archive: ' + err.message })
          } catch (sendError) {
            fastify.log.error('Failed to send error response:', sendError)
          }
        }
      })
      
      // Handle response stream errors
      rawResponse.on('error', (err: any) => {
        fastify.log.error('Response stream error:', err)
        archive.abort()
      })
      
      archive.pipe(rawResponse)

      // Generate report JSON with insights
      const errors = steps.filter(s => !s.success)
      const issues: string[] = []
      const warnings: string[] = []

      // Collect comprehensive testing data from all steps
      const allConsoleErrors: Array<{ type: string; message: string; timestamp: string; step: number }> = []
      const allNetworkErrors: Array<{ url: string; status: number; timestamp: string; step: number }> = []
      const allAccessibilityIssues: Array<{ type: string; message: string; impact: string; step: number }> = []
      const allVisualIssues: Array<{ type: string; description: string; severity: string; step: number }> = []
      const performanceMetrics: Array<{ pageLoadTime: number; firstContentfulPaint?: number; step: number }> = []

      steps.forEach(step => {
        if (step.consoleErrors) {
          step.consoleErrors.forEach(err => {
            allConsoleErrors.push({ ...err, step: step.stepNumber })
          })
        }
        if (step.networkErrors) {
          step.networkErrors.forEach(err => {
            allNetworkErrors.push({ ...err, step: step.stepNumber })
          })
        }
        if (step.accessibilityIssues) {
          step.accessibilityIssues.forEach(issue => {
            allAccessibilityIssues.push({ ...issue, step: step.stepNumber })
          })
        }
        if (step.visualIssues) {
          step.visualIssues.forEach(issue => {
            allVisualIssues.push({ ...issue, step: step.stepNumber })
          })
        }
        if (step.performance) {
          performanceMetrics.push({ ...step.performance, step: step.stepNumber })
        }
      })

      // Add test execution errors
      errors.forEach(error => {
        if (error.error) {
          issues.push(`Step ${error.stepNumber}: ${error.error}`)
        }
      })

      if (errors.length > 0) {
        issues.unshift(`${errors.length} step(s) failed during execution`)
      }

      // Add console errors as issues
      const uniqueConsoleErrors = new Map<string, number>()
      allConsoleErrors.forEach(err => {
        const key = err.message.substring(0, 100)
        if (!uniqueConsoleErrors.has(key)) {
          uniqueConsoleErrors.set(key, err.step)
          issues.push(`Console Error (Step ${err.step}): ${err.message}`)
        }
      })

      // Add network errors as issues
      allNetworkErrors.forEach(err => {
        if (err.status >= 400) {
          issues.push(`Network Error (Step ${err.step}): ${err.url} returned ${err.status}`)
        }
      })

      // Add accessibility issues
      const criticalAccessibility = allAccessibilityIssues.filter(a => a.impact === 'critical' || a.impact === 'serious')
      criticalAccessibility.forEach(issue => {
        issues.push(`Accessibility Issue (Step ${issue.step}): ${issue.message}`)
      })
      const moderateAccessibility = allAccessibilityIssues.filter(a => a.impact === 'moderate')
      moderateAccessibility.forEach(issue => {
        warnings.push(`Accessibility Warning (Step ${issue.step}): ${issue.message}`)
      })

      // Add visual issues
      const highSeverityVisual = allVisualIssues.filter(v => v.severity === 'high')
      highSeverityVisual.forEach(issue => {
        issues.push(`Visual Issue (Step ${issue.step}): ${issue.description}`)
      })
      const mediumSeverityVisual = allVisualIssues.filter(v => v.severity === 'medium')
      mediumSeverityVisual.forEach(issue => {
        warnings.push(`Visual Warning (Step ${issue.step}): ${issue.description}`)
      })

      const navigationSteps = steps.filter(s => s.action === 'navigate')
      if (navigationSteps.length === 0 && steps.length > 0) {
        warnings.push('No navigation steps detected - test may not have started properly')
      }

      const interactionSteps = steps.filter(s => ['click', 'type'].includes(s.action))
      if (interactionSteps.length === 0 && steps.length > 3) {
        warnings.push('Limited user interactions detected - test may be incomplete')
      }

      // Performance warnings
      if (performanceMetrics.length > 0) {
        const avgLoadTime = performanceMetrics.reduce((sum, m) => sum + m.pageLoadTime, 0) / performanceMetrics.length
        if (avgLoadTime > 3000) {
          warnings.push(`Slow page load detected: Average load time ${(avgLoadTime / 1000).toFixed(1)}s (target: <3s)`)
        }
      }

      const recommendations = [
        ...(errors.length > 0 ? ['Review failed steps and fix underlying issues'] : []),
        ...(allConsoleErrors.length > 0 ? [`Fix ${allConsoleErrors.length} JavaScript console error(s) detected during testing`] : []),
        ...(allNetworkErrors.length > 0 ? [`Fix ${allNetworkErrors.length} network request failure(s) - check API endpoints and resources`] : []),
        ...(criticalAccessibility.length > 0 ? [`Address ${criticalAccessibility.length} critical accessibility issue(s) for WCAG compliance`] : []),
        ...(highSeverityVisual.length > 0 ? [`Fix ${highSeverityVisual.length} high-severity visual issue(s) affecting user experience`] : []),
        ...(performanceMetrics.length > 0 && performanceMetrics[0].pageLoadTime > 3000 ? ['Optimize page load performance - consider code splitting, lazy loading, and asset optimization'] : []),
        ...(steps.length < 5 ? ['Consider adding more test steps for better coverage'] : []),
        'Review screenshots to verify visual correctness',
        'Check console logs for JavaScript errors',
        'Run accessibility audit with axe-core for comprehensive WCAG compliance',
        'Monitor Core Web Vitals (LCP, FID, CLS) for better user experience',
      ]

      // Calculate average performance metrics
      const avgPerformance = performanceMetrics.length > 0 ? {
        pageLoadTime: performanceMetrics.reduce((sum, m) => sum + m.pageLoadTime, 0) / performanceMetrics.length,
        firstContentfulPaint: performanceMetrics.filter(m => m.firstContentfulPaint).length > 0
          ? performanceMetrics.filter(m => m.firstContentfulPaint).reduce((sum, m) => sum + (m.firstContentfulPaint || 0), 0) / performanceMetrics.filter(m => m.firstContentfulPaint).length
          : undefined,
      } : null

      const reportData = {
        testRunId: runId,
        status: testRun.status,
        summary: {
          totalSteps: steps.length,
          successfulSteps: steps.filter(s => s.success).length,
          failedSteps: errors.length,
          pagesTested: new Set(steps.filter(s => s.action === 'navigate').map(s => s.value)).size || 1,
          duration: testRun.duration ? `${(testRun.duration / 1000).toFixed(1)}s` : 'N/A',
          startedAt: testRun.startedAt || testRun.createdAt,
          completedAt: testRun.completedAt,
        },
        build: {
          url: testRun.build?.url || 'N/A',
          device: testRun.profile?.device || 'N/A',
        },
        comprehensiveTesting: {
          consoleErrors: {
            total: allConsoleErrors.length,
            errors: allConsoleErrors.filter(e => e.type === 'error').length,
            warnings: allConsoleErrors.filter(e => e.type === 'warning').length,
            details: Array.from(uniqueConsoleErrors.entries()).map(([msg, step]) => ({ message: msg, step })),
          },
          networkErrors: {
            total: allNetworkErrors.length,
            failed: allNetworkErrors.filter(e => e.status >= 400 || e.status === 0).length,
            details: allNetworkErrors.map(e => ({ url: e.url, status: e.status, step: e.step })),
          },
          performance: avgPerformance ? {
            averagePageLoadTime: avgPerformance.pageLoadTime,
            averageFirstContentfulPaint: avgPerformance.firstContentfulPaint,
            recommendation: avgPerformance.pageLoadTime > 3000 ? 'Page load time exceeds 3s - consider optimization' : 'Page load time is acceptable',
          } : null,
          accessibility: {
            total: allAccessibilityIssues.length,
            critical: allAccessibilityIssues.filter(a => a.impact === 'critical').length,
            serious: allAccessibilityIssues.filter(a => a.impact === 'serious').length,
            moderate: allAccessibilityIssues.filter(a => a.impact === 'moderate').length,
            details: allAccessibilityIssues.map(a => ({ type: a.type, message: a.message, impact: a.impact, step: a.step })),
          },
          visualIssues: {
            total: allVisualIssues.length,
            high: allVisualIssues.filter(v => v.severity === 'high').length,
            medium: allVisualIssues.filter(v => v.severity === 'medium').length,
            low: allVisualIssues.filter(v => v.severity === 'low').length,
            details: allVisualIssues.map(v => ({ type: v.type, description: v.description, severity: v.severity, step: v.step })),
          },
        },
        issues,
        warnings,
        recommendations,
        steps: steps.map(step => ({
          stepNumber: step.stepNumber,
          action: step.action,
          target: step.target,
          value: step.value,
          success: step.success,
          error: step.error,
          timestamp: step.timestamp,
          screenshot: step.screenshotUrl ? `screenshots/step-${step.stepNumber}.png` : null,
          consoleErrors: step.consoleErrors?.length || 0,
          networkErrors: step.networkErrors?.length || 0,
          accessibilityIssues: step.accessibilityIssues?.length || 0,
          visualIssues: step.visualIssues?.length || 0,
        })),
      }

      // Add report JSON
      archive.append(JSON.stringify(reportData, null, 2), { name: 'report.json' })

      // Generate test logs text file
      const logsContent = steps.map(step => {
        const timestamp = new Date(step.timestamp).toLocaleString()
        const status = step.success ? '✓ SUCCESS' : '✗ FAILED'
        let log = `[${timestamp}] ${status} - Step ${step.stepNumber}: ${step.action}`
        if (step.target) log += ` → ${step.target}`
        if (step.value) log += ` (${step.value})`
        if (step.error) log += `\n  ERROR: ${step.error}`
        return log
      }).join('\n\n')

      archive.append(logsContent, { name: 'test-logs.txt' })

      // Download and add screenshots
      const screenshotSteps = steps.filter(s => s.screenshotUrl)
      fastify.log.info(`Downloading ${screenshotSteps.length} screenshots for run ${runId}`)
      
      for (const step of screenshotSteps) {
        try {
          if (step.screenshotUrl) {
            const response = await fetchFn(step.screenshotUrl)
            if (response.ok) {
              const buffer = await response.arrayBuffer()
              archive.append(Buffer.from(buffer), { name: `screenshots/step-${step.stepNumber}.png` })
              fastify.log.debug(`Added screenshot for step ${step.stepNumber}`)
            } else {
              fastify.log.warn(`Failed to download screenshot for step ${step.stepNumber}: HTTP ${response.status}`)
            }
          }
        } catch (error: any) {
          fastify.log.warn(`Failed to download screenshot for step ${step.stepNumber}:`, error.message)
          // Continue with other screenshots even if one fails
        }
      }

      // Download and add video
      const videoArtifact = artifacts.find(a => a.type === 'video')
      if (videoArtifact?.url || testRun.artifactsUrl) {
        try {
          const videoUrl = videoArtifact?.url || testRun.artifactsUrl
          if (videoUrl) {
            fastify.log.info(`Downloading video for run ${runId} from ${videoUrl}`)
            const response = await fetchFn(videoUrl)
            if (response.ok) {
              const buffer = await response.arrayBuffer()
              const ext = videoUrl.includes('.webm') ? 'webm' : 'mp4'
              archive.append(Buffer.from(buffer), { name: `video.${ext}` })
              fastify.log.info(`Added video to archive for run ${runId}`)
            } else {
              fastify.log.warn(`Failed to download video: HTTP ${response.status}`)
            }
          }
        } catch (error: any) {
          fastify.log.warn('Failed to download video:', error.message)
          // Continue without video if download fails
        }
      }

      // Generate HTML summary report
      const htmlReport = generateDetailedReportHtml(runId, testRun, steps, reportData.issues, reportData.warnings, reportData.recommendations)
      archive.append(htmlReport, { name: 'report.html' })

      // Set up promise to wait for archive completion BEFORE finalizing
      const archivePromise = new Promise<void>((resolve, reject) => {
        // Only set up handlers once
        let resolved = false
        
        archive.on('end', () => {
          if (!resolved) {
            resolved = true
            fastify.log.info(`Archive finalized for run ${runId}`)
            resolve()
          }
        })
        
        archive.on('error', (err: any) => {
          if (!resolved) {
            resolved = true
            fastify.log.error('Archive finalization error:', err)
            reject(err)
          }
        })
      })

      // Finalize archive - this will trigger the stream
      archive.finalize()

      // Wait for archive to complete
      try {
        await archivePromise
        // Note: Don't call reply.send() here as the stream handles the response
        // The response is sent automatically when the archive stream completes
      } catch (archiveError: any) {
        fastify.log.error('Archive completion error:', archiveError)
        if (!reply.sent) {
          return reply.code(500).send({ error: 'Failed to complete archive: ' + archiveError.message })
        }
      }

    } catch (error: any) {
      fastify.log.error('Report download error:', error)
      if (!reply.sent) {
        return reply.code(500).send({ error: error.message || 'Failed to generate ZIP report' })
      }
    }
  })
}

// Generate report HTML (works with partial steps) - for report-view endpoint
function generateReportHtml(runId: string, testRun: TestRun, steps: any[], apiBaseUrl: string): string {
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
        <span>${testRun.build.url || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Device</strong>
        <span>${testRun.profile.device}</span>
      </div>
      <div class="info-item">
        <strong>Steps Completed</strong>
        <span>${steps.length} / ${testRun.options?.maxSteps || 10}</span>
      </div>
      <div class="info-item">
        <strong>Started At</strong>
        <span>${testRun.startedAt ? new Date(testRun.startedAt).toLocaleString() : 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Current Step</strong>
        <span>${testRun.currentStep || steps.length}</span>
      </div>
    </div>

    <h2>Test Steps (${steps.length})</h2>
    ${steps.length === 0 ? '<p>No steps completed yet.</p>' : steps.map((step, idx) => `
    <div class="step">
      <div class="step-header">
        <h3>Step ${step.stepNumber}: ${step.action}${step.target ? ` → ${step.target}` : ''}</h3>
        <span class="step-status ${step.success ? 'status-completed' : 'status-failed'}">
          ${step.success ? '✓ SUCCESS' : '✗ FAILED'}
        </span>
      </div>
      <div class="step-details">
        ${step.value ? `<p><strong>Value:</strong> ${step.value}</p>` : ''}
        <p><strong>Timestamp:</strong> ${new Date(step.timestamp).toLocaleString()}</p>
        ${step.error ? `<p style="color: #991b1b;"><strong>Error:</strong> ${step.error}</p>` : ''}
        ${step.screenshotUrl ? `<a href="${step.screenshotUrl}" target="_blank" class="artifact-link">View Screenshot →</a>` : ''}
      </div>
    </div>
    `).join('')}

    <h2>Statistics</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Total Steps</strong>
        <span>${steps.length}</span>
      </div>
      <div class="info-item">
        <strong>Successful Steps</strong>
        <span>${steps.filter(s => s.success).length}</span>
      </div>
      <div class="info-item">
        <strong>Failed Steps</strong>
        <span>${steps.filter(s => !s.success).length}</span>
      </div>
      <div class="info-item">
        <strong>Success Rate</strong>
        <span>${steps.length > 0 ? ((steps.filter(s => s.success).length / steps.length) * 100).toFixed(1) : 0}%</span>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

// Generate detailed report HTML with issues, warnings, and recommendations (for ZIP download)
function generateDetailedReportHtml(runId: string, testRun: TestRun, steps: any[], issues: string[], warnings: string[], recommendations: string[], comprehensiveData?: any): string {
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
    .issue { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0.25rem; color: #991b1b; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0.25rem; color: #92400e; }
    .recommendation { background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0.25rem; color: #1e40af; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { margin-bottom: 0.5rem; }
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
        <strong>Build URL</strong>
        <span>${testRun.build?.url || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Device</strong>
        <span>${testRun.profile?.device || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Steps Completed</strong>
        <span>${steps.length} / ${testRun.options?.maxSteps || 10}</span>
      </div>
      <div class="info-item">
        <strong>Started At</strong>
        <span>${testRun.startedAt ? new Date(testRun.startedAt).toLocaleString() : 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Successful Steps</strong>
        <span>${steps.filter(s => s.success).length}</span>
      </div>
      <div class="info-item">
        <strong>Failed Steps</strong>
        <span>${steps.filter(s => !s.success).length}</span>
      </div>
    </div>

    ${issues.length > 0 ? `
    <h2>Issues Detected</h2>
    <ul>
      ${issues.map(issue => `<li class="issue">⚠️ ${issue}</li>`).join('')}
    </ul>
    ` : ''}

    ${warnings.length > 0 ? `
    <h2>Warnings</h2>
    <ul>
      ${warnings.map(warning => `<li class="warning">⚠️ ${warning}</li>`).join('')}
    </ul>
    ` : ''}

    ${recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <ul>
      ${recommendations.map(rec => `<li class="recommendation">💡 ${rec}</li>`).join('')}
    </ul>
    ` : ''}

    <h2>Test Steps (${steps.length})</h2>
    ${steps.length === 0 ? '<p>No steps completed yet.</p>' : steps.map((step, idx) => `
    <div class="step">
      <div class="step-header">
        <h3>Step ${step.stepNumber}: ${step.action}${step.target ? ` → ${step.target}` : ''}</h3>
        <span class="step-status ${step.success ? 'status-completed' : 'status-failed'}">
          ${step.success ? '✓ SUCCESS' : '✗ FAILED'}
        </span>
      </div>
      <div class="step-details">
        ${step.value ? `<p><strong>Value:</strong> ${step.value}</p>` : ''}
        <p><strong>Timestamp:</strong> ${new Date(step.timestamp).toLocaleString()}</p>
        ${step.error ? `<p style="color: #991b1b;"><strong>Error:</strong> ${step.error}</p>` : ''}
        ${step.screenshotUrl ? `<p><em>Screenshot available in screenshots/step-${step.stepNumber}.png</em></p>` : ''}
      </div>
    </div>
    `).join('')}

    <h2>Statistics</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Total Steps</strong>
        <span>${steps.length}</span>
      </div>
      <div class="info-item">
        <strong>Successful Steps</strong>
        <span>${steps.filter(s => s.success).length}</span>
      </div>
      <div class="info-item">
        <strong>Failed Steps</strong>
        <span>${steps.filter(s => !s.success).length}</span>
      </div>
      <div class="info-item">
        <strong>Success Rate</strong>
        <span>${steps.length > 0 ? ((steps.filter(s => s.success).length / steps.length) * 100).toFixed(1) : 0}%</span>
      </div>
    </div>

    <h2>Report Contents</h2>
    <ul>
      <li><strong>report.json</strong> - Complete test data in JSON format</li>
      <li><strong>test-logs.txt</strong> - Detailed test execution logs</li>
      <li><strong>screenshots/</strong> - All captured screenshots</li>
      <li><strong>video.webm</strong> - Full test execution video (if available)</li>
      <li><strong>report.html</strong> - This HTML report</li>
    </ul>
  </div>
</body>
</html>
  `
}