import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'

const REGISTRY  = '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'
const FLOW_ID   = 'sdr:core:single-stage'
const WORKSPACE = 'ws-09Dymwpl'
const SWARM_API = 'http://localhost:8080'

// Artifact entry_name → swarm stage input key
const ARTIFACT_INPUT_KEYS: Record<string, string> = {
  company_raw:             'company_raw',
  icp_data:                'icp_data',
  competitive_positioning: 'competitive_positioning',
  scoring_rubric:          'scoring_rubric',
}

async function fetchArtifactContent(
  entryName: string,
  sessionId: string,
  pipelineTaskId: string | null
): Promise<unknown> {
  // 1. Check for local override first
  const [override] = await sql<{ content: unknown }[]>`
    SELECT content FROM strategy_artifact_overrides
    WHERE session_id = ${sessionId} AND entry_name = ${entryName}
  `
  if (override) return override.content

  // 2. Fall back to SwarmStudio artifact
  if (!pipelineTaskId) return null
  try {
    const r = await fetch(`${SWARM_API}/api/artifacts?task_id=${pipelineTaskId}`, { cache: 'no-store' })
    const d = await r.json()
    const artifacts: Array<{ id: string; entry_name: string; status: string }> = d.artifacts ?? []
    const art = artifacts.find(a => a.entry_name === entryName && a.status === 'active')
    if (!art) return null
    const ar = await fetch(`${SWARM_API}/api/artifacts/${art.id}`, { cache: 'no-store' })
    const ad = await ar.json()
    const raw = ad.artifact?.content
    if (!raw) return null
    return JSON.parse(raw.replace(/^\s*\d+\s*\|\s?/gm, ''))
  } catch { return null }
}

function spawnStageTask(inputJson: object): Promise<string | null> {
  return new Promise(resolve => {
    const child = spawn('swarm38', [
      'task', 'run',
      '--flow-id', FLOW_ID,
      '--registry', REGISTRY,
      '--input-json', JSON.stringify(inputJson),
    ], { detached: true, stdio: 'ignore' })
    child.unref()

    setTimeout(async () => {
      try {
        const res  = await fetch(`${SWARM_API}/api/tasks`, { cache: 'no-store' })
        const data = await res.json()
        const tasks: Array<{ id: string; name: string; created_at: string; kind: string }> =
          Array.isArray(data.result) ? data.result : (data.tasks ?? [])
        const latest = tasks
          .filter(t => t.name === FLOW_ID && t.kind === 'task')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        resolve(latest?.id ?? null)
      } catch { resolve(null) }
    }, 2000)
  })
}

export async function POST(req: NextRequest) {
  const { session_id, stage } = await req.json() as { session_id: string; stage: string }
  if (!session_id || !stage) {
    return NextResponse.json({ error: 'session_id and stage required' }, { status: 400 })
  }

  await ensureSchema()

  const [session] = await sql<{ context_text: string | null; pipeline_task_id: string | null; stale_stages: string[] | null }[]>`
    SELECT context_text, pipeline_task_id, stale_stages FROM strategy_sessions WHERE id = ${session_id}
  `
  if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  const taskId = session.pipeline_task_id

  // Build input for this specific stage
  const inputJson: Record<string, unknown> = {
    org_id:       WORKSPACE,
    workspace_id: WORKSPACE,
    stage,
  }

  if (stage === 'company_profiler') {
    inputJson.context_text = session.context_text ?? ''
  } else {
    // Fetch prerequisite artifacts
    const prereqs: Record<string, string[]> = {
      icp_builder:            ['company_raw'],
      competition_researcher: ['company_raw', 'icp_data'],
      scoring_rubric_builder: ['company_raw', 'icp_data', 'competitive_positioning'],
      profile_writer:         ['company_raw', 'icp_data', 'competitive_positioning', 'scoring_rubric'],
    }
    for (const entryName of prereqs[stage] ?? []) {
      const content = await fetchArtifactContent(entryName, session_id, taskId)
      const key = ARTIFACT_INPUT_KEYS[entryName] ?? entryName
      inputJson[key] = content
    }
  }

  const newTaskId = await spawnStageTask(inputJson)

  // Clear this stage from stale_stages
  await sql`
    UPDATE strategy_sessions
    SET stale_stages = array_remove(COALESCE(stale_stages, '{}'), ${stage}),
        pipeline_task_id = COALESCE(${newTaskId}, pipeline_task_id),
        updated_at = NOW()
    WHERE id = ${session_id}
  `

  return NextResponse.json({ task_id: newTaskId, stage })
}
