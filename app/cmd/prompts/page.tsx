'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react'

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

interface PromptEntry {
  stage_id: string
  label: string
  motion: string
  content: string | null
  saved: boolean
  dirty: boolean
}

const STAGES = [
  { id: 'inspiration_researcher', label: 'Inspiration Researcher', motion: 'M0' },
  { id: 'idea_generator',         label: 'Idea Generator',         motion: 'M1' },
  { id: 'idea_scorer',            label: 'Idea Scorer',            motion: 'M1' },
  { id: 'concept_builder',        label: 'Concept Builder',        motion: 'M2' },
  { id: 'structure_builder',      label: 'Structure Builder',      motion: 'M2' },
  { id: 'content_reviewer',       label: 'Content Reviewer',       motion: 'M2' },
  { id: 'content_researcher',     label: 'Content Researcher',     motion: 'M3' },
  { id: 'draft_writer',           label: 'Draft Writer',           motion: 'M3' },
  { id: 'humanizer',              label: 'Humanizer',              motion: 'M3' },
  { id: 'draft_editor',           label: 'Draft Editor',           motion: 'M3' },
  { id: 'publisher',              label: 'Publisher',              motion: 'M4' },
  { id: 'tracker',                label: 'Tracker',                motion: 'M4' },
  { id: 'feedback_synthesizer',   label: 'Feedback Synthesizer',   motion: 'M4' },
  { id: 'manual_reviewer',        label: 'Manual Reviewer',        motion: 'M4' },
]

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

export default function CmdPrompts() {
  const [prompts,       setPrompts]       = useState<Record<string, PromptEntry>>({})
  const [activeStage,   setActiveStage]   = useState<string>(STAGES[0].id)
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [savedMsg,      setSavedMsg]      = useState(false)
  const [originals,     setOriginals]     = useState<Record<string, string>>({})

  const loadPrompt = useCallback(async (stageId: string) => {
    if (prompts[stageId]?.content !== null) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/cmd/prompts/${stageId}`)
      const data = await res.json()
      const content = data.content ?? null
      setPrompts(prev => ({
        ...prev,
        [stageId]: { ...prev[stageId], content, saved: true, dirty: false },
      }))
      if (content) setOriginals(prev => ({ ...prev, [stageId]: content }))
    } finally { setLoading(false) }
  }, [prompts])

  useEffect(() => {
    // Initialize all stages
    const init: Record<string, PromptEntry> = {}
    for (const s of STAGES) {
      init[s.id] = { stage_id: s.id, label: s.label, motion: s.motion, content: null, saved: false, dirty: false }
    }
    setPrompts(init)
  }, [])

  useEffect(() => {
    loadPrompt(activeStage)
  }, [activeStage, loadPrompt])

  const onEdit = (stageId: string, value: string) => {
    setPrompts(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], content: value, dirty: value !== originals[stageId] },
    }))
  }

  const savePrompt = useCallback(async (stageId: string) => {
    const prompt = prompts[stageId]
    if (!prompt?.content) return
    setSaving(true)
    try {
      await fetch(`/api/cmd/prompts/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: prompt.content }),
      })
      setOriginals(prev => ({ ...prev, [stageId]: prompt.content! }))
      setPrompts(prev => ({ ...prev, [stageId]: { ...prev[stageId], saved: true, dirty: false } }))
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } finally { setSaving(false) }
  }, [prompts])

  const revertPrompt = (stageId: string) => {
    const orig = originals[stageId]
    if (orig) {
      setPrompts(prev => ({ ...prev, [stageId]: { ...prev[stageId], content: orig, dirty: false } }))
    }
  }

  const activePrompt = prompts[activeStage]
  const motions = ['M0', 'M1', 'M2', 'M3', 'M4']
  const dirtyCount = Object.values(prompts).filter(p => p.dirty).length

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: D.bg }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .prompt-stage:hover{background:var(--paper-3)!important;}`}</style>

      {/* ── LEFT: Stage list ── */}
      <div style={{ width: 240, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: D.text }}>Prompt Editor</div>
          <div style={{ fontSize: '11px', color: D.muted, marginTop: '2px' }}>
            Edit headless prompts for each stage
            {dirtyCount > 0 && <span style={{ marginLeft: '6px', color: D.warn, fontWeight: 600 }}>{dirtyCount} unsaved</span>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {motions.map(motion => {
            const color  = MOTION_COLORS[motion]
            const stages = STAGES.filter(s => s.motion === motion)
            return (
              <div key={motion} style={{ marginBottom: '4px' }}>
                <div style={{ padding: '6px 14px 3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '3px', height: '11px', background: color, borderRadius: '1px' }} />
                  <span style={{ fontSize: '10px', fontWeight: 600, color, letterSpacing: '0.05em' }}>
                    {motion} · {MOTION_LABELS[motion]}
                  </span>
                </div>
                {stages.map(s => {
                  const prompt  = prompts[s.id]
                  const isActive = activeStage === s.id
                  return (
                    <div key={s.id}
                      className="prompt-stage"
                      onClick={() => setActiveStage(s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px 7px 23px', cursor: 'pointer', background: isActive ? `${color}18` : 'transparent', borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent', margin: '0 4px', borderRadius: isActive ? '0 5px 5px 0' : '0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400, color: isActive ? color : D.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.label}
                        </div>
                        {prompt?.dirty && <div style={{ fontSize: '10px', color: D.warn, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}><AlertTriangle size={9} />Unsaved</div>}
                        {prompt?.saved && !prompt.dirty && <div style={{ fontSize: '10px', color: D.good, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}><CheckCircle size={9} />Saved</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Editor header */}
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, background: D.bg }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: D.text }}>{activePrompt?.label ?? activeStage}</div>
            <div style={{ fontSize: '11px', color: MOTION_COLORS[activePrompt?.motion ?? 'M0'], marginTop: '1px' }}>
              {activePrompt?.motion} · {MOTION_LABELS[activePrompt?.motion ?? 'M0']} — headless.md
            </div>
          </div>

          {activePrompt?.dirty && (
            <button onClick={() => revertPrompt(activeStage)}
              style={{ padding: '5px 10px', background: D.surface, border: `1px solid ${D.border}`, borderRadius: '6px', fontSize: '11.5px', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RotateCcw size={11} />Revert
            </button>
          )}

          {savedMsg ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: `var(--good)18`, borderRadius: '6px', fontSize: '11.5px', color: D.good }}>
              <CheckCircle size={12} />Saved
            </div>
          ) : (
            <button onClick={() => savePrompt(activeStage)}
              disabled={saving || !activePrompt?.dirty}
              style={{ padding: '5px 14px', background: activePrompt?.dirty ? D.accent : D.surface, border: `1px solid ${activePrompt?.dirty ? 'transparent' : D.border}`, borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: activePrompt?.dirty ? '#fff' : D.muted, cursor: activePrompt?.dirty ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>

        {/* Info banner */}
        <div style={{ padding: '8px 18px', borderBottom: `1px solid ${D.border}`, background: `${D.accent}08`, flexShrink: 0 }}>
          <div style={{ fontSize: '11.5px', color: D.text2, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={11} color={D.warn} />
            Changes take effect on the next pipeline run. The prompt is the full system instruction passed to the swarm agent.
          </div>
        </div>

        {/* Textarea */}
        {loading && activePrompt?.content === null ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: D.muted }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Loading prompt…
          </div>
        ) : activePrompt?.content === null && !loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.muted, fontSize: '13px' }}>
            Prompt file not found for this stage
          </div>
        ) : (
          <textarea
            value={activePrompt?.content ?? ''}
            onChange={e => onEdit(activeStage, e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              width: '100%',
              padding: '18px 22px',
              border: 'none',
              background: D.bg,
              fontSize: '12.5px',
              color: D.text,
              fontFamily: 'monospace',
              lineHeight: 1.65,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}

        {/* Character count */}
        {activePrompt?.content && (
          <div style={{ padding: '6px 18px', borderTop: `1px solid ${D.border}`, fontSize: '10.5px', color: D.muted, background: D.surface, flexShrink: 0 }}>
            {activePrompt.content.length.toLocaleString()} chars · {activePrompt.content.split('\n').length} lines
            {activePrompt.dirty && <span style={{ marginLeft: '8px', color: D.warn }}>· Unsaved changes</span>}
          </div>
        )}
      </div>
    </div>
  )
}
