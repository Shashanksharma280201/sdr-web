import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const REGISTRY = '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'
const FLOW_ID = 'sdr:core:profile-builder'
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

    // Run the CLI — this is what actually loads and executes the swarm agents
    const cmd = `swarm task run --flow-id ${FLOW_ID} --registry ${REGISTRY} --input-json '${inputJson.replace(/'/g, "'\\''")}'`

    // Fire and forget — CLI blocks for 8-10 min, frontend polls independently
    exec(cmd, { timeout: 15 * 60 * 1000 }, (err) => {
      if (err) console.error('[flow/run] CLI exited with error:', err.message)
      else console.log('[flow/run] CLI completed successfully')
    })

    // Give the CLI ~1.5s to create the task record before we try to read it
    await new Promise(r => setTimeout(r, 1500))

    // Fetch the most recently created task for this flow to return its ID
    const res = await fetch('http://localhost:8080/api/tasks', { cache: 'no-store' })
    const data = await res.json()
    const tasks: Array<{ id: string; name: string; status: string; created_at: string; kind: string }> =
      Array.isArray(data.result) ? data.result : []

    const latest = tasks
      .filter(t => t.name === FLOW_ID && t.kind === 'task')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    return NextResponse.json({
      taskId: latest?.id ?? null,
      flowSessionId: null,
      message: 'Pipeline started via CLI',
    })
  } catch (err) {
    console.error('[flow/run] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start flow' },
      { status: 500 }
    )
  }
}
