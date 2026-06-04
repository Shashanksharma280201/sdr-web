import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    const res = await fetch(`${SWARM_BASE}/api/artifacts/${artifactId}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    return NextResponse.json({ artifact: json.result })
  } catch (err) {
    console.error('Artifact fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch artifact' }, { status: 500 })
  }
}
