import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ensureSchema } from '../sessions/route'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  await ensureSchema()

  const rows = await sql`
    SELECT id, session_id, role, content, created_at
    FROM strategy_chats
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `
  return NextResponse.json({ messages: rows })
}

export async function POST(req: NextRequest) {
  const { session_id, agent, role, content } = await req.json() as {
    session_id: string; agent: string; role: string; content: string
  }
  if (!session_id || !role || !content) {
    return NextResponse.json({ error: 'session_id, role and content required' }, { status: 400 })
  }
  await ensureSchema()
  await sql`
    INSERT INTO strategy_chats (session_id, agent_name, role, content)
    VALUES (${session_id}, ${agent ?? 'profile_builder_web'}, ${role}, ${content})
  `
  await sql`UPDATE strategy_sessions SET updated_at = NOW() WHERE id = ${session_id}`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  await sql`DELETE FROM strategy_chats WHERE session_id = ${sessionId}`
  return NextResponse.json({ ok: true })
}
