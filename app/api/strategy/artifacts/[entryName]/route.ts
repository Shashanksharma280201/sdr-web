import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'

type Params = { params: Promise<{ entryName: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { entryName } = await params
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ override: null })

  await ensureSchema()
  const [row] = await sql<{ content: unknown }[]>`
    SELECT content FROM strategy_artifact_overrides
    WHERE session_id = ${sessionId} AND entry_name = ${entryName}
  `
  return NextResponse.json({ override: row?.content ?? null })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { entryName } = await params
  const { session_id, content } = await req.json() as { session_id: string; content: unknown }
  if (!session_id || content === undefined) {
    return NextResponse.json({ error: 'session_id and content required' }, { status: 400 })
  }

  await ensureSchema()

  await sql`
    INSERT INTO strategy_artifact_overrides (session_id, entry_name, content)
    VALUES (${session_id}, ${entryName}, ${JSON.stringify(content)}::jsonb)
    ON CONFLICT (session_id, entry_name)
    DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
  `

  // Compute downstream stale stages and persist
  const CASCADES: Record<string, string[]> = {
    company_raw:             ['icp_data', 'competitive_positioning', 'scoring_rubric', 'profile_documents'],
    icp_data:                ['competitive_positioning', 'scoring_rubric', 'profile_documents'],
    competitive_positioning: ['scoring_rubric', 'profile_documents'],
    scoring_rubric:          ['profile_documents'],
  }
  const downstream = CASCADES[entryName] ?? []
  if (downstream.length > 0) {
    await sql`
      UPDATE strategy_sessions
      SET stale_stages = (
        SELECT array_agg(DISTINCT elem)
        FROM unnest(array_cat(COALESCE(stale_stages, '{}'), ${downstream}::text[])) AS t(elem)
      ),
      updated_at = NOW()
      WHERE id = ${session_id}
    `
  }

  return NextResponse.json({ ok: true, stale: downstream })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { entryName } = await params
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  await sql`
    DELETE FROM strategy_artifact_overrides
    WHERE session_id = ${sessionId} AND entry_name = ${entryName}
  `
  return NextResponse.json({ ok: true })
}
