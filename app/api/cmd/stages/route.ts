import { NextRequest, NextResponse } from 'next/server'

const SWARM_API = process.env.SWARM_API_URL ?? 'http://localhost:8080'

export interface StageRecord {
  id: string
  stage_id: string
  label: string
  motion: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string
  completed_at?: string
  duration_ms?: number
}

const STAGE_MAP: Record<string, { label: string; motion: string; order: number }> = {
  inspiration_researcher: { label: 'Inspiration Researcher', motion: 'M0', order: 0 },
  idea_generator:         { label: 'Idea Generator',         motion: 'M1', order: 1 },
  idea_scorer:            { label: 'Idea Scorer',            motion: 'M1', order: 2 },
  concept_builder:        { label: 'Concept Builder',        motion: 'M2', order: 3 },
  structure_builder:      { label: 'Structure Builder',      motion: 'M2', order: 4 },
  content_reviewer:       { label: 'Content Reviewer',       motion: 'M2', order: 5 },
  content_researcher:     { label: 'Content Researcher',     motion: 'M3', order: 6 },
  draft_writer:           { label: 'Draft Writer',           motion: 'M3', order: 7 },
  humanizer:              { label: 'Humanizer',              motion: 'M3', order: 8 },
  draft_editor:           { label: 'Draft Editor',           motion: 'M3', order: 9 },
  publisher:              { label: 'Publisher',              motion: 'M4', order: 10 },
  tracker:                { label: 'Tracker',                motion: 'M4', order: 11 },
  feedback_synthesizer:   { label: 'Feedback Synthesizer',  motion: 'M4', order: 12 },
  manual_reviewer:        { label: 'Manual Reviewer',        motion: 'M4', order: 13 },
}

export async function GET(req: NextRequest) {
  const task_id = req.nextUrl.searchParams.get('task_id')
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const res = await fetch(`${SWARM_API}/api/execution-sessions?task_id=${task_id}`)
  if (!res.ok) return NextResponse.json({ stages: buildIdleStages() })

  const { result } = await res.json() as { result: { sessions: Array<{ id: string; workflow: string; status: string; started_at: string; completed_at: string }> } }
  const sessions = result?.sessions ?? []

  // Filter to stage-level sessions only (workflow = "stage:*")
  const stageSessions = sessions.filter(s => s.workflow?.startsWith('stage:'))

  const stageMap = new Map<string, typeof stageSessions[0]>()
  for (const s of stageSessions) {
    const stageId = s.workflow.replace('stage:', '')
    // Keep the most recent if duplicate
    if (!stageMap.has(stageId) || new Date(s.started_at) > new Date(stageMap.get(stageId)!.started_at)) {
      stageMap.set(stageId, s)
    }
  }

  const stages: StageRecord[] = Object.entries(STAGE_MAP)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([stageId, meta]) => {
      const session = stageMap.get(stageId)
      if (!session) {
        return { id: stageId, stage_id: stageId, label: meta.label, motion: meta.motion, status: 'idle' as const }
      }
      const status = session.status === 'completed' ? 'completed'
        : ['open', 'running', 'active', 'in_progress'].includes(session.status) ? 'running'
        : session.status === 'failed' || session.status === 'crashed' ? 'failed'
        : 'idle'
      const duration_ms = session.started_at && session.completed_at
        ? new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()
        : undefined
      return {
        id: session.id,
        stage_id: stageId,
        label: meta.label,
        motion: meta.motion,
        status,
        started_at:   session.started_at   ?? undefined,
        completed_at: session.completed_at ?? undefined,
        duration_ms,
      } as StageRecord
    })

  return NextResponse.json({ stages })
}

function buildIdleStages(): StageRecord[] {
  return Object.entries(STAGE_MAP)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([stageId, meta]) => ({
      id: stageId, stage_id: stageId, label: meta.label, motion: meta.motion, status: 'idle' as const,
    }))
}
