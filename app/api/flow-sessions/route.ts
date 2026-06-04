import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const qs = searchParams.toString()
    const res = await fetch(`${SWARM_BASE}/api/flow-sessions${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    const sessions = json.result?.sessions ?? []
    const total = json.result?.total ?? sessions.length
    return NextResponse.json({ sessions, total })
  } catch (err) {
    console.error('Flow sessions fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch flow sessions', sessions: [], total: 0 }, { status: 500 })
  }
}
