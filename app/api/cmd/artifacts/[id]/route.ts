import { NextRequest, NextResponse } from 'next/server'

const SWARM_API = process.env.SWARM_API_URL ?? 'http://localhost:8080'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await fetch(`${SWARM_API}/api/artifacts/${id}`)
  if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const data = await res.json()
  return NextResponse.json(data)
}
