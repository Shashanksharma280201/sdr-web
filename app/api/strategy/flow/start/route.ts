import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'

const SWARM_API = process.env.SWARM_API_URL ?? 'http://localhost:8080'

export async function POST(req: NextRequest) {
  const { workspace_id, org_id, title } = await req.json() as {
    workspace_id: string
    org_id: string
    title?: string
  }

  if (!workspace_id || !org_id) {
    return NextResponse.json({ error: 'workspace_id and org_id required' }, { status: 400 })
  }

  await ensureSchema()

  // Start the flow in SwarmStudio
  const inboxRes = await fetch(`${SWARM_API}/api/inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_type: 'new_task',
      name: 'sdr:core:profile-builder-web',
      flow_name: 'sdr:core:profile-builder-web',
      initial_input: { workspace_id, org_id },
    }),
  })

  if (!inboxRes.ok) {
    const text = await inboxRes.text()
    return NextResponse.json({ error: `SwarmStudio error: ${text}` }, { status: 502 })
  }

  const { flow_session_id, task_id } = await inboxRes.json() as {
    flow_session_id: string
    task_id: string
    status: string
  }

  // Persist the session in our DB so we can show history
  const [session] = await sql`
    INSERT INTO strategy_sessions (agent_name, title, flow_session_id)
    VALUES ('profile_builder_web', ${title ?? 'New Analysis'}, ${flow_session_id})
    RETURNING id, agent_name, title, flow_session_id, created_at, updated_at
  `

  return NextResponse.json({ session, flow_session_id, task_id })
}
