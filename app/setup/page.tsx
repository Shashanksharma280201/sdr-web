'use client'

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import {
  Brain, Building2, Target, Users, Zap, SlidersHorizontal, FileText,
  CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight,
  X, Pencil, ArrowRight, Sparkles, GitBranch,
} from 'lucide-react'

// ─── Pipeline types ────────────────────────────────────────────────────────────

interface PipelinePhase {
  id: string; name: string; status: string; phase_num: number
  started_at?: string; completed_at?: string; stage_result?: unknown
}
interface Artifact {
  id: string; entry_name: string; artifact_name: string
  status: string; phase_name?: string; created_at: string
}

const STAGE_META: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  company_profiler:       { label: 'Company Profiler',       description: 'Extract product details, key features, and differentiators',                              icon: <Building2 size={14} /> },
  icp_builder:            { label: 'ICP Builder',            description: 'Define ideal customer profile — company and contact criteria',                            icon: <Target size={14} /> },
  competition_researcher: { label: 'Competition Researcher', description: 'Map the competitive landscape and build positioning matrix',                              icon: <GitBranch size={14} /> },
  scoring_rubric_builder: { label: 'Scoring Rubric Builder', description: 'Create a custom lead scoring framework from ICP and competitive data',                    icon: <Brain size={14} /> },
  profile_writer:         { label: 'Profile Writer',         description: 'Synthesize all research into final ICP Profile, Buyer Persona, and Company Profile docs',  icon: <FileText size={14} /> },
}
const STAGE_ORDER = ['company_profiler', 'icp_builder', 'competition_researcher', 'scoring_rubric_builder', 'profile_writer']

// ─── Wizard data ───────────────────────────────────────────────────────────────

interface WizardData {
  companyName: string; productDescription: string; valueProposition: string
  keyFeatures: string[]; differentiators: string[]; targetOutcomes: string[]
  industries: string[]; companySizes: string[]; fundingStages: string[]
  geographies: string[]; techStackHints: string[]; revenueRange: string
  jobTitles: string[]; seniorityLevels: string[]; painPoints: string[]
  goals: string[]; objections: string[]
  buyingTriggers: string[]; qualificationSignals: string[]; hardDisqualifiers: string[]
  scoringWeights: Record<string, number>; scoringThreshold: number
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  'Industry Fit': 20, 'Buying Triggers': 30, 'Contact Seniority': 25,
  'Company Size': 15, 'Tech Stack Signal': 10, 'Funding Stage': 0,
}
const DEFAULT_WIZARD: WizardData = {
  companyName: '', productDescription: '', valueProposition: '',
  keyFeatures: [], differentiators: [], targetOutcomes: [],
  industries: [], companySizes: [], fundingStages: [], geographies: [],
  techStackHints: [], revenueRange: '',
  jobTitles: [], seniorityLevels: [], painPoints: [], goals: [], objections: [],
  buyingTriggers: [], qualificationSignals: [], hardDisqualifiers: [],
  scoringWeights: { ...DEFAULT_WEIGHTS }, scoringThreshold: 75,
}

// ─── Phase definitions ─────────────────────────────────────────────────────────

const PHASES = [
  { id: 'company',     label: 'Company Profile',       agent: 'company-profiler',       auto: false, icon: <Building2 size={15} />,      desc: 'What your product does and why customers choose it' },
  { id: 'icp',        label: 'ICP Builder',            agent: 'icp-builder',            auto: false, icon: <Target size={15} />,          desc: 'Who you sell to — companies, buyers, and signals' },
  { id: 'competition',label: 'Competition Research',   agent: 'competition-researcher', auto: true,  icon: <GitBranch size={15} />,       desc: 'Competitor landscape mapped automatically' },
  { id: 'scoring',    label: 'Scoring Setup',          agent: 'scoring-rubric-builder', auto: false, icon: <SlidersHorizontal size={15} />, desc: 'How to prioritise and score incoming leads' },
  { id: 'profile',    label: 'Profile Writing',        agent: 'profile-writer',         auto: true,  icon: <FileText size={15} />,        desc: 'Final ICP, Buyer Persona and Company Profile docs' },
]

// ─── TEST AUTOFILL — remove before shipping ────────────────────────────────────
const FLO_AUTOFILL: WizardData = {
  companyName: 'Flo Mobility',
  productDescription: 'Flo Mobility builds autonomous electric material movement robots (FLO Hauler / MMR) for construction sites, airports, data centers, and hospitals. We offer a Robot-as-a-Service (RaaS) platform where our robots navigate autonomously to move materials across job sites — replacing manual labour and diesel dumpers. Deployment, operation, and maintenance are all handled by the Flo team under a no-capex subscription model.',
  valueProposition: 'We reduce material handling costs by up to 50%, cut project timelines by 45%, and lower on-site accidents by 67% — with zero upfront capital expenditure for contractors through our all-inclusive RaaS subscription.',
  keyFeatures: ['Autonomous electric 4-wheel drive robot (FLO Hauler / MMR)', 'Camera-based vision AI — no expensive LiDAR required', 'All-terrain construction site navigation', 'Zero emissions, battery-powered operation', 'Full deployment, operation, and maintenance by Flo team'],
  differentiators: ['Vision-based autonomy at 10× lower cost than LiDAR competitors', 'No-capex RaaS model — all-inclusive subscription', 'Proven at scale: 55 robots deployed across 24 projects', 'Works in unstructured outdoor sites', 'Patented vision-based autonomy (granted 2024)'],
  targetOutcomes: ['Land multi-robot RaaS contracts with Tier 1 and Tier 2 construction contractors', 'Expand from 55 to 500+ robots in 18 months', 'Enter Middle East and European markets'],
  industries: ['Construction', 'Real Estate Development', 'Infrastructure', 'Data Centers', 'Airports', 'Hospitals'],
  companySizes: ['Mid-market (200–1k)', 'Enterprise (1k+)'],
  fundingStages: [],
  geographies: ['India', 'MENA'],
  revenueRange: '₹500 crore+ annual project value (~$60M+)',
  techStackHints: ['BIM', 'Procore', 'Drones', 'IoT sensors'],
  jobTitles: ['Construction Director', 'Head of Projects', 'VP Operations', 'Chief Engineer', 'Head of Procurement', 'Managing Director'],
  seniorityLevels: ['Director', 'VP', 'C-suite'],
  painPoints: ['Material handling accounts for up to 40% of total labour costs on site', 'Acute labour shortages in the construction workforce', 'High accident and injury rates during manual material movement', 'No real-time visibility into material movement status'],
  goals: ['Reduce project cost and improve contractor margins', 'Improve site safety and achieve zero-accident targets', 'Accelerate construction timelines', 'Adopt automation without heavy capital investment'],
  objections: ['We already have workers doing this — why automate?', 'Our sites are too complex for robots', 'What happens when the robot breaks down mid-project?'],
  buyingTriggers: ['Just awarded a new large-scale project', 'Recent on-site accident or safety incident', 'Rising labour costs or active labour shortage', 'Competitor contractor just adopted automation', 'Project running behind schedule'],
  qualificationSignals: ['Tier 1 or Tier 2 construction contractor in India', 'Running 3 or more active construction projects', 'Annual project value exceeds ₹500 crore', 'Has previously adopted BIM, drones, or other construction tech'],
  hardDisqualifiers: ['Individual homeowner or self-build residential project', 'Company with fewer than 50 employees', 'No active large-scale construction projects'],
  scoringWeights: { 'Industry Fit': 25, 'Buying Triggers': 30, 'Contact Seniority': 20, 'Company Size': 15, 'Tech Stack Signal': 10, 'Funding Stage': 0 },
  scoringThreshold: 70,
}

// ─── assembleCompanyText ───────────────────────────────────────────────────────

function assembleCompanyText(d: WizardData): string {
  const sizeMap: Record<string, string> = {
    startup: 'Startup (1–20 employees)', smb: 'SMB (20–200 employees)',
    'mid-market': 'Mid-market (200–1,000 employees)', enterprise: 'Enterprise (1,000+ employees)',
  }
  const lines = [
    `Company Name: ${d.companyName}`,
    `Product Description: ${d.productDescription}`,
    `Value Proposition: ${d.valueProposition}`,
    d.keyFeatures.length     ? `Key Features: ${d.keyFeatures.join(', ')}` : '',
    d.differentiators.length ? `Differentiators: ${d.differentiators.join(', ')}` : '',
    d.targetOutcomes.length  ? `Target Outcomes: ${d.targetOutcomes.join(', ')}` : '',
    '', 'TARGET MARKET:',
    d.industries.length    ? `Industries: ${d.industries.join(', ')}` : '',
    d.companySizes.length  ? `Company Sizes: ${d.companySizes.map(s => sizeMap[s] || s).join(', ')}` : '',
    d.fundingStages.length ? `Funding Stages: ${d.fundingStages.join(', ')}` : '',
    d.geographies.length   ? `Geographies: ${d.geographies.join(', ')}` : '',
    d.revenueRange         ? `Revenue Range: ${d.revenueRange}` : '',
    d.techStackHints.length? `Tech Stack Signals: ${d.techStackHints.join(', ')}` : '',
    '', 'IDEAL BUYER:',
    d.jobTitles.length       ? `Job Titles: ${d.jobTitles.join(', ')}` : '',
    d.seniorityLevels.length ? `Seniority Levels: ${d.seniorityLevels.join(', ')}` : '',
    ...(d.painPoints.length  ? ['Pain Points:', ...d.painPoints.map(p => `- ${p}`)] : []),
    ...(d.goals.length       ? ['Goals:', ...d.goals.map(g => `- ${g}`)] : []),
    ...(d.objections.length  ? ['Common Objections:', ...d.objections.map(o => `- ${o}`)] : []),
    '', 'BUYING TRIGGERS (events that create urgency):',
    ...d.buyingTriggers.map(t => `- ${t}`),
    '', 'QUALIFICATION SIGNALS (patterns your best customers share):',
    ...d.qualificationSignals.map(s => `- ${s}`),
    '', 'HARD DISQUALIFIERS (skip these leads immediately):',
    ...d.hardDisqualifiers.map(x => `- ${x}`),
    '', 'SCORING PRIORITIES (weights sum to 100):',
    ...Object.entries(d.scoringWeights).filter(([, v]) => v > 0).map(([k, v]) => `- ${k}: ${v}%`),
    '', `Lead Scoring Threshold: ${d.scoringThreshold} — leads scoring >= ${d.scoringThreshold} out of 100 proceed to outreach`,
  ]
  return lines.filter(Boolean).join('\n')
}

// ─── Shared form components ────────────────────────────────────────────────────

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>
        {label}
        {required && <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>*</span>}
        {hint && <span style={{ fontWeight: 400, color: 'var(--ink-4)', marginLeft: '6px' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function inputStyle(focused?: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '9px 12px',
    background: 'var(--paper)', border: `1px solid ${focused ? 'var(--ink-3)' : 'var(--line)'}`,
    borderRadius: '6px', fontSize: '13px', color: 'var(--ink)',
    outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle(focused)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const [focused, setFocused] = useState(false)
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle(focused), resize: 'vertical', lineHeight: 1.6 }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  function addTag(raw: string) {
    const val = raw.trim()
    if (!val || tags.includes(val)) { setInput(''); return }
    onChange([...tags, val]); setInput('')
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
    if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', padding: '7px 10px', background: 'var(--paper)', border: `1px solid ${focused ? 'var(--ink-3)' : 'var(--line)'}`, borderRadius: '6px', minHeight: '40px', cursor: 'text', transition: 'border-color 0.15s' }}>
      {tags.map(tag => (
        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: '4px', padding: '2px 8px 2px 9px', fontSize: '12px', fontWeight: 500 }}>
          {tag}
          <button onClick={e => { e.stopPropagation(); onChange(tags.filter(t => t !== tag)) }} style={{ display: 'flex', alignItems: 'center', color: 'inherit', opacity: 0.6, cursor: 'pointer', padding: '0 1px' }}><X size={11} /></button>
        </span>
      ))}
      <input className="tag-input-field" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); if (input.trim()) addTag(input) }} placeholder={tags.length === 0 ? placeholder : 'Add more…'} style={{ border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: 'var(--ink)', minWidth: '120px', flex: 1, fontFamily: 'inherit' }} />
    </div>
  )
}

function ToggleRow({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(opt: string) { onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]) }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(opt => {
        const sel = value.includes(opt)
        return <button key={opt} onClick={() => toggle(opt)} style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer', border: `1px solid ${sel ? 'var(--ink)' : 'var(--line)'}`, background: sel ? 'var(--ink)' : 'var(--paper)', color: sel ? 'var(--paper)' : 'var(--ink-2)', fontWeight: sel ? 600 : 400, transition: 'all 0.12s' }}>{opt}</button>
      })}
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0 16px' }}>
      <div style={{ height: '1px', flex: 1, background: 'var(--line)' }} />
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '1px', flex: 1, background: 'var(--line)' }} />
    </div>
  )
}

// ─── Phase screens ─────────────────────────────────────────────────────────────

type Update = (patch: Partial<WizardData>) => void

function PhaseCompany({ data, update }: { data: WizardData; update: Update }) {
  return (
    <div>
      <Field label="Company name" required>
        <TextInput value={data.companyName} onChange={v => update({ companyName: v })} placeholder="Acme Corp" />
      </Field>
      <Field label="What does your product do?" hint="2–3 sentences" required>
        <TextArea value={data.productDescription} onChange={v => update({ productDescription: v })} placeholder="We build fleet management SaaS for B2B mobility companies…" rows={3} />
      </Field>
      <Field label="What's the #1 outcome customers get?" hint="one sentence" required>
        <TextInput value={data.valueProposition} onChange={v => update({ valueProposition: v })} placeholder="Fleet managers cut operational costs by 30% and achieve 95% utilization" />
      </Field>
      <Field label="Key features" hint="press Enter to add each">
        <TagInput tags={data.keyFeatures} onChange={v => update({ keyFeatures: v })} placeholder="Real-time GPS tracking" />
      </Field>
      <Field label="What makes you different from alternatives?" hint="press Enter to add each">
        <TagInput tags={data.differentiators} onChange={v => update({ differentiators: v })} placeholder="No RevOps team required" />
      </Field>
      <Field label="Outcomes customers achieve" hint="press Enter to add each">
        <TagInput tags={data.targetOutcomes} onChange={v => update({ targetOutcomes: v })} placeholder="30% fuel cost reduction" />
      </Field>
    </div>
  )
}

function PhaseICP({ data, update }: { data: WizardData; update: Update }) {
  return (
    <div>
      <SectionDivider label="Target Companies" />
      <Field label="Target industries" hint="press Enter to add each" required>
        <TagInput tags={data.industries} onChange={v => update({ industries: v })} placeholder="Logistics, B2B SaaS, Fintech…" />
      </Field>
      <Field label="Company size" required>
        <ToggleRow options={['Startup (1–20)', 'SMB (20–200)', 'Mid-market (200–1k)', 'Enterprise (1k+)']} value={data.companySizes} onChange={v => update({ companySizes: v })} />
      </Field>
      <Field label="Funding stage">
        <ToggleRow options={['Bootstrapped', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Public']} value={data.fundingStages} onChange={v => update({ fundingStages: v })} />
      </Field>
      <Field label="Geographies">
        <ToggleRow options={['India', 'North America', 'UK', 'Europe', 'Southeast Asia', 'MENA', 'Global']} value={data.geographies} onChange={v => update({ geographies: v })} />
      </Field>
      <Field label="Revenue range of target companies" hint="optional">
        <TextInput value={data.revenueRange} onChange={v => update({ revenueRange: v })} placeholder="$2M–$30M ARR" />
      </Field>
      <Field label="Tech stack signals" hint="tools they use that indicate fit">
        <TagInput tags={data.techStackHints} onChange={v => update({ techStackHints: v })} placeholder="HubSpot, Salesforce, SAP…" />
      </Field>

      <SectionDivider label="Ideal Buyer" />
      <Field label="Job titles you target" hint="press Enter to add each" required>
        <TagInput tags={data.jobTitles} onChange={v => update({ jobTitles: v })} placeholder="VP Operations, CTO, Fleet Manager…" />
      </Field>
      <Field label="Seniority level" required>
        <ToggleRow options={['Individual Contributor', 'Manager', 'Director', 'VP', 'C-suite']} value={data.seniorityLevels} onChange={v => update({ seniorityLevels: v })} />
      </Field>
      <Field label="Their biggest pain points" hint="press Enter to add each — be specific" required>
        <TagInput tags={data.painPoints} onChange={v => update({ painPoints: v })} placeholder="Manual tracking with no real-time visibility" />
      </Field>
      <Field label="Their goals" hint="press Enter to add each">
        <TagInput tags={data.goals} onChange={v => update({ goals: v })} placeholder="Reduce OPEX by 30% this year" />
      </Field>
      <Field label="Common objections they raise" hint="optional">
        <TagInput tags={data.objections} onChange={v => update({ objections: v })} placeholder="Already using basic GPS trackers" />
      </Field>

      <SectionDivider label="Urgency Signals" />
      <div style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)', borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--ink)' }}>Buying triggers</strong> are the most important signal in lead scoring — be specific.
      </div>
      <Field label="What has to happen for a company to urgently need you?" hint="press Enter after each" required>
        <TagInput tags={data.buyingTriggers} onChange={v => update({ buyingTriggers: v })} placeholder="New VP of Operations hired" />
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {['New VP/CXO hired', 'Series A raised', 'Missed revenue quarter', 'Expanding to new market', 'Fuel costs spiked', 'Rapid headcount growth'].map(s => (
            !data.buyingTriggers.includes(s) && (
              <button key={s} onClick={() => update({ buyingTriggers: [...data.buyingTriggers, s] })} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px', border: '1px dashed var(--line-2)', background: 'var(--paper)', color: 'var(--ink-3)', cursor: 'pointer' }}>+ {s}</button>
            )
          ))}
        </div>
      </Field>
      <Field label="Qualification signals" hint="what do your best customers have in common?">
        <TagInput tags={data.qualificationSignals} onChange={v => update({ qualificationSignals: v })} placeholder="Fleet of 50+ vehicles" />
      </Field>
      <Field label="Hard disqualifiers" hint="conditions that make a lead not worth pursuing">
        <TagInput tags={data.hardDisqualifiers} onChange={v => update({ hardDisqualifiers: v })} placeholder="B2C personal vehicle tracking" />
      </Field>
    </div>
  )
}

function PhaseCompetition() {
  return (
    <div>
      <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '10px', padding: '28px 24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--paper-3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="var(--ink-3)" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Handled automatically</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>Competition Researcher agent</div>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
          The <strong>Competition Researcher</strong> agent takes your Company Profile and ICP, then autonomously maps your competitive landscape — identifying direct and indirect competitors, building positioning battlecards, and surfacing market gaps where you have an advantage.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[
          { icon: '🔍', label: 'Competitor discovery', desc: 'Identifies direct and indirect alternatives your buyers consider' },
          { icon: '⚔️', label: 'Battlecard generation', desc: 'Win/lose conditions against each key competitor' },
          { icon: '📍', label: 'Positioning matrix', desc: 'Where you win, where you lose, and whitespace to own' },
          { icon: '💡', label: 'Market gaps', desc: 'Underserved segments your ICP maps to' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', padding: '12px 14px', background: 'var(--good-soft)', border: '1px solid var(--good)', borderRadius: '7px', fontSize: '12.5px', color: 'var(--ink-2)' }}>
        <strong style={{ color: 'var(--good)' }}>No input needed.</strong> Click <em>Next</em> to proceed to Scoring Setup — the competition research runs automatically as part of the pipeline.
      </div>
    </div>
  )
}

function PhaseScoring({ data, update }: { data: WizardData; update: Update }) {
  const weights = data.scoringWeights
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  const totalOk = total === 100
  function setWeight(dim: string, val: number) { update({ scoringWeights: { ...weights, [dim]: Math.max(0, Math.min(100, val)) } }) }
  function autoBalance() {
    const dims = Object.keys(weights)
    const perDim = Math.floor(100 / dims.length)
    const remainder = 100 - perDim * dims.length
    const balanced: Record<string, number> = {}
    dims.forEach((d, i) => { balanced[d] = perDim + (i < remainder ? 1 : 0) })
    update({ scoringWeights: balanced })
  }
  const THRESHOLD_OPTIONS = [
    { value: 60, label: 'Broad', desc: 'More leads, lower bar' },
    { value: 75, label: 'Balanced', desc: 'Recommended default' },
    { value: 85, label: 'Tight', desc: 'Fewer, higher-confidence leads' },
  ]
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>
            Scoring dimension weights <span style={{ color: 'var(--accent)' }}>*</span>
            <span style={{ fontWeight: 400, color: 'var(--ink-4)', marginLeft: '6px' }}>must sum to 100</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: totalOk ? 'var(--good)' : total > 100 ? 'var(--bad)' : 'var(--warn)' }}>{total}/100</span>
            {!totalOk && <button onClick={autoBalance} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink-3)', cursor: 'pointer' }}>Auto-balance</button>}
          </div>
        </div>
        {Object.entries(weights).map(([dim, val]) => (
          <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--ink-2)', flex: 1 }}>{dim}</span>
            <button onClick={() => setWeight(dim, val - 5)} style={{ width: '26px', height: '26px', border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--paper)', cursor: 'pointer', fontSize: '14px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", width: '36px', textAlign: 'center', color: val > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>{val}%</span>
            <button onClick={() => setWeight(dim, val + 5)} style={{ width: '26px', height: '26px', border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--paper)', cursor: 'pointer', fontSize: '14px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <div style={{ width: '100px', height: '4px', background: 'var(--paper-3)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${val}%`, borderRadius: '2px', transition: 'width 0.15s', background: val >= 25 ? 'var(--accent)' : val >= 15 ? 'var(--warn)' : 'var(--info)' }} />
            </div>
          </div>
        ))}
      </div>

      <Field label="How selective should we be?" required>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {THRESHOLD_OPTIONS.map(opt => {
            const sel = data.scoringThreshold === opt.value
            return (
              <button key={opt.value} onClick={() => update({ scoringThreshold: opt.value })} style={{ padding: '12px 14px', borderRadius: '7px', cursor: 'pointer', textAlign: 'left', border: `1.5px solid ${sel ? 'var(--ink)' : 'var(--line)'}`, background: sel ? 'var(--ink)' : 'var(--paper)', color: sel ? 'var(--paper)' : 'var(--ink)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '6px' }}>{opt.desc}</div>
                <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, opacity: sel ? 1 : 0.6 }}>≥ {opt.value}/100</div>
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validatePhase(phaseId: string, data: WizardData): string | null {
  if (phaseId === 'company') {
    if (!data.companyName.trim()) return 'Company name is required'
    if (!data.productDescription.trim()) return 'Product description is required'
    if (!data.valueProposition.trim()) return 'Value proposition is required'
  }
  if (phaseId === 'icp') {
    if (data.industries.length === 0) return 'Add at least one target industry'
    if (data.companySizes.length === 0) return 'Select at least one company size'
    if (data.jobTitles.length === 0) return 'Add at least one target job title'
    if (data.painPoints.length === 0) return 'Add at least one pain point'
    if (data.buyingTriggers.length === 0) return 'Add at least one buying trigger'
  }
  if (phaseId === 'scoring') {
    const total = Object.values(data.scoringWeights).reduce((a, b) => a + b, 0)
    if (total !== 100) return `Scoring weights must sum to 100 (currently ${total})`
  }
  return null
}

// ─── Pipeline progress (after submit) ─────────────────────────────────────────

function Duration({ startedAt, completedAt }: { startedAt?: string; completedAt?: string }) {
  const [elapsed, setElapsed] = useState<number | null>(null)
  useEffect(() => {
    if (!startedAt) return
    if (completedAt) { setElapsed(Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)); return }
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.round((Date.now() - start) / 1000))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [startedAt, completedAt])
  if (elapsed === null) return <span style={{ color: 'var(--ink-4)', fontSize: '11px' }}>—</span>
  const m = Math.floor(elapsed / 60), s = elapsed % 60
  return <span style={{ color: 'var(--ink-3)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>
}

// Map stage key → artifact entry_name
const STAGE_ARTIFACT: Record<string, string> = {
  company_profiler: 'company_raw',
  icp_builder: 'icp_data',
  competition_researcher: 'competitive_positioning',
  scoring_rubric_builder: 'scoring_rubric',
  profile_writer: 'profile_documents',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StageSummaryInline({ stageName, content }: { stageName: string; content: any }) {
  if (!content) return null
  switch (stageName) {
    case 'company_profiler': {
      const name = content?.company_name || content?.company_raw?.company_name
      if (!name) return null
      return <span style={{ fontSize: '11.5px', color: 'var(--good)', fontWeight: 500 }}>{name}</span>
    }
    case 'icp_builder': {
      const industries = content?.company_criteria?.target_industries || content?.target_industries
      const triggers = content?.company_criteria?.buying_triggers || content?.buying_triggers
      const parts = []
      if (Array.isArray(industries) && industries.length > 0) parts.push(`${industries.length} industries`)
      if (Array.isArray(triggers) && triggers.length > 0) parts.push(`${triggers.length} triggers`)
      if (parts.length === 0) return <span style={{ fontSize: '11.5px', color: 'var(--good)', fontWeight: 500 }}>ICP defined</span>
      return <span style={{ fontSize: '11.5px', color: 'var(--good)', fontWeight: 500 }}>{parts.join(' · ')}</span>
    }
    case 'competition_researcher': {
      const comps = content?.competitors
      if (Array.isArray(comps)) return <span style={{ fontSize: '11.5px', color: 'var(--good)', fontWeight: 500 }}>{comps.length} competitors mapped</span>
      return null
    }
    case 'scoring_rubric_builder': {
      const dims = content?.dimensions
      if (Array.isArray(dims)) return <span style={{ fontSize: '11.5px', color: 'var(--good)', fontWeight: 500 }}>{dims.length} scoring dimensions</span>
      return null
    }
    case 'profile_writer': {
      const company = content?.company_profile?.company_name
      return <span style={{ fontSize: '11.5px', color: 'var(--good)', fontWeight: 500 }}>{company ? `${company} · ` : ''}ICP · Persona · Company Profile</span>
    }
    default: return null
  }
}

function PipelineProgress({
  phases, taskId, artifacts, artifactContents,
}: {
  phases: PipelinePhase[]
  taskId: string | null
  artifacts?: Artifact[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifactContents?: Record<string, any>
}) {
  const phaseMap = new Map(phases.map(p => [p.name, p]))
  const artifactByEntry = new Map((artifacts || []).map(a => [a.entry_name, a]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {STAGE_ORDER.map((stageName, idx) => {
        const phase = phaseMap.get(stageName)
        const status = phase?.status || 'pending'
        const isRunning = status === 'running' || status === 'open' || status === 'active'
        const isDone = status === 'completed'
        const isFailed = status === 'failed' || status === 'crashed'
        const meta = STAGE_META[stageName]
        const artifactEntry = STAGE_ARTIFACT[stageName]
        const artifact = artifactEntry ? artifactByEntry.get(artifactEntry) : undefined
        const content = artifact && artifactContents ? artifactContents[artifact.id] : undefined

        const dotColor = isDone ? 'var(--good)' : isRunning ? 'var(--info)' : isFailed ? '#c0392b' : 'var(--line-2)'
        const bgColor = isRunning ? 'linear-gradient(135deg, var(--info-soft) 0%, var(--paper) 100%)' : isDone ? 'var(--good-soft)' : 'var(--paper-2)'
        const borderColor = isRunning ? 'var(--info)' : isDone ? 'var(--good)' : 'var(--line)'

        return (
          <div key={stageName} style={{ display: 'flex', gap: '0', position: 'relative' }}>
            {idx < STAGE_ORDER.length - 1 && (
              <div style={{ position: 'absolute', left: '20px', top: '42px', width: '2px', height: '12px', background: isDone ? 'var(--good)' : 'var(--line)', zIndex: 0 }} />
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '10px 14px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: dotColor, border: `2px solid ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isDone && <CheckCircle size={10} color="white" strokeWidth={2.5} />}
                {isRunning && <span style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{meta?.label || stageName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>stage {idx + 1}/5</span>
                  {isRunning && <span style={{ fontSize: '11px', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '4px' }}><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />running</span>}
                </div>
                {isDone && content
                  ? <StageSummaryInline stageName={stageName} content={content} />
                  : <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '2px' }}>{meta?.description}</div>
                }
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {phase ? <Duration startedAt={phase.started_at} completedAt={phase.completed_at} /> : <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>queued</span>}
              </div>
            </div>
          </div>
        )
      })}

      {taskId && (
        <div style={{ marginTop: '8px', padding: '10px 14px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ink-4)' }}>{taskId}</span>
          <span style={{ flex: 1 }} />
          <a href="/console" style={{ fontSize: '12px', color: 'var(--info)', textDecoration: 'none', fontWeight: 500 }}>Open in Console →</a>
        </div>
      )}
    </div>
  )
}

// ─── Results view ──────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '6px', marginTop: '14px' }}>{label}</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ArtifactCard({ artifact, content }: { artifact: Artifact; content: any }) {
  const [expanded, setExpanded] = useState(true)
  const name = artifact.entry_name
  const titles: Record<string, string> = { profile_documents: 'Profile Documents', icp_data: 'ICP Data', company_raw: 'Company Profile', scoring_rubric: 'Scoring Rubric', competitive_positioning: 'Competitive Positioning' }
  const title = titles[name] || artifact.artifact_name || name

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderContent(n: string, c: any) {
    if (n === 'profile_documents') {
      const icp = c.icp_profile, persona = c.buyer_persona, company = c.company_profile
      return (
        <div>
          {icp && (<div style={{ marginBottom: '16px' }}><SectionLabel label="ICP Profile" /><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>{String(icp.title || '')}</div><div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{String(icp.summary || '').slice(0, 300)}{String(icp.summary || '').length > 300 ? '…' : ''}</div></div>)}
          {persona && (<div style={{ marginBottom: '16px' }}><SectionLabel label="Buyer Persona" /><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>{String(persona.persona_name || '')}</div>{persona.job_titles && (<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{(persona.job_titles as string[]).slice(0, 4).map((t: string) => (<span key={t} style={{ fontSize: '11px', background: 'var(--accent-tint)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px' }}>{t}</span>))}</div>)}</div>)}
          {company && (<div><SectionLabel label="Company Profile" /><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>{String(company.company_name || '')}</div>{company.elevator_pitch && (<div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{String(company.elevator_pitch).slice(0, 300)}</div>)}</div>)}
        </div>
      )
    }
    if (n === 'icp_data') {
      const cc = c.company_criteria, contact = c.contact_criteria
      return (
        <div>
          {cc?.industries?.length > 0 && (<><SectionLabel label="Target Industries" /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>{(cc.industries as string[]).map((ind: string) => (<span key={ind} style={{ fontSize: '11px', background: 'var(--info-soft)', color: 'var(--info)', padding: '2px 8px', borderRadius: '4px' }}>{ind}</span>))}</div></>)}
          {cc?.buying_triggers?.length > 0 && (<><SectionLabel label="Buying Triggers" />{(cc.buying_triggers as string[]).slice(0, 4).map((t: string, i: number) => (<div key={i} style={{ fontSize: '12px', color: 'var(--ink-2)', paddingLeft: '12px', position: 'relative', marginBottom: '3px' }}><span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>·</span>{t}</div>))}</>)}
          {contact?.job_titles?.length > 0 && (<><SectionLabel label="Target Job Titles" /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{(contact.job_titles as string[]).map((t: string) => (<span key={t} style={{ fontSize: '11px', background: 'var(--accent-tint)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px' }}>{t}</span>))}</div></>)}
        </div>
      )
    }
    if (n === 'scoring_rubric') {
      const dims = (c.dimensions || []) as Array<Record<string, unknown>>
      return (
        <div>
          {dims.slice(0, 5).map((dim, i) => {
            const w = Number(dim.weight || 0)
            return (<div key={i} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}><span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{String(dim.name || '')}</span><span style={{ fontSize: '11px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>{w}%</span></div><div style={{ height: '4px', background: 'var(--paper-3)', borderRadius: '2px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${w}%`, background: w > 20 ? 'var(--accent)' : 'var(--info)', borderRadius: '2px' }} /></div></div>)
          })}
        </div>
      )
    }
    return <pre style={{ fontSize: '11px', color: 'var(--ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(c, null, 2).slice(0, 600)}</pre>
  }

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--paper-2)', borderBottom: expanded ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}>
        <CheckCircle size={13} color="var(--good)" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', flex: 1, textAlign: 'left' }}>{title}</span>
        <span style={{ fontSize: '10px', background: 'var(--good-soft)', color: 'var(--good)', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>active</span>
        {expanded ? <ChevronDown size={13} color="var(--ink-4)" /> : <ChevronRight size={13} color="var(--ink-4)" />}
      </button>
      {expanded && content && <div style={{ padding: '16px' }}>{renderContent(name, content)}</div>}
    </div>
  )
}

// ─── localStorage ──────────────────────────────────────────────────────────────

const LS_KEY = 'sdr_wizard_state'
const LS_SNAPSHOT_KEY = 'sdr_wizard_snapshot'

function loadPersistedState(): { wizardData: WizardData; phase: number; state: string; taskId: string | null } | null {
  if (typeof window === 'undefined') return null
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function savePersistedState(wizardData: WizardData, phase: number, state: string, taskId: string | null) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify({ wizardData, phase, state, taskId })) } catch {}
}
function clearPersistedState() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(LS_KEY) } catch {}
}
function saveSnapshot(data: WizardData) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_SNAPSHOT_KEY, JSON.stringify(data)) } catch {}
}
function loadSnapshot(): WizardData | null {
  if (typeof window === 'undefined') return null
  try { const raw = localStorage.getItem(LS_SNAPSHOT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}

// Which PHASES pipeline stages depend on user input from wizard steps
// phase.id → wizard fields that affect it
const PHASE_FIELDS: Record<string, (keyof WizardData)[]> = {
  company: ['companyName', 'productDescription', 'valueProposition', 'keyFeatures', 'differentiators', 'targetOutcomes'],
  icp: ['industries', 'companySizes', 'fundingStages', 'geographies', 'revenueRange', 'techStackHints', 'jobTitles', 'seniorityLevels', 'painPoints', 'goals', 'objections', 'buyingTriggers', 'qualificationSignals', 'hardDisqualifiers'],
  scoring: ['scoringWeights', 'scoringThreshold'],
}

function getChangedPhaseIds(current: WizardData, snapshot: WizardData): string[] {
  const changed: string[] = []
  for (const [phaseId, fields] of Object.entries(PHASE_FIELDS)) {
    const hasChange = fields.some(f => JSON.stringify(current[f]) !== JSON.stringify(snapshot[f]))
    if (hasChange) changed.push(phaseId)
  }
  return changed
}

const PHASE_INDEX: Record<string, number> = { company: 0, icp: 1, scoring: 3 }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [phase, setPhase] = useState(0)           // 0–3 = input phases; 4 = running/done
  const [wizardData, setWizardData] = useState<WizardData>({ ...DEFAULT_WIZARD })
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set())
  const [snapshot, setSnapshot] = useState<WizardData | null>(null)

  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [pipelinePhases, setPipelinePhases] = useState<PipelinePhase[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [artifactContents, setArtifactContents] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [totalDuration, setTotalDuration] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Restore from localStorage
  useEffect(() => {
    const snap = loadSnapshot()
    if (snap) setSnapshot(snap)
    const persisted = loadPersistedState()
    if (!persisted) return
    setWizardData(persisted.wizardData || DEFAULT_WIZARD)
    if (persisted.state === 'progress' && persisted.taskId) {
      fetch('/api/tasks')
        .then(r => r.json())
        .then(d => {
          const RUNNING = new Set(['open', 'running', 'active', 'in_progress', 'pending'])
          const task = (d.tasks || []).find((t: { id: string }) => t.id === persisted.taskId)
          if (task && RUNNING.has(task.status)) {
            setPhase(4); setTaskId(persisted.taskId); setRunState('running'); setStartTime(new Date())
          } else {
            clearPersistedState()
          }
        })
        .catch(() => clearPersistedState())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    savePersistedState(wizardData, phase, runState === 'running' ? 'progress' : 'idle', taskId)
  }, [wizardData, phase, runState, taskId])

  function update(patch: Partial<WizardData>) { setWizardData(prev => ({ ...prev, ...patch })); setPhaseError(null) }

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const fetchPipelinePhases = useCallback(async (tid: string) => {
    try {
      const res = await fetch(`/api/tasks/${tid}/phases`)
      const data = await res.json()
      const ps: PipelinePhase[] = data.phases || []
      setPipelinePhases(ps)

      // Incrementally fetch artifacts for newly completed stages (shows results during run)
      const completedStages = ps.filter(p => p.status === 'completed').map(p => p.name)
      if (completedStages.length > 0) {
        const artRes = await fetch(`/api/tasks/${tid}/artifacts`)
        const artData = await artRes.json()
        const arts: Artifact[] = (artData.artifacts || []).filter((a: Artifact) => a.status === 'active' && a.entry_name !== 'trigger-input')
        setArtifacts(arts)
        // Fetch content for new artifacts only
        setArtifactContents(prev => {
          const toFetch = arts.filter(a => !prev[a.id])
          if (toFetch.length === 0) return prev
          Promise.all(toFetch.map(async (a: Artifact) => {
            try {
              const cr = await fetch(`/api/artifacts/${a.id}`)
              const cd = await cr.json()
              const raw = cd.artifact?.content
              if (raw) {
                const cleaned = raw.replace(/^\s*\d+\s*\|\s?/gm, '')
                try { return [a.id, JSON.parse(cleaned)] as [string, unknown] } catch { return [a.id, { raw }] as [string, unknown] }
              }
            } catch {}
            return null
          })).then(results => {
            const newContents: Record<string, unknown> = {}
            results.forEach(r => { if (r) newContents[r[0]] = r[1] })
            if (Object.keys(newContents).length > 0) {
              setArtifactContents(p => ({ ...p, ...newContents }))
            }
          })
          return prev
        })
      }

      const allDone = ps.length >= STAGE_ORDER.length && ps.every(p => p.status === 'completed' || p.status === 'failed')
      if (allDone) {
        stopPolling()
        if (startTime) {
          const ms = Date.now() - startTime.getTime()
          const mins = Math.floor(ms / 60000), secs = Math.floor((ms % 60000) / 1000)
          setTotalDuration(`${mins}:${secs.toString().padStart(2, '0')}`)
        }
        // Save snapshot so we can detect changes on future edits
        setWizardData(prev => { saveSnapshot(prev); setSnapshot(prev); return prev })
        clearPersistedState()
        setRunState('done')
      }
    } catch (err) { console.error('Poll error:', err) }
  }, [stopPolling, startTime])

  // Auto-start polling when restored mid-run
  useEffect(() => {
    if (runState === 'running' && taskId && !pollRef.current) {
      fetchPipelinePhases(taskId)
      pollRef.current = setInterval(() => fetchPipelinePhases(taskId), 2000)
    }
  }, [runState, taskId, fetchPipelinePhases]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { return () => stopPolling() }, [stopPolling])

  function goToPhase(idx: number) {
    // Only allow navigating to completed phases or the next one
    if (idx <= phase || completedPhases.has(idx)) { setPhase(idx); setPhaseError(null) }
  }

  function handleNext() {
    const currentPhaseId = PHASES[phase]?.id
    if (currentPhaseId && !PHASES[phase].auto) {
      const err = validatePhase(currentPhaseId, wizardData)
      if (err) { setPhaseError(err); return }
    }
    setPhaseError(null)
    setCompletedPhases(prev => new Set([...prev, phase]))
    if (phase < PHASES.length - 1) setPhase(phase + 1)
  }

  async function handleBuildProfile() {
    const err = validatePhase('scoring', wizardData)
    if (err) { setPhaseError(err); return }

    setLoading(true); setError(null)
    try {
      const companyText = assembleCompanyText(wizardData)
      const res = await fetch('/api/flow/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start flow')

      const tid = data.taskId
      setTaskId(tid); setStartTime(new Date())
      setCompletedPhases(prev => new Set([...prev, phase]))
      setPhase(4); setRunState('running')
      await fetchPipelinePhases(tid)
      pollRef.current = setInterval(() => fetchPipelinePhases(tid), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    stopPolling()
    setWizardData({ ...DEFAULT_WIZARD }); setPhase(0); setCompletedPhases(new Set())
    setRunState('idle'); setTaskId(null); setPipelinePhases([]); setArtifacts([])
    setArtifactContents({}); setStartTime(null); setTotalDuration(null)
    setPhaseError(null); setError(null); setSnapshot(null)
    clearPersistedState()
    if (typeof window !== 'undefined') { try { localStorage.removeItem(LS_SNAPSHOT_KEY) } catch {} }
  }

  const isPhase4 = phase === 4

  // Change detection: compare current wizardData to the snapshot from last completed run
  const changedPhaseIds = snapshot && runState !== 'running' ? getChangedPhaseIds(wizardData, snapshot) : []
  const hasChanges = changedPhaseIds.length > 0
  // Find the earliest phase index that has changes to know what to re-run from
  const rerunFromIdx = changedPhaseIds.length > 0
    ? Math.min(...changedPhaseIds.map(id => PHASE_INDEX[id] ?? 99).filter(n => n < 99))
    : -1
  const rerunFromPhase = rerunFromIdx >= 0 ? PHASES[rerunFromIdx] : null

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{transform:translateX(-100%);width:40%} 50%{width:60%} 100%{transform:translateX(300%);width:40%} }
      `}</style>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left phase nav ── */}
        <div style={{
          width: '240px', flexShrink: 0,
          borderRight: '1px solid var(--line)',
          background: 'var(--paper-2)',
          display: 'flex', flexDirection: 'column',
          padding: '24px 0',
          overflowY: 'auto',
        }}>
          {/* Title */}
          <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--accent-tint)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={13} color="var(--accent)" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Profile Builder</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-4)', lineHeight: 1.5 }}>
              5 agents · ICP + Scoring + Docs
            </div>
          </div>

          {/* TEST ONLY autofill */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <button
              onClick={() => { setWizardData({ ...FLO_AUTOFILL }); setPhaseError(null) }}
              style={{ width: '100%', padding: '6px 10px', fontSize: '11px', fontWeight: 600, border: '1px dashed var(--warn)', borderRadius: '5px', background: 'var(--warn-soft)', color: 'var(--warn)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              ⚡ Autofill · Flo Mobility
            </button>
          </div>

          {/* Phase list */}
          <div style={{ flex: 1, padding: '16px 0' }}>
            {PHASES.map((p, idx) => {
              const isCurrent = phase === idx
              const isDone = completedPhases.has(idx) || (isPhase4 && idx < 4)
              const isLocked = idx > phase && !completedPhases.has(idx)

              return (
                <button
                  key={p.id}
                  onClick={() => goToPhase(idx)}
                  disabled={isLocked && !isPhase4}
                  style={{
                    width: '100%', padding: '10px 20px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    textAlign: 'left', cursor: isLocked ? 'default' : 'pointer',
                    background: isCurrent ? 'var(--paper)' : 'transparent',
                    borderLeft: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
                    opacity: isLocked ? 0.45 : 1,
                    transition: 'all 0.12s',
                  }}
                >
                  {/* Step indicator */}
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? 'var(--good)' : isCurrent ? 'var(--accent)' : 'var(--paper-3)',
                    border: `1.5px solid ${isDone ? 'var(--good)' : isCurrent ? 'var(--accent)' : 'var(--line)'}`,
                    marginTop: '1px',
                  }}>
                    {isDone
                      ? <CheckCircle size={12} color="white" strokeWidth={2.5} />
                      : <span style={{ fontSize: '10px', fontWeight: 700, color: isCurrent ? 'white' : 'var(--ink-4)' }}>{idx + 1}</span>
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: isCurrent ? 600 : 500, color: isCurrent ? 'var(--ink)' : 'var(--ink-2)' }}>{p.label}</span>
                      {p.auto && (
                        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', background: 'var(--info-soft)', color: 'var(--info)', padding: '1px 5px', borderRadius: '3px' }}>AUTO</span>
                      )}
                      {!p.auto && changedPhaseIds.includes(p.id) && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '2px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
          <div style={{ maxWidth: '620px' }}>

            {/* Phase 4: Pipeline running / done */}
            {isPhase4 && (
              <div>
                <div style={{ marginBottom: '28px' }}>
                  <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '26px', fontStyle: 'italic', color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
                    {runState === 'done' ? 'Profile complete' : 'Building your profile…'}
                  </h1>
                  <p style={{ color: 'var(--ink-3)', fontSize: '13.5px', lineHeight: 1.6 }}>
                    {runState === 'done'
                      ? `Completed in ${totalDuration || '—'} · ${artifacts.length} artifacts generated`
                      : '5 agents running in sequence — this takes 8–10 minutes'}
                  </p>
                </div>

                {runState === 'done' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--good-soft)', border: '1px solid var(--good)', borderRadius: '8px', marginBottom: '24px' }}>
                    <CheckCircle size={16} color="var(--good)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--good)', flex: 1 }}>All {pipelinePhases.length} stages completed · Task {taskId}</span>
                    <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--good)', border: '1px solid var(--good)', background: 'transparent', borderRadius: '5px', cursor: 'pointer' }}>
                      <Pencil size={11} /> Reset
                    </button>
                  </div>
                )}

                <div style={{ marginBottom: '28px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '10px' }}>Pipeline Stages</div>
                  <PipelineProgress phases={pipelinePhases} taskId={taskId} artifacts={artifacts} artifactContents={artifactContents} />
                </div>

                {runState === 'done' && artifacts.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '10px' }}>Generated Artifacts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {artifacts.map(artifact => (
                        <ArtifactCard key={artifact.id} artifact={artifact} content={artifactContents[artifact.id] || null} />
                      ))}
                    </div>
                    <div style={{ marginTop: '24px', padding: '14px 16px', background: 'var(--accent-tint)', border: '1px solid var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--ink-2)', flex: 1 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Profile ready.</span> Next: run prospecting to find and score leads.
                      </div>
                      <a href="/pipeline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, background: 'var(--accent)', color: 'white', borderRadius: '6px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Go to Pipeline →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Phases 0–3: Input collection */}
            {!isPhase4 && (
              <div>
                {/* Phase header */}
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '32px', height: '32px', background: PHASES[phase].auto ? 'var(--info-soft)' : 'var(--accent-tint)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PHASES[phase].auto ? 'var(--info)' : 'var(--accent)' }}>
                      {PHASES[phase].icon}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '24px', fontStyle: 'italic', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                          {PHASES[phase].label}
                        </h1>
                        {PHASES[phase].auto && (
                          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', background: 'var(--info-soft)', color: 'var(--info)', padding: '2px 7px', borderRadius: '4px' }}>AUTO</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--ink-4)', marginTop: '1px' }}>
                        Agent: <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{PHASES[phase].agent}</code>
                      </div>
                    </div>
                  </div>
                  <p style={{ color: 'var(--ink-3)', fontSize: '13.5px', lineHeight: 1.6 }}>
                    {PHASES[phase].desc}
                  </p>
                </div>

                {/* Phase body */}
                {phase === 0 && <PhaseCompany data={wizardData} update={update} />}
                {phase === 1 && <PhaseICP data={wizardData} update={update} />}
                {phase === 2 && <PhaseCompetition />}
                {phase === 3 && <PhaseScoring data={wizardData} update={update} />}

                {/* Error */}
                {phaseError && (
                  <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '10px 14px', fontSize: '12.5px', color: 'var(--bad)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={13} />
                    {phaseError}
                  </div>
                )}
                {error && (
                  <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '10px 14px', fontSize: '12.5px', color: 'var(--bad)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={13} />
                    {error}
                  </div>
                )}

                {/* Re-run change banner */}
                {hasChanges && runState === 'done' && (() => {
                  const affectedPhase = PHASES.find(p => changedPhaseIds.includes(p.id) && !p.auto)
                  if (!affectedPhase) return null
                  return (
                    <div style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn)', borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '12.5px', color: 'var(--ink-2)' }}>
                      <strong style={{ color: 'var(--warn)' }}>Changes detected</strong> in:{' '}
                      {changedPhaseIds.filter(id => !PHASES.find(p => p.id === id)?.auto).map(id => PHASES.find(p => p.id === id)?.label).filter(Boolean).join(', ')}
                      {rerunFromPhase && (
                        <span style={{ color: 'var(--ink-3)' }}> · Will re-run from <strong>{rerunFromPhase.label}</strong></span>
                      )}
                    </div>
                  )
                })()}

                {/* Nav footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>Phase {phase + 1} of {PHASES.length}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {phase > 0 && (
                      <button onClick={() => { setPhase(phase - 1); setPhaseError(null) }} style={{ padding: '9px 18px', fontSize: '13px', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', background: 'var(--paper)' }}>
                        ← Back
                      </button>
                    )}
                    {/* After a completed run: show Next or Re-run depending on whether changes detected */}
                    {phase < PHASES.length - 1 && phase !== 3 && (
                      <button onClick={handleNext} style={{ padding: '9px 20px', fontSize: '13px', fontWeight: 600, background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Next <ArrowRight size={13} />
                      </button>
                    )}
                    {phase === 3 && !hasChanges && (
                      <button onClick={handleBuildProfile} disabled={loading} style={{ padding: '9px 22px', fontSize: '13px', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={14} />}
                        {runState === 'done' ? 'Re-run Profile Builder' : 'Build Profile'}
                      </button>
                    )}
                    {phase === 3 && hasChanges && (
                      <button onClick={handleBuildProfile} disabled={loading} style={{ padding: '9px 22px', fontSize: '13px', fontWeight: 600, background: 'var(--warn)', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={14} />}
                        Re-run from {rerunFromPhase?.label || 'start'}
                      </button>
                    )}
                    {/* Show re-run button on non-scoring input phases when changes are detected after a completed run */}
                    {phase !== 3 && !PHASES[phase].auto && hasChanges && runState === 'done' && (
                      <button onClick={handleBuildProfile} disabled={loading} style={{ padding: '9px 18px', fontSize: '13px', fontWeight: 600, background: 'var(--warn)', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={13} />}
                        Re-run from {rerunFromPhase?.label || 'here'}
                      </button>
                    )}
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
