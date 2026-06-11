'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Save, Loader2, CheckCircle, AlertCircle, FileText, Eye } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CMDStage {
  id: string; label: string; motion: string
  swarmName: string; description: string
  x: number; y: number
}

interface CMDEdge { from: string; to: string }

interface CmdSession {
  id: string; title: string; task_id: string | null
  status: string; created_at: string
}

interface StageRecord {
  stage_id: string; label: string; motion: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string; completed_at?: string; duration_ms?: number
}

// ─── Layout constants (left-to-right columns per motion) ─────────────────────

const NODE_W = 148, NODE_H = 44

// Each motion is a vertical column; columns flow left → right
const COL_X: Record<string, number> = { M0: 60, M1: 310, M2: 560, M3: 810, M4: 1060 }
const COL_STRIDE = 250  // distance between column left edges

// Nodes within each column are stacked vertically, centred in the canvas
// Using stride=120 and centering around y=240 (mid of range 60–420)
const COL_Y: Record<string, number[]> = {
  M0: [240],
  M1: [180, 300],
  M2: [120, 240, 360],
  M3: [60,  180, 300, 420],
  M4: [60,  180, 300, 420],
}

const CANVAS_W = 1060 + NODE_W + 52   // last column right edge + padding
const CANVAS_H = 420  + NODE_H + 56   // deepest node bottom + padding

// ─── Stage definitions ────────────────────────────────────────────────────────

function makeStages(): CMDStage[] {
  const defs: Omit<CMDStage, 'x' | 'y'>[] = [
    { id: 'inspiration_researcher', label: 'inspiration-researcher', motion: 'M0', swarmName: 'inspiration-researcher', description: 'Researches trending topics, competitive content gaps, and audience signals' },
    { id: 'idea_generator',         label: 'idea-generator',         motion: 'M1', swarmName: 'idea-generator',         description: 'Generates a batch of content ideas from inspiration data and audience pain points' },
    { id: 'idea_scorer',            label: 'idea-scorer',            motion: 'M1', swarmName: 'idea-scorer',            description: 'Scores and ranks each idea by SEO potential, audience fit, and uniqueness' },
    { id: 'concept_builder',        label: 'concept-builder',        motion: 'M2', swarmName: 'concept-builder',        description: 'Expands top ideas into full content concepts with angles and key takeaways' },
    { id: 'structure_builder',      label: 'structure-builder',      motion: 'M2', swarmName: 'structure-builder',      description: 'Builds detailed outlines and H2/H3 heading structures for each concept' },
    { id: 'content_reviewer',       label: 'content-reviewer',       motion: 'M2', swarmName: 'content-reviewer',       description: 'Reviews all concepts and selects the best one for full production' },
    { id: 'content_researcher',     label: 'content-researcher',     motion: 'M3', swarmName: 'content-researcher',     description: 'Deep-researches the chosen concept — facts, data, examples, and statistics' },
    { id: 'draft_writer',           label: 'draft-writer',           motion: 'M3', swarmName: 'draft-writer',           description: 'Writes the first full draft using research, structure, and brand voice' },
    { id: 'humanizer',              label: 'humanizer',              motion: 'M3', swarmName: 'humanizer',              description: 'Rewrites AI-sounding passages to feel authentic and human' },
    { id: 'draft_editor',           label: 'draft-editor',           motion: 'M3', swarmName: 'draft-editor',           description: 'Final editorial pass: clarity, flow, SEO improvements, and CTA sharpening' },
    { id: 'publisher',              label: 'publisher',              motion: 'M4', swarmName: 'publisher',              description: 'Packages the final draft for publishing — formats, metadata, and tags' },
    { id: 'tracker',                label: 'tracker',                motion: 'M4', swarmName: 'tracker',                description: 'Logs performance tracking setup: UTMs, target KPIs, and benchmarks' },
    { id: 'feedback_synthesizer',   label: 'feedback-synthesizer',   motion: 'M4', swarmName: 'feedback-synthesizer',   description: 'Collects and synthesises feedback signals after the content goes live' },
    { id: 'manual_reviewer',        label: 'manual-reviewer',        motion: 'M4', swarmName: 'manual-reviewer',        description: 'Human review checkpoint before finalising the content cycle' },
  ]
  const idxByMotion: Record<string, number> = {}
  return defs.map(d => {
    const i = idxByMotion[d.motion] ?? 0
    idxByMotion[d.motion] = i + 1
    return { ...d, x: COL_X[d.motion], y: COL_Y[d.motion][i] }
  })
}

const STAGES: CMDStage[] = makeStages()

const EDGES: CMDEdge[] = [
  { from: 'inspiration_researcher', to: 'idea_generator' },
  { from: 'idea_generator',         to: 'idea_scorer' },
  { from: 'idea_scorer',            to: 'concept_builder' },
  { from: 'concept_builder',        to: 'structure_builder' },
  { from: 'structure_builder',      to: 'content_reviewer' },
  { from: 'content_reviewer',       to: 'content_researcher' },
  { from: 'content_researcher',     to: 'draft_writer' },
  { from: 'draft_writer',           to: 'humanizer' },
  { from: 'humanizer',              to: 'draft_editor' },
  { from: 'draft_editor',           to: 'publisher' },
  { from: 'publisher',              to: 'tracker' },
  { from: 'tracker',                to: 'feedback_synthesizer' },
  { from: 'feedback_synthesizer',   to: 'manual_reviewer' },
]

// ─── Motion config ────────────────────────────────────────────────────────────

const MOTIONS = ['M0', 'M1', 'M2', 'M3', 'M4']

const MOTION_META: Record<string, { label: string; color: string; fillBg: string; strokeColor: string }> = {
  M0: { label: 'Inspiration', color: 'var(--info)',   fillBg: '#e8f3fb', strokeColor: '#4d8fb5' },
  M1: { label: 'Ideation',    color: 'var(--accent)', fillBg: '#eeebff', strokeColor: '#6e56b5' },
  M2: { label: 'Concepts',    color: 'var(--good)',   fillBg: '#e6f5ec', strokeColor: '#4b8f63' },
  M3: { label: 'Drafts',      color: 'var(--warn)',   fillBg: '#faf2e4', strokeColor: '#b58a4d' },
  M4: { label: 'Publish',     color: 'var(--bad)',    fillBg: '#fbe9e9', strokeColor: '#b54d4d' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEdgePath(from: CMDStage, to: CMDStage): string {
  const fcy = from.y + NODE_H / 2
  const tcy = to.y   + NODE_H / 2
  if (from.motion === to.motion) {
    // Same column → vertical connection: bottom of source to top of target
    const fcx = from.x + NODE_W / 2
    const fy = from.y + NODE_H, ty = to.y
    const midY = (fy + ty) / 2
    return `M ${fcx} ${fy} C ${fcx} ${midY}, ${fcx} ${midY}, ${fcx} ${ty}`
  }
  // Cross-column → horizontal bezier: right edge of source to left edge of target
  const fx = from.x + NODE_W, tx = to.x
  const midX = (fx + tx) / 2
  return `M ${fx} ${fcy} C ${midX} ${fcy}, ${midX} ${tcy}, ${tx} ${tcy}`
}

function duration(start?: string, end?: string) {
  if (!start) return '—'
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
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

function fmtDuration(ms: number) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'var(--good-soft)',   color: 'var(--good)' },
    running:   { bg: 'var(--info-soft)',   color: 'var(--info)' },
    failed:    { bg: 'var(--accent-tint)', color: 'var(--accent)' },
    open:      { bg: 'var(--info-soft)',   color: 'var(--info)' },
    idle:      { bg: 'var(--paper-3)',     color: 'var(--ink-3)' },
  }
  const s = map[status] ?? { bg: 'var(--paper-3)', color: 'var(--ink-3)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: s.bg, color: s.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {status}
    </span>
  )
}

// ─── Prompt panel ─────────────────────────────────────────────────────────────

type PanelTab = 'prompt' | 'info'

function PromptPanel({ stage, onClose }: { stage: CMDStage; onClose: () => void }) {
  const [tab,          setTab]          = useState<PanelTab>('prompt')
  const [content,      setContent]      = useState<string | null>(null)
  const [edited,       setEdited]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveStatus,   setSaveStatus]   = useState<'idle' | 'saved' | 'error'>('idle')
  const [dirty,        setDirty]        = useState(false)
  const meta = MOTION_META[stage.motion]

  useEffect(() => {
    setLoading(true); setSaveStatus('idle'); setDirty(false)
    fetch(`/api/cmd/prompts/${stage.id}`)
      .then(r => r.json())
      .then(d => {
        const c = d.content ?? null
        setContent(c); setEdited(c ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [stage.id])

  async function save() {
    setSaving(true); setSaveStatus('idle')
    try {
      const res = await fetch(`/api/cmd/prompts/${stage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: edited }),
      })
      if (!res.ok) throw new Error()
      setContent(edited); setDirty(false); setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const TABS: { id: PanelTab; icon: React.ReactNode; label: string }[] = [
    { id: 'prompt', icon: <FileText size={12} />, label: 'Prompt' },
    { id: 'info',   icon: <Eye size={12} />,      label: 'Info'   },
  ]

  return (
    <div style={{ width: 380, flexShrink: 0, background: 'var(--paper-2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: meta.strokeColor, marginBottom: 3 }}>{stage.motion} · {meta.label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all', color: 'var(--ink)' }}>{stage.label}</div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{stage.description}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 8, padding: '3px 7px', fontSize: 11, color: 'var(--ink-4)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'var(--paper)', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: `${meta.fillBg}`, color: meta.strokeColor, border: `1px solid ${meta.strokeColor}44` }}>
            {stage.motion} — {meta.label}
          </span>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--ink-4)', fontSize: 12 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : (
          <>
            {tab === 'prompt' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {content === null ? (
                  <div style={{ padding: '20px 16px', color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic' }}>
                    Prompt file not found for this stage.
                  </div>
                ) : (
                  <textarea
                    value={edited}
                    onChange={e => { setEdited(e.target.value); setDirty(e.target.value !== content) }}
                    style={{
                      flex: 1, padding: '14px', fontSize: '11.5px', lineHeight: 1.65,
                      fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)',
                      background: 'var(--paper)', border: 'none', outline: 'none', resize: 'none',
                    }}
                    spellCheck={false}
                  />
                )}
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {saveStatus === 'saved' && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--good)' }}><CheckCircle size={12} /> Saved</span>}
                  {saveStatus === 'error' && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--bad)' }}><AlertCircle size={12} /> Save failed</span>}
                  <div style={{ flex: 1 }} />
                  {dirty && <span style={{ fontSize: 11, color: 'var(--warn)' }}>Unsaved changes</span>}
                  <button
                    onClick={save} disabled={saving || !dirty}
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

            {tab === 'info' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Swarm key</div>
                  <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', background: 'var(--paper-3)', padding: '6px 10px', borderRadius: 5 }}>
                    cmd:core:{stage.swarmName}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Motion</div>
                  <div style={{ fontSize: 11.5, color: meta.strokeColor, fontWeight: 600 }}>{stage.motion} — {meta.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Prompt file</div>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-3)', background: 'var(--paper-3)', padding: '6px 10px', borderRadius: 5, wordBreak: 'break-all' }}>
                    cmd/core/swarms/{stage.swarmName}/prompts/headless.md
                  </div>
                </div>
                {(() => {
                  const deps = EDGES.filter(e => e.to === stage.id).map(e => e.from)
                  const prods = EDGES.filter(e => e.from === stage.id).map(e => e.to)
                  return (
                    <>
                      {deps.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Receives from</div>
                          {deps.map(d => <div key={d} style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', marginBottom: 3 }}>← {d}</div>)}
                        </div>
                      )}
                      {prods.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Passes to</div>
                          {prods.map(p => <div key={p} style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', marginBottom: 3 }}>→ {p}</div>)}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Blueprint tab ────────────────────────────────────────────────────────────

function BlueprintTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedStage = STAGES.find(s => s.id === selectedId) ?? null

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--line-2) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundColor: 'var(--paper)' }}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ display: 'block', minWidth: CANVAS_W }}>
          <defs>
            <marker id="arr"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--ink-4)" opacity="0.7" /></marker>
            <marker id="arr-a" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--accent)" /></marker>
          </defs>

          {/* Motion column backgrounds */}
          {MOTIONS.map((m, i) => {
            const meta   = MOTION_META[m]
            const bandX  = i * COL_STRIDE
            const bandW  = i < MOTIONS.length - 1 ? COL_STRIDE : CANVAS_W - bandX
            return (
              <rect key={m} x={bandX} y={0} width={bandW} height={CANVAS_H}
                fill={meta.fillBg} opacity={0.45} rx={0} />
            )
          })}

          {/* Motion column labels (top of each column) */}
          {MOTIONS.map((m, i) => {
            const meta  = MOTION_META[m]
            const bandX = i * COL_STRIDE + COL_STRIDE / 2
            return (
              <text key={m}
                x={bandX} y={18}
                textAnchor="middle" fontSize="9"
                fontFamily="'Instrument Sans', sans-serif"
                fill={meta.strokeColor} fontWeight={700} letterSpacing="0.08em">
                {m} · {meta.label.toUpperCase()}
              </text>
            )
          })}

          {/* Edges */}
          {EDGES.map((edge, i) => {
            const from = STAGES.find(s => s.id === edge.from)
            const to   = STAGES.find(s => s.id === edge.to)
            if (!from || !to) return null
            const hi = selectedId === edge.from || selectedId === edge.to
            return (
              <path key={i} d={buildEdgePath(from, to)}
                fill="none"
                stroke={hi ? 'var(--accent)' : 'var(--ink-4)'}
                strokeWidth={hi ? 1.8 : 1.2}
                opacity={hi ? 1 : 0.5}
                markerEnd={hi ? 'url(#arr-a)' : 'url(#arr)'}
                style={{ transition: 'stroke 0.15s' }}
              />
            )
          })}

          {/* Nodes */}
          {STAGES.map(stage => {
            const isSel = stage.id === selectedId
            const meta  = MOTION_META[stage.motion]
            return (
              <g key={stage.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(isSel ? null : stage.id)}>
                <rect
                  x={stage.x} y={stage.y} width={NODE_W} height={NODE_H} rx={5}
                  fill={isSel ? meta.fillBg : 'var(--paper)'}
                  stroke={isSel ? 'var(--accent)' : meta.strokeColor}
                  strokeWidth={isSel ? 2 : 1.2}
                />
                <text x={stage.x + NODE_W / 2} y={stage.y + 17}
                  textAnchor="middle" fontSize="10.5"
                  fontFamily="'JetBrains Mono', monospace"
                  fill="var(--ink-2)" fontWeight={isSel ? '600' : '400'}>
                  {stage.label.length > 18 ? stage.label.slice(0, 17) + '…' : stage.label}
                </text>
                <text x={stage.x + NODE_W / 2} y={stage.y + 32}
                  textAnchor="middle" fontSize="8"
                  fontFamily="'Instrument Sans', sans-serif"
                  fill={meta.strokeColor} letterSpacing="0.06em" fontWeight="600">
                  SWARM · EDITABLE
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {MOTIONS.map(m => {
            const meta = MOTION_META[m]
            return (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 14, background: meta.fillBg, border: `1.5px solid ${meta.strokeColor}`, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{m} — {meta.label}</span>
              </div>
            )
          })}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 2, fontSize: 10, color: 'var(--ink-4)' }}>
            Click any node to view and edit its prompt
          </div>
        </div>
      </div>

      {/* Right panel */}
      {selectedStage
        ? <PromptPanel stage={selectedStage} onClose={() => setSelectedId(null)} />
        : (
          <div style={{ width: 260, flexShrink: 0, background: 'var(--paper-2)', borderLeft: '1px solid var(--line)', overflow: 'auto', padding: '20px 16px' }}>
            <div style={{ color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>Click a node to inspect it</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7 }}>
              All <strong style={{ color: 'var(--ink-2)', fontStyle: 'normal' }}>14 swarm nodes</strong> run headlessly in sequence. Each node has an editable <code style={{ fontSize: 10, background: 'var(--paper-3)', padding: '1px 5px', borderRadius: 3 }}>headless.md</code> prompt you can update here.
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 4 }}>Summary</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>14 editable swarms</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>5 motion phases (M0–M4)</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>13 sequential edges</div>
            </div>
          </div>
        )
      }
    </div>
  )
}

// ─── Runs tab ─────────────────────────────────────────────────────────────────

function RunsTab() {
  const [sessions,  setSessions]  = useState<CmdSession[]>([])
  const [stages,    setStages]    = useState<Record<string, StageRecord[]>>({})
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/cmd/sessions')
      const data = await res.json()
      setSessions((data.sessions ?? []).filter((s: CmdSession) => s.task_id))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleExpand(sessionId: string, taskId: string | null) {
    if (expanded === sessionId) { setExpanded(null); return }
    setExpanded(sessionId)
    if (!stages[sessionId] && taskId) {
      const res  = await fetch(`/api/cmd/stages?task_id=${taskId}`)
      const data = await res.json()
      setStages(prev => ({ ...prev, [sessionId]: data.stages ?? [] }))
    }
  }

  if (loading) return <div style={{ padding: '40px 32px', color: 'var(--ink-4)', fontSize: 13 }}>Loading runs…</div>
  if (sessions.length === 0) return <div style={{ padding: '40px 32px', color: 'var(--ink-4)', fontSize: 13, fontStyle: 'italic' }}>No pipeline runs yet. Start one from the Studio page.</div>

  return (
    <div style={{ padding: '0 0 32px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['', 'Title', 'Task ID', 'Status', 'Started', 'Duration'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, borderBottom: '1px solid var(--line)', background: 'var(--paper)', position: 'sticky', top: 0 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => {
            const isOpen    = expanded === s.id
            const stageList = stages[s.id] ?? []
            return [
              <tr key={s.id} onClick={() => toggleExpand(s.id, s.task_id)} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isOpen ? 'var(--accent-tint)' : undefined }}>
                <td style={{ padding: '10px 8px 10px 16px', width: 28 }}>
                  <div style={{ width: 18, height: 18, border: '1px solid var(--line-2)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isOpen ? 'var(--ink)' : 'var(--paper)' }}>
                    {isOpen ? <ChevronDown size={10} color="white" /> : <ChevronRight size={10} color="var(--ink-3)" />}
                  </div>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink)' }}>{s.title}</td>
                <td style={{ padding: '10px 16px', color: 'var(--ink-3)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{s.task_id}</td>
                <td style={{ padding: '10px 16px' }}><StatusPill status={s.status} /></td>
                <td style={{ padding: '10px 16px', color: 'var(--ink-3)' }}>{relativeTime(s.created_at)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--ink-3)' }}>{duration(s.created_at)}</td>
              </tr>,
              isOpen && (
                <tr key={`${s.id}-stages`} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td colSpan={6} style={{ padding: 0, background: 'var(--paper-2)' }}>
                    <div style={{ padding: '6px 16px 12px 48px' }}>
                      {stageList.length === 0
                        ? <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '8px 0' }}>No stage data yet</div>
                        : stageList.map(stage => {
                            const mm = MOTION_META[stage.motion]
                            return (
                              <div key={stage.stage_id} style={{ display: 'grid', gridTemplateColumns: '8px 1fr 100px 80px 90px', gap: 12, alignItems: 'center', padding: '7px 10px', fontSize: 12, borderLeft: `2px solid ${mm?.strokeColor ?? 'var(--line)'}`, marginLeft: 6, background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: mm?.strokeColor ?? 'var(--ink-4)', flexShrink: 0 }} />
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink)' }}>{stage.label}</span>
                                <StatusPill status={stage.status} />
                                <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600 }}>{stage.motion}</span>
                                <span style={{ color: 'var(--ink-3)' }}>{stage.duration_ms ? fmtDuration(stage.duration_ms) : '—'}</span>
                              </div>
                            )
                          })
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CmdFlowPage() {
  const [tab, setTab] = useState<'blueprint' | 'runs'>('blueprint')

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ padding: '28px 32px 0', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>Flow Graph</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
          14 editable swarms across 5 motions (M0–M4) · click any node to edit its AI prompt
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
