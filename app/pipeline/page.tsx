'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronRight, Loader2, AlertCircle, RefreshCw, Zap, Terminal, LayoutList, LayoutGrid, CheckCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoredLead {
  company_name: string
  domain: string
  score: number
  grade: string
  passed_threshold: boolean
  icp_match: {
    industry_match: boolean
    size_match: boolean
    stage_match: boolean
    geo_match: boolean
    trigger_signals: string[]
  }
  disqualifier_hit: string | null
  rationale: string
}

interface Lead {
  id: string
  company: string
  domain: string
  industry: string
  score: number
  grade: string
  badges: string[]
  column: string
  rationale: string
  passed_threshold: boolean
  icp_match: ScoredLead['icp_match']
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = new Set(['open', 'running', 'active', 'in_progress'])

function scoreToColumn(lead: ScoredLead): string {
  if (!lead.passed_threshold) return 'researched'
  if (lead.score >= 100) return 'shortlisted'
  if (lead.score >= 80) return 'scored'
  return 'researched'
}

function icpMatchBadges(lead: ScoredLead): string[] {
  const badges: string[] = []
  const signals = lead.icp_match?.trigger_signals ?? []
  if (signals.length > 0) badges.push(...signals.slice(0, 2))
  if (lead.icp_match?.geo_match) badges.push('Geo ✓')
  return badges.slice(0, 3)
}

function mapScoredLeads(rawLeads: ScoredLead[]): Lead[] {
  return rawLeads.map(l => ({
    id: l.domain,
    company: l.company_name,
    domain: l.domain,
    industry: `Grade ${l.grade}`,
    score: l.score,
    grade: l.grade,
    badges: icpMatchBadges(l),
    column: scoreToColumn(l),
    rationale: l.rationale ?? '',
    passed_threshold: l.passed_threshold,
    icp_match: l.icp_match,
  }))
}

function parseContent(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const cleaned = raw.replace(/^\s*\d+\s*\|\s?/gm, '')
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Static fallback leads shown when no pipeline has run
// ---------------------------------------------------------------------------
const EMPTY_ICP: ScoredLead['icp_match'] = { industry_match: false, size_match: false, stage_match: false, geo_match: false, trigger_signals: [] }

const STATIC_LEADS: Lead[] = [
  { id: 'lt-construction', company: 'L&T Construction', domain: 'larsentoubro.com', industry: 'EPC · General Contracting', score: 91, grade: 'A', badges: ['India', 'Existing customer'], column: 'scored', rationale: 'Tier 1 contractor with active large-scale infrastructure projects.', passed_threshold: true, icp_match: { industry_match: true, size_match: true, stage_match: true, geo_match: true, trigger_signals: ['India', 'Existing customer'] } },
  { id: 'godrej-properties', company: 'Godrej Properties', domain: 'godrejproperties.com', industry: 'Real Estate Development', score: 88, grade: 'A', badges: ['India'], column: 'scored', rationale: 'Large residential developer with ongoing construction sites.', passed_threshold: true, icp_match: { industry_match: true, size_match: true, stage_match: false, geo_match: true, trigger_signals: ['India'] } },
  { id: 'embassy-group', company: 'Embassy Group', domain: 'embassygroup.in', industry: 'Real Estate · Commercial', score: 94, grade: 'A', badges: ['India', 'Series B'], column: 'shortlisted', rationale: 'Commercial real estate developer expanding rapidly across India.', passed_threshold: true, icp_match: { industry_match: true, size_match: true, stage_match: true, geo_match: true, trigger_signals: ['India', 'Series B'] } },
  { id: 'damac-properties', company: 'DAMAC Properties', domain: 'damac.com', industry: 'Real Estate Development', score: 86, grade: 'A', badges: ['UAE', 'New VP Ops'], column: 'shortlisted', rationale: 'MENA developer with high-volume material handling requirements.', passed_threshold: true, icp_match: { industry_match: true, size_match: true, stage_match: false, geo_match: true, trigger_signals: ['UAE', 'New VP Ops'] } },
  { id: 'tata-projects', company: 'Tata Projects', domain: 'tata.com', industry: 'General Contracting', score: 62, grade: 'B', badges: ['India'], column: 'researched', rationale: 'General contractor but limited recent activity signals.', passed_threshold: false, icp_match: { industry_match: true, size_match: true, stage_match: false, geo_match: true, trigger_signals: [] } },
  { id: 'acc-limited', company: 'ACC Limited', domain: 'acclimited.com', industry: 'Building Materials', score: 45, grade: 'C', badges: ['India'], column: 'researched', rationale: 'Materials company — not a construction contractor.', passed_threshold: false, icp_match: { ...EMPTY_ICP, geo_match: true } },
]

const columns = [
  { key: 'researched', label: 'Researched' },
  { key: 'scored', label: 'Scored' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'sequencing', label: 'Sequencing' },
  { key: 'handoff', label: 'Handoff' },
]

// ---------------------------------------------------------------------------
// Score badge
// ---------------------------------------------------------------------------
function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  const isA = grade === 'A'
  const isB = grade === 'B'
  const bg = isA ? 'var(--good-soft)' : isB ? 'var(--warn-soft)' : 'var(--accent-soft)'
  const color = isA ? 'var(--good)' : isB ? 'var(--warn)' : 'var(--bad)'
  return (
    <span style={{
      fontSize: '10.5px', fontWeight: 600,
      background: bg, color,
      padding: '1px 6px', borderRadius: '3px',
      whiteSpace: 'nowrap',
    }}>
      {score} · {grade}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Kanban card
// ---------------------------------------------------------------------------
function KanbanCard({
  lead, selected, onToggle,
}: {
  lead: Lead
  selected: boolean
  onToggle: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? 'var(--accent-tint)' : 'white',
        border: `1px solid ${selected ? 'var(--accent)' : hovered ? 'var(--line-2)' : 'var(--line)'}`,
        borderRadius: '5px', padding: '10px 12px', cursor: 'pointer',
        transform: hovered && !selected ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 2px 8px rgba(26,24,20,0.08)' : 'none',
        transition: 'transform 0.1s, box-shadow 0.1s, border-color 0.1s, background 0.1s',
        position: 'relative',
      }}
    >
      {/* Checkbox */}
      <div
        onClick={e => { e.stopPropagation(); onToggle(lead.id) }}
        style={{
          position: 'absolute', top: '10px', right: '10px',
          width: '14px', height: '14px',
          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--line-2)'}`,
          borderRadius: '3px',
          background: selected ? 'var(--accent)' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered || selected ? 1 : 0,
          transition: 'opacity 0.1s', cursor: 'pointer',
        }}
      >
        {selected && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px', paddingRight: '20px', lineHeight: 1.3 }}>
        {lead.company}
      </div>
      <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>
        {lead.domain}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginBottom: '8px', lineHeight: 1.3 }}>
        {lead.industry}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
        <span style={{ fontSize: '10.5px', color: 'var(--ink-4)' }}>Score</span>
        <ScoreBadge score={lead.score} grade={lead.grade} />
      </div>
      {lead.rationale && (
        <div style={{ fontSize: '10.5px', color: 'var(--ink-4)', lineHeight: 1.4, marginBottom: '6px' }}>
          {lead.rationale.slice(0, 80)}{lead.rationale.length > 80 ? '…' : ''}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {lead.badges.map((badge, i) => (
          <span key={i} style={{
            fontSize: '10px', fontWeight: 500,
            background: 'var(--paper-2)', color: 'var(--ink-2)',
            padding: '1px 5px', borderRadius: '3px',
            border: '1px solid var(--line)',
          }}>
            {badge}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ICP dot row (shared between table and kanban)
// ---------------------------------------------------------------------------
function IcpDims({ match }: { match: Lead['icp_match'] }) {
  const dims = [
    { label: 'Ind', ok: match?.industry_match },
    { label: 'Size', ok: match?.size_match },
    { label: 'Geo', ok: match?.geo_match },
    { label: 'Stage', ok: match?.stage_match },
  ]
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {dims.map(d => (
        <span key={d.label} style={{
          fontSize: '9.5px', display: 'inline-flex', alignItems: 'center', gap: '2px',
          color: d.ok ? 'var(--good)' : 'var(--ink-4)',
          padding: '1px 4px', borderRadius: '3px',
          background: d.ok ? 'var(--good-soft)' : 'var(--paper-3)',
        }}>
          {d.ok ? <CheckCircle size={8} /> : null}
          {d.label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------
function LeadTableRow({ lead, selected, onToggle }: { lead: Lead; selected: boolean; onToggle: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onToggle(lead.id)}
      style={{
        background: selected ? 'var(--accent-tint)' : hovered ? 'var(--paper-2)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      {/* Checkbox */}
      <td style={{ padding: '8px 10px', width: '28px' }}>
        <div style={{
          width: '14px', height: '14px',
          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--line-2)'}`,
          borderRadius: '3px',
          background: selected ? 'var(--accent)' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered || selected ? 1 : 0,
          transition: 'opacity 0.1s',
        }}>
          {selected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
      </td>
      {/* Company */}
      <td style={{ padding: '8px 10px', minWidth: '180px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '1px' }}>{lead.company}</div>
        <div style={{ fontSize: '10.5px', color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>{lead.domain}</div>
      </td>
      {/* Score */}
      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
        <ScoreBadge score={lead.score} grade={lead.grade} />
      </td>
      {/* Passed */}
      <td style={{ padding: '8px 10px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 600,
          background: lead.passed_threshold ? 'var(--good-soft)' : 'var(--paper-3)',
          color: lead.passed_threshold ? 'var(--good)' : 'var(--ink-4)',
          padding: '2px 7px', borderRadius: '3px',
        }}>
          {lead.passed_threshold ? '✓ Passed' : '✗ Below threshold'}
        </span>
      </td>
      {/* ICP dims */}
      <td style={{ padding: '8px 10px' }}>
        <IcpDims match={lead.icp_match} />
      </td>
      {/* Signals */}
      <td style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(lead.icp_match?.trigger_signals ?? []).slice(0, 2).map((s, i) => (
            <span key={i} style={{ fontSize: '10px', background: 'var(--paper-2)', color: 'var(--ink-3)', padding: '1px 6px', borderRadius: '3px', border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
              {s}
            </span>
          ))}
        </div>
      </td>
      {/* Rationale */}
      <td style={{ padding: '8px 12px', maxWidth: '280px' }}>
        <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', lineHeight: 1.4 }}>
          {lead.rationale ? `${lead.rationale.slice(0, 90)}${lead.rationale.length > 90 ? '…' : ''}` : '—'}
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PipelinePage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [leads, setLeads] = useState<Lead[]>(STATIC_LEADS)
  const [runState, setRunState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [runError, setRunError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activePipelineTaskId, setActivePipelineTaskId] = useState<string | null>(null)
  const activeTaskPollRef = useRef<NodeJS.Timeout | null>(null)
  const [companyName, setCompanyName] = useState<string>('Your Company')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [filterGrade, setFilterGrade] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [filterPassed, setFilterPassed] = useState<'all' | 'passed' | 'failed'>('all')

  const loadLeads = useCallback(async (quiet = false) => {
    if (!quiet) return
    setRefreshing(true)
    try {
      const tasksRes = await fetch('/api/tasks', { cache: 'no-store' })
      const tasksData = await tasksRes.json()
      const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = tasksData.tasks ?? []
      const latestPipeline = allTasks
        .filter(t => t.name === 'sdr:core:sales-pipeline' && t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      if (!latestPipeline) {
        setRefreshing(false)
        return
      }

      const artRes = await fetch(`/api/tasks/${latestPipeline.id}/artifacts`, { cache: 'no-store' })
      const artData = await artRes.json()
      const arts: Array<{ id: string; entry_name: string }> = artData.artifacts ?? []

      const scoredArt = arts.find(a => a.entry_name === 'scored_leads')
      if (!scoredArt) {
        setRefreshing(false)
        return
      }

      const contentRes = await fetch(`/api/artifacts/${scoredArt.id}`, { cache: 'no-store' })
      const contentData = await contentRes.json()
      const parsed = parseContent(contentData.artifact?.content)

      if (parsed?.scored_leads && Array.isArray(parsed.scored_leads)) {
        const mapped = mapScoredLeads(parsed.scored_leads as ScoredLead[])
        setLeads(mapped)
        setDataSource(latestPipeline.id)
      }
    } catch {}
    setRefreshing(false)
  }, [])

  const checkActiveTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      const data = await res.json()
      const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = data.tasks ?? []
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      // Only count tasks created within the last 2 hours as truly active (avoids stale "open" tasks)
      const active = allTasks.find(t =>
        t.name === 'sdr:core:sales-pipeline' &&
        ACTIVE_STATUSES.has(t.status) &&
        new Date(t.created_at) > twoHoursAgo
      )
      setActivePipelineTaskId(active?.id ?? null)
    } catch {}
  }, [])

  // Fetch company name from latest profile-builder profile_documents artifact
  useEffect(() => {
    async function fetchCompanyName() {
      try {
        const tasksRes = await fetch('/api/tasks', { cache: 'no-store' })
        const tasksData = await tasksRes.json()
        const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = tasksData.tasks ?? []
        const latestPB = allTasks
          .filter(t => t.name === 'sdr:core:profile-builder' && t.status === 'completed')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        if (!latestPB) return
        const artRes = await fetch(`/api/tasks/${latestPB.id}/artifacts`, { cache: 'no-store' })
        const artData = await artRes.json()
        const pdArt = (artData.artifacts ?? []).find((a: { entry_name: string }) => a.entry_name === 'profile_documents')
        if (!pdArt) return
        const contentRes = await fetch(`/api/artifacts/${(pdArt as { id: string }).id}`, { cache: 'no-store' })
        const contentData = await contentRes.json()
        const raw: string = contentData.artifact?.content ?? ''
        const cleaned = raw.replace(/^\s*\d+\s*\|\s?/gm, '')
        const parsed = JSON.parse(cleaned)
        const name = parsed?.company_profile?.company_name || parsed?.company_name
        if (name) setCompanyName(String(name))
      } catch {}
    }
    fetchCompanyName()
  }, [])

  // On mount: detect active tasks and load leads from latest completed run
  useEffect(() => {
    checkActiveTasks()
    loadLeads(true)
  }, [checkActiveTasks, loadLeads])

  // Poll the active task every 3s; when it completes, clear it and reload leads
  useEffect(() => {
    if (!activePipelineTaskId) {
      if (activeTaskPollRef.current) {
        clearInterval(activeTaskPollRef.current)
        activeTaskPollRef.current = null
      }
      return
    }
    activeTaskPollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/tasks', { cache: 'no-store' })
        const data = await res.json()
        const task = (data.tasks ?? []).find(
          (t: { id: string; status: string }) => t.id === activePipelineTaskId
        )
        if (task && !ACTIVE_STATUSES.has(task.status)) {
          setActivePipelineTaskId(null)
          loadLeads(true)
        }
      } catch {}
    }, 3000)
    return () => {
      if (activeTaskPollRef.current) {
        clearInterval(activeTaskPollRef.current)
        activeTaskPollRef.current = null
      }
    }
  }, [activePipelineTaskId, loadLeads])

  // Reload when the tab regains focus (user returns from console)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkActiveTasks()
        loadLeads(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [checkActiveTasks, loadLeads])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runProspecting() {
    setRunState('loading')
    setRunError(null)
    try {
      const res = await fetch('/api/flow/sales-pipeline/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setRunState('error')
        setRunError(data.error ?? 'Failed to start pipeline')
        return
      }
      router.push('/console')
    } catch (err) {
      setRunState('error')
      setRunError(err instanceof Error ? err.message : 'Network error')
    }
  }

  const filteredLeads = leads.filter(l => {
    if (filterGrade !== 'all' && l.grade !== filterGrade) return false
    if (filterPassed === 'passed' && !l.passed_threshold) return false
    if (filterPassed === 'failed' && l.passed_threshold) return false
    return true
  })

  const selCount = selected.size
  const isPipelineRunning = activePipelineTaskId !== null

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Running banner */}
      {isPipelineRunning && (
        <div style={{
          padding: '9px 32px',
          background: 'var(--info-soft)',
          borderBottom: '1px solid var(--info)',
          display: 'flex', alignItems: 'center', gap: '10px',
          flexShrink: 0,
        }}>
          <Loader2 size={13} color="var(--info)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', color: 'var(--info)', fontWeight: 500 }}>
            Prospecting pipeline is running — leads will appear here when complete
          </span>
          <button
            onClick={() => router.push('/console')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '11.5px', fontWeight: 500, color: 'var(--info)',
              background: 'transparent', border: '1px solid var(--info)',
              borderRadius: '4px', padding: '3px 10px', cursor: 'pointer',
            }}
          >
            <Terminal size={10} />
            View in console
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '10.5px', color: 'var(--info)', opacity: 0.6, fontFamily: "'JetBrains Mono', monospace" }}>
            {activePipelineTaskId}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '28px 32px 16px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'flex-end', gap: '24px', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '32px', letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>
            Account Pipeline
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {companyName} · ICP v1
            {dataSource && (
              <span style={{ fontSize: '11px', background: 'var(--good-soft)', color: 'var(--good)', padding: '1px 7px', borderRadius: '10px', fontWeight: 500 }}>
                Live · {dataSource}
              </span>
            )}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {runError && (
            <span style={{ fontSize: '11.5px', color: 'var(--bad)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertCircle size={12} />
              {runError}
            </span>
          )}
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: '5px', overflow: 'hidden' }}>
            {([
              { key: 'kanban', icon: <LayoutGrid size={12} />, label: 'Kanban' },
              { key: 'list',   icon: <LayoutList size={12} />, label: 'List'   },
            ] as const).map(({ key, icon, label }) => (
              <button key={key} onClick={() => setViewMode(key)} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 11px', fontSize: '11.5px', fontWeight: viewMode === key ? 600 : 400,
                background: viewMode === key ? 'var(--ink)' : 'var(--paper)',
                color: viewMode === key ? 'white' : 'var(--ink-3)',
                cursor: 'pointer', borderRight: key === 'kanban' ? '1px solid var(--line)' : 'none',
              }}>
                {icon} {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadLeads(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', fontSize: '12px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              borderRadius: '5px', color: 'var(--ink-2)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', fontSize: '12.5px',
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: '5px', color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 500,
          }}>
            <Plus size={12} />
            New account
          </button>

          {isPipelineRunning ? (
            <button
              onClick={() => router.push('/console')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', fontSize: '12.5px',
                background: 'var(--info-soft)',
                border: '1px solid var(--info)',
                borderRadius: '5px', color: 'var(--info)', cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Running · console
            </button>
          ) : (
            <button
              onClick={runProspecting}
              disabled={runState === 'loading'}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', fontSize: '12.5px',
                background: runState === 'loading' ? 'var(--ink-2)' : 'var(--accent)',
                border: `1px solid ${runState === 'loading' ? 'var(--ink-2)' : 'var(--accent)'}`,
                borderRadius: '5px', color: 'white', cursor: runState === 'loading' ? 'default' : 'pointer',
                fontWeight: 500, opacity: runState === 'loading' ? 0.8 : 1,
              }}
            >
              {runState === 'loading' ? (
                <>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Starting…
                </>
              ) : (
                <>
                  <Zap size={12} />
                  Run prospecting
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Chat bar */}
      <div style={{
        padding: '10px 32px', borderBottom: '1px solid var(--line)',
        background: 'var(--paper-2)', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--paper)', border: '1px solid var(--line)',
          borderRadius: '6px', padding: '8px 12px',
        }}>
          <input
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--ink)' }}
            placeholder="Find accounts, filter by trigger, or ask about pipeline health…"
            readOnly
          />
          <button style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 500, background: 'var(--ink)', color: 'var(--paper)', borderRadius: '4px', cursor: 'pointer' }}>
            Ask
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        padding: '8px 32px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, flexWrap: 'wrap',
        background: 'var(--paper-2)',
      }}>
        {/* Grade filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-4)', fontWeight: 600 }}>GRADE</span>
          {(['all', 'A', 'B', 'C'] as const).map(g => (
            <button key={g} onClick={() => setFilterGrade(g)} style={{
              padding: '3px 9px', fontSize: '11px', fontWeight: filterGrade === g ? 600 : 400,
              background: filterGrade === g ? 'var(--ink)' : 'var(--paper)',
              color: filterGrade === g ? 'white' : 'var(--ink-3)',
              border: `1px solid ${filterGrade === g ? 'var(--ink)' : 'var(--line)'}`,
              borderRadius: '4px', cursor: 'pointer',
            }}>
              {g === 'all' ? 'All' : g}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--line)' }} />

        {/* Passed filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-4)', fontWeight: 600 }}>STATUS</span>
          {([
            { key: 'all', label: 'All' },
            { key: 'passed', label: '✓ Passed' },
            { key: 'failed', label: '✗ Below threshold' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setFilterPassed(key)} style={{
              padding: '3px 9px', fontSize: '11px', fontWeight: filterPassed === key ? 600 : 400,
              background: filterPassed === key ? 'var(--ink)' : 'var(--paper)',
              color: filterPassed === key ? 'white' : 'var(--ink-3)',
              border: `1px solid ${filterPassed === key ? 'var(--ink)' : 'var(--line)'}`,
              borderRadius: '4px', cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
        </div>

        {(filterGrade !== 'all' || filterPassed !== 'all') && (
          <button onClick={() => { setFilterGrade('all'); setFilterPassed('all') }} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', color: 'var(--ink-4)', cursor: 'pointer',
            background: 'none', border: 'none', padding: '3px 6px',
          }}>
            <X size={10} /> Clear
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--ink-4)' }}>
          {filteredLeads.length !== leads.length
            ? <><strong style={{ color: 'var(--ink-2)' }}>{filteredLeads.length}</strong> of {leads.length} accounts</>
            : <>{leads.length} accounts</>
          }
          {dataSource
            ? <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--good-soft)', color: 'var(--good)', padding: '1px 7px', borderRadius: '10px', fontWeight: 500 }}>Live</span>
            : <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--ink-4)' }}>· sample data</span>
          }
        </div>
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div style={{
          position: 'fixed', top: '44px', left: '220px', right: 0,
          background: 'var(--ink)', color: 'var(--paper)',
          padding: '10px 32px', display: 'flex', alignItems: 'center', gap: '12px',
          zIndex: 50, flexShrink: 0,
        }}>
          <span style={{ fontSize: '12.5px', fontWeight: 500 }}>{selCount} selected</span>
          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
          {['Promote to Shortlisted', 'Suppress'].map(label => (
            <button key={label} style={{
              padding: '5px 12px', fontSize: '12px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px', color: 'var(--paper)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <ChevronRight size={11} />
              {label}
            </button>
          ))}
          <button
            onClick={() => router.push('/engagement')}
            style={{
              padding: '5px 12px', fontSize: '12px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px', color: 'var(--paper)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <ChevronRight size={11} />
            Enroll in sequence
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => setSelected(new Set())} style={{ padding: '5px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Kanban board */}
      {viewMode === 'kanban' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 24px' }}>
          <div style={{ display: 'flex', gap: '12px', height: '100%', minWidth: 'max-content' }}>
            {columns.map(col => {
              const colLeads = filteredLeads.filter(l => l.column === col.key)
              return (
                <div key={col.key} style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 4px 10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                      {col.label}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 600,
                      background: 'var(--paper-2)', color: 'var(--ink-4)',
                      padding: '0 6px', borderRadius: '10px', lineHeight: '16px',
                      border: '1px solid var(--line)',
                    }}>
                      {colLeads.length}
                    </span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
                    {colLeads.map(lead => (
                      <KanbanCard key={lead.id} lead={lead} selected={selected.has(lead.id)} onToggle={toggleSelect} />
                    ))}
                    {colLeads.length === 0 && (
                      <div style={{
                        border: '1px dashed var(--line)', borderRadius: '5px',
                        padding: '16px 12px', textAlign: 'center',
                        fontSize: '11px', color: 'var(--ink-4)',
                      }}>
                        {isPipelineRunning && col.key === 'researched' ? 'Finding leads…' : 'No accounts'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List / Table view */}
      {viewMode === 'list' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)', background: 'var(--paper-2)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '8px 10px', width: '28px' }} />
                {['Company', 'Score', 'Threshold', 'ICP Match', 'Signals', 'Rationale'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px' }}>
                    {isPipelineRunning ? 'Pipeline running — leads will appear here shortly…' : 'No accounts match the current filters'}
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <LeadTableRow key={lead.id} lead={lead} selected={selected.has(lead.id)} onToggle={toggleSelect} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
