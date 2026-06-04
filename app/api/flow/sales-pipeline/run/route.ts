import { NextResponse } from 'next/server'
import { exec } from 'child_process'

const SWARM_BASE = 'http://localhost:8080'
const REGISTRY = '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'
const FLOW_ID = 'sdr:core:sales-pipeline'
const WORKSPACE_ID = 'ws-09Dymwpl'

function parseContent(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const cleaned = raw.replace(/^\s*\d+\s*\|\s?/gm, '')
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

async function swarmGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SWARM_BASE}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`SwarmStudio ${res.status}: ${path}`)
  const json = await res.json()
  return (json.result ?? json) as T
}

export async function POST() {
  try {
    // Find newest completed profile-builder task that has a profile_documents artifact.
    // Skip tasks where the pipeline completed but didn't save all artifacts.
    const tasks = await swarmGet<Array<{ id: string; name: string; status: string; created_at: string }>>(
      '/api/tasks'
    )
    const pbTasks = tasks
      .filter(t => t.name === 'sdr:core:profile-builder' && t.status === 'completed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (pbTasks.length === 0) {
      return NextResponse.json(
        { error: 'No completed profile-builder task found. Run Profile Builder from the Setup page first.' },
        { status: 400 }
      )
    }

    let arts: Array<{ id: string; entry_name: string }> = []
    let pbTask = pbTasks[0]
    for (const candidate of pbTasks) {
      const artResult = await swarmGet<{ artifacts: Array<{ id: string; entry_name: string }> }>(
        `/api/artifacts?task_id=${candidate.id}`
      )
      const candidateArts = artResult.artifacts ?? []
      if (candidateArts.some(a => a.entry_name === 'profile_documents')) {
        pbTask = candidate
        arts = candidateArts
        break
      }
    }

    const pdArt = arts.find(a => a.entry_name === 'profile_documents')
    const srArt = arts.find(a => a.entry_name === 'scoring_rubric')
    const icpArt = arts.find(a => a.entry_name === 'icp_data')

    if (!pdArt) {
      return NextResponse.json(
        { error: 'No profile-builder run has a complete profile_documents artifact. Please re-run Profile Builder from the Setup page.' },
        { status: 400 }
      )
    }

    // Fetch profile_documents
    const pdFull = await swarmGet<{ content?: string }>(`/api/artifacts/${pdArt.id}`)
    const pdData = parseContent(pdFull.content)

    if (!pdData?.icp_profile || !pdData?.buyer_persona || !pdData?.company_profile) {
      return NextResponse.json(
        { error: 'profile_documents is missing required fields. Please re-run Profile Builder.' },
        { status: 400 }
      )
    }

    // Fetch scoring_rubric — standalone artifact preferred, fallback to embedded in profile_documents
    let scoringRubric: Record<string, unknown> | null = null
    if (srArt) {
      const srFull = await swarmGet<{ content?: string }>(`/api/artifacts/${srArt.id}`)
      scoringRubric = parseContent(srFull.content)
    }
    if (!scoringRubric && pdData?.scoring_rubric && typeof pdData.scoring_rubric === 'object') {
      scoringRubric = pdData.scoring_rubric as Record<string, unknown>
    }

    // Fetch icp_data if available (used for richer lead scoring context)
    let icpData: Record<string, unknown> | null = null
    if (icpArt) {
      const icpFull = await swarmGet<{ content?: string }>(`/api/artifacts/${icpArt.id}`)
      icpData = parseContent(icpFull.content)
    }

    // Build CLI input
    const inputJson = JSON.stringify({
      org_id: WORKSPACE_ID,
      workspace_id: WORKSPACE_ID,
      icp_profile: pdData.icp_profile,
      buyer_persona: pdData.buyer_persona,
      company_profile: pdData.company_profile,
      scoring_rubric: scoringRubric ?? null,
      icp_data: icpData ?? null,
      scoring_threshold: 0.75,
      max_leads: 10,
      dry_run: true,
    })

    const cmd = `swarm task run --flow-id ${FLOW_ID} --registry ${REGISTRY} --input-json '${inputJson.replace(/'/g, "'\\''")}'`

    // Fire and forget — pipeline runs for 30-60 min, frontend polls independently
    exec(cmd, { timeout: 90 * 60 * 1000 }, (err) => {
      if (err) console.error('[sales-pipeline/run] CLI error:', err.message)
      else console.log('[sales-pipeline/run] CLI completed')
    })

    // Wait for CLI to register the task
    await new Promise(r => setTimeout(r, 2000))

    // Return the newly created task ID
    const allTasks = await swarmGet<Array<{ id: string; name: string; status: string; created_at: string }>>(
      '/api/tasks'
    )
    const latest = allTasks
      .filter(t => t.name === FLOW_ID && (t.status === 'open' || t.status === 'pending' || t.status === 'running'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    return NextResponse.json({
      taskId: latest?.id ?? null,
      profileBuilderTaskId: pbTask.id,
      message: 'Sales pipeline started via CLI',
    })
  } catch (err) {
    console.error('[sales-pipeline/run] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start sales pipeline' },
      { status: 500 }
    )
  }
}
