import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS strategy_sessions (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_name       VARCHAR(100) NOT NULL,
      title            VARCHAR(255) NOT NULL DEFAULT 'New Analysis',
      flow_session_id  VARCHAR(100),
      created_at       TIMESTAMPTZ  DEFAULT NOW(),
      updated_at       TIMESTAMPTZ  DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS flow_session_id VARCHAR(100)`
  await sql`ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS context_text TEXT`
  await sql`ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS pipeline_task_id VARCHAR(100)`
  await sql`ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS stale_stages TEXT[] DEFAULT '{}'`
  await sql`ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS artifact_state JSONB DEFAULT '{}'`
  await sql`
    CREATE TABLE IF NOT EXISTS strategy_artifact_overrides (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id  UUID         NOT NULL REFERENCES strategy_sessions(id) ON DELETE CASCADE,
      entry_name  VARCHAR(100) NOT NULL,
      content     JSONB        NOT NULL,
      updated_at  TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE(session_id, entry_name)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS strategy_sessions_agent_idx
    ON strategy_sessions(agent_name, updated_at DESC)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS strategy_chats (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id  UUID,
      agent_name  VARCHAR(100) NOT NULL,
      role        VARCHAR(20)  NOT NULL,
      content     TEXT         NOT NULL,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE strategy_chats ADD COLUMN IF NOT EXISTS session_id UUID`
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'strategy_chats_session_id_fkey'
        AND table_name = 'strategy_chats'
      ) THEN
        ALTER TABLE strategy_chats
        ADD CONSTRAINT strategy_chats_session_id_fkey
        FOREIGN KEY (session_id) REFERENCES strategy_sessions(id) ON DELETE CASCADE;
      END IF;
    END $$
  `
  await sql`
    CREATE INDEX IF NOT EXISTS strategy_chats_session_idx
    ON strategy_chats(session_id, created_at ASC)
  `
}

export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent')
  await ensureSchema()

  const rows = await sql`
    SELECT
      s.id, s.agent_name, s.title, s.flow_session_id,
      s.pipeline_task_id, s.context_text, s.stale_stages,
      s.artifact_state, s.created_at, s.updated_at,
      COUNT(c.id)::int AS message_count
    FROM strategy_sessions s
    LEFT JOIN strategy_chats c ON c.session_id = s.id
    ${agent ? sql`WHERE s.agent_name = ${agent}` : sql``}
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT 50
  `
  return NextResponse.json({ sessions: rows })
}

export async function POST(req: NextRequest) {
  const { agent, title, flow_session_id } = await req.json() as {
    agent: string; title?: string; flow_session_id?: string
  }
  if (!agent) return NextResponse.json({ error: 'agent required' }, { status: 400 })

  await ensureSchema()

  const [session] = await sql`
    INSERT INTO strategy_sessions (agent_name, title, flow_session_id)
    VALUES (${agent}, ${title ?? 'New Analysis'}, ${flow_session_id ?? null})
    RETURNING id, agent_name, title, flow_session_id, created_at, updated_at
  `
  return NextResponse.json({ session })
}
