import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

const SWARM_BASE = process.env.SWARM_API_URL   ?? 'http://localhost:8080'
const REGISTRY   = process.env.SWARM_REGISTRY  ?? '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'
const FLOW_ID    = 'sdr:core:lead-researcher-test'
const WORKSPACE  = 'ws-09Dymwpl'

function parse(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try { return JSON.parse(raw.replace(/^\s*\d+\s*\|\s?/gm, '')) } catch { return null }
}

async function swarmGet<T>(path: string): Promise<T> {
  const r = await fetch(`${SWARM_BASE}${path}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`SwarmStudio ${r.status}: ${path}`)
  const j = await r.json()
  return (j.result ?? j) as T
}

async function fetchArtifact(taskId: string, artifactName: string): Promise<Record<string, unknown> | null> {
  try {
    const arts = await swarmGet<{ artifacts: Array<{ id: string; entry_name: string; created_at: string }> }>(
      `/api/artifacts?task_id=${taskId}`
    )
    // Most recent match — supports overwrite (re-runs produce newer artifacts with same name)
    const sorted = (arts.artifacts ?? [])
      .filter(a => a.entry_name === artifactName)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (!sorted[0]) return null
    const full = await swarmGet<{ content?: string }>(`/api/artifacts/${sorted[0].id}`)
    return parse(full.content)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      stage: string
      dry_run?: boolean
      clay_api_key?: string
      max_leads?: number
      scoring_threshold?: number
      // task IDs of previous stage outputs
      lead_researcher_task_id?: string
      lead_scorer_task_id?: string
      deep_researcher_task_id?: string
      outreach_designer_task_id?: string
      email_composer_task_id?: string
    }

    const { stage } = body
    const dryRun = body.dry_run !== false  // default true unless explicitly false
    const clayKey = body.clay_api_key?.trim() || process.env.CLAY_API_KEY || ''

    if (!stage) return NextResponse.json({ error: 'stage is required' }, { status: 400 })

    // Always load profile-builder data (needed by most stages)
    const pbTasks = await swarmGet<Array<{ id: string; name: string; status: string; created_at: string }>>('/api/tasks')
    const pbTask = pbTasks
      .filter(t => t.name === 'sdr:core:profile-builder' && t.status === 'completed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (!pbTask) return NextResponse.json({ error: 'No completed profile-builder task found. Run Profile Builder first.' }, { status: 400 })

    const pdContent = await fetchArtifact(pbTask.id, 'profile_documents')
    if (!pdContent?.icp_profile || !pdContent?.buyer_persona || !pdContent?.company_profile) {
      return NextResponse.json({ error: 'profile_documents is missing required fields. Re-run Profile Builder.' }, { status: 400 })
    }

    const srContent = await fetchArtifact(pbTask.id, 'scoring_rubric')

    // Build stage-specific input
    const input: Record<string, unknown> = {
      org_id: WORKSPACE, workspace_id: WORKSPACE,
      stage,
      icp_profile:    pdContent.icp_profile,
      buyer_persona:  pdContent.buyer_persona,
      company_profile: pdContent.company_profile,
      scoring_rubric: srContent ?? pdContent.scoring_rubric ?? null,
      dry_run:        dryRun || !clayKey,
      max_leads:      body.max_leads ?? 10,
      scoring_threshold: body.scoring_threshold ?? 0.75,
    }

    // Feed previous stage outputs as needed
    if (body.lead_researcher_task_id) {
      const leads = await fetchArtifact(body.lead_researcher_task_id, 'leads_raw')
      if (leads) input.leads = leads
    }
    if (body.lead_scorer_task_id) {
      const scored = await fetchArtifact(body.lead_scorer_task_id, 'scored_leads')
      if (scored) input.scored_leads = scored
    }
    if (body.deep_researcher_task_id) {
      const enriched = await fetchArtifact(body.deep_researcher_task_id, 'enriched_leads')
      if (enriched) input.enriched_leads = enriched
    }
    if (body.outreach_designer_task_id) {
      const strategy = await fetchArtifact(body.outreach_designer_task_id, 'outreach_strategy')
      if (strategy) input.outreach_strategy = strategy
    }
    if (body.email_composer_task_id) {
      const drafts = await fetchArtifact(body.email_composer_task_id, 'email_drafts')
      if (drafts) input.email_drafts = drafts
    }

    // Spawn swarm38 task run detached (matches working pattern in strategy/stage/run/route.ts)
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: '/home/shanks' }
    if (clayKey) env.CLAY_API_KEY = clayKey

    const proc = spawn(
      'swarm38',
      ['task', 'run', '--flow-id', FLOW_ID, '--registry', REGISTRY, '--input-json', JSON.stringify(input)],
      { detached: true, stdio: 'ignore', env }
    )
    proc.unref()

    // Wait for task registration
    await new Promise(r => setTimeout(r, 2500))

    const allTasks = await swarmGet<Array<{ id: string; name: string; status: string; created_at: string }>>('/api/tasks')
    const latest = allTasks
      .filter(t => t.name === FLOW_ID)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    let flowSessionId: string | null = null
    if (latest?.id) {
      try {
        const fsRes = await fetch(`${SWARM_BASE}/api/flow-session-id/${latest.id}`, { cache: 'no-store' })
        if (fsRes.ok) flowSessionId = ((await fsRes.json()) as { flow_session_id?: string }).flow_session_id ?? null
      } catch {}
    }

    return NextResponse.json({ taskId: latest?.id ?? null, flowSessionId, stage, message: `${stage} started` })
  } catch (err) {
    console.error('[sdr/pipeline/stage] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to start stage' }, { status: 500 })
  }
}
