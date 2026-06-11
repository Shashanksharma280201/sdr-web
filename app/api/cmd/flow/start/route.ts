import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'

const SWARM_API = process.env.SWARM_API_URL ?? 'http://localhost:8080'
const REGISTRY  = process.env.SWARM_REGISTRY  ?? '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    workspace_id?: string
    org_id?: string
    title?: string
    entry_mode?: string
    live_signals?: string
    company_pov?: string
    num_ideas?: number
    num_drafts?: number
    simulate_only?: boolean
    exclude_topics?: string[]
  }

  await ensureSchema()

  const workspace_id = body.workspace_id ?? 'ws-09Dymwpl'
  const org_id       = body.org_id       ?? workspace_id

  const inputJson = JSON.stringify({
    org_id,
    workspace_id,
    headless:      true,
    simulate_only: body.simulate_only  ?? true,
    entry_mode:    body.entry_mode     ?? 'induced',
    live_signals:  body.live_signals   ?? '',
    company_pov:   body.company_pov    ?? '',
    num_ideas:     body.num_ideas      ?? 2,
    num_drafts:    body.num_drafts     ?? 1,
    exclude_topics: body.exclude_topics ?? [],
  })

  // Spawn swarm task run detached; pipe \n to auto-confirm the walkthrough TUI
  const proc = spawn(
    'swarm38',
    [
      'task', 'run',
      '--flow-id',   'cmd:core:content-pipeline',
      '--registry',  REGISTRY,
      '--input-json', inputJson,
    ],
    {
      detached: true,
      stdio:    ['pipe', 'ignore', 'ignore'],
      env:      { ...process.env, HOME: '/home/shanks' },
    }
  )
  // Send Enter to dismiss the walkthrough TUI
  proc.stdin!.write('\n')
  proc.stdin!.end()
  proc.unref()

  // Wait for the task to be created in DB (typically ~1s)
  await new Promise(resolve => setTimeout(resolve, 2500))

  // Find the newly created CMD task
  const tasksRes = await fetch(`${SWARM_API}/api/tasks?limit=10`)
  if (!tasksRes.ok) {
    return NextResponse.json({ error: 'Cannot reach SwarmStudio API' }, { status: 502 })
  }
  const { result } = await tasksRes.json() as { result: { tasks: Array<{ id: string; name: string; created_at: string }> } }
  const tasks = result?.tasks ?? []

  const cmdTask = tasks
    .filter(t => t.name === 'cmd:core:content-pipeline')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  if (!cmdTask) {
    return NextResponse.json({ error: 'Task not found — pipeline may still be starting' }, { status: 500 })
  }

  // Get flow session ID
  let flow_session_id: string | null = null
  try {
    const fsRes = await fetch(`${SWARM_API}/api/flow-session-id/${cmdTask.id}`)
    if (fsRes.ok) {
      const fsData = await fsRes.json() as { flow_session_id: string }
      flow_session_id = fsData.flow_session_id ?? null
    }
  } catch {}

  // Persist session
  const [session] = await sql`
    INSERT INTO cmd_sessions (title, task_id, flow_session_id, workspace_id, status, pipeline_config)
    VALUES (
      ${body.title ?? `Run ${new Date().toISOString().slice(0,10)}`},
      ${cmdTask.id},
      ${flow_session_id},
      ${workspace_id},
      'running',
      ${JSON.stringify({
        entry_mode:    body.entry_mode    ?? 'induced',
        live_signals:  body.live_signals  ?? '',
        num_ideas:     body.num_ideas     ?? 2,
        num_drafts:    body.num_drafts    ?? 1,
        simulate_only: body.simulate_only ?? true,
      })}::jsonb
    )
    RETURNING *
  `

  return NextResponse.json({ session, task_id: cmdTask.id, flow_session_id })
}
