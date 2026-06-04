'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw, CheckCircle, Calendar, BarChart2, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
}

interface ScoredLead {
  company_name: string
  domain: string
  score: number
  grade: string
  rationale: string
  passed_threshold: boolean
}

interface FlowStat {
  flowId: string
  label: string
  completed: number
  failed: number
  lastRun: string
  avgDurationMins: number
}

interface PageData {
  pipelineRuns: number
  profileBuilderRuns: number
  totalScored: number
  totalQualified: number
  totalEmailsDrafted: number
  topAccounts: ScoredLead[]
  flowStats: FlowStat[]
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

function avgDurationMins(tasks: Task[]): number {
  const withBoth = tasks.filter(t => t.updated_at && t.created_at)
  if (!withBoth.length) return 0
  const sum = withBoth.reduce(
    (acc, t) => acc + new Date(t.updated_at).getTime() - new Date(t.created_at).getTime(),
    0
  )
  return Math.round(sum / withBoth.length / 60000)
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function successColor(rate: number): string {
  if (rate >= 95) return 'var(--good)'
  if (rate >= 70) return 'var(--warn)'
  return 'var(--bad)'
}

// ---------------------------------------------------------------------------
// Sub-components
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

function MetricTile({
  label, value, meta, trend, loading,
}: {
  label: string; value: string; meta: string; trend?: string; loading?: boolean
}) {
  const isUp = trend?.startsWith('+')
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '6px' }}>
        {loading ? (
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--ink-4)' }} />
        ) : (
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '30px', color: 'var(--ink)', lineHeight: 1 }}>
            {value}
          </div>
        )}
        {trend && !loading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            fontSize: '11.5px', fontWeight: 500,
            color: isUp ? 'var(--good)' : 'var(--ink-3)',
            marginBottom: '2px',
          }}>
            {trend}
          </div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{meta}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OutcomesPage() {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)

    try {
      const tasksRes = await fetch('/api/tasks', { cache: 'no-store' })
      const tasksJson = await tasksRes.json()
      const allTasks: Task[] = tasksJson.tasks ?? []

      const spAll = allTasks.filter(t => t.name === 'sdr:core:sales-pipeline')
      const pbAll = allTasks.filter(t => t.name === 'sdr:core:profile-builder')

      const spCompleted = spAll.filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const pbCompleted = pbAll.filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Aggregate artifacts from up to 5 most recent completed SP tasks
      let totalScored = 0, totalQualified = 0, totalEmails = 0
      const allLeads: ScoredLead[] = []

      await Promise.all(spCompleted.slice(0, 5).map(async (task) => {
        try {
          const artRes = await fetch(`/api/tasks/${task.id}/artifacts`, { cache: 'no-store' })
          const artData = await artRes.json()
          const arts: { id: string; entry_name: string }[] = artData.artifacts ?? []

          const scoredArt = arts.find(a => a.entry_name === 'scored_leads')
          const emailArt  = arts.find(a => a.entry_name === 'email_drafts')

          await Promise.all([
            scoredArt ? fetch(`/api/artifacts/${scoredArt.id}`, { cache: 'no-store' })
              .then(r => r.json())
              .then(d => {
                const p = parseContent(d.artifact?.content)
                if (p) {
                  totalScored += (p.total_scored as number) || (p.scored_leads as ScoredLead[])?.length || 0
                  totalQualified += (p.qualified_count as number) || 0
                  allLeads.push(...((p.scored_leads as ScoredLead[]) ?? []))
                }
              }).catch(() => {}) : Promise.resolve(),

            emailArt ? fetch(`/api/artifacts/${emailArt.id}`, { cache: 'no-store' })
              .then(r => r.json())
              .then(d => {
                const p = parseContent(d.artifact?.content)
                if (p) totalEmails += (p.drafts as unknown[])?.length ?? 0
              }).catch(() => {}) : Promise.resolve(),
          ])
        } catch {}
      }))

      // Deduplicate leads by domain, keep highest score
      const leadMap = new Map<string, ScoredLead>()
      for (const lead of allLeads) {
        const existing = leadMap.get(lead.domain)
        if (!existing || lead.score > existing.score) leadMap.set(lead.domain, lead)
      }
      const topAccounts = [...leadMap.values()]
        .filter(l => l.passed_threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)

      const spFailed = spAll.filter(t => t.status === 'blocked' || t.status === 'failed').length
      const pbFailed = pbAll.filter(t => t.status === 'blocked' || t.status === 'failed').length

      const flowStats: FlowStat[] = [
        {
          flowId: 'sdr:core:profile-builder',
          label: 'Profile Builder',
          completed: pbCompleted.length,
          failed: pbFailed,
          lastRun: pbCompleted[0]?.updated_at ?? '',
          avgDurationMins: avgDurationMins(pbCompleted),
        },
        {
          flowId: 'sdr:core:sales-pipeline',
          label: 'Sales Pipeline',
          completed: spCompleted.length,
          failed: spFailed,
          lastRun: spCompleted[0]?.updated_at ?? '',
          avgDurationMins: avgDurationMins(spCompleted),
        },
      ]

      setData({
        pipelineRuns: spCompleted.length,
        profileBuilderRuns: pbCompleted.length,
        totalScored,
        totalQualified,
        totalEmailsDrafted: totalEmails,
        topAccounts,
        flowStats,
      })
    } catch (err) {
      console.error('Outcomes load error:', err)
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const gradeColor = (grade: string) => {
    if (grade === 'A') return 'var(--good)'
    if (grade === 'B') return 'var(--warn)'
    return 'var(--bad)'
  }

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
            Outcomes
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '4px' }}>
            {data ? `${data.pipelineRuns} pipeline runs · ${data.profileBuilderRuns} profiles built` : 'Loading…'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11.5px', color: 'var(--ink-3)',
            padding: '5px 10px', border: '1px solid var(--line)', borderRadius: '5px',
          }}>
            <Calendar size={12} />
            All time
          </div>
          <button
            onClick={() => load(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px', fontSize: '11.5px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              borderRadius: '5px', color: 'var(--ink-2)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px 40px', flex: 1, maxWidth: '1100px' }}>

        {/* Metric tiles — real data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          <MetricTile
            label="Pipeline Runs"
            value={data ? String(data.pipelineRuns) : '—'}
            meta="completed sales-pipeline runs"
            loading={loading}
          />
          <MetricTile
            label="Leads Researched"
            value={data ? String(data.totalScored) : '—'}
            meta="total companies evaluated"
            loading={loading}
          />
          <MetricTile
            label="Qualified"
            value={data ? String(data.totalQualified) : '—'}
            meta="passed ICP scoring threshold"
            loading={loading}
          />
          <MetricTile
            label="Emails Drafted"
            value={data ? String(data.totalEmailsDrafted) : '—'}
            meta="personalised drafts generated"
            loading={loading}
          />
        </div>

        {/* Flow Performance */}
        <SectionLabel>Flow Performance</SectionLabel>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                {['Flow', 'Completed', 'Failed', 'Success Rate', 'Avg Duration', 'Last Run'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left',
                    fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ink-4)' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  </td>
                </tr>
              ) : (data?.flowStats ?? []).map((row, i) => {
                const total = row.completed + row.failed
                const rate = total > 0 ? Math.round((row.completed / total) * 100) : 100
                return (
                  <tr key={row.flowId} style={{ borderBottom: i < (data?.flowStats.length ?? 0) - 1 ? '1px solid var(--line)' : undefined }}>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{row.label}</div>
                      <div style={{ fontSize: '10.5px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-4)' }}>{row.flowId}</div>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--good)' }}>{row.completed}</td>
                    <td style={{ padding: '9px 14px', fontSize: '13px', color: row.failed > 0 ? 'var(--bad)' : 'var(--ink-4)' }}>{row.failed}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: successColor(rate) }}>{rate}%</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: 'var(--ink-3)' }}>
                      {row.avgDurationMins > 0 ? `~${row.avgDurationMins}m` : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: '11.5px', color: 'var(--ink-3)' }}>
                      {formatDate(row.lastRun)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Top performing accounts — real data */}
        <SectionLabel>Top Qualified Accounts</SectionLabel>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-4)', fontSize: '13px' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : data && data.topAccounts.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {data.topAccounts.map((acc) => (
              <div key={acc.domain} style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '6px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: gradeColor(acc.grade), flexShrink: 0 }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.company_name}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, background: gradeColor(acc.grade) + '22', color: gradeColor(acc.grade), padding: '1px 7px', borderRadius: '3px', flexShrink: 0 }}>
                    {acc.score} · {acc.grade}
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-4)', marginBottom: '6px' }}>
                  {acc.domain}
                </div>
                {acc.rationale && (
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    {acc.rationale.slice(0, 120)}{acc.rationale.length > 120 ? '…' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '12.5px', color: 'var(--ink-4)', fontStyle: 'italic' }}>
            No qualified accounts yet — run the sales pipeline to score leads.
          </div>
        )}

        {/* Engagement metrics — placeholder (requires email tracking integration) */}
        <SectionLabel>Engagement Metrics</SectionLabel>
        <div style={{
          background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '6px',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <AlertCircle size={14} color="var(--ink-4)" />
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-2)', marginBottom: '2px' }}>
              Open rate, reply rate, and meeting data require a connected mailbox
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>
              Connect a sender in Engagement → Sender Health to track email performance.
            </div>
          </div>
        </div>

        {/* Quick stats footer */}
        {data && (
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { icon: <BarChart2 size={11} />, label: `${data.pipelineRuns} pipeline runs completed` },
              { icon: <CheckCircle size={11} />, label: `${data.totalQualified} leads qualified` },
              { icon: <CheckCircle size={11} />, label: `${data.totalEmailsDrafted} email drafts ready` },
            ].map(s => (
              <div key={s.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px', background: 'var(--good-soft)', border: '1px solid var(--good)',
                borderRadius: '4px', fontSize: '11px', color: 'var(--good)', fontWeight: 500,
              }}>
                {s.icon}
                {s.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
