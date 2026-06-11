import { NextRequest, NextResponse } from 'next/server'

const SWARM_API = process.env.SWARM_API_URL ?? 'http://localhost:8080'

export async function GET(req: NextRequest) {
  const task_id = req.nextUrl.searchParams.get('task_id')
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const res = await fetch(`${SWARM_API}/api/artifacts?task_id=${task_id}`)
  if (!res.ok) return NextResponse.json({ artifacts: [] })

  const data = await res.json()
  return NextResponse.json(data)
}
