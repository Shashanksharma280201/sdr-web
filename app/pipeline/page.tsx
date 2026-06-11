'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Play, RotateCcw, Key, Settings } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StageKey = 'lead_researcher' | 'lead_scorer' | 'deep_researcher' | 'outreach_designer' | 'email_composer' | 'email_sender'
type StageStatus = 'idle' | 'running' | 'completed' | 'failed'

interface StageState {
  status:    StageStatus
  taskId:    string | null
  artifact:  Record<string, unknown> | null
  startedAt: string | null
  error:     string | null
}

interface RunConfig {
  dryRun:          boolean
  clayApiKey:      string
  maxLeads:        number
  scoringThreshold: number
}

const STAGE_META: { key: StageKey; label: string; artifact: string; description: string; needsClay: boolean }[] = [
  { key: 'lead_researcher',   label: 'Lead Research',       artifact: 'leads_raw',         description: 'Finds companies matching your ICP profile',                       needsClay: true  },
  { key: 'lead_scorer',       label: 'Lead Scoring',        artifact: 'scored_leads',      description: 'Scores each lead against your rubric and ICP criteria',           needsClay: false },
  { key: 'deep_researcher',   label: 'Deep Research',       artifact: 'enriched_leads',    description: 'Enriches qualified leads with news, decision maker, and hooks',   needsClay: true  },
  { key: 'outreach_designer', label: 'Outreach Design',     artifact: 'outreach_strategy', description: 'Designs your outreach sequence, tone, CTAs, and personalisation', needsClay: false },
  { key: 'email_composer',    label: 'Email Drafting',      artifact: 'email_drafts',      description: 'Writes personalised cold emails guided by the outreach strategy',  needsClay: false },
  { key: 'email_sender',      label: 'Save Drafts',         artifact: 'emails_saved',      description: 'Saves email drafts to the database — no emails sent automatically', needsClay: false },
]

const STAGE_ORDER: StageKey[] = STAGE_META.map(s => s.key)

const EMPTY_STAGE: StageState = { status: 'idle', taskId: null, artifact: null, startedAt: null, error: null }

const LS_KEY = 'sdr_pipeline_v2'

function initialStages(): Record<StageKey, StageState> {
  return Object.fromEntries(STAGE_META.map(s => [s.key, { ...EMPTY_STAGE }])) as Record<StageKey, StageState>
}

function loadLS(): { stages: Record<StageKey, StageState>; config: RunConfig } | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') } catch { return null }
}

function saveLS(stages: Record<StageKey, StageState>, config: RunConfig) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ stages, config })) } catch {}
}

// ─── Stage summary helpers ────────────────────────────────────────────────────

function stageSummary(key: StageKey, art: Record<string, unknown> | null): string {
  if (!art) return ''
  try {
    if (key === 'lead_researcher') {
      const n = (art.leads as unknown[])?.length ?? art.total_found ?? 0
      return `${n} leads found`
    }
    if (key === 'lead_scorer') {
      const q = art.qualified_count ?? 0
      const t = art.total_scored ?? 0
      return `${q}/${t} qualified`
    }
    if (key === 'deep_researcher') {
      const n = art.total_enriched ?? (art.enriched_leads as unknown[])?.length ?? 0
      return `${n} leads enriched`
    }
    if (key === 'outreach_designer') {
      const touches = (art.sequence as Record<string, unknown>)?.total_touches ?? '?'
      return `${touches}-touch sequence`
    }
    if (key === 'email_composer') {
      const n = art.total_drafted ?? (art.drafts as unknown[])?.length ?? 0
      return `${n} emails drafted`
    }
    if (key === 'email_sender') {
      const n = art.saved_count ?? 0
      return `${n} drafts saved`
    }
  } catch {}
  return ''
}

// ─── Artifact preview ─────────────────────────────────────────────────────────

function ArtifactPreview({ stageKey, data }: { stageKey: StageKey; data: Record<string, unknown> }) {
  if (stageKey === 'lead_researcher') {
    const leads = (data.leads as Array<Record<string, unknown>>) ?? []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {leads.slice(0, 8).map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', background: 'var(--paper-2)', borderRadius: 4, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 160 }}>{String(l.company_name ?? '—')}</span>
            <span style={{ color: 'var(--ink-4)', fontFamily: 'monospace', fontSize: 11 }}>{String(l.domain ?? '')}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 11 }}>{String(l.industry ?? '')} · {String(l.geography ?? '')}</span>
          </div>
        ))}
        {leads.length > 8 && <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '2px 10px' }}>+{leads.length - 8} more</div>}
      </div>
    )
  }

  if (stageKey === 'lead_scorer') {
    const leads = (data.scored_leads as Array<Record<string, unknown>>) ?? []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {leads.slice(0, 8).map((l, i) => {
          const passed = Boolean(l.passed_threshold)
          const score = Number(l.score ?? 0)
          const grade = String(l.grade ?? '?')
          const gradeColor = grade === 'A' ? 'var(--good)' : grade === 'B' ? 'var(--warn)' : 'var(--bad)'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', background: passed ? 'var(--good-soft)' : 'var(--paper-2)', borderRadius: 4, fontSize: 12, borderLeft: `3px solid ${passed ? 'var(--good)' : 'var(--line)'}` }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 160 }}>{String(l.company_name ?? '—')}</span>
              <span style={{ fontWeight: 700, color: gradeColor, fontSize: 11, padding: '1px 6px', background: 'white', borderRadius: 3, border: `1px solid ${gradeColor}` }}>{score} · {grade}</span>
              <span style={{ color: passed ? 'var(--good)' : 'var(--ink-4)', fontSize: 11 }}>{passed ? '✓ Qualified' : '✗ Below threshold'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(l.rationale ?? '')}</span>
            </div>
          )
        })}
        {leads.length > 8 && <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '2px 10px' }}>+{leads.length - 8} more</div>}
      </div>
    )
  }

  if (stageKey === 'deep_researcher') {
    const leads = (data.enriched_leads as Array<Record<string, unknown>>) ?? []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {leads.slice(0, 6).map((l, i) => {
          const dm = (l.decision_maker as Record<string, unknown>) ?? {}
          const hooks = (l.personalization_hooks as string[]) ?? []
          return (
            <div key={i} style={{ padding: '7px 10px', background: 'var(--paper-2)', borderRadius: 4, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{String(l.company_name ?? '—')}</span>
                {dm.name ? <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{String(dm.name)} · {String(dm.title ?? '')}</span> : null}
              </div>
              {hooks[0] && <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>↳ {String(hooks[0])}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  if (stageKey === 'outreach_designer') {
    const seq = (data.sequence as Record<string, unknown>) ?? {}
    const steps = (seq.steps as Array<Record<string, unknown>>) ?? []
    const tone = (data.tone_and_voice as Record<string, unknown>) ?? {}
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{steps.length}-touch sequence</span>
          {tone.overall_tone ? <span> · Tone: {String(tone.overall_tone)}</span> : null}
        </div>
        {steps.slice(0, 4).map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 10px', background: 'var(--paper-2)', borderRadius: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{String(s.channel ?? '—')}</span>
            <span style={{ color: 'var(--ink-4)' }}>{String(s.timing ?? '')}</span>
            <span style={{ color: 'var(--ink-3)', flex: 1 }}>{String(s.purpose ?? '')}</span>
          </div>
        ))}
      </div>
    )
  }

  if (stageKey === 'email_composer') {
    const drafts = (data.drafts as Array<Record<string, unknown>>) ?? []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drafts.slice(0, 4).map((d, i) => {
          const emails = (d.emails as Array<Record<string, unknown>>) ?? []
          const first = emails[0] ?? {}
          return (
            <div key={i} style={{ padding: '7px 10px', background: 'var(--paper-2)', borderRadius: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                {String(d.company_name ?? d.domain ?? `Lead ${i + 1}`)}
              </div>
              {first.subject ? <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>Subject: {String(first.subject)}</div> : null}
              {first.body ? <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4, maxHeight: 40, overflow: 'hidden' }}>{String(first.body).slice(0, 120)}…</div> : null}
            </div>
          )
        })}
        {drafts.length > 4 && <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '2px 10px' }}>+{drafts.length - 4} more</div>}
      </div>
    )
  }

  if (stageKey === 'email_sender') {
    return (
      <div style={{ fontSize: 13, color: 'var(--good)', padding: '8px 12px', background: 'var(--good-soft)', borderRadius: 6 }}>
        ✓ {String(data.saved_count ?? 0)} email drafts saved to database
      </div>
    )
  }

  return <pre style={{ fontSize: 11, color: 'var(--ink-3)', maxHeight: 120, overflow: 'auto' }}>{JSON.stringify(data, null, 2).slice(0, 600)}</pre>
}

// ─── Stage card ───────────────────────────────────────────────────────────────

function StageCard({
  meta, state, index, canRun, onRun, onRerun,
}: {
  meta: typeof STAGE_META[0]
  state: StageState
  index: number
  canRun: boolean
  onRun: () => void
  onRerun: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isRunning   = state.status === 'running'
  const isCompleted = state.status === 'completed'
  const isFailed    = state.status === 'failed'
  const isIdle      = state.status === 'idle'

  const borderColor = isCompleted ? 'var(--good)' : isRunning ? 'var(--accent)' : isFailed ? 'var(--bad)' : 'var(--line)'
  const summary = stageSummary(meta.key, state.artifact)

  return (
    <div style={{
      border: `1.5px solid ${borderColor}`,
      borderRadius: 8,
      background: isCompleted ? 'white' : isRunning ? '#f8f7ff' : 'var(--paper)',
      transition: 'border-color 0.2s, background 0.2s',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        {/* Step number / status icon */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isCompleted ? 'var(--good)' : isRunning ? 'var(--accent)' : isFailed ? 'var(--bad)' : 'var(--paper-2)',
          color: isCompleted || isRunning || isFailed ? 'white' : 'var(--ink-4)',
          fontSize: 12, fontWeight: 700,
        }}>
          {isRunning  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> :
           isCompleted ? <CheckCircle size={13} /> :
           isFailed    ? <AlertCircle size={13} /> :
           index + 1}
        </div>

        {/* Label + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{meta.label}</span>
            {meta.needsClay && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--info)', background: 'var(--info-soft)', padding: '1px 6px', borderRadius: 3 }}>Clay</span>
            )}
            {isCompleted && summary && (
              <span style={{ fontSize: 11, color: 'var(--good)', fontWeight: 500 }}>· {summary}</span>
            )}
            {isRunning && (
              <span style={{ fontSize: 11, color: 'var(--accent)' }}>Running…</span>
            )}
            {isFailed && state.error && (
              <span style={{ fontSize: 11, color: 'var(--bad)' }}>Failed: {state.error}</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>{meta.description}</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isCompleted && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--ink-3)', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Results
            </button>
          )}
          {isCompleted && (
            <button
              onClick={onRerun}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--ink-3)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
            >
              <RotateCcw size={11} /> Re-run
            </button>
          )}
          {(isIdle || isFailed) && (
            <button
              onClick={onRun}
              disabled={!canRun}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 600,
                color: canRun ? 'white' : 'var(--ink-4)',
                background: canRun ? 'var(--accent)' : 'var(--paper-2)',
                border: `1px solid ${canRun ? 'var(--accent)' : 'var(--line)'}`,
                borderRadius: 5, padding: '5px 14px', cursor: canRun ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              <Play size={11} /> Run
            </button>
          )}
          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', padding: '5px 12px' }}>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Running
            </div>
          )}
        </div>
      </div>

      {/* Expanded results */}
      {expanded && isCompleted && state.artifact && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--line)' }}>
          <div style={{ paddingTop: 12 }}>
            <ArtifactPreview stageKey={meta.key} data={state.artifact} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [stages, setStages] = useState<Record<StageKey, StageState>>(initialStages)
  const [config, setConfig] = useState<RunConfig>({ dryRun: true, clayApiKey: '', maxLeads: 10, scoringThreshold: 0.75 })
  const [showConfig, setShowConfig] = useState(false)
  const [companyName, setCompanyName] = useState('Flo Mobility')
  const pollRefs = useRef<Record<string, NodeJS.Timeout>>({})

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadLS()
    if (saved) {
      setStages(saved.stages)
      setConfig(saved.config)
    }
  }, [])

  // Load company name from profile-builder
  useEffect(() => {
    fetch('/api/tasks', { cache: 'no-store' })
      .then(r => r.json())
      .then(async d => {
        const tasks: Array<{ id: string; name: string; status: string; created_at: string }> = d.tasks ?? []
        const pb = tasks.filter(t => t.name === 'sdr:core:profile-builder' && t.status === 'completed')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        if (!pb) return
        const r = await fetch(`/api/sdr/pipeline/artifact?task_id=${pb.id}&artifact_name=profile_documents`)
        const { content } = await r.json() as { content: Record<string, unknown> | null }
        const name = (content?.company_profile as Record<string, unknown>)?.company_name
          ?? (content as Record<string, unknown>)?.company_name
        if (name) setCompanyName(String(name))
      })
      .catch(() => {})
  }, [])

  const updateStage = useCallback((key: StageKey, patch: Partial<StageState>) => {
    setStages(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } }
      saveLS(next, config)
      return next
    })
  }, [config])

  // Poll a running stage task until completion, then fetch artifact
  const pollStage = useCallback((key: StageKey, taskId: string, artifactName: string) => {
    const ref = setInterval(async () => {
      try {
        const r = await fetch(`/api/tasks`, { cache: 'no-store' })
        const d = await r.json() as { tasks: Array<{ id: string; name: string; status: string }> }
        const task = (d.tasks ?? []).find(t => t.id === taskId)
        if (!task) {
          clearInterval(ref)
          delete pollRefs.current[key]
          updateStage(key, { status: 'failed', error: 'Task not found (deleted or expired)' })
          return
        }

        const done = !['open', 'running', 'pending', 'in_progress'].includes(task.status)
        if (!done) return

        clearInterval(ref)
        delete pollRefs.current[key]

        if (task.status === 'completed' || task.status === 'open') {
          // Fetch the artifact
          const ar = await fetch(`/api/sdr/pipeline/artifact?task_id=${taskId}&artifact_name=${artifactName}`)
          const { content } = await ar.json() as { content: Record<string, unknown> | null }
          if (content) {
            updateStage(key, { status: 'completed', artifact: content })
          } else {
            updateStage(key, { status: 'failed', error: 'No artifact produced' })
          }
        } else {
          updateStage(key, { status: 'failed', error: `Task ${task.status}` })
        }
      } catch {}
    }, 4000)
    pollRefs.current[key] = ref
  }, [updateStage])

  // Re-attach polls for any stages that were running when page was left
  useEffect(() => {
    for (const meta of STAGE_META) {
      const s = stages[meta.key]
      if (s.status === 'running' && s.taskId) {
        pollStage(meta.key, s.taskId, meta.artifact)
      }
    }
    return () => { Object.values(pollRefs.current).forEach(clearInterval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runStage(key: StageKey) {
    const meta = STAGE_META.find(m => m.key === key)!
    updateStage(key, { status: 'running', error: null, startedAt: new Date().toISOString() })

    try {
      const body: Record<string, unknown> = {
        stage: key,
        dry_run:           !config.clayApiKey || config.dryRun,
        clay_api_key:      config.clayApiKey || undefined,
        max_leads:         config.maxLeads,
        scoring_threshold: config.scoringThreshold,
      }
      // Pass previous stage task IDs so the route can fetch prior outputs
      const idx = STAGE_ORDER.indexOf(key)
      if (idx >= 1) body.lead_researcher_task_id   = stages.lead_researcher.taskId   ?? undefined
      if (idx >= 2) body.lead_scorer_task_id        = stages.lead_scorer.taskId       ?? undefined
      if (idx >= 3) body.deep_researcher_task_id    = stages.deep_researcher.taskId   ?? undefined
      if (idx >= 4) body.outreach_designer_task_id  = stages.outreach_designer.taskId ?? undefined
      if (idx >= 5) body.email_composer_task_id     = stages.email_composer.taskId    ?? undefined

      const res  = await fetch('/api/sdr/pipeline/stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json() as { taskId?: string; error?: string }

      if (!res.ok || data.error) {
        updateStage(key, { status: 'failed', error: data.error ?? 'Failed to start' })
        return
      }

      const taskId = data.taskId ?? null
      updateStage(key, { taskId })

      if (taskId) {
        pollStage(key, taskId, meta.artifact)
      } else {
        updateStage(key, { status: 'failed', error: 'No task ID returned' })
      }
    } catch (err) {
      updateStage(key, { status: 'failed', error: err instanceof Error ? err.message : 'Network error' })
    }
  }

  function rerunStage(key: StageKey) {
    // Clear this stage and all stages after it
    const idx = STAGE_ORDER.indexOf(key)
    setStages(prev => {
      const next = { ...prev }
      for (let i = idx; i < STAGE_ORDER.length; i++) {
        next[STAGE_ORDER[i]] = { ...EMPTY_STAGE }
      }
      saveLS(next, config)
      return next
    })
  }

  function resetAll() {
    const fresh = initialStages()
    setStages(fresh)
    saveLS(fresh, config)
  }

  function canRunStage(key: StageKey): boolean {
    const idx = STAGE_ORDER.indexOf(key)
    if (idx === 0) return true
    return stages[STAGE_ORDER[idx - 1]].status === 'completed'
  }

  const completedCount = STAGE_META.filter(m => stages[m.key].status === 'completed').length
  const runningCount   = STAGE_META.filter(m => stages[m.key].status === 'running').length
  const hasAny = completedCount > 0 || runningCount > 0

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 30, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1, margin: 0 }}>
              Lead Pipeline
            </h1>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              {companyName} · Run stages one by one · Review before proceeding
            </div>
          </div>

          {/* Progress */}
          {hasAny && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              {STAGE_META.map((m, i) => {
                const s = stages[m.key].status
                const bg = s === 'completed' ? 'var(--good)' : s === 'running' ? 'var(--accent)' : s === 'failed' ? 'var(--bad)' : 'var(--line)'
                return <div key={m.key} style={{ width: 28, height: 5, borderRadius: 3, background: bg, transition: 'background 0.3s' }} title={`${i+1}. ${m.label}: ${s}`} />
              })}
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)', marginLeft: 4 }}>{completedCount}/6 done</span>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasAny && (
              <button onClick={resetAll} style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 5, padding: '6px 12px', cursor: 'pointer' }}>
                New Run
              </button>
            )}
            <button
              onClick={() => setShowConfig(c => !c)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: showConfig ? 'var(--accent)' : 'var(--ink-3)', background: showConfig ? 'var(--accent-tint)' : 'var(--paper)', border: `1px solid ${showConfig ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 5, padding: '6px 12px', cursor: 'pointer' }}
            >
              <Settings size={12} /> Config
            </button>
          </div>
        </div>

        {/* Config panel */}
        {showConfig && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--paper-2)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Source</label>
              <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden' }}>
                {[
                  { val: true,  label: 'Synthetic (dry run)' },
                  { val: false, label: 'Clay API (real leads)' },
                ].map(opt => (
                  <button key={String(opt.val)} onClick={() => setConfig(c => ({ ...c, dryRun: opt.val }))}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: config.dryRun === opt.val ? 600 : 400, background: config.dryRun === opt.val ? 'var(--ink)' : 'var(--paper)', color: config.dryRun === opt.val ? 'white' : 'var(--ink-3)', cursor: 'pointer', borderRight: opt.val ? '1px solid var(--line)' : 'none' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clay API key */}
            {!config.dryRun && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Key size={10} /> Clay API Key
                </label>
                <input
                  type="password"
                  placeholder="clay_live_..."
                  value={config.clayApiKey}
                  onChange={e => setConfig(c => ({ ...c, clayApiKey: e.target.value }))}
                  style={{ width: 220, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 5, fontSize: 12, fontFamily: 'monospace', background: 'white' }}
                />
              </div>
            )}

            {/* Max leads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Max Leads</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={5} max={50} step={5} value={config.maxLeads}
                  onChange={e => setConfig(c => ({ ...c, maxLeads: Number(e.target.value) }))}
                  style={{ width: 100 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', minWidth: 24 }}>{config.maxLeads}</span>
              </div>
            </div>

            {/* Scoring threshold */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Threshold</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0.5} max={0.95} step={0.05} value={config.scoringThreshold}
                  onChange={e => setConfig(c => ({ ...c, scoringThreshold: Number(e.target.value) }))}
                  style={{ width: 100 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', minWidth: 36 }}>{Math.round(config.scoringThreshold * 100)}%</span>
              </div>
            </div>

            <button onClick={() => { saveLS(stages, config); setShowConfig(false) }}
              style={{ fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--accent)', border: 'none', borderRadius: 5, padding: '7px 16px', cursor: 'pointer' }}>
              Save
            </button>
          </div>
        )}
      </div>

      {/* Stage list */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 900 }}>
        {STAGE_META.map((meta, i) => (
          <StageCard
            key={meta.key}
            meta={meta}
            state={stages[meta.key]}
            index={i}
            canRun={canRunStage(meta.key)}
            onRun={() => runStage(meta.key)}
            onRerun={() => rerunStage(meta.key)}
          />
        ))}

        {/* CLI hint */}
        <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'monospace', lineHeight: 1.7 }}>
          CLI: <span style={{ color: 'var(--ink-2)' }}>swarm38 task run --flow-id sdr:core:pipeline-stage --registry ./swarm-registry/swarm-registry --input-json {'\'{"stage":"lead_researcher",...}\''}</span>
        </div>
      </div>
    </div>
  )
}
