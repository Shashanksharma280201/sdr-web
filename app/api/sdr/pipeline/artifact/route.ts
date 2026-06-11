import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = process.env.SWARM_API_URL ?? 'http://localhost:8080'

function parse(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try { return JSON.parse(raw.replace(/^\s*\d+\s*\|\s?/gm, '')) } catch { return null }
}

// GET /api/sdr/pipeline/artifact?task_id=xxx&artifact_name=leads_raw
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const taskId       = searchParams.get('task_id')
  const artifactName = searchParams.get('artifact_name')

  if (!taskId || !artifactName) {
    return NextResponse.json({ error: 'task_id and artifact_name are required' }, { status: 400 })
  }

  try {
    const r = await fetch(`${SWARM_BASE}/api/artifacts?task_id=${taskId}`, { cache: 'no-store' })
    const d = await r.json()
    const all: Array<{ id: string; entry_name: string; created_at: string; status: string }> =
      d.result?.artifacts ?? d.artifacts ?? []

    // Most recent match (overwrites on re-run)
    const match = all
      .filter(a => a.entry_name === artifactName && a.status === 'active')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (!match) return NextResponse.json({ content: null })

    const ar = await fetch(`${SWARM_BASE}/api/artifacts/${match.id}`, { cache: 'no-store' })
    const ad = await ar.json()
    const raw: string = ad.result?.content ?? ad.artifact?.content ?? ''
    const content = parse(raw)

    return NextResponse.json({ content, artifactId: match.id, createdAt: match.created_at })
  } catch (err) {
    console.error('[sdr/pipeline/artifact]', err)
    return NextResponse.json({ error: 'Failed to fetch artifact', content: null }, { status: 500 })
  }
}
