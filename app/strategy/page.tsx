'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, RefreshCw, Download, FileText, Target, BarChart2, Building2, Loader2, Mail, Users, GitBranch } from 'lucide-react'

interface ArtifactMeta {
  id: string
  entry_name: string
  artifact_name: string
  status: string
  phase_name?: string
  created_at: string
}

interface ArtifactContent {
  id: string
  entry_name: string
  content?: string
  parsed?: Record<string, unknown>
}

const ARTIFACT_META: Record<string, {
  label: string
  group: string
  color: string
  icon: React.ReactNode
  description: string
}> = {
  company_raw: {
    label: 'Company Profile',
    group: 'Foundation',
    color: 'var(--info)',
    icon: <Building2 size={13} />,
    description: 'Raw company and product data extracted from description',
  },
  icp_data: {
    label: 'ICP Data',
    group: 'Foundation',
    color: 'var(--good)',
    icon: <Target size={13} />,
    description: 'Company and contact ideal customer profile',
  },
  profile_documents: {
    label: 'Profile Documents',
    group: 'Foundation',
    color: 'var(--accent)',
    icon: <FileText size={13} />,
    description: 'Final ICP Profile, Buyer Persona, and Company Profile',
  },
  scoring_rubric: {
    label: 'Scoring Rubric',
    group: 'Scoring',
    color: 'var(--warn)',
    icon: <BarChart2 size={13} />,
    description: 'Lead scoring dimensions with weights',
  },
  competitive_positioning: {
    label: 'Competitive Positioning',
    group: 'Competitive',
    color: 'var(--bad)',
    icon: <BarChart2 size={13} />,
    description: 'Competitor landscape and positioning matrix',
  },
  leads_raw: {
    label: 'Leads Found',
    group: 'Pipeline',
    color: 'var(--info)',
    icon: <Users size={13} />,
    description: 'Companies discovered by lead researcher matching the ICP',
  },
  scored_leads: {
    label: 'Scored Leads',
    group: 'Pipeline',
    color: 'var(--warn)',
    icon: <BarChart2 size={13} />,
    description: 'Leads scored and qualified against the ICP scoring rubric',
  },
  enriched_leads: {
    label: 'Enriched Leads',
    group: 'Pipeline',
    color: 'var(--good)',
    icon: <Target size={13} />,
    description: 'Qualified leads enriched with decision makers and personalization hooks',
  },
  outreach_strategy: {
    label: 'Outreach Strategy',
    group: 'Pipeline',
    color: 'var(--accent)',
    icon: <GitBranch size={13} />,
    description: 'Multi-touch outreach sequence, tone, CTAs, and personalisation rules',
  },
  email_drafts: {
    label: 'Email Drafts',
    group: 'Pipeline',
    color: 'var(--good)',
    icon: <Mail size={13} />,
    description: 'Personalised cold email drafts for each qualified lead',
  },
}

const GROUPS = ['Foundation', 'Competitive', 'Scoring', 'Pipeline']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseContent(raw: string): any | null {
  if (!raw) return null
  try {
    const cleaned = raw.replace(/^\s*\d+\s*\|\s?/gm, '')
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--ink-4)', marginBottom: '8px', marginTop: '16px',
    }}>
      {label}
    </div>
  )
}

function Chip({ text, color }: { text: string; color?: string }) {
  return (
    <span style={{
      fontSize: '11px',
      background: color ? `${color}22` : 'var(--paper-3)',
      color: color || 'var(--ink-3)',
      padding: '2px 8px',
      borderRadius: '4px',
      border: color ? `1px solid ${color}44` : '1px solid var(--line)',
    }}>
      {text}
    </span>
  )
}

function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: '12.5px', color: 'var(--ink-2)', paddingLeft: '14px', position: 'relative', lineHeight: 1.5 }}>
          <span style={{ position: 'absolute', left: 0, color: color || 'var(--accent)' }}>·</span>
          {item}
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ICPView({ data }: { data: any }) {
  const company = data.company_criteria || data.company_icp
  const contact = data.contact_criteria || data.contact_icp

  if (!company && !contact) {
    return <pre style={{ fontSize: '11px', color: 'var(--ink-3)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
  }

  return (
    <div>
      {company && (
        <div>
          <SectionLabel label="Firmographics" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
            {(company.industries as string[] || []).map((ind) => (
              <Chip key={ind} text={ind} color="var(--info)" />
            ))}
          </div>

          {company.geographies && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '5px' }}>Geographies</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                {(company.geographies as string[]).map((g) => (
                  <Chip key={g} text={g} color="var(--good)" />
                ))}
              </div>
            </>
          )}

          {company.revenue_range && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '3px' }}>Revenue Range</div>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', fontWeight: 500 }}>{String(company.revenue_range)}</div>
            </div>
          )}

          {company.buying_triggers && (
            <>
              <SectionLabel label="Buying Triggers" />
              <BulletList items={(company.buying_triggers as string[]).slice(0, 5)} color="var(--accent)" />
            </>
          )}

          {company.qualification_signals && (
            <>
              <SectionLabel label="Qualification Signals" />
              <BulletList items={(company.qualification_signals as string[]).slice(0, 4)} color="var(--good)" />
            </>
          )}

          {company.disqualifiers && (
            <>
              <SectionLabel label="Disqualifiers" />
              <BulletList items={(company.disqualifiers as string[]).slice(0, 4)} color="var(--bad)" />
            </>
          )}
        </div>
      )}

      {contact && (
        <div>
          <SectionLabel label="Contact ICP" />
          {contact.job_titles && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '5px' }}>Job Titles</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                {(contact.job_titles as string[]).map((t) => (
                  <Chip key={t} text={t} color="var(--accent)" />
                ))}
              </div>
            </>
          )}
          {contact.pain_points && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '5px' }}>Pain Points</div>
              <BulletList items={(contact.pain_points as string[]).slice(0, 4)} color="var(--warn)" />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScoringRubricView({ data }: { data: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dims: Array<any> = data.dimensions || []

  return (
    <div>
      <SectionLabel label="Scoring Dimensions" />
      {dims.map((dim, i) => {
        const weight = Number(dim.weight || 0)
        const name = String(dim.name || dim.dimension || `Dimension ${i + 1}`)
        return (
          <div key={i} style={{ marginBottom: '14px', padding: '12px 14px', background: 'var(--paper-2)', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
              <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-3)', background: 'var(--paper)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px' }}>
                {weight}%
              </span>
            </div>
            <div style={{ height: '5px', background: 'var(--paper-3)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{
                height: '100%',
                width: `${weight}%`,
                background: weight > 20 ? 'var(--accent)' : weight > 12 ? 'var(--warn)' : 'var(--info)',
                borderRadius: '3px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            {dim.scoring_guide && (
              <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                {String(dim.scoring_guide).slice(0, 150)}{String(dim.scoring_guide).length > 150 ? '…' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompanyRawView({ data }: { data: any }) {
  return (
    <div>
      {data.company_name && (
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
          {String(data.company_name)}
        </div>
      )}
      {data.differentiators && (
        <>
          <SectionLabel label="Differentiators" />
          <BulletList items={data.differentiators as string[]} color="var(--accent)" />
        </>
      )}
      {data.key_features && (
        <>
          <SectionLabel label="Key Features" />
          <BulletList items={data.key_features as string[]} color="var(--info)" />
        </>
      )}
      {data.target_outcomes && (
        <>
          <SectionLabel label="Target Outcomes" />
          <BulletList items={data.target_outcomes as string[]} color="var(--good)" />
        </>
      )}
      {data.open_questions && (
        <>
          <SectionLabel label="Open Questions" />
          <BulletList items={(data.open_questions as string[]).slice(0, 5)} color="var(--warn)" />
        </>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProfileDocumentsView({ data }: { data: any }) {
  const icp = data.icp_profile
  const persona = data.buyer_persona
  const company = data.company_profile

  return (
    <div>
      {icp && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--info)', marginBottom: '8px' }}>ICP Profile</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>{String(icp.title || '')}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{String(icp.summary || '').slice(0, 400)}{String(icp.summary || '').length > 400 ? '…' : ''}</div>
        </div>
      )}
      {persona && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>Buyer Persona</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>{String(persona.persona_name || '')}</div>
          {persona.job_titles && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
              {(persona.job_titles as string[]).map((t) => (
                <Chip key={t} text={t} color="var(--accent)" />
              ))}
            </div>
          )}
          {persona.pain_points && (
            <BulletList items={(persona.pain_points as string[]).slice(0, 4)} color="var(--warn)" />
          )}
        </div>
      )}
      {company && (
        <div style={{ padding: '16px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--good)', marginBottom: '8px' }}>Company Profile</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>{String(company.company_name || '')}</div>
          {company.elevator_pitch && (
            <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: '10px' }}>
              {String(company.elevator_pitch).slice(0, 400)}
            </div>
          )}
          {company.key_benefits && (
            <BulletList items={(company.key_benefits as string[]).slice(0, 4)} color="var(--good)" />
          )}
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ArtifactContent({ name, data }: { name: string; data: any }) {
  if (name === 'icp_data') return <ICPView data={data} />
  if (name === 'scoring_rubric') return <ScoringRubricView data={data} />
  if (name === 'company_raw') return <CompanyRawView data={data} />
  if (name === 'profile_documents') return <ProfileDocumentsView data={data} />
  return (
    <pre style={{ fontSize: '11px', color: 'var(--ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function StrategyPage() {
  const [artifacts, setArtifacts] = useState<ArtifactMeta[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contents, setContents] = useState<Record<string, any>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskIds, setTaskIds] = useState<{ profileBuilder?: string; salesPipeline?: string }>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Discover latest completed tasks dynamically
      const tasksRes = await fetch('/api/tasks', { cache: 'no-store' })
      const tasksData = await tasksRes.json()
      const allTasks: Array<{ id: string; name: string; status: string; created_at: string }> = tasksData.tasks ?? []

      const latestPB = allTasks
        .filter(t => t.name === 'sdr:core:profile-builder' && t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      const latestSP = allTasks
        .filter(t => t.name === 'sdr:core:sales-pipeline' && t.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      setTaskIds({ profileBuilder: latestPB?.id, salesPipeline: latestSP?.id })

      // Fetch artifacts from both tasks
      const taskIds = [latestPB?.id, latestSP?.id].filter(Boolean) as string[]
      const allArts: ArtifactMeta[] = []

      await Promise.all(taskIds.map(async (tid) => {
        try {
          const res = await fetch(`/api/tasks/${tid}/artifacts`, { cache: 'no-store' })
          const data = await res.json()
          const arts: ArtifactMeta[] = (data.artifacts ?? []).filter(
            (a: ArtifactMeta) => a.status === 'active' && a.entry_name !== 'trigger-input'
          )
          allArts.push(...arts)
        } catch {}
      }))

      // Deduplicate by entry_name (prefer latest)
      const seen = new Map<string, ArtifactMeta>()
      for (const art of allArts) {
        if (!seen.has(art.entry_name)) seen.set(art.entry_name, art)
      }
      const arts = Array.from(seen.values())
      setArtifacts(arts)

      const cts: Record<string, Record<string, unknown>> = {}
      await Promise.all(
        arts.map(async (a) => {
          try {
            const cr = await fetch(`/api/artifacts/${a.id}`, { cache: 'no-store' })
            const cd = await cr.json()
            const raw = cd.artifact?.content
            if (raw) {
              const parsed = parseContent(raw)
              if (parsed) cts[a.id] = parsed
            }
          } catch {}
        })
      )
      setContents(cts)
      if (arts.length > 0) setSelected(arts[0].id)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const selectedArtifact = artifacts.find(a => a.id === selected)
  const selectedContent = selected ? contents[selected] : null
  const selectedMeta = selectedArtifact ? ARTIFACT_META[selectedArtifact.entry_name] : null

  const grouped = GROUPS.map(group => ({
    group,
    items: artifacts.filter(a => (ARTIFACT_META[a.entry_name]?.group || 'Foundation') === group),
  })).filter(g => g.items.length > 0)

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', flex: 1, overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{
          borderRight: '1px solid var(--line)',
          background: 'var(--paper-2)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>Strategy Artifacts</div>
            <div style={{ fontSize: '10px', color: 'var(--ink-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {taskIds.profileBuilder && <span>Profile: {taskIds.profileBuilder}</span>}
              {taskIds.salesPipeline && <span>Pipeline: {taskIds.salesPipeline}</span>}
              {!taskIds.profileBuilder && !taskIds.salesPipeline && <span>No completed runs found</span>}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '6px', color: 'var(--ink-4)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {grouped.map(({ group, items }) => (
                <div key={group}>
                  <div style={{ padding: '8px 14px 4px', fontSize: '10px', fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {group}
                  </div>
                  {items.map((art) => {
                    const meta = ARTIFACT_META[art.entry_name]
                    const isSelected = art.id === selected
                    return (
                      <button
                        key={art.id}
                        onClick={() => setSelected(art.id)}
                        style={{
                          width: '100%',
                          padding: '7px 14px',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: isSelected ? 'var(--ink)' : 'transparent',
                          color: isSelected ? 'var(--paper)' : 'var(--ink-2)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ color: isSelected ? 'var(--paper)' : (meta?.color || 'var(--ink-3)'), flexShrink: 0 }}>
                          {meta?.icon || <FileText size={13} />}
                        </span>
                        <span style={{ flex: 1, fontSize: '12.5px', fontWeight: isSelected ? 500 : 400 }}>
                          {meta?.label || art.entry_name}
                        </span>
                        <span style={{
                          fontSize: '9px', padding: '1px 5px',
                          background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--good-soft)',
                          color: isSelected ? 'var(--paper)' : 'var(--good)',
                          borderRadius: '4px', fontWeight: 600,
                        }}>
                          v1
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center panel */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selectedArtifact && selectedMeta ? (
            <>
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--line)',
                background: 'var(--paper-2)',
                display: 'flex', alignItems: 'center', gap: '10px',
                flexShrink: 0,
              }}>
                <span style={{ color: selectedMeta.color }}>{selectedMeta.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedMeta.label}
                    <span style={{ fontSize: '10px', background: 'var(--good-soft)', color: 'var(--good)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>v1 · active</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-3)' }}>{selectedMeta.description}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '5px', color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <RefreshCw size={11} />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      const content = contents[selectedArtifact.id]
                      if (content) {
                        const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${selectedArtifact.entry_name}.json`
                        a.click()
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '5px', color: 'var(--ink-2)', cursor: 'pointer' }}
                  >
                    <Download size={11} />
                    Export JSON
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {selectedContent ? (
                  <ArtifactContent name={selectedArtifact.entry_name} data={selectedContent} />
                ) : (
                  <div style={{ color: 'var(--ink-4)', fontSize: '13px' }}>No content available</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--ink-4)' }}>
              {loading ? (
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <Target size={24} color="var(--ink-4)" style={{ margin: '0 auto 8px' }} />
                  <div>Select an artifact from the left</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{
          borderLeft: '1px solid var(--line)',
          background: 'var(--paper-2)',
          overflow: 'auto',
        }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>Version History</div>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)' }}>Artifact lineage & drift</div>
          </div>

          <div style={{ padding: '12px' }}>
            {/* Version list */}
            <div style={{ marginBottom: '16px' }}>
              {[{ label: 'v1', tag: 'current', color: 'var(--good)' }].map(({ label, tag, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  marginBottom: '6px',
                }}>
                  <div style={{ width: '28px', height: '28px', background: color + '22', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color }}>
                    {label}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-4)' }}>
                    {selectedArtifact ? new Date(selectedArtifact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </div>
                  </div>
                  <span style={{ fontSize: '10px', background: color + '22', color, padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    {tag}
                  </span>
                </div>
              ))}
            </div>

            {/* Drift card */}
            <div style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Drift Analysis</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--ink-3)' }}>vs previous</span>
                  <span style={{ color: 'var(--ink-4)' }}>Initial version</span>
                </div>
              </div>
            </div>

            {/* Artifact stats */}
            {selectedArtifact && (
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Metadata</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-4)' }}>Artifact ID</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace" }}>{selectedArtifact.id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-4)' }}>Phase</div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-2)' }}>{selectedArtifact.phase_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-4)' }}>Created</div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-2)' }}>
                      {new Date(selectedArtifact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-4)' }}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--good)', fontWeight: 500 }}>
                      <CheckCircle size={10} />
                      {selectedArtifact.status}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
