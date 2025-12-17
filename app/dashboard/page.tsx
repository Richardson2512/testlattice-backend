'use client'

import { useEffect, useState } from 'react'
import { api, TestRun, Project } from '../../lib/api'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { validateTestUrl } from '@/lib/urlValidator'

type TestMode = 'single' | 'multi'

export default function DashboardPage() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('none')
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateTestModal, setShowCreateTestModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string>('default-team')
  
  // Test creation form state
  const [testMode, setTestMode] = useState<TestMode>('single')
  const [singlePageUrl, setSinglePageUrl] = useState('')
  const [multiPageUrls, setMultiPageUrls] = useState<string[]>([''])
  const [extraInstructions, setExtraInstructions] = useState('')
  const [device, setDevice] = useState('chrome-latest')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const changeMode = (mode: TestMode) => {
    setTestMode(mode)
    if (mode === 'single') {
      setMultiPageUrls([''])
    } else {
      setSinglePageUrl('')
    }
  }

  useEffect(() => {
    const getUserInfo = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setTeamId(user.id)
      }
    }
    getUserInfo()
  }, [])

  useEffect(() => {
    if (teamId) {
      loadData()
    }
  }, [selectedProject, teamId])

  async function loadData() {
    setLoading(true)
    try {
      const [runsResponse, projectsResponse] = await Promise.all([
        api.listTestRuns(selectedProject && selectedProject !== 'none' ? selectedProject : undefined),
        api.listProjects(),
      ])
      setTestRuns(runsResponse.testRuns)
      setProjects(projectsResponse.projects)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    try {
      const response = await api.createProject({
        name: newProjectName,
        description: newProjectDescription || undefined,
        teamId: teamId || userId || 'default-team',
      })
      
      setShowCreateProjectModal(false)
      setNewProjectName('')
      setNewProjectDescription('')
      loadData()
    } catch (error: any) {
      console.error('Failed to create project:', error.message)
      alert(`Failed to create project: ${error.message || 'Unknown error'}`)
    }
  }

  async function handleCreateTest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!selectedProject || selectedProject === 'none') {
        alert('Please select or create a project')
        setIsSubmitting(false)
        return
      }

      let urls: string[] = []
      let mainUrl = ''
      
      if (testMode === 'single') {
        urls = [singlePageUrl].filter(Boolean)
        mainUrl = singlePageUrl
      } else if (testMode === 'multi') {
        urls = multiPageUrls.filter(Boolean)
        mainUrl = urls[0]
      }

      if (urls.length === 0 || !mainUrl) {
        alert('Please add at least one URL')
        setIsSubmitting(false)
        return
      }

      for (const url of urls) {
        const validation = validateTestUrl(url)
        if (!validation.valid) {
          alert(`Invalid URL: ${validation.error}\n\nTo test local apps, use:\n• ngrok (npx ngrok http 3000)\n• Cloudflare Tunnel\n• Localtunnel`)
          setIsSubmitting(false)
          return
        }
      }

      if (testMode === 'multi' && urls.length > 3) {
        alert('Multi-page test supports maximum 3 pages')
        setIsSubmitting(false)
        return
      }

      const response = await api.createTestRun({
        projectId: selectedProject,
        build: {
          type: 'web',
          url: mainUrl,
        },
        profile: {
          device: device as any,
          maxMinutes: 10,
        },
        options: {
          coverage: extraInstructions ? [extraInstructions] : undefined,
          testMode: testMode,
          approvalPolicy: { mode: 'manual' },
        },
      })

      setShowCreateTestModal(false)
      setSinglePageUrl('')
      setMultiPageUrls([''])
      setExtraInstructions('')
      setTestMode('single')
      setSelectedProject('none')
      
      window.location.href = `/test/run/${response.runId}`
    } catch (error: any) {
      alert(`Failed to create test: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function addMultiPageUrl() {
    if (multiPageUrls.length < 3) {
      setMultiPageUrls([...multiPageUrls, ''])
    }
  }

  function removeMultiPageUrl(index: number) {
    setMultiPageUrls(multiPageUrls.filter((_, i) => i !== index))
  }

  function updateMultiPageUrl(index: number, value: string) {
    const updated = [...multiPageUrls]
    updated[index] = value
    setMultiPageUrls(updated)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#01B574'
      case 'failed': return '#E31A1A'
      case 'running': return '#0075FF'
      case 'queued': return '#F6AD55'
      case 'waiting_approval': return '#F6AD55'
      default: return '#A0AEC0'
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#F7F9FC',
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#F7F9FC',
      minHeight: '100vh',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1A202C',
            margin: 0,
          }}>
            Dashboard
          </h1>
          <button
            onClick={() => setShowCreateTestModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0075FF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            + Create Test
          </button>
        </div>

        {/* Test Credits Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '14px',
                color: '#718096',
                marginBottom: '8px',
              }}>
                Test Credits
              </div>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1A202C',
              }}>
                Unlimited
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#718096',
            }}>
              You have unlimited test credits
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '16px',
        }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                minWidth: '200px',
              }}
            >
              <option value="none">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateProjectModal(true)}
              style={{
                padding: '10px 16px',
                backgroundColor: '#01B574',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + New Project
            </button>
          </div>
        </div>

        {/* Test Runs Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #E2E8F0',
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1A202C',
              margin: 0,
            }}>
              Test Runs
            </h2>
          </div>
          {testRuns.length === 0 ? (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              color: '#718096',
            }}>
              No test runs yet. Create your first test to get started.
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#F7F9FC',
                  borderBottom: '1px solid #E2E8F0',
                }}>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#718096',
                    textTransform: 'uppercase',
                  }}>
                    Status
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#718096',
                    textTransform: 'uppercase',
                  }}>
                    Project
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#718096',
                    textTransform: 'uppercase',
                  }}>
                    URL
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#718096',
                    textTransform: 'uppercase',
                  }}>
                    Created
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#718096',
                    textTransform: 'uppercase',
                  }}>
                    Duration
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#718096',
                    textTransform: 'uppercase',
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {testRuns.map((run) => (
                  <tr key={run.id} style={{
                    borderBottom: '1px solid #E2E8F0',
                  }}>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: getStatusColor(run.status) + '20',
                        color: getStatusColor(run.status),
                      }}>
                        {run.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#1A202C' }}>
                      {projects.find(p => p.id === run.projectId)?.name || 'Unknown'}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#1A202C' }}>
                      <div style={{
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {run.build?.url || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#718096', fontSize: '14px' }}>
                      {formatDate(run.createdAt)}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#718096', fontSize: '14px' }}>
                      {formatDuration(run.duration)}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Link
                        href={`/test/run/${run.id}`}
                        style={{
                          color: '#0075FF',
                          textDecoration: 'none',
                          fontSize: '14px',
                          fontWeight: '600',
                        }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Test Modal */}
      {showCreateTestModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowCreateTestModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
                Create Frontend Test
              </h2>
              <button
                onClick={() => setShowCreateTestModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateTest}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600' 
                }}>
                  Project <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <option value="none">-- Select Project --</option>
                    {projects.length === 0 ? (
                      <option value="" disabled>No projects - Create one first</option>
                    ) : (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProjectModal(true)
                    }}
                    style={{
                      padding: '0.625rem 1rem',
                      background: '#01B574',
                      color: 'white',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    + New
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem', 
                  fontWeight: '600' 
                }}>
                  Test Mode <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}>
                  <label style={{
                    border: `1px solid ${testMode === 'single' ? '#0075FF' : '#E2E8F0'}`,
                    borderRadius: '0.75rem',
                    padding: '0.9rem',
                    cursor: 'pointer',
                    background: testMode === 'single' ? '#0075FF10' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name="testMode"
                        value="single"
                        checked={testMode === 'single'}
                        onChange={() => changeMode('single')}
                      />
                      <div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Single-page test</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                          Perfect for validating a core flow or screen.
                        </div>
                      </div>
                    </div>
                  </label>
                  <label style={{
                    border: `1px solid ${testMode === 'multi' ? '#0075FF' : '#E2E8F0'}`,
                    borderRadius: '0.75rem',
                    padding: '0.9rem',
                    cursor: 'pointer',
                    background: testMode === 'multi' ? '#0075FF10' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name="testMode"
                        value="multi"
                        checked={testMode === 'multi'}
                        onChange={() => changeMode('multi')}
                      />
                      <div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Multi-page test</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                          Chain a few URLs for short journeys.
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {testMode === 'single' ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600' 
                  }}>
                    Website URL <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={singlePageUrl}
                    onChange={(e) => setSinglePageUrl(e.target.value)}
                    placeholder="https://example.com or https://your-app.ngrok-free.app"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #E2E8F0',
                    }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '0.75rem',
                  }}>
                    <label style={{ fontWeight: '600' }}>
                      Website URLs <span style={{ color: 'red' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addMultiPageUrl}
                      disabled={multiPageUrls.length >= 3}
                      style={{
                        padding: '0.5rem 1rem',
                        background: multiPageUrls.length >= 3 ? '#E2E8F0' : '#0075FF',
                        color: 'white',
                        fontSize: '0.8125rem',
                        cursor: multiPageUrls.length >= 3 ? 'not-allowed' : 'pointer',
                        borderRadius: '0.5rem',
                        border: 'none',
                      }}
                    >
                      + Add URL
                    </button>
                  </div>
                  {multiPageUrls.map((url, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      gap: '0.75rem', 
                      marginBottom: '0.75rem', 
                      alignItems: 'center',
                    }}>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateMultiPageUrl(index, e.target.value)}
                        placeholder={`Page ${index + 1} URL`}
                        required={index === 0}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #E2E8F0',
                        }}
                      />
                      {multiPageUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMultiPageUrl(index)}
                          style={{
                            padding: '0.625rem',
                            background: '#E31A1A',
                            color: 'white',
                            fontSize: '0.875rem',
                            minWidth: '40px',
                            borderRadius: '0.5rem',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600' 
                }}>
                  Specify instruction if any
                </label>
                <textarea
                  value={extraInstructions}
                  onChange={(e) => setExtraInstructions(e.target.value)}
                  placeholder="e.g., 'Check navbar', 'Click login button', 'Verify footer links'"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #E2E8F0',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600' 
                }}>
                  Device/Browser
                </label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <option value="chrome-latest">Chrome (Latest)</option>
                  <option value="firefox-latest">Firefox (Latest)</option>
                  <option value="safari-latest">Safari (Latest)</option>
                </select>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                justifyContent: 'flex-end', 
                marginTop: '2rem',
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTestModal(false)
                    setSinglePageUrl('')
                    setMultiPageUrls([''])
                    setExtraInstructions('')
                    setTestMode('single')
                  }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    border: '1px solid #E2E8F0',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: '#0075FF',
                    color: 'white',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Starting Test...' : 'Start Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '1rem',
          }}
          onClick={() => {
            setShowCreateProjectModal(false)
            setNewProjectName('')
            setNewProjectDescription('')
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2.5rem',
              maxWidth: '520px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
                Create Project
              </h2>
              <button
                onClick={() => {
                  setShowCreateProjectModal(false)
                  setNewProjectName('')
                  setNewProjectDescription('')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600' 
                }}>
                  Project Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  placeholder="My Test Project"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #E2E8F0',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600' 
                }}>
                  Description (Optional)
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Describe your project..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #E2E8F0',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                justifyContent: 'flex-end', 
                marginTop: '2rem',
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateProjectModal(false)
                    setNewProjectName('')
                    setNewProjectDescription('')
                  }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    border: '1px solid #E2E8F0',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: '#01B574',
                    color: 'white',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
