'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Save, Loader2, CheckCircle, AlertCircle, FileText, Code2, Eye } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'artifact' | 'strategy' | 'prospect' | 'engagement'
type Phase = 'profile-builder' | 'sales-pipeline'

interface FlowNode {
  id: string; label: string; type: NodeType; x: number; y: number
  description: string; dependsOn?: string[]; produces?: string[]
  swarmKey?: string; phase?: Phase
}
interface Edge { from: string; to: string }

interface FlowSession {
  id: string; flow_id: string; task_id: string; status: string
  started_at: string; completed_at?: string
}
interface ExecSession {
  id: string; name: string; kind: string; status: string
  sequence_num?: number; started_at?: string; completed_at?: string
  total_tokens?: number
}

// ─── Static blueprint ─────────────────────────────────────────────────────────

const nodes: FlowNode[] = [
  // Phase 1 — profile-builder artifacts
  { id: 'company_raw',           label: 'company_raw',           type: 'artifact',  x: 80,   y: 200, phase: 'profile-builder', description: 'Raw company profile: name, product, value prop, features, differentiators' },
  { id: 'icp_data',              label: 'icp_data',              type: 'artifact',  x: 280,  y: 100, phase: 'profile-builder', description: 'Company + contact ICP: industries, sizes, triggers, titles, pain points', dependsOn: ['company_raw'] },
  { id: 'competitive_positioning',label:'competitive_positioning',type: 'artifact',  x: 280,  y: 300, phase: 'profile-builder', description: 'Competitor landscape, battlecards, positioning statement', dependsOn: ['company_raw', 'icp_data'] },
  { id: 'scoring_rubric',        label: 'scoring_rubric',        type: 'artifact',  x: 480,  y: 200, phase: 'profile-builder', description: 'Custom lead scoring: dimensions, weights (sum=100), thresholds', dependsOn: ['company_raw', 'icp_data', 'competitive_positioning'] },
  { id: 'profile_documents',     label: 'profile_documents',     type: 'artifact',  x: 680,  y: 200, phase: 'profile-builder', description: 'Final docs: ICP Profile, Buyer Persona, Company Profile', dependsOn: ['company_raw', 'icp_data', 'competitive_positioning', 'scoring_rubric'] },

  // Phase 1 — profile-builder swarms
  { id: 'company-profiler',      label: 'company-profiler',      type: 'strategy',  x: 80,   y: 360, phase: 'profile-builder', swarmKey: 'sdr:core:company-profiler',       description: 'Extracts company name, product, value prop, features, differentiators from description text', produces: ['company_raw'] },
  { id: 'icp-builder',           label: 'icp-builder',           type: 'strategy',  x: 280,  y: 50,  phase: 'profile-builder', swarmKey: 'sdr:core:icp-builder',            description: 'Infers full ICP from company context — company criteria and contact criteria', dependsOn: ['company_raw'], produces: ['icp_data'] },
  { id: 'competition-researcher',label: 'competition-researcher',type: 'strategy',  x: 280,  y: 460, phase: 'profile-builder', swarmKey: 'sdr:core:competition-researcher',  description: 'Researches competitive landscape from first principles; produces battlecards', dependsOn: ['company_raw', 'icp_data'], produces: ['competitive_positioning'] },
  { id: 'scoring-rubric-builder',label: 'scoring-rubric-builder',type: 'strategy',  x: 480,  y: 360, phase: 'profile-builder', swarmKey: 'sdr:core:scoring-rubric-builder',  description: 'Builds custom scoring rubric — selects 4-6 dimensions, assigns weights summing to 100', dependsOn: ['company_raw', 'icp_data', 'competitive_positioning'], produces: ['scoring_rubric'] },
  { id: 'profile-writer',        label: 'profile-writer',        type: 'strategy',  x: 680,  y: 360, phase: 'profile-builder', swarmKey: 'sdr:core:profile-writer',          description: 'Synthesises all 4 inputs into 3 formal documents: ICP Profile, Buyer Persona, Company Profile', dependsOn: ['company_raw', 'icp_data', 'competitive_positioning', 'scoring_rubric'], produces: ['profile_documents'] },

  // Phase 2 — sales-pipeline swarms
  { id: 'lead-researcher',       label: 'lead-researcher',       type: 'prospect',  x: 940,  y: 100, phase: 'sales-pipeline', swarmKey: 'sdr:core:lead-researcher',         description: 'Finds companies matching the ICP using Clay MCP or synthetic data (dry_run)', dependsOn: ['profile_documents'] },
  { id: 'lead-scorer',           label: 'lead-scorer',           type: 'prospect',  x: 940,  y: 260, phase: 'sales-pipeline', swarmKey: 'sdr:core:lead-scorer',             description: 'Scores each lead against the scoring rubric; marks pass/fail at threshold', dependsOn: ['scoring_rubric'] },
  { id: 'deep-researcher',       label: 'deep-researcher',       type: 'prospect',  x: 940,  y: 420, phase: 'sales-pipeline', swarmKey: 'sdr:core:deep-researcher',         description: 'Enriches qualified leads: recent news, decision maker data, personalization hooks', dependsOn: ['lead-scorer'] },
  { id: 'outreach-designer',     label: 'outreach-designer',     type: 'engagement',x: 1140, y: 200, phase: 'sales-pipeline', swarmKey: 'sdr:core:outreach-designer',       description: 'Designs outreach sequence: tone, CTAs, personalization rules, subject line formulas', dependsOn: ['deep-researcher'] },
  { id: 'email-composer',        label: 'email-composer',        type: 'engagement',x: 1140, y: 380, phase: 'sales-pipeline', swarmKey: 'sdr:core:email-composer',          description: 'Drafts personalized cold emails (primary + follow-up) guided by outreach strategy', dependsOn: ['outreach-designer'] },
  { id: 'email-sender',          label: 'email-sender',          type: 'engagement',x: 1340, y: 290, phase: 'sales-pipeline', swarmKey: 'sdr:core:email-sender',            description: 'Saves email drafts to DB — no emails are sent automatically', dependsOn: ['email-composer'] },
]

const edges: Edge[] = [
  { from: 'company-profiler',       to: 'company_raw' },
  { from: 'icp-builder',            to: 'icp_data' },
  { from: 'company_raw',            to: 'icp-builder' },
  { from: 'company_raw',            to: 'competition-researcher' },
  { from: 'icp_data',               to: 'competition-researcher' },
  { from: 'competition-researcher', to: 'competitive_positioning' },
  { from: 'company_raw',            to: 'scoring-rubric-builder' },
  { from: 'icp_data',               to: 'scoring-rubric-builder' },
  { from: 'competitive_positioning',to: 'scoring-rubric-builder' },
  { from: 'scoring-rubric-builder', to: 'scoring_rubric' },
  { from: 'company_raw',            to: 'profile-writer' },
  { from: 'icp_data',               to: 'profile-writer' },
  { from: 'competitive_positioning',to: 'profile-writer' },
  { from: 'scoring_rubric',         to: 'profile-writer' },
  { from: 'profile-writer',         to: 'profile_documents' },
  { from: 'profile_documents',      to: 'lead-researcher' },
  { from: 'lead-researcher',        to: 'lead-scorer' },
  { from: 'lead-scorer',            to: 'deep-researcher' },
  { from: 'deep-researcher',        to: 'outreach-designer' },
  { from: 'outreach-designer',      to: 'email-composer' },
  { from: 'email-composer',         to: 'email-sender' },
]

const NODE_W = 148, NODE_H = 44

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeCenter(n: FlowNode) { return { cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2 } }

function typeStyle(type: NodeType, selected: boolean) {
  const accent = selected ? 'var(--accent)' : undefined
  if (type === 'artifact')   return { fill: selected ? 'var(--accent-tint)' : '#ede5d5', stroke: accent ?? '#b39a6f', rx: 12 }
  if (type === 'strategy')   return { fill: selected ? 'var(--accent-tint)' : 'white',   stroke: accent ?? '#b39a6f', rx: 4 }
  if (type === 'prospect')   return { fill: selected ? 'var(--accent-tint)' : 'white',   stroke: accent ?? '#6f8fb3', rx: 4 }
  return                            { fill: selected ? 'var(--accent-tint)' : 'white',   stroke: accent ?? '#b36f6f', rx: 4 }
}

function typeLabelColor(type: NodeType) {
  if (type === 'artifact') return '#b39a6f'
  if (type === 'strategy') return '#b39a6f'
  if (type === 'prospect') return '#6f8fb3'
  return '#b36f6f'
}

function buildEdgePath(from: FlowNode, to: FlowNode) {
  const fc = nodeCenter(from), tc = nodeCenter(to)
  const fx = from.x + NODE_W, tx = to.x, fy = fc.cy, ty = tc.cy
  if (Math.abs(fx - tx) > 10) {
    const midX = (fx + tx) / 2
    return `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`
  }
  const fby = from.y + NODE_H, ttopy = to.y, midY = (fby + ttopy) / 2
  return `M ${fc.cx} ${fby} C ${fc.cx} ${midY}, ${tc.cx} ${midY}, ${tc.cx} ${ttopy}`
}

function relativeTime(iso?: string) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function duration(start?: string, end?: string) {
  if (!start) return '—'
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'var(--good-soft)',   color: 'var(--good)' },
    running:   { bg: 'var(--info-soft)',   color: 'var(--info)' },
    failed:    { bg: 'var(--accent-tint)', color: 'var(--accent)' },
    aborted:   { bg: 'var(--paper-3)',     color: 'var(--ink-3)' },
  }
  const s = map[status] ?? { bg: 'var(--paper-3)', color: 'var(--ink-3)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: s.bg, color: s.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {status}
    </span>
  )
}

// ─── Prompt editor panel ──────────────────────────────────────────────────────

type PanelTab = 'prompt' | 'schema' | 'info'

function PromptPanel({ node, onClose }: { node: FlowNode; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>('prompt')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [schema, setSchema] = useState<string | null>(null)
  const [editedPrompt, setEditedPrompt] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [dirty, setDirty] = useState(false)

  const hasSwarm = !!node.swarmKey

  useEffect(() => {
    if (!hasSwarm) return
    setLoading(true); setSaveStatus('idle'); setDirty(false)
    const encoded = encodeURIComponent(node.swarmKey!)
    fetch(`/api/swarms/${encoded}/prompt`)
      .then(r => r.json())
      .then(d => {
        setPrompt(d.prompt ?? null)
        setSchema(d.schema ?? null)
        setEditedPrompt(d.prompt ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [node.id, node.swarmKey, hasSwarm])

  async function save() {
    if (!node.swarmKey) return
    setSaving(true); setSaveStatus('idle')
    try {
      const encoded = encodeURIComponent(node.swarmKey)
      const res = await fetch(`/api/swarms/${encoded}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editedPrompt }),
      })
      if (!res.ok) throw new Error('Save failed')
      setPrompt(editedPrompt); setDirty(false); setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const TABS: { id: PanelTab; icon: React.ReactNode; label: string }[] = [
    { id: 'prompt', icon: <FileText size={12} />, label: 'Prompt' },
    { id: 'schema', icon: <Code2 size={12} />,   label: 'Schema' },
    { id: 'info',   icon: <Eye size={12} />,      label: 'Info' },
  ]

  return (
    <div style={{ width: 380, flexShrink: 0, background: 'var(--paper-2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: typeLabelColor(node.type), marginBottom: 3 }}>{node.type}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all', color: 'var(--ink)' }}>{node.label}</div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{node.description}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 8, padding: '3px 7px', fontSize: 11, color: 'var(--ink-4)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'var(--paper)', flexShrink: 0 }}>✕</button>
        </div>

        {/* Phase badge */}
        {node.phase && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: node.phase === 'profile-builder' ? 'var(--accent-tint)' : 'var(--info-soft)', color: node.phase === 'profile-builder' ? 'var(--accent)' : 'var(--info)' }}>
              Phase {node.phase === 'profile-builder' ? '1' : '2'} — {node.phase}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      {hasSwarm && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 13px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px',
              color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: tab === t.id ? 500 : 400, cursor: 'pointer', marginBottom: -1,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!hasSwarm ? (
          <div style={{ padding: '20px 16px', color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic' }}>
            This is an artifact node — it stores data produced by swarms, not a swarm itself.
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Produced by:</div>
              {nodes.filter(n => n.produces?.includes(node.id)).map(n => (
                <div key={n.id} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', marginBottom: 3 }}>→ {n.label}</div>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--ink-4)', fontSize: 12 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : (
          <>
            {/* Prompt tab */}
            {tab === 'prompt' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <textarea
                  value={editedPrompt}
                  onChange={e => { setEditedPrompt(e.target.value); setDirty(e.target.value !== prompt) }}
                  style={{
                    flex: 1, padding: '14px', fontSize: '11.5px', lineHeight: 1.65,
                    fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)',
                    background: 'var(--paper)', border: 'none', outline: 'none', resize: 'none',
                  }}
                  spellCheck={false}
                />
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {saveStatus === 'saved' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--good)' }}>
                      <CheckCircle size={12} /> Saved
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--bad)' }}>
                      <AlertCircle size={12} /> Save failed
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {dirty && <span style={{ fontSize: 11, color: 'var(--warn)' }}>Unsaved changes</span>}
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', fontSize: 12, fontWeight: 600,
                      background: dirty ? 'var(--ink)' : 'var(--paper-3)',
                      color: dirty ? 'var(--paper)' : 'var(--ink-4)',
                      border: 'none', borderRadius: 5, cursor: dirty ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s',
                    }}
                  >
                    {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                    Save prompt
                  </button>
                </div>
              </div>
            )}

            {/* Schema tab */}
            {tab === 'schema' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
                {schema ? (
                  <pre style={{ fontSize: '11px', lineHeight: 1.6, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                    {schema}
                  </pre>
                ) : (
                  <div style={{ color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic' }}>No output schema found for this swarm.</div>
                )}
              </div>
            )}

            {/* Info tab */}
            {tab === 'info' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Swarm key</div>
                  <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', background: 'var(--paper-3)', padding: '6px 10px', borderRadius: 5 }}>{node.swarmKey}</div>
                </div>
                {node.dependsOn && node.dependsOn.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Reads from</div>
                    {node.dependsOn.map(dep => (
                      <div key={dep} style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', marginBottom: 3 }}>← {dep}</div>
                    ))}
                  </div>
                )}
                {node.produces && node.produces.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Writes to</div>
                    {node.produces.map(p => (
                      <div key={p} style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', marginBottom: 3 }}>→ {p}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Runs tab ─────────────────────────────────────────────────────────────────

function RunsTab() {
  const [sessions, setSessions] = useState<FlowSession[]>([])
  const [stages, setStages] = useState<Record<string, ExecSession[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flow-sessions?limit=20')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleExpand(sessionId: string) {
    if (expanded === sessionId) { setExpanded(null); return }
    setExpanded(sessionId)
    if (!stages[sessionId]) {
      const r = await fetch(`/api/execution-sessions?flow_session_id=${sessionId}`)
      const d = await r.json()
      setStages(prev => ({ ...prev, [sessionId]: d.sessions ?? [] }))
    }
  }

  if (loading) return <div style={{ padding: '40px 32px', color: 'var(--ink-4)', fontSize: 13 }}>Loading runs…</div>
  if (sessions.length === 0) return <div style={{ padding: '40px 32px', color: 'var(--ink-4)', fontSize: 13, fontStyle: 'italic' }}>No flow runs yet. Start a flow from the Setup page.</div>

  return (
    <div style={{ padding: '0 0 32px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['', 'Flow', 'Task', 'Status', 'Started', 'Duration'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--ink-3)', fontWeight: 600, borderBottom: '1px solid var(--line)', background: 'var(--paper)', position: 'sticky' as const, top: 0 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => {
            const isOpen = expanded === s.id
            const stageList = stages[s.id] ?? []
            return [
              <tr key={s.id} onClick={() => toggleExpand(s.id)} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isOpen ? 'var(--accent-tint)' : undefined }}>
                <td style={{ padding: '10px 8px 10px 16px', width: 28 }}>
                  <div style={{ width: 18, height: 18, border: '1px solid var(--line-2)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isOpen ? 'var(--ink)' : 'var(--paper)' }}>
                    {isOpen ? <ChevronDown size={10} color="white" /> : <ChevronRight size={10} color="var(--ink-3)" />}
                  </div>
                </td>
                <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink)' }}>{s.flow_id}</td>
                <td style={{ padding: '10px 16px', color: 'var(--ink-3)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{s.task_id}</td>
                <td style={{ padding: '10px 16px' }}><StatusPill status={s.status} /></td>
                <td style={{ padding: '10px 16px', color: 'var(--ink-3)' }}>{relativeTime(s.started_at)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--ink-3)' }}>{duration(s.started_at, s.completed_at)}</td>
              </tr>,
              isOpen && (
                <tr key={`${s.id}-stages`} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td colSpan={6} style={{ padding: 0, background: 'var(--paper-2)' }}>
                    <div style={{ padding: '6px 16px 12px 48px' }}>
                      {stageList.length === 0
                        ? <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '8px 0' }}>No stages recorded</div>
                        : stageList
                            .sort((a, b) => (a.sequence_num ?? 0) - (b.sequence_num ?? 0))
                            .map(stage => (
                              <div key={stage.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr 100px 70px 90px', gap: 12, alignItems: 'center', padding: '7px 10px', fontSize: 12, borderLeft: '2px solid var(--line)', marginLeft: 6, background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                                <span style={{ color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>└</span>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink)' }}>{stage.name}</span>
                                <StatusPill status={stage.status} />
                                <span style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stage.kind}</span>
                                <span style={{ color: 'var(--ink-3)' }}>{duration(stage.started_at, stage.completed_at)}</span>
                              </div>
                            ))
                      }
                    </div>
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Blueprint tab ────────────────────────────────────────────────────────────

function BlueprintTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  const swarmCount = nodes.filter(n => n.swarmKey).length
  const artifactCount = nodes.filter(n => n.type === 'artifact').length

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--line-2) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundColor: 'var(--paper)' }}>
        <svg width={1560} height={580} style={{ display: 'block', minWidth: 1560 }}>
          <defs>
            <marker id="arr"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--ink-4)" opacity="0.7" /></marker>
            <marker id="arr-a" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--accent)" /></marker>
          </defs>

          {/* Phase 1 / Phase 2 separator line */}
          <line x1={860} y1={20} x2={860} y2={560} stroke="var(--line)" strokeWidth={1} strokeDasharray="6 4" opacity={0.6} />
          <text x={460} y={22} textAnchor="middle" fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill="var(--ink-4)" fontWeight={600} letterSpacing="0.06em">PHASE 1 — PROFILE BUILDER</text>
          <text x={1180} y={22} textAnchor="middle" fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill="var(--ink-4)" fontWeight={600} letterSpacing="0.06em">PHASE 2 — SALES PIPELINE</text>

          {edges.map((edge, i) => {
            const from = nodes.find(n => n.id === edge.from)
            const to   = nodes.find(n => n.id === edge.to)
            if (!from || !to) return null
            const hi = selectedId === edge.from || selectedId === edge.to
            return <path key={i} d={buildEdgePath(from, to)} fill="none" stroke={hi ? 'var(--accent)' : 'var(--ink-4)'} strokeWidth={hi ? 1.8 : 1.2} opacity={hi ? 1 : 0.55} markerEnd={hi ? 'url(#arr-a)' : 'url(#arr)'} style={{ transition: 'stroke 0.15s' }} />
          })}

          {nodes.map(node => {
            const isSel = node.id === selectedId
            const s = typeStyle(node.type, isSel)
            return (
              <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(isSel ? null : node.id)}>
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={s.rx} fill={s.fill} stroke={s.stroke} strokeWidth={isSel ? 2 : 1.2} />
                <text x={node.x + NODE_W / 2} y={node.y + 16} textAnchor="middle" fontSize="11" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-2)" fontWeight={isSel ? '600' : '400'}>
                  {node.label.length > 17 ? node.label.slice(0, 16) + '…' : node.label}
                </text>
                <text x={node.x + NODE_W / 2} y={node.y + 31} textAnchor="middle" fontSize="8.5" fontFamily="'Instrument Sans', sans-serif" fill={typeLabelColor(node.type)} letterSpacing="0.06em" fontWeight="600">
                  {node.type.toUpperCase()}{node.swarmKey ? ' · EDITABLE' : ''}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { swatch: '#ede5d5', border: '#b39a6f', label: 'Artifact (data store)', rx: true },
            { swatch: 'white',   border: '#b39a6f', label: 'Profile builder swarm', rx: false },
            { swatch: 'white',   border: '#6f8fb3', label: 'Sales pipeline swarm', rx: false },
            { swatch: 'white',   border: '#b36f6f', label: 'Engagement swarm', rx: false },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 14, background: item.swatch, border: `1.5px solid ${item.border}`, borderRadius: item.rx ? 5 : 2, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{item.label}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 2, fontSize: 10, color: 'var(--ink-4)' }}>
            Click any swarm node to view and edit its prompt
          </div>
        </div>
      </div>

      {/* Right panel */}
      {selectedNode
        ? <PromptPanel node={selectedNode} onClose={() => setSelectedId(null)} />
        : (
          <div style={{ width: 260, flexShrink: 0, background: 'var(--paper-2)', borderLeft: '1px solid var(--line)', overflow: 'auto', padding: '20px 16px' }}>
            <div style={{ color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>Click a node to inspect it</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--ink-2)', fontStyle: 'normal' }}>Swarm nodes</strong> (rounded rect) show the AI prompt and output schema. You can edit the prompt directly here.
              <br /><br />
              <strong style={{ color: 'var(--ink-2)', fontStyle: 'normal' }}>Artifact nodes</strong> (pill shape) store the structured data produced by swarms.
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 4 }}>Summary</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{swarmCount} editable swarms</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{artifactCount} artifact stores</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>2 flow phases</div>
            </div>
          </div>
        )
      }
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const [tab, setTab] = useState<'blueprint' | 'runs'>('blueprint')

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ padding: '28px 32px 0', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ marginBottom: 0 }}>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>Flow Graph</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            {nodes.filter(n => n.swarmKey).length} editable swarms across 2 phases · click any swarm to edit its AI prompt
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
          {(['blueprint', 'runs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 14px', fontSize: 12,
              color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: tab === t ? 500 : 400, cursor: 'pointer', marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t === 'runs' && <RefreshCw size={11} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'blueprint' ? <BlueprintTab /> : (
          <div style={{ flex: 1, overflow: 'auto' }}><RunsTab /></div>
        )}
      </div>
    </div>
  )
}
