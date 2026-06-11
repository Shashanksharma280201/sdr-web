'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, FileText, ChevronDown, ChevronRight, CheckCircle, Zap, BarChart2, AlignLeft } from 'lucide-react'

const D = {
  bg:      'var(--paper)',
  surface: 'var(--paper-2)',
  border:  'var(--line)',
  text:    'var(--ink)',
  text2:   'var(--ink-2)',
  muted:   'var(--ink-4)',
  accent:  'var(--accent)',
  good:    'var(--good)',
  warn:    'var(--warn)',
  bad:     'var(--bad)',
  info:    'var(--info)',
} as const

interface ArtifactRecord {
  id: string
  entry_name: string
  artifact_name?: string
  task_id: string
  created_at: string
  content?: string
}

interface CmdSession {
  id: string
  title: string
  task_id: string | null
  created_at: string
  status: string
}

const MOTION_ARTIFACTS: Record<string, { key: string; label: string; color: string; icon: React.ReactNode }[]> = {
  M0: [
    { key: 'inspiration',     label: 'Inspiration Research', color: 'var(--info)',   icon: <Zap size={13} /> },
  ],
  M1: [
    { key: 'idea_candidates', label: 'Idea Candidates',      color: 'var(--accent)', icon: <FileText size={13} /> },
    { key: 'scored_ideas',    label: 'Scored Ideas',         color: 'var(--accent)', icon: <BarChart2 size={13} /> },
  ],
  M2: [
    { key: 'concept_batch',   label: 'Concept Batch',        color: 'var(--good)',   icon: <FileText size={13} /> },
    { key: 'structure_batch', label: 'Structure Batch',      color: 'var(--good)',   icon: <AlignLeft size={13} /> },
    { key: 'concept',         label: 'Final Concepts',       color: 'var(--good)',   icon: <CheckCircle size={13} /> },
  ],
  M3: [
    { key: 'draft_idea_',     label: 'Draft',                color: 'var(--warn)',   icon: <FileText size={13} /> },
    { key: 'final_draft_',    label: 'Final Draft',          color: 'var(--warn)',   icon: <CheckCircle size={13} /> },
  ],
  M4: [
    { key: 'published_batch', label: 'Published',            color: 'var(--bad)',    icon: <Zap size={13} /> },
    { key: 'performance_',    label: 'Performance',          color: 'var(--bad)',    icon: <BarChart2 size={13} /> },
    { key: 'feedback',        label: 'Feedback',             color: 'var(--bad)',    icon: <FileText size={13} /> },
    { key: 'feedback_verified', label: 'Verified Feedback',  color: 'var(--bad)',    icon: <CheckCircle size={13} /> },
  ],
}

const MOTION_LABELS: Record<string, string> = {
  M0: 'Inspiration',
  M1: 'Ideation',
  M2: 'Concepts',
  M3: 'Drafts',
  M4: 'Publish',
}

function parseArtifact(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  try { return JSON.parse(raw.replace(/^\s*\d+\s*\|\s?/gm, '')) } catch { return null }
}

function formatScore(val: unknown): string {
  if (typeof val === 'number') return (val * 100).toFixed(0) + '%'
  return String(val)
}

function ScoredIdeasView({ data }: { data: Record<string, unknown> }) {
  const ideas: unknown[] = (data.scored_ideas ?? data.ideas ?? []) as unknown[]
  if (!ideas.length) return <pre style={{ fontSize: '11px', color: D.text2, whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {(ideas as Record<string, unknown>[]).map((idea, i) => {
        const score = (idea.combined_score ?? idea.score ?? 0) as number
        return (
          <div key={i} style={{ padding: '12px 14px', background: D.surface, borderRadius: '8px', border: `1px solid ${D.border}` }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: D.text, marginBottom: '4px' }}>{String(idea.headline ?? idea.title ?? `Idea ${i+1}`)}</div>
            {!!idea.hook && <div style={{ fontSize: '12px', color: D.text2, marginBottom: '8px', lineHeight: 1.5 }}>{String(idea.hook)}</div>}
            <div style={{ height: '4px', background: D.border, borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
              <div style={{ height: '100%', width: `${score * 100}%`, background: score > 0.7 ? D.good : score > 0.5 ? D.accent : D.warn, borderRadius: '2px' }} />
            </div>
            <div style={{ fontSize: '11px', color: D.muted }}>{formatScore(score)} score</div>
          </div>
        )
      })}
    </div>
  )
}

function InspirationView({ data }: { data: Record<string, unknown> }) {
  const signals: unknown[] = (data.signals ?? data.themes ?? []) as unknown[]
  return (
    <div>
      {!!data.summary && (
        <div style={{ padding: '12px', background: D.surface, borderRadius: '7px', border: `1px solid ${D.border}`, fontSize: '12.5px', color: D.text, lineHeight: 1.6, marginBottom: '14px' }}>
          {String(data.summary)}
        </div>
      )}
      {signals.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.muted, marginBottom: '8px' }}>Signals</div>
          {(signals as Record<string, unknown>[]).slice(0, 8).map((s, i) => (
            <div key={i} style={{ padding: '8px 12px', background: D.surface, borderRadius: '6px', border: `1px solid ${D.border}`, marginBottom: '6px' }}>
              <div style={{ fontSize: '12.5px', color: D.text }}>{String(s.theme ?? s.topic ?? s.signal ?? s)}</div>
              {!!s.relevance_score && <div style={{ fontSize: '10px', color: D.muted, marginTop: '2px' }}>Relevance: {formatScore(s.relevance_score)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DraftView({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const seo = (data.seo_metadata ?? {}) as Record<string, unknown>
  const headline = String(data.headline ?? seo.title ?? data.title ?? '')
  const body     = String(data.blog_draft ?? data.body ?? data.draft ?? data.content ?? '')
  const metaDesc = String(seo.meta_description ?? data.meta_description ?? data.meta ?? '')
  const format   = data.confirmed_format ? String(data.confirmed_format).toUpperCase() : null
  const editorNotes = data.editor_notes ? String(data.editor_notes) : null
  const charCount = data.character_count ? Number(data.character_count) : body.length || null

  return (
    <div>
      {format && (
        <div style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', padding: '2px 8px', borderRadius: '4px', background: `${D.accent}18`, color: D.accent, border: `1px solid ${D.accent}44` }}>
            {format}
          </span>
        </div>
      )}
      {headline && <div style={{ fontSize: '18px', fontWeight: 700, color: D.text, letterSpacing: '-0.02em', marginBottom: '10px', lineHeight: 1.3 }}>{headline}</div>}
      {!!data.hook && <div style={{ fontSize: '13px', color: D.text2, lineHeight: 1.6, marginBottom: '12px', padding: '10px 14px', background: D.surface, borderRadius: '7px', borderLeft: `3px solid ${D.accent}` }}>{String(data.hook)}</div>}
      {body && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: D.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {expanded ? body : body.slice(0, 800) + (body.length > 800 ? '…' : '')}
          </div>
          {body.length > 800 && (
            <button onClick={() => setExpanded(o => !o)}
              style={{ marginTop: '8px', padding: '4px 10px', background: D.surface, border: `1px solid ${D.border}`, borderRadius: '5px', fontSize: '11.5px', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {expanded ? 'Show less' : `Show full draft (${charCount?.toLocaleString()} chars)`}
            </button>
          )}
        </div>
      )}
      {metaDesc && (
        <div style={{ marginTop: '8px', padding: '8px 12px', background: D.surface, borderRadius: '6px', border: `1px solid ${D.border}` }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: D.muted, marginBottom: '4px' }}>META DESCRIPTION</div>
          <div style={{ fontSize: '12px', color: D.text2 }}>{metaDesc}</div>
        </div>
      )}
      {editorNotes && (
        <div style={{ marginTop: '8px', padding: '8px 12px', background: `${D.warn}0a`, borderRadius: '6px', border: `1px solid ${D.warn}33` }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: D.warn, marginBottom: '4px' }}>EDITOR NOTES</div>
          <div style={{ fontSize: '11.5px', color: D.text2, lineHeight: 1.5 }}>{editorNotes}</div>
        </div>
      )}
    </div>
  )
}

function ArtifactView({ artifactKey, data }: { artifactKey: string; data: Record<string, unknown> }) {
  if (artifactKey === 'inspiration')     return <InspirationView data={data} />
  if (artifactKey === 'scored_ideas')    return <ScoredIdeasView data={data} />
  if (artifactKey.startsWith('draft_') || artifactKey.startsWith('final_draft_')) return <DraftView data={data} />
  return <pre style={{ fontSize: '11px', color: D.text2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{JSON.stringify(data, null, 2)}</pre>
}

export default function CmdContent() {
  const [sessions,       setSessions]       = useState<CmdSession[]>([])
  const [activeSession,  setActiveSession]  = useState<CmdSession | null>(null)
  const [allArtifacts,   setAllArtifacts]   = useState<ArtifactRecord[]>([])
  const [contents,       setContents]       = useState<Record<string, Record<string, unknown>>>({})
  const [activeMotion,   setActiveMotion]   = useState('M0')
  const [activeArtId,    setActiveArtId]    = useState<string | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [loadingArt,     setLoadingArt]     = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    const res  = await fetch('/api/cmd/sessions')
    const data = await res.json()
    const list: CmdSession[] = (data.sessions ?? []).filter((s: CmdSession) => s.task_id)
    setSessions(list)
    if (list.length > 0 && !activeSession) setActiveSession(list[0])
  }, [activeSession])

  useEffect(() => { loadSessions() }, [loadSessions])

  const loadArtifacts = useCallback(async (session: CmdSession) => {
    if (!session.task_id) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/cmd/artifacts?task_id=${session.task_id}`)
      const data = await res.json()
      const arts: ArtifactRecord[] = (data.result?.artifacts ?? data.artifacts ?? [])
        .filter((a: ArtifactRecord) => a.entry_name !== 'trigger-input')
      setAllArtifacts(arts)
      setActiveArtId(arts[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSession) loadArtifacts(activeSession)
  }, [activeSession, loadArtifacts])

  const loadContent = useCallback(async (artifactId: string) => {
    if (contents[artifactId]) { setActiveArtId(artifactId); return }
    setLoadingArt(artifactId)
    try {
      const res  = await fetch(`/api/cmd/artifacts/${artifactId}`)
      const data = await res.json()
      const raw  = data.result?.content ?? data.artifact?.content
      if (raw) {
        const parsed = parseArtifact(raw)
        if (parsed) setContents(prev => ({ ...prev, [artifactId]: parsed }))
      }
    } finally {
      setLoadingArt(null)
      setActiveArtId(artifactId)
    }
  }, [contents])

  // Exact match first; wildcard (startsWith) only for keys ending with '_'
  const matchArt = (key: string, arts: ArtifactRecord[]) =>
    arts.find(a => a.entry_name === key) ??
    (key.endsWith('_') ? arts.find(a => a.entry_name.startsWith(key)) : undefined)

  const motions    = ['M0', 'M1', 'M2', 'M3', 'M4']
  const motionArts = (MOTION_ARTIFACTS[activeMotion] ?? [])
  const displayArts = motionArts
    .map(m => { const art = matchArt(m.key, allArtifacts); return art ? { meta: m, art } : null })
    .filter(Boolean) as { meta: typeof motionArts[0]; art: ArtifactRecord }[]

  const activeArt     = activeArtId ? allArtifacts.find(a => a.id === activeArtId) : null
  const activeContent = activeArtId ? contents[activeArtId] : null
  const activeMotionMeta = activeArt
    ? (MOTION_ARTIFACTS[activeMotion] ?? []).find(m =>
        activeArt.entry_name === m.key || (m.key.endsWith('_') && activeArt.entry_name.startsWith(m.key)))
    : null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: D.bg }}>

      {/* ── LEFT: Session + Motion tabs ── */}
      <div style={{ width: 240, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: D.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Runs</div>
          <select
            value={activeSession?.id ?? ''}
            onChange={e => {
              const s = sessions.find(x => x.id === e.target.value)
              if (s) setActiveSession(s)
            }}
            style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '12px', color: D.text, background: D.bg, cursor: 'pointer' }}
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title} ({s.task_id?.slice(-8)})</option>
            ))}
          </select>
        </div>

        {/* Motion tabs */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: D.muted, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 14px 8px' }}>Motions</div>
          {motions.map(m => {
            const mArts = (MOTION_ARTIFACTS[m] ?? [])
            const doneCount = mArts.filter(ma => !!matchArt(ma.key, allArtifacts)).length
            const isActive  = activeMotion === m
            const color = `var(--${m === 'M0' ? 'info' : m === 'M1' ? 'accent' : m === 'M2' ? 'good' : m === 'M3' ? 'warn' : 'bad'})`
            return (
              <div key={m}
                onClick={() => setActiveMotion(m)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', cursor: 'pointer', background: isActive ? `${color}18` : 'transparent', borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent', marginBottom: '1px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: isActive ? 600 : 400, color: isActive ? color : D.text }}>{m} — {MOTION_LABELS[m]}</div>
                  <div style={{ fontSize: '10px', color: D.muted, marginTop: '1px' }}>{doneCount}/{mArts.length} artifacts</div>
                </div>
                {doneCount === mArts.length && mArts.length > 0 && <CheckCircle size={12} color="var(--good)" />}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
          <button onClick={() => activeSession && loadArtifacts(activeSession)} disabled={loading}
            style={{ width: '100%', padding: '6px', background: D.bg, border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '11.5px', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
            {loading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── CENTRE: Artifact tabs for current motion ── */}
      <div style={{ width: 220, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: D.text }}>
            {activeMotion} · {MOTION_LABELS[activeMotion]}
          </div>
          <div style={{ fontSize: '10px', color: D.muted, marginTop: '1px' }}>{displayArts.length} artifact{displayArts.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {displayArts.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '12px', color: D.muted }}>No artifacts yet for this motion</div>
          ) : (
            displayArts.map(({ meta, art }) => {
              const isActive = activeArtId === art.id
              return (
                <div key={art.id}
                  onClick={() => loadContent(art.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', cursor: 'pointer', background: isActive ? `${meta.color}18` : 'transparent', borderLeft: isActive ? `3px solid ${meta.color}` : '3px solid transparent' }}>
                  <span style={{ color: meta.color, flexShrink: 0 }}>
                    {loadingArt === art.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : meta.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400, color: isActive ? meta.color : D.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</div>
                    <div style={{ fontSize: '10px', color: D.muted }}>{new Date(art.created_at).toLocaleTimeString()}</div>
                  </div>
                  {isActive && <ChevronRight size={11} color={meta.color} />}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Artifact content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {activeArt && (
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {activeMotionMeta && <span style={{ color: activeMotionMeta.color }}>{activeMotionMeta.icon}</span>}
            <span style={{ fontSize: '13px', fontWeight: 600, color: D.text }}>{activeMotionMeta?.label ?? activeArt.entry_name}</span>
            <span style={{ fontSize: '10px', color: D.muted, marginLeft: '4px' }}>
              {new Date(activeArt.created_at).toLocaleString()}
            </span>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {!activeSession ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: D.muted }}>
              <FileText size={36} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: '13px' }}>No pipeline run selected</div>
            </div>
          ) : !activeArt ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: D.muted }}>
              <FileText size={36} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: '13px' }}>Select an artifact from the list</div>
            </div>
          ) : loadingArt === activeArtId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: D.muted, fontSize: '13px' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading artifact…
            </div>
          ) : activeContent ? (
            <ArtifactView artifactKey={activeArt.entry_name} data={activeContent} />
          ) : (
            <div style={{ color: D.muted, fontSize: '13px' }}>Failed to load content</div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
