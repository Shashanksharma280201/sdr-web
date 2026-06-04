import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const qs = searchParams.toString()
    const res = await fetch(`${SWARM_BASE}/api/execution-sessions${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    const sessions = json.result?.sessions ?? []
    return NextResponse.json({ sessions })
  } catch (err) {
    console.error('Execution sessions fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch execution sessions', sessions: [] }, { status: 500 })
  }
}
