import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const res = await fetch(
      `${SWARM_BASE}/api/execution-sessions?task_id=${taskId}`,
      { cache: 'no-store' }
    )
    // Older tasks can trigger a 500 from a pydantic validation bug in SwarmStudio
    // (execution_type='swarm' is no longer a valid enum value). Return empty phases
    // rather than propagating the error so the console doesn't spam retries.
    if (!res.ok) return NextResponse.json({ phases: [] })
    const json = await res.json()
    const sessions = json.result?.sessions ?? []

    // Map to the shape the console page expects
    const phases = sessions.map((s: {
      id: string
      task_id: string
      flow_session_id: string
      kind: string
      name: string
      status: string
      workflow?: string
      sequence_num?: number
      started_at?: string
      completed_at?: string
      total_tokens?: number
    }) => ({
      ...s,
      phase_num: s.sequence_num ?? 0,
    }))

    return NextResponse.json({ phases })
  } catch (err) {
    console.error('Phases fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch phases', phases: [] }, { status: 500 })
  }
}
