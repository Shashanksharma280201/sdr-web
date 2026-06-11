'use client'

import { useState } from 'react'
import { GitMerge, Eye, EyeOff } from 'lucide-react'

const NODE_W = 148, NODE_H = 44

// ─── Layout constants ──────────────────────────────────────────────────────────
// Vertical: SDR occupies y=40–540; separator at 540–596; CMD at 596–1120
// Horizontal: Phase 1 zone = x 0–860 (separator at x=860); Phase 2 zone = x 860–1580
// CMD M0 is centred inside Phase 1 zone; CMD M1–M4 spread inside Phase 2 zone

const SDR_SEP_X  = 860          // SDR phase separator (also CMD zone boundary)
const CMD_Y_OFF  = 596           // CMD section starts
const CANVAS_W   = 1580
const CANVAS_H   = CMD_Y_OFF + 420 + NODE_H + 64   // ~1124

// CMD column x positions — aligned to SDR phase zones
const CMD_COL_X: Record<string, number> = {
  M0: 356,    // centred in Phase 1 zone (0–860, centre=430, x=430-74=356)
  M1: 876,    // Phase 2 zone split equally into 4 bands of 180px each
  M2: 1056,
  M3: 1236,
  M4: 1416,
}
const CMD_COL_Y: Record<string, number[]> = {
  M0: [240],
  M1: [180, 300],
  M2: [120, 240, 360],
  M3: [60,  180, 300, 420],
  M4: [60,  180, 300, 420],
}

// ─── SDR nodes ─────────────────────────────────────────────────────────────────
type SDRType  = 'artifact' | 'strategy' | 'prospect' | 'engagement'
interface SDRNode { id: string; label: string; x: number; y: number; type: SDRType; phase: 'profile-builder' | 'sales-pipeline' }

const SDR_NODES: SDRNode[] = [
  { id: 'company_raw',             label: 'company_raw',            type: 'artifact',   phase: 'profile-builder', x: 80,   y: 200 },
  { id: 'icp_data',                label: 'icp_data',               type: 'artifact',   phase: 'profile-builder', x: 280,  y: 100 },
  { id: 'competitive_positioning', label: 'competitive_pos…',       type: 'artifact',   phase: 'profile-builder', x: 280,  y: 300 },
  { id: 'scoring_rubric',          label: 'scoring_rubric',         type: 'artifact',   phase: 'profile-builder', x: 480,  y: 200 },
  { id: 'profile_documents',       label: 'profile_documents',      type: 'artifact',   phase: 'profile-builder', x: 680,  y: 200 },
  { id: 'company-profiler',        label: 'company-profiler',       type: 'strategy',   phase: 'profile-builder', x: 80,   y: 360 },
  { id: 'icp-builder',             label: 'icp-builder',            type: 'strategy',   phase: 'profile-builder', x: 280,  y: 50  },
  { id: 'competition-researcher',  label: 'competition-resear…',    type: 'strategy',   phase: 'profile-builder', x: 280,  y: 460 },
  { id: 'scoring-rubric-builder',  label: 'scoring-rubric-bui…',   type: 'strategy',   phase: 'profile-builder', x: 480,  y: 360 },
  { id: 'profile-writer',          label: 'profile-writer',         type: 'strategy',   phase: 'profile-builder', x: 680,  y: 360 },
  { id: 'lead-researcher',         label: 'lead-researcher',        type: 'prospect',   phase: 'sales-pipeline',  x: 940,  y: 100 },
  { id: 'lead-scorer',             label: 'lead-scorer',            type: 'prospect',   phase: 'sales-pipeline',  x: 940,  y: 260 },
  { id: 'deep-researcher',         label: 'deep-researcher',        type: 'prospect',   phase: 'sales-pipeline',  x: 940,  y: 420 },
  { id: 'outreach-designer',       label: 'outreach-designer',      type: 'engagement', phase: 'sales-pipeline',  x: 1140, y: 200 },
  { id: 'email-composer',          label: 'email-composer',         type: 'engagement', phase: 'sales-pipeline',  x: 1140, y: 380 },
  { id: 'email-sender',            label: 'email-sender',           type: 'engagement', phase: 'sales-pipeline',  x: 1340, y: 290 },
]

const SDR_EDGES = [
  ['company-profiler','company_raw'],['icp-builder','icp_data'],
  ['company_raw','icp-builder'],['company_raw','competition-researcher'],
  ['icp_data','competition-researcher'],['competition-researcher','competitive_positioning'],
  ['company_raw','scoring-rubric-builder'],['icp_data','scoring-rubric-builder'],
  ['competitive_positioning','scoring-rubric-builder'],['scoring-rubric-builder','scoring_rubric'],
  ['company_raw','profile-writer'],['icp_data','profile-writer'],
  ['competitive_positioning','profile-writer'],['scoring_rubric','profile-writer'],
  ['profile-writer','profile_documents'],['profile_documents','lead-researcher'],
  ['lead-researcher','lead-scorer'],['lead-scorer','deep-researcher'],
  ['deep-researcher','outreach-designer'],['outreach-designer','email-composer'],
  ['email-composer','email-sender'],
]

// ─── CMD nodes ─────────────────────────────────────────────────────────────────
interface CMDNode { id: string; label: string; x: number; y: number; motion: string }

const MOTION_META: Record<string, { fillBg: string; strokeColor: string; label: string }> = {
  M0: { label: 'Inspiration', fillBg: '#e8f3fb', strokeColor: '#4d8fb5' },
  M1: { label: 'Ideation',    fillBg: '#eeebff', strokeColor: '#6e56b5' },
  M2: { label: 'Concepts',    fillBg: '#e6f5ec', strokeColor: '#4b8f63' },
  M3: { label: 'Drafts',      fillBg: '#faf2e4', strokeColor: '#b58a4d' },
  M4: { label: 'Publish',     fillBg: '#fbe9e9', strokeColor: '#b54d4d' },
}

const CMD_DEFS = [
  { id: 'inspiration_researcher', label: 'inspiration-resear…', motion: 'M0' },
  { id: 'idea_generator',         label: 'idea-generator',       motion: 'M1' },
  { id: 'idea_scorer',            label: 'idea-scorer',          motion: 'M1' },
  { id: 'concept_builder',        label: 'concept-builder',      motion: 'M2' },
  { id: 'structure_builder',      label: 'structure-builder',    motion: 'M2' },
  { id: 'content_reviewer',       label: 'content-reviewer',     motion: 'M2' },
  { id: 'content_researcher',     label: 'content-researcher',   motion: 'M3' },
  { id: 'draft_writer',           label: 'draft-writer',         motion: 'M3' },
  { id: 'humanizer',              label: 'humanizer',            motion: 'M3' },
  { id: 'draft_editor',           label: 'draft-editor',         motion: 'M3' },
  { id: 'publisher',              label: 'publisher',            motion: 'M4' },
  { id: 'tracker',                label: 'tracker',              motion: 'M4' },
  { id: 'feedback_synthesizer',   label: 'feedback-synthesizer', motion: 'M4' },
  { id: 'manual_reviewer',        label: 'manual-reviewer',      motion: 'M4' },
]
const cmdIdx: Record<string, number> = {}
const CMD_NODES: CMDNode[] = CMD_DEFS.map(d => {
  const i = cmdIdx[d.motion] ?? 0; cmdIdx[d.motion] = i + 1
  return { ...d, x: CMD_COL_X[d.motion], y: CMD_COL_Y[d.motion][i] + CMD_Y_OFF }
})

const CMD_EDGES = [
  ['inspiration_researcher','idea_generator'],['idea_generator','idea_scorer'],
  ['idea_scorer','concept_builder'],['concept_builder','structure_builder'],
  ['structure_builder','content_reviewer'],['content_reviewer','content_researcher'],
  ['content_researcher','draft_writer'],['draft_writer','humanizer'],
  ['humanizer','draft_editor'],['draft_editor','publisher'],
  ['publisher','tracker'],['tracker','feedback_synthesizer'],
  ['feedback_synthesizer','manual_reviewer'],
]

// ─── Intersections ─────────────────────────────────────────────────────────────
interface Intersection {
  id: string; label: string; color: string
  sdrId: string; cmdId: string; description: string
}

const INTERSECTIONS: Intersection[] = [
  {
    id: 'foundation',
    label: 'Foundation',
    color: '#d97706',
    sdrId: 'profile_documents',
    cmdId: 'inspiration_researcher',
    description: 'SDR Phase 1 builds the ICP & buyer persona; CMD M0 uses this strategic context to research relevant content topics and audience signals.',
  },
  {
    id: 'generation',
    label: 'Generation',
    color: '#059669',
    sdrId: 'lead-researcher',
    cmdId: 'idea_generator',
    description: 'Both generate an initial batch of candidates — lead companies for SDR, content ideas for CMD — anchored to the ICP.',
  },
  {
    id: 'scoring',
    label: 'Scoring',
    color: '#7c3aed',
    sdrId: 'lead-scorer',
    cmdId: 'idea_scorer',
    description: 'Rubric-based automated scoring filters the best candidates before costly downstream work.',
  },
  {
    id: 'research',
    label: 'Enrichment',
    color: '#0d9488',
    sdrId: 'deep-researcher',
    cmdId: 'content_researcher',
    description: 'Deep enrichment of selected items — decision-maker data & hooks for SDR; facts, stats, and examples for CMD.',
  },
  {
    id: 'writing',
    label: 'Writing',
    color: '#2563eb',
    sdrId: 'email-composer',
    cmdId: 'draft_writer',
    description: 'Core content production — personalised cold emails for SDR; long-form article drafts for CMD.',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    color: '#dc2626',
    sdrId: 'email-sender',
    cmdId: 'publisher',
    description: 'Final dispatch — email drafts saved to DB for SDR; article packaged and published for CMD.',
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function ncx(n: { x: number }) { return n.x + NODE_W / 2 }
function ncy(n: { y: number }) { return n.y + NODE_H / 2 }

function edgePath(f: { x: number; y: number }, t: { x: number; y: number }) {
  const fx = f.x + NODE_W, tx = t.x, fy = ncy(f), ty = ncy(t)
  if (Math.abs(fx - tx) > 10) {
    const mid = (fx + tx) / 2
    return `M ${fx} ${fy} C ${mid} ${fy}, ${mid} ${ty}, ${tx} ${ty}`
  }
  const fby = f.y + NODE_H, ttop = t.y, midY = (fby + ttop) / 2
  return `M ${ncx(f)} ${fby} C ${ncx(f)} ${midY}, ${ncx(t)} ${midY}, ${ncx(t)} ${ttop}`
}

function arcPath(x1: number, y1: number, x2: number, y2: number) {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

function sdrStyle(type: SDRType, ixColor?: string) {
  const stroke = ixColor ?? (type === 'artifact' ? '#b39a6f' : type === 'strategy' ? '#b39a6f' : type === 'prospect' ? '#6f8fb3' : '#b36f6f')
  const fill   = type === 'artifact' ? '#ede5d5' : 'white'
  return { stroke, fill, rx: type === 'artifact' ? 12 : 4, sw: ixColor ? 2.5 : 1.2 }
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SamplePage() {
  const [showIx, setShowIx]   = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)

  const sdrIxMap = Object.fromEntries(INTERSECTIONS.map(ix => [ix.sdrId, ix]))
  const cmdIxMap = Object.fromEntries(INTERSECTIONS.map(ix => [ix.cmdId, ix]))

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 32px 0', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <GitMerge size={17} style={{ color: 'var(--accent)', opacity: 0.8, flexShrink: 0 }} />
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 30, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>
                SDR × CMD — Combined Flow
              </h1>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              SDR Phase 1 feeds CMD M0 · SDR Phase 2 runs in parallel with CMD M1–M4 · {INTERSECTIONS.length} shared concepts
            </div>
          </div>
          <button
            onClick={() => setShowIx(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
              background: showIx ? 'var(--ink)' : 'var(--paper-2)',
              color: showIx ? 'var(--paper)' : 'var(--ink-3)',
              border: '1px solid var(--line)', flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {showIx ? <Eye size={13} /> : <EyeOff size={13} />}
            {showIx ? 'Intersections on' : 'Intersections off'}
          </button>
        </div>

        {/* Intersection pills */}
        {showIx && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>Shared concepts:</span>
            {INTERSECTIONS.map(ix => (
              <button key={ix.id} onMouseEnter={() => setHovered(ix.id)} onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                  borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: 'default', flexShrink: 0,
                  background: hovered === ix.id ? ix.color + '20' : 'var(--paper-2)',
                  border: `1.5px solid ${ix.color}`, color: ix.color, transition: 'background 0.12s',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ix.color, flexShrink: 0 }} />
                {ix.label}
              </button>
            ))}
          </div>
        )}

        {/* Description line */}
        <div style={{ height: 26, display: 'flex', alignItems: 'center', marginTop: 4 }}>
          {hovered && (() => {
            const ix = INTERSECTIONS.find(i => i.id === hovered)
            return ix ? (
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                <span style={{ fontWeight: 600, color: ix.color, fontStyle: 'normal' }}>{ix.label}:</span>{' '}{ix.description}
              </span>
            ) : null
          })()}
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflow: 'auto',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--line-2) 1px, transparent 0)',
        backgroundSize: '20px 20px', backgroundColor: 'var(--paper)',
      }}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ display: 'block', minWidth: CANVAS_W }}>
          <defs>
            <marker id="arr"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="var(--ink-4)" opacity="0.65" /></marker>
            {INTERSECTIONS.map(ix => (
              <marker key={ix.id} id={`arr-${ix.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0,8 3,0 6" fill={ix.color} />
              </marker>
            ))}
          </defs>

          {/* ── Zone column backgrounds (full height) ─────────────────────── */}
          {/* Phase 1 / M0 zone */}
          <rect x={0} y={0} width={SDR_SEP_X} height={CANVAS_H} fill="#faf8f4" opacity={0.4} />
          {/* Phase 2 / M1-M4 zone split by CMD motions */}
          {(['M1','M2','M3','M4'] as const).map((m, i) => {
            const meta = MOTION_META[m]
            const bx   = SDR_SEP_X + i * 180
            return <rect key={m} x={bx} y={CMD_Y_OFF} width={180} height={CANVAS_H - CMD_Y_OFF} fill={meta.fillBg} opacity={0.35} />
          })}
          {/* M0 CMD background */}
          <rect x={0} y={CMD_Y_OFF} width={SDR_SEP_X} height={CANVAS_H - CMD_Y_OFF} fill={MOTION_META.M0.fillBg} opacity={0.35} />

          {/* ── Full-height phase separator ─────────────────────────────── */}
          <line x1={SDR_SEP_X} y1={0} x2={SDR_SEP_X} y2={CANVAS_H} stroke="var(--line)" strokeWidth={1} strokeDasharray="6 4" opacity={0.7} />

          {/* ── SDR section labels ──────────────────────────────────────── */}
          <text x={16}            y={28} fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill="var(--ink-4)" fontWeight={700} letterSpacing="0.08em">SDR — PHASE 1: PROFILE BUILDER</text>
          <text x={SDR_SEP_X+16} y={28} fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill="var(--ink-4)" fontWeight={700} letterSpacing="0.08em">SDR — PHASE 2: SALES PIPELINE</text>

          {/* ── SDR edges ───────────────────────────────────────────────── */}
          {SDR_EDGES.map(([fid, tid], i) => {
            const f = SDR_NODES.find(n => n.id === fid), t = SDR_NODES.find(n => n.id === tid)
            if (!f || !t) return null
            return <path key={i} d={edgePath(f, t)} fill="none" stroke="var(--ink-4)" strokeWidth={1.2} opacity={0.5} markerEnd="url(#arr)" />
          })}

          {/* ── SDR nodes ───────────────────────────────────────────────── */}
          {SDR_NODES.map(node => {
            const ix      = showIx ? sdrIxMap[node.id] : undefined
            const isHov   = ix && hovered === ix.id
            const { stroke, fill, rx, sw } = sdrStyle(node.type, ix ? ix.color : undefined)
            const labelFill = ix ? ix.color : node.type === 'artifact' ? '#b39a6f' : node.type === 'strategy' ? '#b39a6f' : node.type === 'prospect' ? '#6f8fb3' : '#b36f6f'
            return (
              <g key={node.id} onMouseEnter={() => ix && setHovered(ix.id)} onMouseLeave={() => setHovered(null)}>
                {ix && <rect x={node.x-4} y={node.y-4} width={NODE_W+8} height={NODE_H+8} rx={rx+3}
                  fill="none" stroke={ix.color} strokeWidth={isHov ? 2.5 : 1.5}
                  opacity={isHov ? 0.9 : 0.4} strokeDasharray={node.type==='artifact' ? undefined : '4 2'} />}
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={rx} fill={isHov ? ix!.color+'18' : fill} stroke={stroke} strokeWidth={sw} />
                <text x={ncx(node)} y={node.y+16} textAnchor="middle" fontSize="10.5" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-2)" fontWeight="400">
                  {node.label}
                </text>
                <text x={ncx(node)} y={node.y+31} textAnchor="middle" fontSize="8" fontFamily="'Instrument Sans', sans-serif" fill={labelFill} letterSpacing="0.06em" fontWeight="600">
                  {ix ? `SDR · ${ix.label.toUpperCase()}` : node.type.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* ── Separator strip ─────────────────────────────────────────── */}
          <rect x={0} y={540} width={CANVAS_W} height={56} fill="var(--paper-2)" opacity={0.85} />
          <line x1={0} y1={540} x2={CANVAS_W} y2={540} stroke="var(--line)" strokeWidth={1} />
          <line x1={0} y1={596} x2={CANVAS_W} y2={596} stroke="var(--line)" strokeWidth={1} />

          {/* Zone labels in separator */}
          <text x={SDR_SEP_X/2} y={562} textAnchor="middle" fontSize="8.5" fontFamily="'Instrument Sans', sans-serif" fill="var(--ink-4)" fontWeight={700} letterSpacing="0.08em">
            SDR PHASE 1 → CMD M0
          </text>
          <text x={SDR_SEP_X + (CANVAS_W - SDR_SEP_X)/2} y={562} textAnchor="middle" fontSize="8.5" fontFamily="'Instrument Sans', sans-serif" fill="var(--ink-4)" fontWeight={700} letterSpacing="0.08em">
            SDR PHASE 2 ↔ CMD M1–M4
          </text>
          {showIx && INTERSECTIONS.map((ix, idx) => {
            const sdrNode = SDR_NODES.find(n => n.id === ix.sdrId)
            if (!sdrNode) return null
            const dotX = ncx(sdrNode)
            return (
              <g key={ix.id}>
                <circle cx={dotX} cy={568} r={4} fill={ix.color} opacity={hovered === ix.id ? 1 : 0.55} />
                <text x={dotX} y={584} textAnchor="middle" fontSize="7.5" fontFamily="'Instrument Sans', sans-serif" fill={ix.color} fontWeight={700} letterSpacing="0.05em" opacity={hovered === ix.id ? 1 : 0.65}>
                  {ix.label.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* ── CMD section header ──────────────────────────────────────── */}
          <text x={16}            y={CMD_Y_OFF+22} fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill={MOTION_META.M0.strokeColor} fontWeight={700} letterSpacing="0.08em">CMD — M0: {MOTION_META.M0.label.toUpperCase()}</text>
          {(['M1','M2','M3','M4'] as const).map((m, i) => (
            <text key={m} x={SDR_SEP_X + i*180 + 90} y={CMD_Y_OFF+22} textAnchor="middle" fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill={MOTION_META[m].strokeColor} fontWeight={700} letterSpacing="0.08em">
              {m} · {MOTION_META[m].label.toUpperCase()}
            </text>
          ))}

          {/* CMD motion vertical separators (in CMD zone only) */}
          {[1,2,3].map(i => (
            <line key={i} x1={SDR_SEP_X + i*180} y1={CMD_Y_OFF} x2={SDR_SEP_X + i*180} y2={CANVAS_H}
              stroke="var(--line)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
          ))}

          {/* ── CMD edges ───────────────────────────────────────────────── */}
          {CMD_EDGES.map(([fid, tid], i) => {
            const f = CMD_NODES.find(n => n.id === fid), t = CMD_NODES.find(n => n.id === tid)
            if (!f || !t) return null
            return <path key={i} d={edgePath(f, t)} fill="none" stroke="var(--ink-4)" strokeWidth={1.2} opacity={0.5} markerEnd="url(#arr)" />
          })}

          {/* ── CMD nodes ───────────────────────────────────────────────── */}
          {CMD_NODES.map(node => {
            const meta  = MOTION_META[node.motion]
            const ix    = showIx ? cmdIxMap[node.id] : undefined
            const isHov = ix && hovered === ix.id
            return (
              <g key={node.id} onMouseEnter={() => ix && setHovered(ix.id)} onMouseLeave={() => setHovered(null)}>
                {ix && <rect x={node.x-4} y={node.y-4} width={NODE_W+8} height={NODE_H+8} rx={8}
                  fill="none" stroke={ix.color} strokeWidth={isHov ? 2.5 : 1.5}
                  opacity={isHov ? 0.9 : 0.4} strokeDasharray="4 2" />}
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={5}
                  fill={isHov ? ix!.color+'18' : 'var(--paper)'}
                  stroke={ix ? ix.color : meta.strokeColor}
                  strokeWidth={ix ? (isHov ? 2.5 : 2) : 1.2} />
                <text x={ncx(node)} y={node.y+17} textAnchor="middle" fontSize="10.5" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-2)" fontWeight="400">
                  {node.label}
                </text>
                <text x={ncx(node)} y={node.y+32} textAnchor="middle" fontSize="8" fontFamily="'Instrument Sans', sans-serif"
                  fill={ix ? ix.color : meta.strokeColor} letterSpacing="0.06em" fontWeight="600">
                  {ix ? `CMD · ${ix.label.toUpperCase()}` : `CMD · ${meta.label.toUpperCase()}`}
                </text>
              </g>
            )
          })}

          {/* ── Intersection arcs ────────────────────────────────────────── */}
          {showIx && INTERSECTIONS.map(ix => {
            const sdrNode = SDR_NODES.find(n => n.id === ix.sdrId)
            const cmdNode = CMD_NODES.find(n => n.id === ix.cmdId)
            if (!sdrNode || !cmdNode) return null
            const isHov = hovered === ix.id
            const x1 = ncx(sdrNode), y1 = sdrNode.y + NODE_H
            const x2 = ncx(cmdNode), y2 = cmdNode.y
            const path = arcPath(x1, y1, x2, y2)
            return (
              <g key={ix.id} onMouseEnter={() => setHovered(ix.id)} onMouseLeave={() => setHovered(null)}>
                <path d={path} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'default' }} />
                <path d={path} fill="none" stroke={ix.color}
                  strokeWidth={isHov ? 2.2 : 1.5} strokeDasharray={isHov ? '8 4' : '6 5'}
                  opacity={isHov ? 1 : 0.6} markerEnd={`url(#arr-${ix.id})`}
                  style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }} />
                {isHov && (() => {
                  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
                  return (
                    <g>
                      <rect x={mx-36} y={my-11} width={72} height={20} rx={4} fill={ix.color} />
                      <text x={mx} y={my+3} textAnchor="middle" fontSize="9" fontFamily="'Instrument Sans', sans-serif" fill="white" fontWeight={700} letterSpacing="0.05em">
                        {ix.label.toUpperCase()}
                      </text>
                    </g>
                  )
                })()}
              </g>
            )
          })}
        </svg>

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', bottom: 16, left: 16, display: 'inline-flex', flexDirection: 'column', gap: 5,
          background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '10px 14px',
          margin: '0 0 16px 16px', boxShadow: 'var(--shadow-lift)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Legend</div>
          {[
            { swatch: '#ede5d5', border: '#b39a6f', label: 'SDR artifact', rx: true },
            { swatch: 'white',   border: '#b39a6f', label: 'SDR profile swarm', rx: false },
            { swatch: 'white',   border: '#6f8fb3', label: 'SDR prospect swarm', rx: false },
            { swatch: 'white',   border: '#b36f6f', label: 'SDR engagement swarm', rx: false },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 14, background: item.swatch, border: `1.5px solid ${item.border}`, borderRadius: item.rx ? 5 : 2, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{item.label}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 5, marginTop: 2 }}>
            {INTERSECTIONS.map(ix => (
              <div key={ix.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <svg width={28} height={14}><line x1={2} y1={7} x2={26} y2={7} stroke={ix.color} strokeWidth={1.8} strokeDasharray="4 3" /></svg>
                <span style={{ fontSize: 11, color: ix.color, fontWeight: 500 }}>{ix.label}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 5, marginTop: 2, fontSize: 10, color: 'var(--ink-4)' }}>
            Hover arcs or pills to highlight a pair
          </div>
        </div>
      </div>
    </div>
  )
}
