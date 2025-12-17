// Supabase database implementation
import { randomUUID } from 'crypto'
import { TestRun, TestRunStatus, Project, Team, TestArtifact } from '../types'
import { supabase } from './supabase'

export class Database {
  // Test Runs
  static async createTestRun(data: Omit<TestRun, 'id' | 'createdAt' | 'updatedAt'>, userId?: string): Promise<TestRun> {
    const now = new Date().toISOString()
    const runId = randomUUID()
    
    const { data: run, error } = await supabase
      .from('test_runs')
      .insert({
        id: runId,
        project_id: data.projectId,
        user_id: userId || null, // Link to authenticated user if provided
        status: data.status,
        build: data.build,
        profile: data.profile,
        options: data.options || null,
        started_at: data.startedAt || null,
        completed_at: data.completedAt || null,
        duration: data.duration || null,
        error: data.error || null,
        report_url: data.reportUrl || null,
        artifacts_url: data.artifactsUrl || null,
        trace_url: data.traceUrl || null,
        stream_url: data.streamUrl || null,
        steps: data.steps || null,
        diagnosis: data.diagnosis || null,
        paused: false,
        current_step: 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create test run: ${error.message}`)
    }

    return this.mapTestRunFromDb(run)
  }

  static async getTestRun(id: string): Promise<TestRun | null> {
    const { data, error } = await supabase
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to get test run: ${error.message}`)
    }

    return data ? this.mapTestRunFromDb(data) : null
  }

  static async updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun | null> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt
    if (updates.duration !== undefined) updateData.duration = updates.duration
    if (updates.error !== undefined) updateData.error = updates.error
    if (updates.reportUrl !== undefined) updateData.report_url = updates.reportUrl
    if (updates.artifactsUrl !== undefined) updateData.artifacts_url = updates.artifactsUrl
    if (updates.traceUrl !== undefined) updateData.trace_url = updates.traceUrl
    if (updates.streamUrl !== undefined) updateData.stream_url = updates.streamUrl
    if (updates.steps !== undefined) updateData.steps = updates.steps
    if (updates.diagnosis !== undefined) updateData.diagnosis = updates.diagnosis
    if (updates.diagnosisProgress !== undefined) updateData.diagnosis_progress = updates.diagnosisProgress
    if (updates.paused !== undefined) updateData.paused = updates.paused
    if (updates.currentStep !== undefined) updateData.current_step = updates.currentStep

    const { data, error } = await supabase
      .from('test_runs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update test run: ${error.message}`)
    }

    return data ? this.mapTestRunFromDb(data) : null
  }

  static async listTestRuns(projectId?: string, limit = 50): Promise<TestRun[]> {
    let query = supabase
      .from('test_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to list test runs: ${error.message}`)
    }

    return (data || []).map(this.mapTestRunFromDb)
  }

  static async deleteTestRun(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('test_runs')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete test run: ${error.message}`)
    }

    return true
  }

  // Projects
  static async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>, userId?: string): Promise<Project> {
    const now = new Date().toISOString()
    
    // Use service role client to bypass RLS
    // Service role has full access per RLS policies
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: data.name,
        description: data.description || null,
        team_id: data.teamId,
        user_id: userId || null, // Link to authenticated user if provided
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) {
      console.error('Project creation error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId,
        data,
      })
      throw new Error(`Failed to create project: ${error.message}${error.code ? ` (Code: ${error.code})` : ''}`)
    }

    if (!project) {
      throw new Error('Failed to create project: No data returned')
    }

    return this.mapProjectFromDb(project)
  }

  static async getProject(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to get project: ${error.message}`)
    }

    return data ? this.mapProjectFromDb(data) : null
  }

  static async listProjects(teamId?: string): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to list projects: ${error.message}`)
    }

    return (data || []).map(this.mapProjectFromDb)
  }

  // Artifacts
  static async createArtifact(data: Omit<TestArtifact, 'id' | 'createdAt'>): Promise<TestArtifact> {
    const now = new Date().toISOString()
    const artifactId = randomUUID()
    
    const { data: artifact, error } = await supabase
      .from('test_artifacts')
      .insert({
        id: artifactId,
        run_id: data.runId,
        type: data.type,
        url: data.url,
        path: data.path,
        size: data.size,
        created_at: now,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create artifact: ${error.message}`)
    }

    return this.mapArtifactFromDb(artifact)
  }

  static async getArtifacts(runId: string): Promise<TestArtifact[]> {
    const { data, error } = await supabase
      .from('test_artifacts')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to get artifacts: ${error.message}`)
    }

    return (data || []).map(this.mapArtifactFromDb)
  }

  // Helper methods to map database rows to TypeScript types
  private static mapTestRunFromDb(row: any): TestRun {
    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status as TestRunStatus,
      build: row.build,
      profile: row.profile,
      options: row.options,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      error: row.error,
      reportUrl: row.report_url,
      artifactsUrl: row.artifacts_url,
      traceUrl: row.trace_url || null,
      streamUrl: row.stream_url || null,
      steps: row.steps,
      diagnosis: row.diagnosis || null,
      diagnosisProgress: row.diagnosis_progress || null,
      paused: row.paused || false,
      currentStep: row.current_step || 0,
    }
  }

  private static mapProjectFromDb(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      teamId: row.team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private static mapArtifactFromDb(row: any): TestArtifact {
    return {
      id: row.id,
      runId: row.run_id,
      type: row.type,
      url: row.url,
      path: row.path,
      size: row.size,
      createdAt: row.created_at,
    }
  }

  // Initialize - check connection and create default project if needed
  static async initialize() {
    try {
      // Test connection
      const { error } = await supabase.from('projects').select('id').limit(1)
      
      if (error) {
        console.warn('Database connection warning:', error.message)
        console.warn('Make sure Supabase tables are created. See SETUP.md for schema.')
        return
      }

      // Check if default project exists
      const projects = await this.listProjects()
      if (projects.length === 0) {
        const defaultProject = await this.createProject({
          name: 'Sample Project',
          description: 'Default project for testing',
          teamId: 'team_default',
        })
        console.log('Database initialized with default project:', defaultProject.id)
      } else {
        console.log('Database connected successfully')
      }
    } catch (error: any) {
      console.warn('Database initialization warning:', error.message)
    }
  }
}

