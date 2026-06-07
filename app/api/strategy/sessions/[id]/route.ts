import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await sql`DELETE FROM strategy_sessions WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { title?: string; artifact_state?: Record<string, unknown> }

  if (body.title !== undefined) {
    if (!body.title.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const [session] = await sql`
      UPDATE strategy_sessions
      SET title = ${body.title.trim()}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, updated_at
    `
    return NextResponse.json({ session })
  }

  if (body.artifact_state !== undefined) {
    await sql`
      UPDATE strategy_sessions
      SET artifact_state = ${JSON.stringify(body.artifact_state)}, updated_at = NOW()
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'title or artifact_state required' }, { status: 400 })
}
