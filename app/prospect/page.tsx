'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Zap, Users, CheckCircle, Mail, Target, Loader2, ChevronRight, AlertCircle } from 'lucide-react'

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

interface DecisionMaker {
  name: string | null
  title: string | null
  linkedin_url: string | null
  email: string | null
  recent_activity: string[]
}

interface EnrichedLead {
  company_name: string
  domain: string
  score: number
  grade: string
  recent_news: string[]
  buying_signal_evidence: string[]
  decision_maker: DecisionMaker
  personalization_hooks: string[]
}

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

interface PipelineData {
  taskId: string
  scoredLeads: ScoredLead[]
  enrichedLeads: EnrichedLead[]
  emailDrafts: EmailDraft[]
  qualifiedCount: number
  totalScored: number
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

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const colors: Record<string, [string, string]> = {
    A: ['var(--good-soft)', 'var(--good)'],
    B: ['var(--warn-soft)', 'var(--warn)'],
    C: ['var(--accent-soft)', 'var(--bad)'],
  }
  const [bg, color] = colors[grade] ?? ['var(--paper-3)', 'var(--ink-3)']
  return (
    <span style={{ fontSize: '10.5px', fontWeight: 600, background: bg, color, padding: '1px 7px', borderRadius: '3px' }}>
      {score} · {grade}
    </span>
  )
}

function IcpDots({ match }: { match: ScoredLead['icp_match'] }) {
  const dims = [
    { label: 'Industry', ok: match.industry_match },
    { label: 'Size', ok: match.size_match },
    { label: 'Stage', ok: match.stage_match },
    { label: 'Geo', ok: match.geo_match },
  ]
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {dims.map(d => (
        <span key={d.label} style={{
          fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px',
          color: d.ok ? 'var(--good)' : 'var(--ink-4)',
        }}>
          {d.ok
            ? <CheckCircle size={9} color="var(--good)" />
            : <AlertCircle size={9} color="var(--ink-4)" />}
          {d.label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lead row
// ---------------------------------------------------------------------------
function LeadRow({
  lead,
  enriched,
  email,
  selected,
  onSelect,
}: {
  lead: ScoredLead
  enriched: EnrichedLead | undefined
  email: EmailDraft | undefined
  selected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--line)',
        cursor: 'pointer',
        background: selected ? 'var(--accent-tint)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{lead.company_name}</span>
            <GradeBadge grade={lead.grade} score={lead.score} />
            {enriched && (
              <span style={{ fontSize: '9px', background: 'var(--info-soft)', color: 'var(--info)', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                ENRICHED
              </span>
            )}
            {email && (
              <span style={{ fontSize: '9px', background: 'var(--good-soft)', color: 'var(--good)', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                DRAFT READY
              </span>
            )}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '6px' }}>
            {lead.domain}
          </div>
          <IcpDots match={lead.icp_match} />
        </div>
        <ChevronRight size={13} color="var(--ink-4)" style={{ marginTop: '2px', flexShrink: 0 }} />
      </div>

      {lead.icp_match?.trigger_signals?.length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {lead.icp_match.trigger_signals.slice(0, 2).map((s, i) => (
            <span key={i} style={{
              fontSize: '10px', background: 'var(--paper-2)', color: 'var(--ink-3)',
              padding: '1px 6px', borderRadius: '3px', border: '1px solid var(--line)',
            }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------
function DetailPanel({
  lead,
  enriched,
  email,
}: {
  lead: ScoredLead
  enriched: EnrichedLead | undefined
  email: EmailDraft | undefined
}) {
  const [emailTab, setEmailTab] = useState<'primary' | 'followup'>('primary')
  const [copied, setCopied] = useState(false)

  function copyEmail() {
    if (!email) return
    const subject = emailTab === 'primary' ? email.subject : email.follow_up_subject
    const body = emailTab === 'primary' ? email.body : email.follow_up_body
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Company header */}
      <div style={{ padding: '16px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
              {lead.company_name}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>{lead.domain}</div>
          </div>
          <GradeBadge grade={lead.grade} score={lead.score} />
        </div>
        <IcpDots match={lead.icp_match} />
        {lead.rationale && (
          <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {lead.rationale}
          </div>
        )}
      </div>

      {/* Trigger signals */}
      {lead.icp_match?.trigger_signals?.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Trigger Signals
          </div>
          {lead.icp_match.trigger_signals.map((s, i) => (
            <div key={i} style={{
              padding: '7px 12px', marginBottom: '5px',
              background: 'var(--accent-tint)', border: '1px solid rgba(var(--accent-rgb), 0.2)',
              borderRadius: '5px', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5,
            }}>
              · {s}
            </div>
          ))}
        </div>
      )}

      {/* Enriched section */}
      {enriched ? (
        <>
          {enriched.recent_news?.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Recent News
              </div>
              {enriched.recent_news.map((n, i) => (
                <div key={i} style={{ fontSize: '12px', color: 'var(--ink-2)', padding: '5px 0', borderBottom: i < enriched.recent_news.length - 1 ? '1px solid var(--line)' : undefined }}>
                  · {n}
                </div>
              ))}
            </div>
          )}

          {enriched.decision_maker && (
            <div style={{ padding: '14px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Decision Maker
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                {enriched.decision_maker.name ?? 'Unknown'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px' }}>
                {enriched.decision_maker.title ?? '—'}
              </div>
              {enriched.decision_maker.email && (
                <div style={{ fontSize: '11.5px', color: 'var(--info)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {enriched.decision_maker.email}
                </div>
              )}
            </div>
          )}

          {enriched.personalization_hooks?.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Personalisation Hooks
              </div>
              {enriched.personalization_hooks.map((h, i) => (
                <div key={i} style={{
                  padding: '8px 12px', marginBottom: '5px',
                  background: 'var(--good-soft)', borderRadius: '5px',
                  fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5,
                }}>
                  · {h}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{
          padding: '16px', background: 'var(--paper-2)', borderRadius: '8px',
          border: '1px dashed var(--line)', textAlign: 'center',
          fontSize: '12px', color: 'var(--ink-4)',
        }}>
          Deep research not yet run for this lead.
          <br />Run the pipeline to get decision maker and personalisation data.
        </div>
      )}

      {/* Email draft */}
      {email ? (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Email Draft
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', alignItems: 'center' }}>
            {(['primary', 'followup'] as const).map(tab => (
              <button key={tab} onClick={() => setEmailTab(tab)} style={{
                padding: '4px 12px', fontSize: '11.5px', borderRadius: '4px', cursor: 'pointer',
                fontWeight: emailTab === tab ? 600 : 400,
                background: emailTab === tab ? 'var(--ink)' : 'var(--paper-2)',
                color: emailTab === tab ? 'var(--paper)' : 'var(--ink-3)',
                border: '1px solid var(--line)',
              }}>
                {tab === 'primary' ? 'Initial' : 'Follow-up'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={copyEmail} style={{
              padding: '4px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
              background: copied ? 'var(--good-soft)' : 'var(--paper-2)',
              color: copied ? 'var(--good)' : 'var(--ink-3)',
              border: `1px solid ${copied ? 'var(--good)' : 'var(--line)'}`,
              fontWeight: 500, transition: 'all 0.15s',
            }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ padding: '14px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px', display: 'flex', gap: '6px' }}>
              <span style={{ color: 'var(--ink-4)' }}>Subject:</span>
              {emailTab === 'primary' ? email.subject : email.follow_up_subject}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {emailTab === 'primary' ? email.body : email.follow_up_body}
            </div>
            {email.personalization_note && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--info-soft)', borderRadius: '5px', fontSize: '11px', color: 'var(--info)' }}>
                ✦ {email.personalization_note}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '16px', background: 'var(--paper-2)', borderRadius: '8px',
          border: '1px dashed var(--line)', textAlign: 'center',
          fontSize: '12px', color: 'var(--ink-4)',
        }}>
          No email draft for this lead yet.
          <br />Run a full pipeline to generate personalised drafts.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProspectPage() {
  const router = useRouter()
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tasksRes = await fetch('/api/tasks', { cache: 'no-store' })
      const tasksData = await tasksRes.json()
      const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = tasksData.tasks ?? []

      const latestSP = allTasks
        .filter(t => t.name === 'sdr:core:sales-pipeline' && t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      if (!latestSP) { setLoading(false); return }

      const artRes = await fetch(`/api/tasks/${latestSP.id}/artifacts`, { cache: 'no-store' })
      const artData = await artRes.json()
      const arts: Array<{ id: string; entry_name: string }> = artData.artifacts ?? []

      async function fetchArtifact(name: string) {
        const art = arts.find(a => a.entry_name === name)
        if (!art) return null
        const res = await fetch(`/api/artifacts/${art.id}`, { cache: 'no-store' })
        const json = await res.json()
        return parseContent(json.artifact?.content)
      }

      const [scored, enriched, emails] = await Promise.all([
        fetchArtifact('scored_leads'),
        fetchArtifact('enriched_leads'),
        fetchArtifact('email_drafts'),
      ])

      setData({
        taskId: latestSP.id,
        scoredLeads: (scored?.scored_leads as ScoredLead[]) ?? [],
        enrichedLeads: (enriched?.enriched_leads as EnrichedLead[]) ?? [],
        emailDrafts: (emails?.drafts as EmailDraft[]) ?? [],
        qualifiedCount: (scored?.qualified_count as number) ?? 0,
        totalScored: (scored?.total_scored as number) ?? 0,
      })
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // If no data after initial load, poll every 5s (pipeline might be finishing)
  useEffect(() => {
    if (data) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    if (!loading) {
      pollRef.current = setInterval(load, 5000)
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [data, loading, load])

  const selectedLead = data?.scoredLeads.find(l => l.domain === selectedDomain) ?? null
  const selectedEnriched = data?.enrichedLeads.find(l => l.domain === selectedDomain)
  const selectedEmail = data?.emailDrafts.find(d => d.company_name === selectedLead?.company_name)

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 32px 16px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'flex-end', gap: '24px', flexShrink: 0,
        background: 'var(--paper-2)',
      }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '32px', letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>
            Prospect Workbench
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '4px' }}>
            {data ? `${data.taskId} · ${data.qualifiedCount}/${data.totalScored} qualified` : 'No pipeline run yet'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button onClick={() => load()} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 12px', fontSize: '12px',
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: '5px', color: 'var(--ink-2)', cursor: 'pointer',
          }}>
            <RefreshCw size={11} />
          </button>
          <button onClick={() => router.push('/pipeline')} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', fontSize: '12.5px',
            background: 'var(--accent)', border: '1px solid var(--accent)',
            borderRadius: '5px', color: 'white', cursor: 'pointer', fontWeight: 500,
          }}>
            <Zap size={12} />
            Run prospecting
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {data && (
        <div style={{
          display: 'flex', gap: '0', borderBottom: '1px solid var(--line)',
          flexShrink: 0, background: 'var(--paper)',
        }}>
          {[
            { icon: <Users size={13} />, label: 'Researched', value: data.totalScored, color: 'var(--info)' },
            { icon: <Target size={13} />, label: 'Qualified', value: data.qualifiedCount, color: 'var(--good)' },
            { icon: <CheckCircle size={13} />, label: 'Enriched', value: data.enrichedLeads.length, color: 'var(--warn)' },
            { icon: <Mail size={13} />, label: 'Emails Drafted', value: data.emailDrafts.length, color: 'var(--accent)' },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1, padding: '12px 20px',
              borderRight: i < 3 ? '1px solid var(--line)' : undefined,
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ color: stat.color }}>{stat.icon}</span>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', fontFamily: "'Instrument Serif', serif", lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--ink-4)', fontWeight: 500, marginTop: '2px' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--ink-3)' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Loading pipeline data…
          </div>
        ) : !data || data.scoredLeads.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '40px', maxWidth: '340px' }}>
              <Users size={28} color="var(--ink-4)" style={{ margin: '0 auto 12px' }} />
              {pollRef.current ? (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>
                    Waiting for pipeline results…
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', fontSize: '12px', color: 'var(--info)', marginBottom: '16px' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Checking every 5s
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>No leads yet</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: '16px' }}>
                    Run the sales pipeline from the Pipeline page to find and score leads.
                  </div>
                </>
              )}
              <button onClick={() => router.push('/pipeline')} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', fontSize: '12.5px',
                background: 'var(--accent)', border: '1px solid var(--accent)',
                borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 500,
              }}>
                <Zap size={13} />
                Go to Pipeline
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Lead list */}
            <div style={{ width: '360px', borderRight: '1px solid var(--line)', overflow: 'auto', flexShrink: 0 }}>
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--line)',
                fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                background: 'var(--paper-2)',
              }}>
                {data.scoredLeads.length} Leads · sorted by score
              </div>
              {[...data.scoredLeads]
                .sort((a, b) => b.score - a.score)
                .map(lead => (
                  <LeadRow
                    key={lead.domain}
                    lead={lead}
                    enriched={data.enrichedLeads.find(e => e.domain === lead.domain)}
                    email={data.emailDrafts.find(d => d.company_name === lead.company_name)}
                    selected={selectedDomain === lead.domain}
                    onSelect={() => setSelectedDomain(lead.domain)}
                  />
                ))}
            </div>

            {/* Detail panel */}
            {selectedLead ? (
              <DetailPanel lead={selectedLead} enriched={selectedEnriched} email={selectedEmail} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: '13px' }}>
                Select a lead to see details
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
