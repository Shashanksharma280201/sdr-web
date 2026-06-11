import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

const SWARM_BASE = process.env.SWARM_API_URL ?? 'http://localhost:8080'
const REGISTRY   = process.env.SWARM_REGISTRY ?? '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'
const FLOW_ID    = 'sdr:core:profile-builder'
const WORKSPACE_ID = 'ws-09Dymwpl'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyText } = body

    if (!companyText?.trim()) {
      return NextResponse.json({ error: 'companyText is required' }, { status: 400 })
    }

    const inputJson = JSON.stringify({
      org_id: WORKSPACE_ID,
      workspace_id: WORKSPACE_ID,
      headless: true,
      initial_company_text: companyText,
    })

    // Spawn swarm38 task run detached — same pattern as cmd:core:content-pipeline
    const proc = spawn(
      'swarm38',
      ['task', 'run', '--flow-id', FLOW_ID, '--registry', REGISTRY, '--input-json', inputJson],
      {
        detached: true,
        stdio: ['pipe', 'ignore', 'ignore'],
        env: { ...process.env, HOME: '/home/shanks' },
      }
    )
    proc.stdin!.write('\n')
    proc.stdin!.end()
    proc.unref()

    // Wait for the task to be registered
    await new Promise(r => setTimeout(r, 2500))

    // Fetch the newly created task
    const res = await fetch(`${SWARM_BASE}/api/tasks`, { cache: 'no-store' })
    const data = await res.json()
    const tasks: Array<{ id: string; name: string; status: string; created_at: string }> =
      Array.isArray(data.result) ? data.result : (data.result?.tasks ?? [])

    const latest = tasks
      .filter(t => t.name === FLOW_ID)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    // Resolve flow session ID
    let flowSessionId: string | null = null
    if (latest?.id) {
      try {
        const fsRes = await fetch(`${SWARM_BASE}/api/flow-session-id/${latest.id}`, { cache: 'no-store' })
        if (fsRes.ok) {
          const fsData = await fsRes.json() as { flow_session_id?: string }
          flowSessionId = fsData.flow_session_id ?? null
        }
      } catch {}
    }

    return NextResponse.json({
      taskId: latest?.id ?? null,
      flowSessionId,
      message: 'Profile Builder started',
    })
  } catch (err) {
    console.error('[flow/run] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start flow' },
      { status: 500 }
    )
  }
}
