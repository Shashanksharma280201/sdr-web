import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'
import { triggerPipeline } from '../../chat/stream/route'

export async function POST(req: NextRequest) {
  const { session_id } = await req.json() as { session_id: string }
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  await ensureSchema()

  const [session] = await sql<{ context_text: string | null; id: string }[]>`
    SELECT id, context_text FROM strategy_sessions WHERE id = ${session_id}
  `
  if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (!session.context_text) return NextResponse.json({ error: 'no context — complete the chat first' }, { status: 400 })

  const taskId = await triggerPipeline(session.context_text)
  if (!taskId) return NextResponse.json({ error: 'failed to start pipeline' }, { status: 502 })

  await sql`
    UPDATE strategy_sessions SET pipeline_task_id = ${taskId}, updated_at = NOW() WHERE id = ${session_id}
  `

  return NextResponse.json({ task_id: taskId })
}
