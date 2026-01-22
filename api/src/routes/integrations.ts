// Integration routes (GitHub webhook, Zapier, etc.)
import { FastifyInstance } from 'fastify'
import { TestRunStatus, BuildType, DeviceProfile } from '../types'
import { Database } from '../lib/db'
import { enqueueTestRun } from '../lib/queue'

export async function integrationRoutes(fastify: FastifyInstance) {
  // GitHub webhook
  fastify.post('/github/webhook', async (request, reply) => {
    try {
      // SECURITY: Webhook signature verification should be implemented
      // To implement:
      // 1. Get webhook secret from GITHUB_WEBHOOK_SECRET env var
      // 2. Get signature from request.headers['x-hub-signature-256']
      // 3. Use crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
      // 4. Compare with 'sha256=' + signature from header
      // 5. Reject request if signatures don't match
      const payload = request.body as any

      fastify.log.info('GitHub webhook received:', payload.action)

      // Handle different webhook events
      if (payload.action === 'release' || payload.action === 'published') {
        // Create test run for new release
        const release = payload.release
        const projectId = payload.repository?.full_name || 'default'

        // Get or create project (simplified)
        let project = await Database.getProject(projectId)
        if (!project) {
          project = await Database.createProject({
            name: payload.repository?.name || 'GitHub Project',
            description: `Auto-created from ${payload.repository?.full_name}`,
            teamId: 'team_github',
          })
        }

        const testRun = await Database.createTestRun({
          projectId: project.id,
          build: {
            type: BuildType.WEB,
            url: release.html_url,
            version: release.tag_name,
          },
          profile: {
            device: DeviceProfile.CHROME_LATEST,
          },
          status: TestRunStatus.PENDING,
        })

        await enqueueTestRun({
          runId: testRun.id,
          projectId: project.id,
          build: testRun.build,
          profile: testRun.profile,
        })

        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.QUEUED,
        })

        return reply.send({ success: true, runId: testRun.id })
      }

      return reply.send({ received: true })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Webhook processing failed' })
    }
  })

  // Generic webhook endpoint for Zapier/n8n
  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body as any

      fastify.log.info('Generic webhook received')

      // Extract project and build info from payload
      const projectId = payload.projectId || 'default'
      const buildUrl = payload.buildUrl || payload.url

      if (!buildUrl) {
        return reply.code(400).send({ error: 'buildUrl or url is required' })
      }

      let project = await Database.getProject(projectId)
      if (!project) {
        project = await Database.createProject({
          name: payload.projectName || 'Webhook Project',
          teamId: 'team_webhook',
        })
      }

      const testRun = await Database.createTestRun({
        projectId: project.id,
        build: {
          type: (payload.buildType as any) || 'web',
          url: buildUrl,
          version: payload.version,
        },
        profile: {
          device: (payload.device as any) || 'chrome-latest',
        },
        status: TestRunStatus.PENDING,
      })

      await enqueueTestRun({
        runId: testRun.id,
        projectId: project.id,
        build: testRun.build,
        profile: testRun.profile,
      })

      await Database.updateTestRun(testRun.id, {
        status: TestRunStatus.QUEUED,
      })

      return reply.send({ success: true, runId: testRun.id })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Webhook processing failed' })
    }
  })
}

