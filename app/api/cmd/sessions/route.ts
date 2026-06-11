import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS cmd_sessions (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title            VARCHAR(255) NOT NULL DEFAULT 'New Run',
      task_id          VARCHAR(100),
      flow_session_id  VARCHAR(100),
      workspace_id     VARCHAR(100),
      status           VARCHAR(50)  DEFAULT 'pending',
      pipeline_config  JSONB        DEFAULT '{}',
      created_at       TIMESTAMPTZ  DEFAULT NOW(),
      updated_at       TIMESTAMPTZ  DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cmd_sessions_created_idx
    ON cmd_sessions(created_at DESC)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cmd_chats (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id  UUID         NOT NULL REFERENCES cmd_sessions(id) ON DELETE CASCADE,
      role        VARCHAR(20)  NOT NULL,
      content     TEXT         NOT NULL,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cmd_chats_session_idx
    ON cmd_chats(session_id, created_at ASC)
  `
}

const SWARM_URL = process.env.SWARM_API_URL ?? 'http://localhost:8080'

export async function GET() {
  await ensureSchema()
  const rows = await sql`
    SELECT s.*, COUNT(c.id)::int AS message_count
    FROM cmd_sessions s
    LEFT JOIN cmd_chats c ON c.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 50
  `

  // Also pull cmd:core:content-pipeline tasks from swarm API that aren't in cmd_sessions
  let swarmSessions: Record<string, unknown>[] = []
  try {
    const res  = await fetch(`${SWARM_URL}/api/tasks?limit=100`, { cache: 'no-store' })
    const data = await res.json() as { result?: unknown[]; tasks?: unknown[] }
    const allTasks = (data.result ?? data.tasks ?? []) as Array<Record<string, unknown>>
    const registeredTaskIds = new Set((rows as Array<Record<string, unknown>>).map(r => r.task_id).filter(Boolean))

    swarmSessions = allTasks
      .filter(t => t.name === 'cmd:core:content-pipeline' && !registeredTaskIds.has(t.id))
      .map(t => ({
        id:              t.id,
        title:           `Run ${String(t.created_at ?? '').slice(0, 10)} (${String(t.id).slice(-8)})`,
        task_id:         t.id,
        flow_session_id: null,
        workspace_id:    null,
        status:          t.status ?? 'unknown',
        pipeline_config: {},
        created_at:      t.created_at,
        updated_at:      t.created_at,
        message_count:   0,
      }))
  } catch {}

  const statusRank = (s: string) => s === 'completed' ? 0 : s === 'running' ? 1 : s === 'open' ? 2 : 3
  const sessions = [...(rows as Record<string, unknown>[]), ...swarmSessions]
    .sort((a, b) => {
      const sr = statusRank(a.status as string) - statusRank(b.status as string)
      if (sr !== 0) return sr
      return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    })

  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const { title, task_id, flow_session_id, workspace_id, pipeline_config } = await req.json() as {
    title?: string
    task_id?: string
    flow_session_id?: string
    workspace_id?: string
    pipeline_config?: Record<string, unknown>
  }
  await ensureSchema()
  const [session] = await sql`
    INSERT INTO cmd_sessions (title, task_id, flow_session_id, workspace_id, pipeline_config)
    VALUES (
      ${title ?? 'New Run'},
      ${task_id ?? null},
      ${flow_session_id ?? null},
      ${workspace_id ?? 'ws-09Dymwpl'},
      ${JSON.stringify(pipeline_config ?? {})}::jsonb
    )
    RETURNING *
  `
  return NextResponse.json({ session })
}
