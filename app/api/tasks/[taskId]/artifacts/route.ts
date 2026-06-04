import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const res = await fetch(`${SWARM_BASE}/api/artifacts?task_id=${taskId}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    const artifacts = json.result?.artifacts || []
    return NextResponse.json({ artifacts })
  } catch (err) {
    console.error('Artifacts fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch artifacts', artifacts: [] }, { status: 500 })
  }
}
