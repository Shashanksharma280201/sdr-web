'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Mail, Link2, Phone, CheckCircle, AlertCircle, Globe, Loader2, RefreshCw, Copy } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailDraft {
  company_name: string
  to_name: string | null
  to_email: string | null
  subject: string
  body: string
  follow_up_subject: string
  follow_up_body: string
  personalization_note: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Static sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--ink-4)',
      marginBottom: '12px', marginTop: '28px',
    }}>
      {children}
    </div>
  )
}

function DeliverabilityBar({ pct, status }: { pct: number; status: 'good' | 'warn' | 'bad' }) {
  const color = status === 'good' ? 'var(--good)' : status === 'warn' ? 'var(--warn)' : 'var(--bad)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--ink-4)', fontWeight: 500 }}>Deliverability</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div style={{ height: '5px', background: 'var(--paper-3)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
      </div>
    </div>
  )
}

function StepIcon({ type }: { type: string }) {
  const s = { width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 as const }
  if (type === 'Email') return <div style={{ ...s, background: 'var(--accent-tint)' }}><Mail size={10} color="var(--accent)" /></div>
  if (type === 'LinkedIn') return <div style={{ ...s, background: 'var(--info-soft)' }}><Link2 size={10} color="var(--info)" /></div>
  if (type === 'Call') return <div style={{ ...s, background: 'var(--good-soft)' }}><Phone size={10} color="var(--good)" /></div>
  return <div style={{ ...s, background: 'var(--paper-3)' }}><Globe size={10} color="var(--ink-3)" /></div>
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{
      width: '32px', height: '18px', background: on ? 'var(--good)' : 'var(--line-2)',
      borderRadius: '9px', position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'background 0.15s',
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: on ? '16px' : '2px',
        width: '14px', height: '14px', background: 'white', borderRadius: '50%',
        transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email draft card
// ---------------------------------------------------------------------------

function DraftCard({ draft, index }: { draft: EmailDraft; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<'initial' | 'followup' | null>(null)

  function copy(which: 'initial' | 'followup') {
    const subject = which === 'initial' ? draft.subject : draft.follow_up_subject
    const body    = which === 'initial' ? draft.body    : draft.follow_up_body
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
      setCopiedIdx(which)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--line)',
      borderLeft: '3px solid var(--accent)', borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '12px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%',
          background: 'var(--accent-tint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '10px', fontWeight: 700, color: 'var(--accent)',
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '1px' }}>
            {draft.company_name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.subject}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {draft.to_email && (
            <span style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              {draft.to_email}
            </span>
          )}
          <span style={{ fontSize: '10px', background: 'var(--accent-tint)', color: 'var(--accent)', padding: '1px 7px', borderRadius: '10px', fontWeight: 600 }}>
            draft
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--line)' }}>
          {/* Initial email */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Initial</div>
              <button
                onClick={() => copy('initial')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10.5px', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: copiedIdx === 'initial' ? 'var(--good-soft)' : 'var(--paper-2)',
                  color: copiedIdx === 'initial' ? 'var(--good)' : 'var(--ink-3)',
                  border: `1px solid ${copiedIdx === 'initial' ? 'var(--good)' : 'var(--line)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <Copy size={9} />
                {copiedIdx === 'initial' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '5px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>Subject: </span>{draft.subject}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {draft.body}
              </div>
            </div>
          </div>

          {/* Follow-up email */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Follow-up</div>
              <button
                onClick={() => copy('followup')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10.5px', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: copiedIdx === 'followup' ? 'var(--good-soft)' : 'var(--paper-2)',
                  color: copiedIdx === 'followup' ? 'var(--good)' : 'var(--ink-3)',
                  border: `1px solid ${copiedIdx === 'followup' ? 'var(--good)' : 'var(--line)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <Copy size={9} />
                {copiedIdx === 'followup' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '5px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>Subject: </span>{draft.follow_up_subject}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {draft.follow_up_body}
              </div>
            </div>
          </div>

          {draft.personalization_note && (
            <div style={{ marginTop: '8px', padding: '7px 10px', background: 'var(--info-soft)', borderRadius: '4px', fontSize: '11px', color: 'var(--info)' }}>
              ✦ {draft.personalization_note}
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

const complianceRules = [
  { label: 'Max 3 touches per contact per week', scope: 'GLOBAL', on: true },
  { label: 'Skip contacts who opened < 24h ago', scope: 'SEQUENCE', on: true },
  { label: "Suppress competitors' domains", scope: 'GLOBAL', on: true },
  { label: 'Respect unsubscribe within 24h', scope: 'LEGAL', on: true },
  { label: 'Pause on Indian public holidays', scope: 'REGIONAL', on: false },
]

const suppressions = [
  { entity: 'hubspot.com', type: 'Domain', reason: 'Competitor', source: 'Manual', added: 'Apr 12' },
  { entity: 'salesforce.com', type: 'Domain', reason: 'Competitor', source: 'Manual', added: 'Apr 12' },
  { entity: 'zoho.com', type: 'Domain', reason: 'Competitor', source: 'Auto', added: 'May 1' },
]

export default function EngagementPage() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([])
  const [draftsTaskId, setDraftsTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)

    try {
      const tasksRes = await fetch('/api/tasks', { cache: 'no-store' })
      const tasksData = await tasksRes.json()
      const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = tasksData.tasks ?? []

      const latestSP = allTasks
        .filter(t => t.name === 'sdr:core:sales-pipeline' && t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      if (!latestSP) { setLoading(false); setRefreshing(false); return }

      const artRes = await fetch(`/api/tasks/${latestSP.id}/artifacts`, { cache: 'no-store' })
      const artData = await artRes.json()
      const arts: Array<{ id: string; entry_name: string }> = artData.artifacts ?? []

      const emailArt = arts.find(a => a.entry_name === 'email_drafts')
      if (!emailArt) { setLoading(false); setRefreshing(false); return }

      const contentRes = await fetch(`/api/artifacts/${emailArt.id}`, { cache: 'no-store' })
      const contentData = await contentRes.json()
      const parsed = parseContent(contentData.artifact?.content)

      if (parsed?.drafts && Array.isArray(parsed.drafts)) {
        setDrafts(parsed.drafts as EmailDraft[])
        setDraftsTaskId(latestSP.id)
      }
    } catch {}

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        padding: '28px 32px 16px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'flex-end', gap: '24px', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '32px', letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>
            Engagement Workbench
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '4px' }}>
            {loading ? 'Loading…' : drafts.length > 0 ? `${drafts.length} email drafts ready · ${draftsTaskId}` : 'Sender health · compliance rules'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => load(true)}
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
            background: 'var(--accent)', border: '1px solid var(--accent)',
            borderRadius: '5px', color: 'white', cursor: 'pointer', fontWeight: 500,
          }}>
            <Plus size={12} />
            New sequence
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px 40px', flex: 1 }}>

        {/* Email Drafts — live data from pipeline */}
        <SectionLabel>Email Drafts — Ready to Send</SectionLabel>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-4)', fontSize: '13px' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading drafts…
          </div>
        ) : drafts.length > 0 ? (
          <>
            <div style={{ marginBottom: '10px', fontSize: '11.5px', color: 'var(--ink-4)' }}>
              {drafts.length} personalised drafts from pipeline run · expand any card to copy body text
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {drafts.map((draft, i) => (
                <DraftCard key={draft.company_name || i} draft={draft} index={i} />
              ))}
            </div>
          </>
        ) : (
          <div style={{
            background: 'var(--paper-2)', border: '1px dashed var(--line-2)',
            borderRadius: '6px', padding: '24px', textAlign: 'center',
            fontSize: '12.5px', color: 'var(--ink-4)',
          }}>
            No email drafts yet — run the sales pipeline from the Pipeline page to generate personalised drafts.
          </div>
        )}

        {/* Sequence steps legend */}
        {drafts.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[['Email', '#d14729'], ['Follow-up', '#6f8fb3']].map(([label, color]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--ink-3)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
            <span style={{ fontSize: '11px', color: 'var(--ink-4)', marginLeft: '4px' }}>· 2-touch sequence per account</span>
          </div>
        )}

        {/* Sender Health */}
        <SectionLabel>Sender Health</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderLeft: '3px solid var(--good)', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <CheckCircle size={12} color="var(--good)" />
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>sales@flomobility.com</div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '12px' }}>Primary sender</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {[{ label: 'Sent', value: '—' }, { label: 'Open', value: '—' }, { label: 'Reply', value: '—' }].map((stat) => (
                <div key={stat.label}>
                  <div style={{ fontSize: '9px', color: 'var(--ink-4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1px' }}>{stat.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-3)' }}>{stat.value}</div>
                </div>
              ))}
            </div>
            <DeliverabilityBar pct={92} status="good" />
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--ink-3)' }}>
              Connect mailbox to track metrics
            </div>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderLeft: '3px solid var(--warn)', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <AlertCircle size={12} color="var(--warn)" />
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>outreach@flomobility.com</div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '12px' }}>Secondary sender</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {[{ label: 'Sent', value: '—' }, { label: 'Open', value: '—' }, { label: 'Bounce', value: '—' }].map((stat) => (
                <div key={stat.label}>
                  <div style={{ fontSize: '9px', color: 'var(--ink-4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1px' }}>{stat.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-3)' }}>{stat.value}</div>
                </div>
              ))}
            </div>
            <DeliverabilityBar pct={71} status="warn" />
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--warn)', fontWeight: 500 }}>
              Connect mailbox to track metrics
            </div>
          </div>

          <div style={{
            background: 'var(--paper-2)', border: '1px dashed var(--line-2)', borderRadius: '6px',
            padding: '14px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px', minHeight: '160px',
          }}>
            <div style={{ width: '32px', height: '32px', border: '1.5px dashed var(--line-2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)' }}>
              <Plus size={16} />
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-3)' }}>Add sender</div>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', textAlign: 'center' }}>Connect a mailbox or LinkedIn account</div>
          </div>
        </div>

        {/* Compliance rules */}
        <SectionLabel>Compliance Rules</SectionLabel>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
          {complianceRules.map((rule, i) => (
            <div key={rule.label} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderBottom: i < complianceRules.length - 1 ? '1px solid var(--line)' : undefined,
            }}>
              <Toggle on={rule.on} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: rule.on ? 'var(--ink)' : 'var(--ink-3)' }}>
                  {rule.label}
                </span>
              </div>
              <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.06em', background: 'var(--paper-2)', color: 'var(--ink-4)', padding: '2px 6px', borderRadius: '3px' }}>
                {rule.scope}
              </span>
            </div>
          ))}
        </div>

        {/* Suppression list */}
        <SectionLabel>Suppression List</SectionLabel>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                {['Domain / Email', 'Type', 'Reason', 'Source', 'Added'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppressions.map((s, i) => (
                <tr key={s.entity} style={{ borderBottom: i < suppressions.length - 1 ? '1px solid var(--line)' : undefined }}>
                  <td style={{ padding: '9px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: 'var(--ink-2)' }}>{s.entity}</td>
                  <td style={{ padding: '9px 14px', fontSize: '11.5px', color: 'var(--ink-3)' }}>{s.type}</td>
                  <td style={{ padding: '9px 14px', fontSize: '11.5px', color: 'var(--ink-2)' }}>{s.reason}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 500, background: s.source === 'Auto' ? 'var(--info-soft)' : 'var(--paper-2)', color: s.source === 'Auto' ? 'var(--info)' : 'var(--ink-3)', padding: '1px 6px', borderRadius: '3px' }}>{s.source}</span>
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: '11.5px', color: 'var(--ink-3)' }}>{s.added}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
