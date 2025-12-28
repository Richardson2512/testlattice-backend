// Simple HTTP client for worker to communicate with API
import fetch from 'node-fetch'

const API_URL = process.env.API_URL || 'http://localhost:3001'

export async function updateTestRun(runId: string, updates: any): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/tests/${runId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
  } catch (error: any) {
    console.error(`Failed to update test run ${runId}:`, error.message)
    throw error
  }
}

export async function createArtifact(runId: string, artifact: any): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/tests/${runId}/artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(artifact),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error: any) {
    console.error(`Failed to create artifact for run ${runId}:`, error.message)
    throw error
  }
}

