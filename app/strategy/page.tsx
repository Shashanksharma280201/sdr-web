'use client'

import {
  useState, useEffect, useRef, useCallback,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  Building2, Target, GitBranch, SlidersHorizontal, FileText,
  ChevronLeft, ChevronRight, Send, Trash2, Loader2,
  CheckCircle, Circle, BarChart2, Users, Mail,
  RefreshCw, SquarePen, Clock, Zap,
  Expand, Pencil, X, AlertTriangle, Save,
} from 'lucide-react'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:          'var(--paper)',
  surface:     'var(--paper-2)',
  surface2:    'var(--paper-2)',
  surface3:    'var(--paper-3)',
  border:      'var(--line)',
  border2:     'var(--line-2)',
  text:        'var(--ink)',
  text2:       'var(--ink-2)',
  textMuted:   'var(--ink-4)',
  accent:      'var(--accent)',
  accentSoft:  'var(--accent-tint)',
  success:     'var(--good)',
  successSoft: 'var(--good-soft)',
  warn:        'var(--warn)',
  info:        'var(--info)',
  bad:         'var(--bad)',
} as const

// ─── Stage definitions ─────────────────────────────────────────────────────────
const STAGES = [
  { id: 'company_profiler',       label: 'Company Profiler',       description: 'Product, features & differentiators',   icon: <Building2 size={13} />,        artifactKey: 'company_raw' },
  { id: 'icp_builder',            label: 'ICP Builder',            description: 'Ideal customer profile',                icon: <Target size={13} />,            artifactKey: 'icp_data' },
  { id: 'competition_researcher', label: 'Competition Researcher', description: 'Competitive landscape & battlecards',   icon: <GitBranch size={13} />,         artifactKey: 'competitive_positioning' },
  { id: 'scoring_rubric_builder', label: 'Scoring Rubric',         description: 'Lead scoring framework',               icon: <SlidersHorizontal size={13} />,  artifactKey: 'scoring_rubric' },
  { id: 'profile_writer',         label: 'Profile Writer',         description: 'Final ICP, persona & company docs',    icon: <FileText size={13} />,          artifactKey: 'profile_documents' },
]

const ARTIFACT_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  company_raw:             { label: 'Company Profile',         color: D.info,    icon: <Building2 size={13} /> },
  icp_data:                { label: 'ICP Data',                color: D.success, icon: <Target size={13} /> },
  profile_documents:       { label: 'Profile Documents',       color: D.accent,  icon: <FileText size={13} /> },
  scoring_rubric:          { label: 'Scoring Rubric',          color: D.warn,    icon: <BarChart2 size={13} /> },
  competitive_positioning: { label: 'Competitive Positioning', color: D.bad,     icon: <GitBranch size={13} /> },
  leads_raw:               { label: 'Leads Found',             color: D.info,    icon: <Users size={13} /> },
  email_drafts:            { label: 'Email Drafts',            color: D.success, icon: <Mail size={13} /> },
}

const STAGE_PHASE_KEYS = ['company_profiler', 'icp_builder', 'competition_researcher', 'scoring_rubric_builder', 'profile_writer']

// Artifact edit → downstream stale cascade
const STALE_CASCADES: Record<string, string[]> = {
  company_raw:             ['icp_builder', 'competition_researcher', 'scoring_rubric_builder', 'profile_writer'],
  icp_data:                ['competition_researcher', 'scoring_rubric_builder', 'profile_writer'],
  competitive_positioning: ['scoring_rubric_builder', 'profile_writer'],
  scoring_rubric:          ['profile_writer'],
}

// Artifact entry_name → stage id
const ARTIFACT_TO_STAGE: Record<string, string> = {
  company_raw:             'company_profiler',
  icp_data:                'icp_builder',
  competitive_positioning: 'competition_researcher',
  scoring_rubric:          'scoring_rubric_builder',
  profile_documents:       'profile_writer',
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StrategySession {
  id: string; agent_name: string; title: string; flow_session_id: string | null
  pipeline_task_id: string | null; context_text: string | null
  stale_stages: string[] | null
  artifact_state: Record<string, { confirmed: boolean; data: Record<string, unknown> | null }> | null
  created_at: string; updated_at: string; message_count: number
}
interface ChatMessage { id: string; role: 'user' | 'assistant' | 'status'; content: string; created_at: string }
interface ArtifactMeta { id: string; entry_name: string; artifact_name: string; status: string; created_at: string }
interface Phase { id: string; name: string; status: string; started_at?: string; completed_at?: string }

// ─── Utilities ─────────────────────────────────────────────────────────────────
function parseContent(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  try { return JSON.parse(raw.replace(/^\s*\d+\s*\|\s?/gm, '')) } catch { return null }
}
function extractJsonBlock(text: string): Record<string, unknown> | null {
  const m = text.match(/```json\s*([\s\S]*?)```/)
  if (!m) return null
  try { return JSON.parse(m[1].trim()) } catch { return null }
}
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function groupSessions(sessions: StrategySession[]): { label: string; items: StrategySession[] }[] {
  const groups: Record<string, StrategySession[]> = {}
  for (const s of sessions) { const l = relativeDate(s.updated_at); (groups[l] = groups[l] || []).push(s) }
  const order = ['Today', 'Yesterday']
  const keys = [...order.filter(k => groups[k]), ...Object.keys(groups).filter(k => !order.includes(k))]
  return keys.map(label => ({ label, items: groups[label] }))
}

// ─── Artifact views ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: D.text2, marginBottom: '6px', marginTop: '14px' }}>{label}</div>
}
function Chip({ text, color }: { text: string; color?: string }) {
  return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: color ? `${color}22` : D.surface3, color: color || D.text2, border: `1px solid ${color ? color + '44' : D.border}` }}>{text}</span>
}
function Bullet({ items, color }: { items: string[]; color?: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{items.map((t, i) => (
    <div key={i} style={{ fontSize: '12.5px', color: D.text, paddingLeft: '14px', position: 'relative', lineHeight: 1.5 }}>
      <span style={{ position: 'absolute', left: 0, color: color || D.accent }}>·</span>{t}
    </div>
  ))}</div>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ICPView({ data }: { data: any }) {
  const co = data.company_criteria || data.company_icp
  const ct = data.contact_criteria  || data.contact_icp
  if (!co && !ct) return <pre style={{ fontSize: '11px', color: D.text2, whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
  return <div>
    {co && (<>
      <SectionLabel label="Firmographics" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>{((co.industries as string[]) || []).map(v => <Chip key={v} text={v} color={D.info} />)}</div>
      {co.geographies && <><div style={{ fontSize: '11px', color: D.text2, marginBottom: '5px' }}>Geographies</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>{(co.geographies as string[]).map(v => <Chip key={v} text={v} color={D.success} />)}</div></>}
      {co.revenue_range && <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '11px', color: D.text2, marginBottom: '3px' }}>Revenue Range</div><div style={{ fontSize: '12.5px', color: D.text, fontWeight: 500 }}>{String(co.revenue_range)}</div></div>}
      {co.buying_triggers && <><SectionLabel label="Buying Triggers" /><Bullet items={(co.buying_triggers as string[]).slice(0, 5)} color={D.accent} /></>}
      {co.qualification_signals && <><SectionLabel label="Qualification Signals" /><Bullet items={(co.qualification_signals as string[]).slice(0, 4)} color={D.success} /></>}
      {co.disqualifiers && <><SectionLabel label="Disqualifiers" /><Bullet items={(co.disqualifiers as string[]).slice(0, 4)} color={D.bad} /></>}
    </>)}
    {ct && (<>
      <SectionLabel label="Contact ICP" />
      {ct.job_titles && <><div style={{ fontSize: '11px', color: D.text2, marginBottom: '5px' }}>Titles</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>{(ct.job_titles as string[]).map(v => <Chip key={v} text={v} color={D.accent} />)}</div></>}
      {ct.pain_points && <><div style={{ fontSize: '11px', color: D.text2, marginBottom: '5px' }}>Pain Points</div><Bullet items={(ct.pain_points as string[]).slice(0, 4)} color={D.warn} /></>}
    </>)}
  </div>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScoringView({ data }: { data: any }) {
  const dims: Array<{ name?: string; weight?: number; scoring_guide?: string }> = data.dimensions || []
  return <div>
    <SectionLabel label="Scoring Dimensions" />
    {dims.map((d, i) => {
      const w = Number(d.weight || 0), name = String(d.name || `Dimension ${i+1}`)
      return <div key={i} style={{ marginBottom: '10px', padding: '10px 12px', background: D.surface2, borderRadius: '6px', border: `1px solid ${D.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: D.text }}>{name}</span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: D.text2, background: D.surface, border: `1px solid ${D.border}`, padding: '1px 7px', borderRadius: '4px' }}>{w}%</span>
        </div>
        <div style={{ height: '3px', background: D.surface3, borderRadius: '2px', overflow: 'hidden', marginBottom: '7px' }}>
          <div style={{ height: '100%', width: `${w}%`, background: w > 20 ? D.accent : w > 12 ? D.warn : D.info, borderRadius: '2px' }} />
        </div>
        {d.scoring_guide && <div style={{ fontSize: '11px', color: D.text2, lineHeight: 1.5 }}>{String(d.scoring_guide).slice(0, 130)}{String(d.scoring_guide).length > 130 ? '…' : ''}</div>}
      </div>
    })}
  </div>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompanyRawView({ data }: { data: any }) {
  return <div>
    {data.company_name && <div style={{ fontSize: '17px', fontWeight: 700, color: D.text, marginBottom: '12px', letterSpacing: '-0.01em' }}>{String(data.company_name)}</div>}
    {data.value_proposition && <><SectionLabel label="Value Proposition" /><div style={{ fontSize: '12.5px', color: D.text, lineHeight: 1.6, padding: '10px 12px', background: D.surface2, borderRadius: '6px', border: `1px solid ${D.border}`, marginBottom: '10px' }}>{String(data.value_proposition)}</div></>}
    {data.differentiators && <><SectionLabel label="Differentiators" /><Bullet items={data.differentiators as string[]} color={D.accent} /></>}
    {data.key_features && <><SectionLabel label="Key Features" /><Bullet items={data.key_features as string[]} color={D.info} /></>}
    {data.target_outcomes && <><SectionLabel label="Target Outcomes" /><Bullet items={data.target_outcomes as string[]} color={D.success} /></>}
  </div>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProfileDocsView({ data }: { data: any }) {
  return <div>
    {data.icp_profile && <div style={{ marginBottom: '16px', padding: '14px', background: D.surface2, borderRadius: '7px', border: `1px solid ${D.border}` }}>
      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: D.info, marginBottom: '6px' }}>ICP Profile</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: D.text, marginBottom: '5px' }}>{String(data.icp_profile.title || '')}</div>
      <div style={{ fontSize: '12px', color: D.text2, lineHeight: 1.6 }}>{String(data.icp_profile.summary || '').slice(0, 320)}{String(data.icp_profile.summary || '').length > 320 ? '…' : ''}</div>
    </div>}
    {data.buyer_persona && <div style={{ marginBottom: '16px', padding: '14px', background: D.surface2, borderRadius: '7px', border: `1px solid ${D.border}` }}>
      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: D.accent, marginBottom: '6px' }}>Buyer Persona</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: D.text, marginBottom: '5px' }}>{String(data.buyer_persona.persona_name || '')}</div>
      {data.buyer_persona.job_titles && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>{(data.buyer_persona.job_titles as string[]).map(t => <Chip key={t} text={t} color={D.accent} />)}</div>}
      {data.buyer_persona.pain_points && <Bullet items={(data.buyer_persona.pain_points as string[]).slice(0, 4)} color={D.warn} />}
    </div>}
    {data.company_profile && <div style={{ padding: '14px', background: D.surface2, borderRadius: '7px', border: `1px solid ${D.border}` }}>
      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: D.success, marginBottom: '6px' }}>Company Profile</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: D.text, marginBottom: '5px' }}>{String(data.company_profile.company_name || '')}</div>
      {data.company_profile.elevator_pitch && <div style={{ fontSize: '12px', color: D.text2, lineHeight: 1.6, marginBottom: '8px' }}>{String(data.company_profile.elevator_pitch).slice(0, 280)}</div>}
      {data.company_profile.key_benefits && <Bullet items={(data.company_profile.key_benefits as string[]).slice(0, 4)} color={D.success} />}
    </div>}
  </div>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ArtifactView({ entryName, data }: { entryName: string; data: any }) {
  if (entryName === 'icp_data')                return <ICPView data={data} />
  if (entryName === 'scoring_rubric')          return <ScoringView data={data} />
  if (entryName === 'company_raw')             return <CompanyRawView data={data} />
  if (entryName === 'profile_documents')       return <ProfileDocsView data={data} />
  if (entryName === 'competitive_positioning') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = data.competitors || []
    return <div>
      <SectionLabel label="Competitors" />
      {competitors.slice(0, 5).map((c, i) => <div key={i} style={{ marginBottom: '10px', padding: '10px 12px', background: D.surface2, borderRadius: '6px', border: `1px solid ${D.border}` }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: D.text, marginBottom: '4px' }}>{String(c.name || '')}</div>
        <div style={{ fontSize: '11px', color: D.text2, lineHeight: 1.5 }}>{String(c.positioning_statement || '').slice(0, 160)}</div>
      </div>)}
      {data.our_positioning?.positioning_statement && <>
        <SectionLabel label="Our Positioning" />
        <div style={{ fontSize: '12.5px', color: D.text, lineHeight: 1.6, padding: '10px 12px', background: D.surface2, borderRadius: '6px', border: `1px solid ${D.border}` }}>
          {String(data.our_positioning.positioning_statement)}
        </div>
      </>}
    </div>
  }
  return <pre style={{ fontSize: '11px', color: D.text2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(data, null, 2)}</pre>
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Sessions & messages
  const [sessions,        setSessions]        = useState<StrategySession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages,        setMessages]        = useState<Record<string, ChatMessage[]>>({})
  const [hoveredSession,  setHoveredSession]  = useState<string | null>(null)

  // Streaming chat
  const [input,        setInput]        = useState('')
  const [streaming,    setStreaming]     = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [draftPreviews, setDraftPreviews] = useState<Record<string, Record<string, unknown>>>({})

  // Pipeline progress
  const [pipelineTaskId,   setPipelineTaskId]   = useState<string | null>(null)
  const [pipelineRunning,  setPipelineRunning]  = useState(false)
  const [pipelineError,    setPipelineError]    = useState<string | null>(null)
  const [rerunning,        setRerunning]        = useState(false)
  const [phases,           setPhases]           = useState<Phase[]>([])

  // Per-stage signals (progressive building)
  const [stageTaskIds,     setStageTaskIds]     = useState<Record<string, string>>({})
  const [runningStages,    setRunningStages]    = useState<Set<string>>(new Set())
  const [rebuildingStage,  setRebuildingStage]  = useState<string | null>(null)

  // Edit / expand / stale
  const [staleStages,      setStaleStages]      = useState<Set<string>>(new Set())
  const [expandedEntry,    setExpandedEntry]    = useState<string | null>(null)
  const [editingEntry,     setEditingEntry]     = useState<string | null>(null)
  const [editDraft,        setEditDraft]        = useState('')
  const [savingEdit,       setSavingEdit]       = useState(false)

  // Artifacts
  const [artifacts,        setArtifacts]        = useState<ArtifactMeta[]>([])
  const [artifactContents, setArtifactContents] = useState<Record<string, Record<string, unknown>>>({})
  const [activeArtifact,   setActiveArtifact]   = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamBuffer])

  // ── Sessions ──────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res  = await fetch('/api/strategy/sessions?agent=profile_builder_web')
      const data = await res.json()
      const list: StrategySession[] = data.sessions ?? []
      setSessions(list)
      setActiveSessionId(prev => prev ?? list[0]?.id ?? null)
    } catch {}
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  // ── Messages ──────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (sessionId: string) => {
    if (messages[sessionId]) return
    try {
      const res  = await fetch(`/api/strategy/chat?session_id=${sessionId}`)
      const data = await res.json()
      setMessages(prev => ({ ...prev, [sessionId]: data.messages ?? [] }))
    } catch {}
  }, [messages])

  useEffect(() => {
    if (!activeSessionId) return
    loadMessages(activeSessionId)
    const session = sessions.find(s => s.id === activeSessionId)
    if (session?.pipeline_task_id) setPipelineTaskId(session.pipeline_task_id)
    if (session?.stale_stages?.length) setStaleStages(new Set(session.stale_stages))
    else setStaleStages(new Set())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId])

  // ── Pipeline phase polling ────────────────────────────────────────────────
  const loadPhases = useCallback(async (taskId: string) => {
    try {
      const res  = await fetch(`/api/tasks/${taskId}/phases`, { cache: 'no-store' })
      const data = await res.json()
      setPhases(data.phases || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (!pipelineTaskId || !pipelineRunning) return
    loadPhases(pipelineTaskId)
    const id = setInterval(() => loadPhases(pipelineTaskId), 15000)
    return () => clearInterval(id)
  }, [pipelineTaskId, pipelineRunning, loadPhases])

  // ── Artifacts ─────────────────────────────────────────────────────────────
  const loadArtifacts = useCallback(async (taskId?: string | null) => {
    try {
      // Always scan all relevant tasks — each stage signal creates its own task,
      // so storing a single pipeline_task_id misses most artifacts.
      const tr  = await fetch('/api/tasks', { cache: 'no-store' })
      const td  = await tr.json()
      const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = td.result ?? td.tasks ?? []
      const RELEVANT_FLOWS = ['sdr:core:profile-builder', 'sdr:core:profile-builder-web', 'sdr:core:single-stage']
      const recentIds = allTasks
        .filter(t => RELEVANT_FLOWS.includes(t.name))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
        .map(t => t.id)

      // Merge with any explicitly known IDs (avoids missing in-flight tasks)
      const knownIds = [taskId, pipelineTaskId, ...Object.values(stageTaskIds)].filter(Boolean) as string[]
      const taskIds = [...new Set([...knownIds, ...recentIds])]

      const allArts: ArtifactMeta[] = []
      await Promise.all(taskIds.map(async tid => {
        const r = await fetch(`/api/tasks/${tid}/artifacts`, { cache: 'no-store' })
        const d = await r.json()
        const arts: ArtifactMeta[] = (d.artifacts ?? []).filter(
          (a: ArtifactMeta) => a.status === 'active' && !a.entry_name.includes('intake_turn')
        )
        allArts.push(...arts)
      }))

      const seen = new Map<string, ArtifactMeta>()
      for (const a of allArts) if (!seen.has(a.entry_name)) seen.set(a.entry_name, a)
      const arts = Array.from(seen.values())
      setArtifacts(arts)

      const cts: Record<string, Record<string, unknown>> = {}
      await Promise.all(arts.map(async a => {
        const r = await fetch(`/api/artifacts/${a.id}`, { cache: 'no-store' })
        const d = await r.json()
        const raw = d.artifact?.content
        if (raw) { const p = parseContent(raw); if (p) cts[a.id] = p }
      }))

      // Apply local overrides (from DB edits)
      if (activeSessionId) {
        await Promise.all(arts.map(async a => {
          const or = await fetch(`/api/strategy/artifacts/${a.entry_name}?session_id=${activeSessionId}`)
          const od = await or.json()
          if (od.override) cts[a.id] = od.override as Record<string, unknown>
        }))
      }

      setArtifactContents(cts)
      if (!activeArtifact && arts.length > 0) setActiveArtifact(arts[0].id)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineTaskId, stageTaskIds])

  useEffect(() => { loadArtifacts() }, [loadArtifacts])

  // Poll artifacts while pipeline is running (every 12s — artifact fetch is heavy)
  useEffect(() => {
    if (!pipelineRunning) return
    const id = setInterval(() => loadArtifacts(), 12000)
    return () => clearInterval(id)
  }, [pipelineRunning, loadArtifacts])

  // Stop polling when all 5 stage artifacts exist
  useEffect(() => {
    if (!pipelineRunning) return
    const allArtifactKeys = STAGES.map(s => s.artifactKey)
    const allDone = allArtifactKeys.every(key => artifacts.find(a => a.entry_name === key))
    if (allDone) setPipelineRunning(false)
  }, [artifacts, pipelineRunning])

  // ── New session ───────────────────────────────────────────────────────────
  const newSession = useCallback(async () => {
    try {
      const res  = await fetch('/api/strategy/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'profile_builder_web' }),
      })
      const data = await res.json()
      const s: StrategySession = data.session
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
      setMessages(prev => ({ ...prev, [s.id]: [] }))
      setTimeout(() => textareaRef.current?.focus(), 60)
    } catch {}
  }, [])

  // ── Save artifact edit ────────────────────────────────────────────────────
  const saveArtifactEdit = useCallback(async () => {
    if (!editingEntry || !activeSessionId) return
    setSavingEdit(true)
    try {
      let parsed: unknown
      try { parsed = JSON.parse(editDraft) } catch { alert('Invalid JSON'); return }

      const res = await fetch(`/api/strategy/artifacts/${editingEntry}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId, content: parsed }),
      })
      const data = await res.json() as { stale: string[] }

      // Update local content
      const art = artifacts.find(a => a.entry_name === editingEntry)
      if (art) setArtifactContents(prev => ({ ...prev, [art.id]: parsed as Record<string, unknown> }))

      // Mark downstream stages stale
      const newStale = new Set([...staleStages, ...(data.stale ?? [])])
      setStaleStages(newStale)
      setEditingEntry(null)
    } finally { setSavingEdit(false) }
  }, [editingEntry, activeSessionId, editDraft, staleStages, artifacts])

  // ── Per-stage rebuild ─────────────────────────────────────────────────────
  const rebuildStage = useCallback(async (stageId: string) => {
    if (!activeSessionId || rebuildingStage) return
    setRebuildingStage(stageId)
    try {
      const res  = await fetch('/api/strategy/stage/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId, stage: stageId }),
      })
      const data = await res.json() as { task_id?: string }
      if (data.task_id) {
        setStageTaskIds(prev => ({ ...prev, [stageId]: data.task_id! }))
        setRunningStages(prev => new Set([...prev, stageId]))
        setStaleStages(prev => { const n = new Set(prev); n.delete(stageId); return n })
        setPipelineRunning(true)
      }
    } finally { setRebuildingStage(null) }
  }, [activeSessionId, rebuildingStage])

  // ── Re-run pipeline ───────────────────────────────────────────────────────
  const rerunPipeline = useCallback(async () => {
    if (!activeSessionId || rerunning) return
    setRerunning(true)
    setPipelineError(null)
    try {
      const res  = await fetch('/api/strategy/flow/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId }),
      })
      const data = await res.json()
      if (!res.ok) { setPipelineError(data.error ?? 'Re-run failed'); return }
      setPipelineTaskId(data.task_id)
      setPipelineRunning(true)
      setPhases([])
    } catch { setPipelineError('Re-run failed — check the console') }
    finally { setRerunning(false) }
  }, [activeSessionId, rerunning])

  // ── Delete session ────────────────────────────────────────────────────────
  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/strategy/sessions/${sessionId}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId)
      setActiveSessionId(remaining[0]?.id ?? null)
    }
  }, [activeSessionId, sessions])

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    let sid = activeSessionId
    if (!sid) {
      const res  = await fetch('/api/strategy/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'profile_builder_web' }),
      })
      const data = await res.json()
      sid = data.session.id as string
      setSessions(prev => [data.session, ...prev])
      setActiveSessionId(sid)
      setMessages(prev => ({ ...prev, [sid!]: [] }))
    }

    const optimistic: ChatMessage = { id: `opt-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages(prev => ({ ...prev, [sid!]: [...(prev[sid!] ?? []), optimistic] }))
    setInput('')
    setStreaming(true)
    setStreamBuffer('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/strategy/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, agent: 'profile_builder_web', message: text }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const d = line.slice(6).trim()
          if (d === '[DONE]') continue
          if (d.startsWith('{')) {
            try {
              const parsed = JSON.parse(d)
              if (parsed.token !== undefined) {
                acc += parsed.token
                setStreamBuffer(acc)
                const preview = extractJsonBlock(acc)
                if (preview) setDraftPreviews(prev => ({ ...prev, [sid!]: preview }))
              }
              // Per-stage progressive signal
              if (parsed.stage_signal && parsed.stage_task_id) {
                const sId = parsed.stage_signal as string
                const tId = parsed.stage_task_id as string
                setStageTaskIds(prev => ({ ...prev, [sId]: tId }))
                setRunningStages(prev => new Set([...prev, sId]))
                setPipelineRunning(true)
                setPipelineTaskId(tId)
              }
              // Full pipeline triggered
              if (parsed.pipeline_task_id) {
                setPipelineTaskId(parsed.pipeline_task_id)
                setPipelineRunning(true)
                setPhases([])
              }
            } catch {}
          }
        }
      }

      const asst: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: acc, created_at: new Date().toISOString() }
      setMessages(prev => ({ ...prev, [sid!]: [...(prev[sid!] ?? []), asst] }))
      setStreamBuffer('')

      setSessions(prev => prev.map(s =>
        s.id === sid && s.title === 'New Analysis'
          ? { ...s, title: text.length > 50 ? text.slice(0, 47) + '…' : text, updated_at: new Date().toISOString() }
          : s
      ))
    } catch (err) {
      console.error(err)
      const errMsg: ChatMessage = { id: `e-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Please try again.', created_at: new Date().toISOString() }
      setMessages(prev => ({ ...prev, [sid!]: [...(prev[sid!] ?? []), errMsg] }))
      setStreamBuffer('')
    } finally {
      setStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, streaming, activeSessionId])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentMessages = activeSessionId ? (messages[activeSessionId] ?? null) : null
  const grouped         = groupSessions(sessions)
  const phaseMap        = new Map(phases.map(p => [p.name, p]))

  const getStageStatus = (stageId: string): 'done' | 'active' | 'stale' | 'idle' => {
    if (runningStages.has(stageId)) return 'active'
    if (staleStages.has(stageId)) return 'stale'
    // Artifact presence is the most reliable completion signal
    const stg = STAGES.find(s => s.id === stageId)
    if (stg && artifacts.find(a => a.entry_name === stg.artifactKey)) return 'done'
    const p = phaseMap.get(stageId)
    if (!p) return 'idle'
    if (p.status === 'completed') return 'done'
    if (['open', 'running', 'active', 'in_progress'].includes(p.status)) return 'active'
    return 'idle'
  }

  const draftPreview = activeSessionId ? (draftPreviews[activeSessionId] ?? null) : null
  const activeArtifactMeta    = artifacts.find(a => a.id === activeArtifact)
  const activeArtifactContent = activeArtifact ? artifactContents[activeArtifact] : null
  const activeArtifactDisplay = activeArtifactMeta ? ARTIFACT_META[activeArtifactMeta.entry_name] : null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .sp-btn { transition: background 160ms ease-out; cursor: pointer; border-radius: 6px; }
        .sp-btn:hover { background: var(--paper-3) !important; }
        .sp-session { transition: background 160ms ease-out; cursor: pointer; border-radius: 5px; }
        .sp-session:hover { background: var(--paper-3) !important; }
        .sp-art-tab { transition: all 140ms ease-out; cursor: pointer; }
        .sp-art-tab:hover { background: var(--paper-3) !important; border-radius: 5px; }
        .sp-send { transition: opacity 150ms; }
        .sp-send:hover:not(:disabled) { opacity: 0.82; }
        .sp-send:disabled { opacity: 0.38; cursor: default; }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes sp-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .sp-cursor::after { content:'▋'; display:inline-block; animation:sp-blink 1.1s step-end infinite; }
      `}</style>

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: D.bg, overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ───────────────────────────────────────────────── */}
        <div style={{
          width: sidebarOpen ? 260 : 48, minWidth: sidebarOpen ? 260 : 48,
          background: D.surface, borderRight: `1px solid ${D.border}`,
          display: 'flex', flexDirection: 'column', transition: 'width 200ms ease', overflow: 'hidden',
        }}>
          <div style={{ padding: sidebarOpen ? '14px 14px 10px' : '14px 0 10px', display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
            {sidebarOpen && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={14} color={D.accent} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: D.text, letterSpacing: '-0.01em' }}>SDR Sales Pack</span>
            </div>}
            <div style={{ display: 'flex', gap: '4px' }}>
              {sidebarOpen && <button className="sp-btn" title="New Chat" onClick={newSession} style={{ padding: '4px', background: 'transparent', border: 'none', color: D.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SquarePen size={14} /></button>}
              <button className="sp-btn" onClick={() => setSidebarOpen(o => !o)} style={{ padding: '4px', background: 'transparent', border: 'none', color: D.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>

          {sidebarOpen && <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 16px' }}>

            {/* Stage progress */}
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.textMuted, marginBottom: '8px', padding: '0 4px' }}>Pipeline Stages</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '18px' }}>
              {STAGES.map((s, idx) => {
                const st = getStageStatus(s.id)
                const isStale   = st === 'stale'
                const isActive  = st === 'active'
                const isDone    = st === 'done'
                const isRebuilding = rebuildingStage === s.id
                const hasArtifact = !!artifacts.find(a => a.entry_name === s.artifactKey)

                return <div key={s.id} style={{
                  borderRadius: '6px', overflow: 'hidden',
                  border: `1px solid ${isStale ? D.warn + '88' : isActive ? D.accent + '44' : 'transparent'}`,
                  background: isStale ? `${D.warn}11` : isActive ? D.accentSoft : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 8px' }}>
                    <div style={{ flexShrink: 0, color: isDone ? D.success : isActive ? D.accent : isStale ? D.warn : D.textMuted }}>
                      {isDone    ? <CheckCircle size={13} /> :
                       isActive  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> :
                       isStale   ? <AlertTriangle size={13} /> :
                       <Circle size={13} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: isStale ? D.warn : isActive ? D.accent : st === 'idle' ? D.text2 : D.text }}>
                        {idx + 1}. {s.label}
                      </div>
                      <div style={{ fontSize: '10px', color: isStale ? D.warn : D.textMuted, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isStale ? 'Needs rebuild' : s.description}
                      </div>
                    </div>
                    {/* Artifact expand shortcut */}
                    {isDone && hasArtifact && (
                      <button className="sp-btn" title="View artifact" onClick={() => {
                        const art = artifacts.find(a => a.entry_name === s.artifactKey)
                        if (art) { setActiveArtifact(art.id); setExpandedEntry(s.artifactKey) }
                      }} style={{ padding: '2px', background: 'transparent', border: 'none', color: D.textMuted, flexShrink: 0 }}>
                        <Expand size={10} />
                      </button>
                    )}
                  </div>
                  {/* Stale rebuild button */}
                  {isStale && (
                    <div style={{ padding: '0 8px 8px', paddingLeft: '30px' }}>
                      <button className="sp-btn" onClick={() => rebuildStage(s.id)} disabled={!!isRebuilding}
                        style={{ width: '100%', padding: '5px 10px', background: D.warn, color: '#fff', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        {isRebuilding ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={10} />}
                        Rebuild {s.label}
                      </button>
                    </div>
                  )}
                </div>
              })}
            </div>

            {/* Sessions history */}
            {sessions.length > 0 && <>
              <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.textMuted, marginBottom: '8px', padding: '0 4px' }}>Conversations</div>
              {grouped.map(group => <div key={group.label} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: D.textMuted, padding: '0 4px', marginBottom: '4px' }}>{group.label}</div>
                {group.items.map(session => <div key={session.id} className="sp-session"
                  style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: activeSessionId === session.id ? D.accentSoft : 'transparent' }}
                  onClick={() => setActiveSessionId(session.id)}
                  onMouseEnter={() => setHoveredSession(session.id)}
                  onMouseLeave={() => setHoveredSession(null)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: D.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</div>
                    <div style={{ fontSize: '10px', color: D.textMuted, marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={9} />{session.message_count || 0} messages
                    </div>
                  </div>
                  {hoveredSession === session.id && <button className="sp-btn" onClick={e => deleteSession(session.id, e)} style={{ padding: '3px', background: 'transparent', border: 'none', color: D.textMuted, flexShrink: 0 }}><Trash2 size={11} /></button>}
                </div>)}
              </div>)}
            </>}
          </div>}
        </div>

        {/* ── MIDDLE: CHAT ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Pipeline banner */}
          {pipelineRunning && <div style={{ padding: '8px 24px', background: D.accentSoft, borderBottom: `1px solid ${D.accent}44`, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <Loader2 size={12} color={D.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '12px', color: D.accent, fontWeight: 500 }}>Building your strategy pack — keep this tab open. Artifacts appear as each stage completes.</span>
          </div>}

          {/* Incomplete pipeline — re-run option */}
          {!pipelineRunning && pipelineTaskId && !STAGES.every(s => artifacts.find(a => a.entry_name === s.artifactKey)) && sessions.find(s => s.id === activeSessionId)?.context_text && (
            <div style={{ padding: '8px 24px', background: D.surface, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: D.text2, flex: 1 }}>
                {pipelineError
                  ? `Pipeline error: ${pipelineError}`
                  : `Pipeline stopped — ${artifacts.filter(a => STAGES.some(s => s.artifactKey === a.entry_name)).length} of ${STAGES.length} stages completed.`}
              </span>
              <button className="sp-btn" onClick={rerunPipeline} disabled={rerunning}
                style={{ padding: '5px 12px', background: D.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: rerunning ? 0.6 : 1 }}>
                {rerunning ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
                {rerunning ? 'Starting…' : 'Re-run Pipeline'}
              </button>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0 12px' }}>
            {!currentMessages || currentMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '60px 32px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: D.accentSoft, border: `1px solid ${D.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={22} color={D.accent} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: D.text, marginBottom: '8px' }}>Build your SDR strategy pack</div>
                  <div style={{ fontSize: '13px', color: D.text2, lineHeight: 1.6, maxWidth: '340px' }}>
                    Start a conversation. Tell me about your company — the AI will research it, ask only what it needs, and build your full strategy pack automatically.
                  </div>
                </div>
              </div>
            ) : (
              currentMessages.map(msg => {
                if (msg.role === 'status') return (
                  <div key={msg.id} style={{ padding: '4px 32px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: D.textMuted, fontStyle: 'italic' }}>{msg.content}</span>
                  </div>
                )
                const isUser = msg.role === 'user'
                return <div key={msg.id} style={{ padding: '6px 32px', display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '72%', padding: '10px 14px',
                    borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: isUser ? D.accent : D.surface2,
                    color: isUser ? '#fff' : D.text,
                    fontSize: '13.5px', lineHeight: 1.65,
                    border: isUser ? 'none' : `1px solid ${D.border}`,
                  }}>
                    {msg.content.split('\n').map((line, i, arr) => <span key={i}>{line}{i < arr.length - 1 && <br />}</span>)}
                  </div>
                </div>
              })
            )}

            {/* Streaming buffer */}
            {streaming && streamBuffer && (
              <div style={{ padding: '6px 32px', display: 'flex', justifyContent: 'flex-start' }}>
                <div className="sp-cursor" style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: '12px 12px 12px 3px', background: D.surface2, color: D.text, fontSize: '13.5px', lineHeight: 1.65, border: `1px solid ${D.border}` }}>
                  {streamBuffer.replace(/```json[\s\S]*?```/g, '').trim() || <span style={{ color: D.textMuted, fontStyle: 'italic', fontSize: '11px' }}>Generating preview…</span>}
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {streaming && !streamBuffer && (
              <div style={{ padding: '6px 32px', display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: '12px 12px 12px 3px', background: D.surface2, border: `1px solid ${D.border}`, display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: D.textMuted, animation: `sp-blink 1.4s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 24px 20px', borderTop: `1px solid ${D.border}`, background: D.bg, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', padding: '10px 14px', background: D.surface, borderRadius: '12px', border: `1px solid ${streaming ? D.accent + '66' : D.border}` }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
                }}
                onKeyDown={onKeyDown}
                placeholder={streaming ? 'AI is thinking…' : 'Tell me about your company…'}
                disabled={streaming}
                rows={1}
                style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '13.5px', color: D.text, lineHeight: 1.6, minHeight: '24px', maxHeight: '140px', overflowY: 'auto', paddingTop: '2px', fontFamily: 'inherit' }}
              />
              <button className="sp-send" onClick={sendMessage} disabled={!input.trim() || streaming}
                style={{ padding: '6px', background: D.accent, color: '#fff', border: 'none', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: ARTIFACTS ───────────────────────────────────────────── */}
        <div style={{ width: 360, minWidth: 360, borderLeft: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface }}>
          <div style={{ padding: '10px 12px 0', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.textMuted, marginBottom: '8px' }}>Artifacts</div>
            {artifacts.length > 0 ? (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingBottom: '8px', alignItems: 'center' }}>
                {artifacts.map(a => {
                  const meta = ARTIFACT_META[a.entry_name]
                  if (!meta) return null
                  const isActive = activeArtifact === a.id
                  return <button key={a.id} className="sp-art-tab" onClick={() => setActiveArtifact(a.id)}
                    style={{ padding: '3px 9px', fontSize: '11px', fontWeight: isActive ? 600 : 400, color: isActive ? meta.color : D.text2, background: isActive ? `${meta.color}18` : 'transparent', border: `1px solid ${isActive ? meta.color + '55' : D.border}`, borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {meta.icon}{meta.label}
                  </button>
                })}
                {/* Re-run button */}
                {activeSessionId && sessions.find(s => s.id === activeSessionId)?.context_text && (
                  <button className="sp-btn" onClick={rerunPipeline} disabled={rerunning || pipelineRunning}
                    title="Re-run full pipeline"
                    style={{ marginLeft: 'auto', padding: '3px 8px', background: 'transparent', border: `1px solid ${D.border}`, borderRadius: '5px', fontSize: '11px', color: D.text2, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', opacity: (rerunning || pipelineRunning) ? 0.5 : 1 }}>
                    {rerunning ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={10} />}
                    Re-run
                  </button>
                )}
              </div>
            ) : (
              <div style={{ paddingBottom: '10px', fontSize: '12px', color: D.textMuted }}>
                {pipelineRunning ? 'Artifacts will appear as each stage completes.' : 'Chat to build your strategy pack. Artifacts appear here.'}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
            {/* Draft preview */}
            {!activeArtifactContent && draftPreview && (
              <div style={{ marginBottom: '16px', padding: '12px', background: D.surface2, borderRadius: '8px', border: `1px dashed ${D.border2}` }}>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: D.textMuted, marginBottom: '8px' }}>Preview (draft)</div>
                <ArtifactView entryName={Object.keys(draftPreview)[0] ?? ''} data={draftPreview} />
              </div>
            )}

            {activeArtifactContent && activeArtifactMeta ? (
              <>
                {/* Artifact header with expand + edit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                  <span style={{ color: activeArtifactDisplay?.color }}>{activeArtifactDisplay?.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: D.text }}>{activeArtifactDisplay?.label}</span>
                  {staleStages.has(ARTIFACT_TO_STAGE[activeArtifactMeta.entry_name] ?? '') && (
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: `${D.warn}22`, color: D.warn, border: `1px solid ${D.warn}44` }}>stale</span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <button className="sp-btn" title="Edit artifact" onClick={() => {
                      setEditingEntry(activeArtifactMeta.entry_name)
                      setEditDraft(JSON.stringify(activeArtifactContent, null, 2))
                    }} style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${D.border}`, borderRadius: '5px', color: D.text2, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                      <Pencil size={10} />Edit
                    </button>
                    <button className="sp-btn" title="Expand view" onClick={() => setExpandedEntry(activeArtifactMeta.entry_name)}
                      style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${D.border}`, borderRadius: '5px', color: D.text2, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                      <Expand size={10} />Expand
                    </button>
                    <button className="sp-btn" onClick={() => loadArtifacts()} style={{ padding: '4px', background: 'transparent', border: 'none', color: D.textMuted }}><RefreshCw size={11} /></button>
                  </div>
                </div>
                <ArtifactView entryName={activeArtifactMeta.entry_name} data={activeArtifactContent} />
              </>
            ) : !draftPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: D.textMuted }}>
                <FileText size={32} style={{ opacity: 0.3 }} />
                <div style={{ textAlign: 'center', fontSize: '12.5px', lineHeight: 1.6 }}>Start chatting to generate your strategy pack.</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── EXPAND MODAL ───────────────────────────────────────────────── */}
      {expandedEntry && (() => {
        const art = artifacts.find(a => a.entry_name === expandedEntry)
        const content = art ? artifactContents[art.id] : null
        const meta = ARTIFACT_META[expandedEntry]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={() => setExpandedEntry(null)}>
            <div style={{ background: D.bg, borderRadius: '12px', border: `1px solid ${D.border}`, width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ color: meta?.color }}>{meta?.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: D.text }}>{meta?.label}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button className="sp-btn" onClick={() => {
                    setEditingEntry(expandedEntry)
                    setEditDraft(JSON.stringify(content, null, 2))
                    setExpandedEntry(null)
                  }} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '12px', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Pencil size={11} />Edit
                  </button>
                  <button className="sp-btn" onClick={() => setExpandedEntry(null)} style={{ padding: '5px', background: 'transparent', border: 'none', color: D.textMuted, cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              {/* Two-column: formatted view + raw JSON */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', borderRight: `1px solid ${D.border}` }}>
                  {content ? <ArtifactView entryName={expandedEntry} data={content} /> : <span style={{ color: D.textMuted }}>No content</span>}
                </div>
                <div style={{ width: '340px', overflowY: 'auto', padding: '16px', background: D.surface }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.textMuted, marginBottom: '8px' }}>Raw JSON</div>
                  <pre style={{ fontSize: '10.5px', color: D.text2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, margin: 0 }}>
                    {JSON.stringify(content, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── EDIT MODAL ─────────────────────────────────────────────────── */}
      {editingEntry && (() => {
        const meta = ARTIFACT_META[editingEntry]
        let previewData: Record<string, unknown> | null = null
        try { previewData = JSON.parse(editDraft) } catch {}

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: D.bg, borderRadius: '12px', border: `1px solid ${D.border}`, width: '100%', maxWidth: '960px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ color: meta?.color }}>{meta?.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: D.text }}>Edit — {meta?.label}</span>
                <div style={{ fontSize: '12px', color: D.warn, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={12} /> Editing will mark downstream stages as stale
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button className="sp-btn" onClick={() => setEditingEntry(null)}
                    style={{ padding: '5px 14px', background: 'transparent', border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '12.5px', color: D.text2, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button className="sp-btn" onClick={saveArtifactEdit} disabled={savingEdit || !previewData}
                    style={{ padding: '5px 14px', background: D.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (savingEdit || !previewData) ? 0.6 : 1 }}>
                    {savingEdit ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                    Save Changes
                  </button>
                </div>
              </div>
              {/* Editor + Live preview */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* JSON Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${D.border}` }}>
                  <div style={{ padding: '8px 16px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.textMuted, borderBottom: `1px solid ${D.border}`, background: D.surface }}>
                    JSON Editor
                    {!previewData && <span style={{ marginLeft: '8px', color: D.bad, fontWeight: 400 }}>Invalid JSON</span>}
                  </div>
                  <textarea
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    spellCheck={false}
                    style={{
                      flex: 1, width: '100%', padding: '16px', fontFamily: 'monospace', fontSize: '12px',
                      color: D.text, background: D.bg, border: 'none', resize: 'none', lineHeight: 1.6,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Live preview */}
                <div style={{ width: '380px', overflowY: 'auto', padding: '16px', background: D.surface }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.textMuted, marginBottom: '12px' }}>Live Preview</div>
                  {previewData
                    ? <ArtifactView entryName={editingEntry} data={previewData} />
                    : <div style={{ color: D.textMuted, fontSize: '12px', fontStyle: 'italic' }}>Fix JSON errors to see preview</div>
                  }
                </div>
              </div>
            </div>
          </div>
        )
      })()}

    </>
  )
}
