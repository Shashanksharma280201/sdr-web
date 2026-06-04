const BASE = 'http://localhost:8080'

export interface TaskRecord {
  id: string
  status: string
  name: string
  workspace_id: string
  created_at: string
  updated_at: string
}

// Matches /api/execution-sessions response items
export interface ExecutionSession {
  id: string
  task_id: string
  flow_session_id: string
  kind: string
  name: string
  status: string
  workflow?: string
  sequence_num?: number
  started_at?: string
  completed_at?: string
  total_tokens?: number
}

// Kept for backward compat with console page
export type PhaseRecord = ExecutionSession & { phase_num: number }

export interface ArtifactRecord {
  id: string
  task_id: string
  entry_name: string
  artifact_name: string
  status: string
  phase_id?: string
  phase_name?: string
  created_at: string
  updated_at: string
  content?: string
}

export interface FlowSession {
  id: string
  flow_id: string
  task_id: string
  status: string
  started_at: string
  completed_at?: string
  inputs: Record<string, unknown>
  results: Record<string, unknown>
}

// For REST endpoints that use the {result, messages} envelope
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SwarmStudio API error ${res.status}: ${text}`)
  }
  const json = await res.json()
  return json.result as T
}

// /api/inbox does NOT use the envelope — returns raw { status, flow_session_id, task_id }
async function inboxPost(body: Record<string, unknown>): Promise<{ status: string; flow_session_id: string; task_id: string }> {
  const res = await fetch(`${BASE}/api/inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SwarmStudio inbox error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function runFlow(params: {
  flowId: string
  taskName?: string
  inputJson: Record<string, unknown>
}): Promise<{ taskId: string; flowSessionId: string }> {
  const r = await inboxPost({
    message_type: 'new_task',
    name: params.taskName ?? params.flowId,
    flow_name: params.flowId,
    initial_input: params.inputJson,
    task_id: null,
  })
  return { taskId: r.task_id, flowSessionId: r.flow_session_id }
}

export async function getTask(taskId: string): Promise<TaskRecord> {
  return apiFetch<TaskRecord>(`/api/tasks/${taskId}`)
}

export async function getTasks(limit = 20): Promise<TaskRecord[]> {
  const result = await apiFetch<{ tasks: TaskRecord[]; total: number }>(`/api/tasks?limit=${limit}`)
  return result.tasks || []
}

export async function getExecutionSessions(taskId: string): Promise<PhaseRecord[]> {
  const result = await apiFetch<{ sessions: ExecutionSession[]; total: number }>(
    `/api/execution-sessions?task_id=${taskId}`
  )
  return (result.sessions || []).map(s => ({
    ...s,
    phase_num: s.sequence_num ?? 0,
  }))
}

// Backward compat alias
export const getTaskPhases = getExecutionSessions

export async function getTaskArtifacts(taskId: string): Promise<ArtifactRecord[]> {
  const result = await apiFetch<{ artifacts: ArtifactRecord[] }>(`/api/artifacts?task_id=${taskId}`)
  return result.artifacts || []
}

export async function getArtifactContent(artifactId: string): Promise<ArtifactRecord> {
  return apiFetch<ArtifactRecord>(`/api/artifacts/${artifactId}`)
}

export async function getFlowSessions(taskId?: string): Promise<FlowSession[]> {
  const qs = taskId ? `?task_id=${taskId}` : ''
  const result = await apiFetch<{ sessions: FlowSession[]; total: number }>(`/api/flow-sessions${qs}`)
  return result.sessions || []
}

// Returns the active/latest flow_session_id for a task (needed to open WS stream)
export async function resolveFlowSession(taskId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/flow-session-id/${taskId}`)
  if (res.status === 404) return null
  const json = await res.json()
  return json.flow_session_id ?? null
}

// WebSocket URL for streaming flow events
export function flowStreamUrl(
  flowSessionId: string,
  opts?: { skipReplay?: boolean; fromSequence?: number }
): string {
  const wsBase = BASE.replace(/^http/, 'ws')
  const q = new URLSearchParams()
  if (opts?.skipReplay) q.set('skip_replay', '1')
  if (opts?.fromSequence != null) q.set('from_sequence', String(opts.fromSequence))
  const qs = q.toString()
  return `${wsBase}/api/flows/${flowSessionId}/stream${qs ? `?${qs}` : ''}`
}
