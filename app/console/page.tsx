'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronRight, ChevronDown, X, CheckCircle, AlertCircle,
  Clock, Loader2, Activity, List, RefreshCw, Zap
} from 'lucide-react'

interface Task {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  workspace_id?: string
}

interface Phase {
  id: string
  task_id: string
  name: string
  status: string
  phase_num: number
  started_at?: string
  completed_at?: string
  stage_result?: unknown
  stage_input?: unknown
  workflow?: string
}

const ACTIVE_STATUSES = new Set(['open', 'running', 'active', 'in_progress', 'pending'])

function isActive(status: string) { return ACTIVE_STATUSES.has(status) }

function statusLabel(s: string) {
  if (s === 'open') return 'running'
  return s
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function elapsed(started?: string, completed?: string): string {
  if (!started) return '—'
  const ms = (completed ? new Date(completed) : new Date()).getTime() - new Date(started).getTime()
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

// ---------------------------------------------------------------------------
// StatusPill
// ---------------------------------------------------------------------------
function StatusPill({ status, small }: { status: string; small?: boolean }) {
  const label = statusLabel(status)
  const cfg: Record<string, { bg: string; color: string }> = {
    running:   { bg: 'var(--info-soft)',   color: 'var(--info)'  },
    active:    { bg: 'var(--info-soft)',   color: 'var(--info)'  },
    open:      { bg: 'var(--info-soft)',   color: 'var(--info)'  },
    in_progress:{ bg: 'var(--info-soft)',  color: 'var(--info)'  },
    completed: { bg: 'var(--good-soft)',   color: 'var(--good)'  },
    failed:    { bg: '#fce8e8',            color: '#c0392b'       },
    crashed:   { bg: '#fce8e8',            color: '#c0392b'       },
    cancelled: { bg: 'var(--paper-3)',     color: 'var(--ink-3)' },
    blocked:   { bg: 'var(--warn-soft)',   color: 'var(--warn)'  },
    draft:     { bg: 'var(--paper-3)',     color: 'var(--ink-4)' },
    pending:   { bg: 'var(--paper-3)',     color: 'var(--ink-4)' },
  }
  const c = cfg[status] || cfg.pending

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: c.bg, color: c.color,
      borderRadius: '20px',
      padding: small ? '1px 7px' : '2px 9px',
      fontSize: small ? '10px' : '11px',
      fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {isActive(status) ? (
        <span style={{ width: '5px', height: '5px', background: c.color, borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
      ) : status === 'completed' ? (
        <CheckCircle size={9} />
      ) : (status === 'failed' || status === 'crashed') ? (
        <AlertCircle size={9} />
      ) : null}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Phase drawer
// ---------------------------------------------------------------------------
function PhaseDrawer({ phase, onClose }: { phase: Phase; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const running = isActive(phase.status)

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: '560px', height: '100vh',
      background: 'var(--paper)',
      borderLeft: '1px solid var(--line)',
      boxShadow: '-4px 0 24px rgba(26,24,20,0.12)',
      zIndex: 100,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: '12px',
        background: 'var(--paper-2)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px', fontFamily: "'JetBrains Mono', monospace" }}>
            {phase.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{phase.id}</div>
        </div>
        <StatusPill status={phase.status} />
        <button onClick={onClose} style={{ padding: '4px', color: 'var(--ink-3)', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Status', value: <StatusPill status={phase.status} small /> },
            { label: 'Started', value: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{phase.started_at ? formatDate(phase.started_at) : '—'}</span> },
            { label: 'Duration', value: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{elapsed(phase.started_at, phase.completed_at)}</span> },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--paper-2)', borderRadius: '6px', padding: '10px 12px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '11px' }}>{value}</div>
            </div>
          ))}
        </div>

        {running && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--info-soft)', border: '1px solid var(--info)',
            borderRadius: '6px', padding: '10px 14px', marginBottom: '20px',
          }}>
            <Loader2 size={14} color="var(--info)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: 'var(--info)' }}>Stage is currently executing…</span>
          </div>
        )}

        {Boolean(phase.stage_result) && (
          <div>
            <button onClick={() => setExpanded(!expanded)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', background: 'var(--paper-2)',
              border: '1px solid var(--line)', borderRadius: expanded ? '6px 6px 0 0' : '6px',
              fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer',
            }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              stage_result JSON
            </button>
            {expanded && (
              <pre style={{
                background: 'var(--ink)', color: 'var(--paper-2)',
                borderRadius: '0 0 6px 6px', padding: '14px',
                fontSize: '11px', overflowX: 'auto',
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.6, maxHeight: '400px', overflowY: 'auto',
              }}>
                {JSON.stringify(phase.stage_result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------
function TaskRow({
  task,
  autoExpand,
  onPhaseSelect,
}: {
  task: Task
  autoExpand: boolean
  onPhaseSelect: (p: Phase) => void
}) {
  const [expanded, setExpanded] = useState(autoExpand)
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPhases = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/phases`, { cache: 'no-store' })
      const data = await res.json()
      setPhases(data.phases || [])
    } catch {}
  }, [task.id])

  // initial load + auto-refresh for active tasks
  useEffect(() => {
    if (expanded) {
      setLoading(true)
      fetchPhases().then(() => setLoading(false))
    }
  }, [expanded, fetchPhases])

  useEffect(() => {
    if (!expanded || !isActive(task.status)) return
    const id = setInterval(fetchPhases, 3000)
    return () => clearInterval(id)
  }, [expanded, task.status, fetchPhases])

  // also auto-expand when task becomes active
  useEffect(() => {
    if (autoExpand && !expanded) setExpanded(true)
  }, [autoExpand, expanded])

  const completedPhases = phases.filter(p => p.status === 'completed').length
  const isRunning = isActive(task.status)

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{
          cursor: 'pointer',
          background: expanded ? 'var(--paper-2)' : 'transparent',
          borderLeft: isRunning ? '3px solid var(--info)' : '3px solid transparent',
          transition: 'background 0.1s',
        }}
      >
        <td style={{ padding: '8px 10px', width: '28px' }}>
          {expanded ? <ChevronDown size={12} color="var(--ink-3)" /> : <ChevronRight size={12} color="var(--ink-3)" />}
        </td>
        <td style={{ padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
          {task.id}
        </td>
        <td style={{ padding: '8px 10px', fontSize: '12.5px', color: 'var(--ink)', fontWeight: 500 }}>
          {task.name || 'Unnamed'}
        </td>
        <td style={{ padding: '8px 10px' }}>
          <StatusPill status={task.status} />
        </td>
        <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
          {phases.length > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {isRunning && <Loader2 size={10} color="var(--info)" style={{ animation: 'spin 1s linear infinite' }} />}
              {completedPhases}/{phases.length}
            </span>
          ) : '—'}
        </td>
        <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
          {elapsed(task.created_at, isRunning ? undefined : task.updated_at)}
        </td>
        <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
          {formatDate(task.created_at)}
        </td>
      </tr>

      {expanded && (
        <>
          {loading && (
            <tr>
              <td colSpan={7} style={{ padding: '8px 48px', background: 'var(--paper-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink-4)', fontSize: '12px' }}>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Loading stages…
                </div>
              </td>
            </tr>
          )}
          {phases.map((phase) => {
            const phRunning = isActive(phase.status)
            return (
              <tr
                key={phase.id}
                onClick={(e) => { e.stopPropagation(); onPhaseSelect(phase) }}
                style={{ background: 'var(--paper-2)', cursor: 'pointer' }}
              >
                <td style={{ padding: '6px 10px', paddingLeft: '28px', color: 'var(--line-2)', fontSize: '14px' }}>└</td>
                <td style={{ padding: '6px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ink-4)' }}>
                  {phase.id}
                </td>
                <td style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: 'var(--ink-2)' }}>
                  {phRunning && <Loader2 size={11} color="var(--info)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                  {phase.name}
                </td>
                <td style={{ padding: '6px 10px' }}><StatusPill status={phase.status} small /></td>
                <td style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--ink-4)' }}>Stage {phase.phase_num}</td>
                <td style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {elapsed(phase.started_at, phase.completed_at)}
                </td>
                <td style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--ink-4)' }}>
                  {phase.started_at ? formatDate(phase.started_at) : '—'}
                </td>
              </tr>
            )
          })}
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Live pipeline monitor
// ---------------------------------------------------------------------------
const SALES_STAGES = [
  { key: 'lead_researcher',   label: 'Lead Researcher',       desc: 'Find companies matching ICP' },
  { key: 'lead_scorer',       label: 'Lead Scorer',           desc: 'Score leads vs. rubric' },
  { key: 'deep_researcher',   label: 'Deep Researcher',       desc: 'Enrich qualified leads' },
  { key: 'outreach_designer', label: 'Outreach Designer',     desc: 'Design outreach strategy' },
  { key: 'email_composer',    label: 'Email Composer',        desc: 'Draft personalised emails' },
  { key: 'email_sender',      label: 'Email Sender',          desc: 'Save drafts to DB' },
]

const PROFILE_BUILDER_STAGES = [
  { key: 'company_profiler',       label: 'Company Profiler',       desc: 'Extract product details, features, differentiators' },
  { key: 'icp_builder',            label: 'ICP Builder',            desc: 'Define ideal customer profile' },
  { key: 'competition_researcher', label: 'Competition Researcher', desc: 'Map competitive landscape' },
  { key: 'scoring_rubric_builder', label: 'Scoring Rubric Builder', desc: 'Build lead scoring framework' },
  { key: 'profile_writer',         label: 'Profile Writer',         desc: 'Synthesise final ICP, Persona, and Company Profile' },
]

const PROFILE_BUILDER_WEB_STAGES = [
  { key: 'intake_conversation',    label: 'Intake Conversation',    desc: 'Clay research + guided chat to gather context' },
  { key: 'company_profiler',       label: 'Company Profiler',       desc: 'Build structured company profile from context' },
  { key: 'icp_builder',            label: 'ICP Builder',            desc: 'Define ideal customer profile' },
  { key: 'competition_researcher', label: 'Competition Researcher', desc: 'Map competitive landscape using Clay' },
  { key: 'scoring_rubric_builder', label: 'Scoring Rubric Builder', desc: 'Build lead scoring framework' },
  { key: 'profile_writer',         label: 'Profile Writer',         desc: 'Synthesise final ICP, Persona, and Company Profile' },
]

function stagesForTask(taskName: string) {
  if (taskName === 'sdr:core:profile-builder-web') return PROFILE_BUILDER_WEB_STAGES
  if (taskName === 'sdr:core:profile-builder') return PROFILE_BUILDER_STAGES
  return SALES_STAGES
}

function stageSummary(key: string, phase?: Phase): string | null {
  if (!phase || phase.status !== 'completed' || !phase.stage_result) return null
  const r = phase.stage_result as Record<string, unknown>
  switch (key) {
    case 'intake_conversation': {
      const company = (r?.context_gathered as Record<string, string>)?.company_name
      return company ? `${company} — context gathered` : '✓ Intake complete'
    }
    case 'company_profiler': {
      const name = (r?.company_raw as Record<string, string>)?.company_name || (r as Record<string, string>)?.company_name
      return name ? `${name}` : '✓ Company profile extracted'
    }
    case 'icp_builder': {
      const triggers = (r?.company_criteria as Record<string, string[]>)?.buying_triggers
      if (Array.isArray(triggers) && triggers.length > 0) return `${triggers.length} buying triggers · ICP defined`
      return '✓ ICP criteria defined'
    }
    case 'competition_researcher': {
      const comps = (r as Record<string, unknown[]>)?.competitors
      if (Array.isArray(comps)) return `${comps.length} competitors mapped`
      return '✓ Competition researched'
    }
    case 'scoring_rubric_builder': {
      const dims = (r as Record<string, unknown[]>)?.dimensions
      if (Array.isArray(dims)) return `${dims.length} scoring dimensions`
      return '✓ Scoring rubric built'
    }
    case 'profile_writer': return '✓ ICP Profile · Buyer Persona · Company Profile'
    case 'lead_researcher': {
      const found = (r as Record<string, number>)?.total_found
      return found !== undefined ? `${found} leads found` : '✓ Leads researched'
    }
    case 'lead_scorer': {
      const qualified = (r as Record<string, number>)?.qualified_count
      const total = (r as Record<string, number>)?.total_scored
      if (qualified !== undefined && total !== undefined) return `${qualified} of ${total} qualified`
      return '✓ Leads scored'
    }
    case 'deep_researcher': {
      const enriched = (r as Record<string, number>)?.total_enriched
      return enriched !== undefined ? `${enriched} leads enriched` : '✓ Deep research done'
    }
    case 'outreach_designer': return '✓ Outreach strategy designed'
    case 'email_composer': {
      const drafted = (r as Record<string, number>)?.total_drafted
      return drafted !== undefined ? `${drafted} email drafts` : '✓ Emails drafted'
    }
    case 'email_sender': {
      const saved = (r as Record<string, number>)?.saved_count
      return saved !== undefined ? `${saved} drafts saved` : '✓ Drafts saved'
    }
    default: return '✓ Completed'
  }
}

function LiveMonitor({ activeTasks, onPhaseSelect }: { activeTasks: Task[]; onPhaseSelect: (p: Phase) => void }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [tick, setTick] = useState(0)

  // only track a task when it's actually running — don't fall back to completed tasks
  useEffect(() => {
    const running = activeTasks.filter(t => isActive(t.status))
    setActiveTask(running[0] || null)
  }, [activeTasks])

  // poll phases every 3s only while the task is running
  useEffect(() => {
    if (!activeTask || !isActive(activeTask.status)) return
    const id = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(id)
  }, [activeTask?.id, activeTask?.status])

  // fetch phases only for active tasks — never for completed/failed/etc.
  useEffect(() => {
    if (!activeTask || !isActive(activeTask.status)) return
    fetch(`/api/tasks/${activeTask.id}/phases`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setPhases(d.phases || []))
      .catch(() => {})
  }, [activeTask?.id, tick])

  if (!activeTask) {
    return (
      <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          background: 'var(--paper-2)', border: '1px solid var(--line)',
          borderRadius: '8px', padding: '32px', textAlign: 'center', maxWidth: '360px',
        }}>
          <Activity size={24} color="var(--ink-4)" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '4px' }}>No active tasks</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-4)' }}>
            Run the sales pipeline from Profile Builder to see live stage updates here.
          </div>
        </div>
      </div>
    )
  }

  const phaseMap = new Map(phases.map(p => [p.name, p]))
  const taskRunning = isActive(activeTask.status)
  const stages = stagesForTask(activeTask.name)

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
            {activeTask.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>
            {activeTask.id} · started {formatDate(activeTask.created_at)}
          </div>
        </div>
        <StatusPill status={activeTask.status} />
        {taskRunning && (
          <div style={{ fontSize: '11px', color: 'var(--ink-4)' }}>
            ⏱ {elapsed(activeTask.created_at)}
          </div>
        )}
      </div>

      {/* Stage pipeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {stages.map((stage, idx) => {
          const phase = phaseMap.get(stage.key)
          const status = phase?.status || 'pending'
          const isRunningNow = isActive(status)
          const isDone = status === 'completed'
          const isFailed = status === 'failed' || status === 'crashed'

          const dotColor = isDone ? 'var(--good)'
            : isRunningNow ? 'var(--info)'
            : isFailed ? '#c0392b'
            : 'var(--line-2)'

          const bgColor = isRunningNow
            ? 'linear-gradient(135deg, var(--info-soft) 0%, var(--paper) 100%)'
            : isDone ? 'var(--good-soft)'
            : 'var(--paper-2)'

          const borderColor = isRunningNow ? 'var(--info)'
            : isDone ? 'var(--good)'
            : 'var(--line)'

          return (
            <div key={stage.key} style={{ display: 'flex', gap: '0', position: 'relative' }}>
              {/* Connector line */}
              {idx < stages.length - 1 && (
                <div style={{
                  position: 'absolute', left: '20px', top: '42px',
                  width: '2px', height: '16px',
                  background: isDone ? 'var(--good)' : 'var(--line)',
                  zIndex: 0,
                }} />
              )}

              <div
                onClick={() => phase && isDone ? onPhaseSelect(phase) : undefined}
                style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: '12px',
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                padding: '10px 16px',
                margin: idx < stages.length - 1 ? '0 0 8px 0' : '0',
                transition: 'background 0.3s, border-color 0.3s',
                position: 'relative', zIndex: 1,
                cursor: isDone && phase ? 'pointer' : 'default',
              }}>
                {/* Status dot */}
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: dotColor, border: `2px solid ${dotColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isDone && <CheckCircle size={10} color="white" strokeWidth={2.5} />}
                  {isRunningNow && (
                    <span style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                      {stage.label}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>
                      stage {idx + 1}/{stages.length}
                    </span>
                    {isRunningNow && (
                      <span style={{ fontSize: '11px', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                        running
                      </span>
                    )}
                  </div>
                  {isDone && stageSummary(stage.key, phase) ? (
                    <div style={{ fontSize: '11.5px', color: 'var(--good)', marginTop: '2px', fontWeight: 500 }}>
                      {stageSummary(stage.key, phase)}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '2px' }}>
                      {stage.desc}
                    </div>
                  )}
                </div>

                {/* Duration / status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {phase && (
                    <>
                      <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '3px' }}>
                        {elapsed(phase.started_at, phase.completed_at)}
                      </div>
                      <StatusPill status={phase.status} small />
                      {isDone && (
                        <div style={{ fontSize: '10px', color: 'var(--good)', marginTop: '4px', opacity: 0.8 }}>
                          View details →
                        </div>
                      )}
                    </>
                  )}
                  {!phase && (
                    <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>queued</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary bar + Next step CTA when complete */}
      {!taskRunning && phases.length > 0 && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: activeTask.status === 'completed' ? 'var(--good-soft)' : 'var(--paper-3)',
            border: `1px solid ${activeTask.status === 'completed' ? 'var(--good)' : 'var(--line)'}`,
            borderRadius: '6px', padding: '10px 16px',
          }}>
            {activeTask.status === 'completed' ? (
              <CheckCircle size={14} color="var(--good)" />
            ) : (
              <AlertCircle size={14} color="var(--ink-3)" />
            )}
            <span style={{ fontSize: '12.5px', color: 'var(--ink-2)', fontWeight: 500 }}>
              {activeTask.status === 'completed'
                ? `Complete · ${phases.length} stages · ${elapsed(activeTask.created_at, activeTask.updated_at)}`
                : `${activeTask.status}`}
            </span>
          </div>

          {activeTask.status === 'completed' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px',
              background: 'var(--paper-2)', border: '1px solid var(--line)',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-3)', flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>What&apos;s next?</span>
                {(activeTask.name === 'sdr:core:profile-builder' || activeTask.name === 'sdr:core:profile-builder-web')
                  ? ' Your ICP and scoring rubric are ready. Go run prospecting to find leads.'
                  : ' Your leads, enrichment and email drafts are ready to review.'}
              </div>
              {(activeTask.name === 'sdr:core:profile-builder' || activeTask.name === 'sdr:core:profile-builder-web') ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href="/pipeline" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', fontSize: '12.5px', fontWeight: 600,
                    background: 'var(--accent)', color: 'white',
                    borderRadius: '6px', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Run Prospecting →
                  </a>
                  <a href="/strategy" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', fontSize: '12.5px', fontWeight: 500,
                    background: 'var(--paper)', color: 'var(--ink-2)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    View Strategy →
                  </a>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href="/prospect" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', fontSize: '12.5px', fontWeight: 600,
                    background: 'var(--accent)', color: 'white',
                    borderRadius: '6px', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    View Leads →
                  </a>
                  <a href="/pipeline" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', fontSize: '12.5px', fontWeight: 500,
                    background: 'var(--paper)', color: 'var(--ink-2)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Pipeline Kanban
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ConsolePage() {
  const [tab, setTab] = useState<'runs' | 'monitor'>('monitor')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null)
  const hasActiveTasks = useRef(false)

  const fetchTasks = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      const data = await res.json()
      setTasks(data.tasks || [])
      hasActiveTasks.current = (data.tasks || []).some((t: Task) => isActive(t.status))
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // always poll — catches tasks started from other pages
  useEffect(() => {
    const id = setInterval(() => fetchTasks(true), 3000)
    return () => clearInterval(id)
  }, [fetchTasks])

  // non-cancelled tasks sorted newest first
  const visibleTasks = tasks
    .filter(t => t.status !== 'cancelled')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const activeTasks = visibleTasks.filter(t => isActive(t.status))

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 32px 0',
        borderBottom: '1px solid var(--line)',
        background: 'var(--paper-2)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Task Console</h1>
            {activeTasks.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: 'var(--info-soft)', color: 'var(--info)',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '11px', fontWeight: 600,
              }}>
                <span style={{ width: '5px', height: '5px', background: 'var(--info)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                {activeTasks.length} running
              </span>
            )}
          </div>
          <button
            onClick={() => fetchTasks(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', fontSize: '12px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              borderRadius: '6px', color: 'var(--ink-2)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0' }}>
          {([
            { key: 'monitor', label: 'Live Monitor', icon: <Zap size={13} /> },
            { key: 'runs',    label: 'All Runs',     icon: <List size={13} /> },
          ] as const).map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', fontSize: '12.5px',
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: tab === key ? '2px solid var(--ink)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', transition: 'color 0.1s',
            }}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'monitor' && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '8px', color: 'var(--ink-3)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Loading…
            </div>
          ) : (
            <LiveMonitor activeTasks={activeTasks} onPhaseSelect={setSelectedPhase} />
          )
        )}

        {tab === 'runs' && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '8px', color: 'var(--ink-3)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Loading tasks…
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                  <th style={{ padding: '8px 10px', width: '28px' }} />
                  {['Task ID', 'Flow', 'Status', 'Stages', 'Duration', 'Started'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-4)' }}>No tasks found</td>
                  </tr>
                ) : (
                  visibleTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      autoExpand={isActive(task.status)}
                      onPhaseSelect={setSelectedPhase}
                    />
                  ))
                )}
              </tbody>
            </table>
          )
        )}
      </div>

      {selectedPhase && <PhaseDrawer phase={selectedPhase} onClose={() => setSelectedPhase(null)} />}
    </>
  )
}
