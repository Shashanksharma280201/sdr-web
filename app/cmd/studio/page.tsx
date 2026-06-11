'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play, RefreshCw, Loader2, CheckCircle, Circle, AlertCircle,
  Zap, MessageSquare, Activity, Clock, ChevronRight,
} from 'lucide-react'

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

interface Stage {
  stage_id: string
  label: string
  motion: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string
  completed_at?: string
  duration_ms?: number
}

interface ArtifactMeta {
  id: string
  entry_name: string
  artifact_name?: string
  task_id: string
  created_at: string
}

interface CmdSession {
  id: string
  title: string
  task_id: string | null
  flow_session_id: string | null
  status: string
  pipeline_config: Record<string, unknown>
  created_at: string
}

interface ChatMsg {
  id: string
  role: 'system' | 'stage' | 'artifact'
  stage?: string
  motion?: string
  text: string
  ts: string
  status?: Stage['status']
}

const MOTION_COLORS: Record<string, string> = {
  M0: 'var(--info)',
  M1: 'var(--accent)',
  M2: 'var(--good)',
  M3: 'var(--warn)',
  M4: 'var(--bad)',
}

const MOTION_LABELS: Record<string, string> = {
  M0: 'Inspiration',
  M1: 'Ideation',
  M2: 'Concepts',
  M3: 'Drafts',
  M4: 'Publish',
}

const ARTIFACT_MAP: Record<string, string> = {
  'trigger-input':   'Pipeline Input',
  inspiration:       'Inspiration Research',
  idea_candidates:   'Idea Candidates',
  scored_ideas:      'Scored Ideas',
  concept_batch:     'Concept Batch',
  structure_batch:   'Structure Batch',
  concept:           'Content Concepts',
  draft_idea_001:    'Draft',
  'final_draft_':    'Final Draft',
  published_batch:   'Published Batch',
  'performance_':    'Performance Data',
  feedback:          'Feedback',
  feedback_verified: 'Verified Feedback',
}

function fmtDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function StatusDot({ status }: { status: Stage['status'] }) {
  if (status === 'completed') return <CheckCircle size={13} color="var(--good)" />
  if (status === 'running')   return <Loader2 size={13} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
  if (status === 'failed')    return <AlertCircle size={13} color="var(--bad)" />
  return <Circle size={13} color="var(--ink-4)" />
}

export default function CmdStudio() {
  const [sessions, setSessions]           = useState<CmdSession[]>([])
  const [activeSession, setActiveSession] = useState<CmdSession | null>(null)
  const [stages, setStages]               = useState<Stage[]>([])
  const [artifacts, setArtifacts]         = useState<ArtifactMeta[]>([])
  const [chatMsgs, setChatMsgs]           = useState<ChatMsg[]>([])
  const [previewArtId, setPreviewArtId]   = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<Record<string, unknown> | null>(null)
  const [starting, setStarting]           = useState(false)
  const [showConfig, setShowConfig]       = useState(false)

  // Pipeline config form
  const [numIdeas, setNumIdeas]       = useState(2)
  const [numDrafts, setNumDrafts]     = useState(1)
  const [liveSignals, setLiveSignals] = useState('')
  const [simOnly, setSimOnly]         = useState(true)

  const prevStagesRef = useRef<Map<string, Stage['status']>>(new Map())
  const prevArtIdsRef = useRef<Set<string>>(new Set())
  const chatEndRef    = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])

  const loadSessions = useCallback(async () => {
    const res  = await fetch('/api/cmd/sessions')
    const data = await res.json()
    setSessions(data.sessions ?? [])
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const pollStatus = useCallback(async (session: CmdSession) => {
    if (!session.task_id) return

    const [stagesRes, artsRes] = await Promise.all([
      fetch(`/api/cmd/stages?task_id=${session.task_id}`),
      fetch(`/api/cmd/artifacts?task_id=${session.task_id}`),
    ])
    const stagesData = await stagesRes.json()
    const artsData   = await artsRes.json()

    const newStages: Stage[] = stagesData.stages ?? []
    const newArts: ArtifactMeta[] = (artsData.result?.artifacts ?? artsData.artifacts ?? [])
      .filter((a: ArtifactMeta) => a.entry_name !== 'trigger-input')

    // Generate chat messages from stage status changes
    const msgs: ChatMsg[] = []
    for (const s of newStages) {
      const prev = prevStagesRef.current.get(s.stage_id)
      if (s.status === 'running' && prev !== 'running') {
        msgs.push({
          id:     `start-${s.stage_id}-${Date.now()}`,
          role:   'stage',
          stage:  s.stage_id,
          motion: s.motion,
          status: 'running',
          text:   `Starting **${s.label}** (${s.motion} — ${MOTION_LABELS[s.motion] ?? s.motion})`,
          ts:     new Date().toISOString(),
        })
      }
      if (s.status === 'completed' && prev === 'running') {
        msgs.push({
          id:     `done-${s.stage_id}-${Date.now()}`,
          role:   'stage',
          stage:  s.stage_id,
          motion: s.motion,
          status: 'completed',
          text:   `${s.label} completed${s.duration_ms ? ` in ${fmtDuration(s.duration_ms)}` : ''}`,
          ts:     new Date().toISOString(),
        })
      }
      if (s.status === 'failed' && prev !== 'failed') {
        msgs.push({
          id:     `fail-${s.stage_id}-${Date.now()}`,
          role:   'stage',
          stage:  s.stage_id,
          motion: s.motion,
          status: 'failed',
          text:   `${s.label} failed — check logs`,
          ts:     new Date().toISOString(),
        })
      }
      prevStagesRef.current.set(s.stage_id, s.status)
    }

    // Artifact messages for new artifacts
    for (const art of newArts) {
      if (!prevArtIdsRef.current.has(art.id)) {
        const label = Object.entries(ARTIFACT_MAP).find(([k]) => art.entry_name.startsWith(k))?.[1] ?? art.entry_name
        msgs.push({
          id:   `art-${art.id}`,
          role: 'artifact',
          text: `Artifact ready: **${label}**`,
          ts:   art.created_at,
        })
        prevArtIdsRef.current.add(art.id)
      }
    }

    if (msgs.length > 0) setChatMsgs(prev => [...prev, ...msgs])
    setStages(newStages)
    setArtifacts(newArts)

    // Stop polling if all completed or failed
    const done = newStages.every(s => s.status === 'completed' || s.status === 'failed' || s.status === 'idle')
    const anyCompleted = newStages.some(s => s.status === 'completed')
    if (done && anyCompleted) {
      setActiveSession(prev => prev ? { ...prev, status: 'completed' } : prev)
    }
  }, [])

  useEffect(() => {
    if (!activeSession?.task_id) return
    prevStagesRef.current.clear()
    prevArtIdsRef.current.clear()
    setChatMsgs([{
      id:   'init',
      role: 'system',
      text: `Loaded run: **${activeSession.title}** (task ${activeSession.task_id})`,
      ts:   activeSession.created_at,
    }])
    pollStatus(activeSession)
  }, [activeSession?.id, pollStatus])

  // Poll every 8s while running
  useEffect(() => {
    if (!activeSession?.task_id) return
    const isRunning = stages.some(s => s.status === 'running') || activeSession.status === 'running'
    if (!isRunning && stages.some(s => s.status === 'completed')) return
    const id = setInterval(() => pollStatus(activeSession), 8000)
    return () => clearInterval(id)
  }, [activeSession, stages, pollStatus])

  const startPipeline = useCallback(async () => {
    setStarting(true)
    setShowConfig(false)
    try {
      const res = await fetch('/api/cmd/flow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: 'ws-09Dymwpl',
          num_ideas:    numIdeas,
          num_drafts:   numDrafts,
          live_signals: liveSignals,
          simulate_only: simOnly,
          title: `Run ${new Date().toLocaleDateString()}`,
        }),
      })
      const data = await res.json() as { session?: CmdSession; error?: string }
      if (!res.ok || !data.session) {
        alert(data.error ?? 'Failed to start pipeline')
        return
      }
      prevStagesRef.current.clear()
      prevArtIdsRef.current.clear()
      setChatMsgs([{
        id:   'start',
        role: 'system',
        text: `Pipeline started — task ${data.session.task_id}. All 14 stages will run headlessly.`,
        ts:   new Date().toISOString(),
      }])
      setStages([])
      setArtifacts([])
      setActiveSession(data.session)
      setSessions(prev => [data.session!, ...prev])
    } finally {
      setStarting(false)
    }
  }, [numIdeas, numDrafts, liveSignals, simOnly])

  const loadPreview = useCallback(async (artifactId: string) => {
    setPreviewArtId(artifactId)
    setPreviewContent(null)
    const res  = await fetch(`/api/cmd/artifacts/${artifactId}`)
    const data = await res.json()
    const raw  = data.result?.content ?? data.result?.full_artifact ?? data.content
    if (raw) {
      try { setPreviewContent(JSON.parse(raw.replace(/^\s*\d+\s*\|\s?/gm, ''))) } catch {
        setPreviewContent({ raw })
      }
    }
  }, [])

  // Derived
  const completedCount = stages.filter(s => s.status === 'completed').length
  const runningStage   = stages.find(s => s.status === 'running')
  const isRunning      = !!runningStage || (activeSession?.status === 'running' && completedCount < 14)
  const motions        = ['M0', 'M1', 'M2', 'M3', 'M4']

  return (
    <>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .cmd-btn:hover { opacity: 0.82; }
        .cmd-session-item:hover { background: var(--paper-3) !important; }
        .cmd-stage-row:hover { background: var(--paper-3) !important; }
        .cmd-art-item:hover { background: var(--paper-3) !important; }
      `}</style>

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: D.bg }}>

        {/* ── LEFT: Stage status + sessions ── */}
        <div style={{ width: 260, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface }}>

          {/* Header */}
          <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: D.text }}>Content Pipeline</span>
              {activeSession?.task_id && (
                <span style={{ fontSize: '10px', color: D.muted, fontFamily: 'monospace' }}>
                  {activeSession.task_id.slice(-8)}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {activeSession?.task_id && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: D.text2 }}>
                    {completedCount}/14 stages
                  </span>
                  {isRunning && runningStage && (
                    <span style={{ fontSize: '10px', color: D.accent }}>
                      {runningStage.label}
                    </span>
                  )}
                </div>
                <div style={{ height: '4px', background: D.border, borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(completedCount / 14) * 100}%`,
                    background: completedCount === 14 ? 'var(--good)' : 'var(--accent)',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Stage list by motion */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {stages.length > 0 ? (
              motions.map(motion => {
                const motionStages = stages.filter(s => s.motion === motion)
                if (!motionStages.length) return null
                const motionColor = MOTION_COLORS[motion]
                const allDone = motionStages.every(s => s.status === 'completed')
                return (
                  <div key={motion} style={{ marginBottom: '2px' }}>
                    <div style={{ padding: '6px 14px 3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '3px', height: '12px', background: motionColor, borderRadius: '1px', flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', fontWeight: 600, color: allDone ? D.good : motionColor, letterSpacing: '0.05em' }}>
                        {motion} · {MOTION_LABELS[motion]}
                      </span>
                      {allDone && <CheckCircle size={10} color="var(--good)" />}
                    </div>
                    {motionStages.map(s => (
                      <div key={s.stage_id} className="cmd-stage-row" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 14px 5px 23px',
                        borderRadius: '4px', margin: '0 4px',
                        background: s.status === 'running' ? `${D.accent}11` : 'transparent',
                      }}>
                        <StatusDot status={s.status} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '11.5px',
                            color: s.status === 'running' ? D.accent : s.status === 'completed' ? D.text : s.status === 'failed' ? D.bad : D.text2,
                            fontWeight: s.status === 'running' ? 600 : 400,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {s.label}
                          </div>
                          {s.duration_ms && (
                            <div style={{ fontSize: '10px', color: D.muted, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={8} />{fmtDuration(s.duration_ms)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Session history */}
                {sessions.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: D.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Recent Runs
                    </div>
                    {sessions.slice(0, 8).map(s => (
                      <div key={s.id} className="cmd-session-item"
                        style={{ padding: '7px 8px', borderRadius: '5px', cursor: 'pointer', background: activeSession?.id === s.id ? `${D.accent}18` : 'transparent', marginBottom: '2px' }}
                        onClick={() => setActiveSession(s)}>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: D.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                        <div style={{ fontSize: '10px', color: D.muted, marginTop: '1px' }}>
                          {s.task_id ? s.task_id.slice(-8) : 'no task'} · {s.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: D.muted, textAlign: 'center' }}>
                  Start a pipeline run to see live stage progress
                </div>
              </div>
            )}
          </div>

          {/* Start button */}
          <div style={{ padding: '12px 10px', borderTop: `1px solid ${D.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button className="cmd-btn" onClick={() => setShowConfig(o => !o)}
              disabled={starting || isRunning}
              style={{ width: '100%', padding: '8px 14px', background: D.surface, border: `1px solid ${D.border}`, borderRadius: '7px', fontSize: '12px', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              Configure Run
            </button>
            <button className="cmd-btn" onClick={startPipeline}
              disabled={starting || isRunning}
              style={{ width: '100%', padding: '8px 14px', background: isRunning ? D.surface : D.accent, color: isRunning ? D.text2 : '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: starting || isRunning ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', opacity: starting ? 0.7 : 1 }}>
              {starting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : isRunning ? <Activity size={13} /> : <Play size={13} />}
              {starting ? 'Starting…' : isRunning ? 'Pipeline Running' : 'Start Pipeline'}
            </button>
          </div>
        </div>

        {/* ── CENTRE: Chat stream ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Topbar */}
          <div style={{ padding: '10px 18px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, background: D.bg }}>
            <MessageSquare size={14} color={D.accent} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: D.text }}>Live Narration</span>
            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px', background: `${D.accent}18`, borderRadius: '10px' }}>
                <div style={{ width: '5px', height: '5px', background: D.accent, borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <span style={{ fontSize: '10px', color: D.accent, fontWeight: 600 }}>LIVE</span>
              </div>
            )}
            {completedCount === 14 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px', background: `var(--good)18`, borderRadius: '10px' }}>
                <CheckCircle size={10} color="var(--good)" />
                <span style={{ fontSize: '10px', color: 'var(--good)', fontWeight: 600 }}>COMPLETED</span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {chatMsgs.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px 20px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${D.accent}18`, border: `1px solid ${D.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={24} color={D.accent} />
                </div>
                <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: D.text, marginBottom: '6px' }}>CMD Content Pipeline</div>
                  <div style={{ fontSize: '12.5px', color: D.text2, lineHeight: 1.6 }}>
                    Start a pipeline run to see live narration of each stage — M0 Inspiration → M1 Ideation → M2 Concepts → M3 Drafts → M4 Publish.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['M0 Inspiration', 'M1 Ideation', 'M2 Concepts', 'M3 Drafts', 'M4 Publish'].map((m, i) => {
                    const key = `M${i}` as keyof typeof MOTION_COLORS
                    return (
                      <div key={m} style={{ padding: '4px 10px', borderRadius: '6px', background: `${MOTION_COLORS[key]}18`, border: `1px solid ${MOTION_COLORS[key]}44`, fontSize: '11px', color: MOTION_COLORS[key] }}>
                        {m}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              chatMsgs.map(msg => {
                const color = msg.motion ? MOTION_COLORS[msg.motion] : msg.role === 'artifact' ? D.good : D.text2
                const parts = msg.text.split(/\*\*(.+?)\*\*/)
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                      background: msg.role === 'system' ? D.surface : `${color}18`,
                      border: `1px solid ${msg.role === 'system' ? D.border : color + '44'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {msg.role === 'system'   && <Activity size={12} color={D.muted} />}
                      {msg.role === 'stage'    && (
                        msg.status === 'running' ? <Loader2 size={12} color={color} style={{ animation: 'spin 1s linear infinite' }} />
                        : msg.status === 'completed' ? <CheckCircle size={12} color={color} />
                        : msg.status === 'failed' ? <AlertCircle size={12} color={color} />
                        : <Circle size={12} color={color} />
                      )}
                      {msg.role === 'artifact' && <ChevronRight size={12} color={D.good} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', color: msg.role === 'system' ? D.muted : D.text, lineHeight: 1.55 }}>
                        {parts.map((p, i) => i % 2 === 0 ? p : <strong key={i} style={{ color, fontWeight: 600 }}>{p}</strong>)}
                      </div>
                      <div style={{ fontSize: '10px', color: D.muted, marginTop: '2px' }}>
                        {new Date(msg.ts).toLocaleTimeString()}
                        {msg.motion && <span style={{ marginLeft: '6px', padding: '1px 5px', background: `${color}18`, borderRadius: '3px', color }}>{msg.motion}</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── RIGHT: Artifacts + Preview ── */}
        <div style={{ width: 320, borderLeft: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={13} color={D.accent} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: D.text }}>Artifacts</span>
            {artifacts.length > 0 && (
              <span style={{ fontSize: '10px', padding: '1px 6px', background: `${D.accent}18`, borderRadius: '8px', color: D.accent, fontWeight: 600 }}>
                {artifacts.length}
              </span>
            )}
            {activeSession?.task_id && (
              <button className="cmd-btn" onClick={() => pollStatus(activeSession)}
                style={{ marginLeft: 'auto', padding: '3px', background: 'transparent', border: 'none', color: D.muted, cursor: 'pointer' }}>
                <RefreshCw size={11} />
              </button>
            )}
          </div>

          {/* Artifact list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {artifacts.length === 0 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: '12px', color: D.muted }}>
                Artifacts appear here as each stage completes
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {artifacts.map(art => {
                  const label = Object.entries(ARTIFACT_MAP).find(([k]) => art.entry_name.startsWith(k))?.[1] ?? art.entry_name
                  const isActive = previewArtId === art.id
                  return (
                    <div key={art.id} className="cmd-art-item"
                      onClick={() => loadPreview(art.id)}
                      style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', background: isActive ? `${D.accent}18` : 'transparent', border: `1px solid ${isActive ? D.accent + '55' : 'transparent'}` }}>
                      <div style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400, color: isActive ? D.accent : D.text }}>{label}</div>
                      <div style={{ fontSize: '10px', color: D.muted, marginTop: '1px' }}>
                        {new Date(art.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Preview */}
            {previewArtId && (
              <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: D.muted, marginBottom: '8px' }}>
                  Preview
                </div>
                {previewContent ? (
                  <pre style={{ fontSize: '10.5px', color: D.text2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, margin: 0 }}>
                    {JSON.stringify(previewContent, null, 2)}
                  </pre>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: D.muted, fontSize: '12px' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Loading…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Config modal */}
      {showConfig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowConfig(false)}>
          <div style={{ background: D.bg, borderRadius: '12px', border: `1px solid ${D.border}`, width: '400px', padding: '24px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: D.text, marginBottom: '20px' }}>Configure Pipeline</div>

            <label style={{ display: 'block', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: D.text2, marginBottom: '5px' }}>Ideas to generate</div>
              <input type="number" min={1} max={10} value={numIdeas} onChange={e => setNumIdeas(+e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '13px', color: D.text, background: D.surface, boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: D.text2, marginBottom: '5px' }}>Drafts per idea</div>
              <input type="number" min={1} max={5} value={numDrafts} onChange={e => setNumDrafts(+e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '13px', color: D.text, background: D.surface, boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: D.text2, marginBottom: '5px' }}>Live signals (optional)</div>
              <textarea value={liveSignals} onChange={e => setLiveSignals(e.target.value)} rows={3}
                placeholder="Recent sales call questions, support tickets, community DMs…"
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '12.5px', color: D.text, background: D.surface, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
              <input type="checkbox" checked={simOnly} onChange={e => setSimOnly(e.target.checked)} style={{ width: '14px', height: '14px' }} />
              <span style={{ fontSize: '12.5px', color: D.text }}>Simulate only (no external API calls)</span>
            </label>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="cmd-btn" onClick={() => setShowConfig(false)}
                style={{ padding: '7px 16px', border: `1px solid ${D.border}`, borderRadius: '7px', background: D.surface, fontSize: '12.5px', color: D.text2, cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="cmd-btn" onClick={startPipeline}
                style={{ padding: '7px 16px', background: D.accent, color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={12} />Start
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
