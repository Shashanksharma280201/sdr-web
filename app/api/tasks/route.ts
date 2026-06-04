import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const qs = searchParams.toString()
    const res = await fetch(`${SWARM_BASE}/api/tasks${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    // result is a list directly when output_format=json, or {tasks, total} shape
    const raw = json.result
    const tasks = Array.isArray(raw) ? raw : (raw?.tasks ?? [])
    return NextResponse.json({ tasks })
  } catch (err) {
    console.error('Tasks fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch tasks', tasks: [] }, { status: 500 })
  }
}
