import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    const [taskRes, phasesRes, artifactsRes] = await Promise.all([
      fetch(`${SWARM_BASE}/api/tasks/${taskId}`, { cache: 'no-store' }),
      fetch(`${SWARM_BASE}/api/tasks/${taskId}/phases`, { cache: 'no-store' }),
      fetch(`${SWARM_BASE}/api/artifacts?task_id=${taskId}`, { cache: 'no-store' }),
    ])

    const taskJson = await taskRes.json()
    const phasesJson = await phasesRes.json()
    const artifactsJson = await artifactsRes.json()

    return NextResponse.json({
      task: taskJson.result,
      phases: Array.isArray(phasesJson.result) ? phasesJson.result : [],
      artifacts: artifactsJson.result?.artifacts || [],
    })
  } catch (err) {
    console.error('Task detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}
