import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'
import { researchCompany, formatResearchForPrompt, type ResearchPacket } from '@/lib/research'

type ArtifactConfirmedState = {
  company_profiler?:       { confirmed: boolean; data: Record<string, unknown> | null }
  icp_builder?:            { confirmed: boolean; data: Record<string, unknown> | null }
  competition_researcher?: { confirmed: boolean; data: Record<string, unknown> | null }
  scoring_rubric_builder?: { confirmed: boolean; data: Record<string, unknown> | null }
  profile_writer?:         { confirmed: boolean; data: Record<string, unknown> | null }
}

const ARTIFACT_ORDER: (keyof ArtifactConfirmedState)[] = [
  'company_profiler', 'icp_builder', 'competition_researcher', 'scoring_rubric_builder', 'profile_writer'
]

const ARTIFACT_LABELS: Record<keyof ArtifactConfirmedState, string> = {
  company_profiler:       'Company Profile',
  icp_builder:            'ICP Data',
  competition_researcher: 'Competitive Positioning',
  scoring_rubric_builder: 'Scoring Rubric',
  profile_writer:         'Profile Documents',
}

const REGISTRY   = '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'
const FLOW_ID    = 'sdr:core:profile-builder'
const WORKSPACE  = 'ws-09Dymwpl'

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/)
  if (m) return m[0].replace(/[.,;!?)]+$/, '')
  // bare domain like "flomobility.com"
  const d = text.match(/\b([a-zA-Z0-9-]+\.(?:com|io|ai|co|net|org|app)(?:\/\S*)?)\b/)
  return d ? `https://${d[1]}` : null
}

function extractDomain(text: string): string | null {
  const url = extractUrl(text)
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

// ─── Pipeline trigger (detached — survives tab switches & HMR) ────────────────
export function triggerPipeline(contextText: string): Promise<string | null> {
  return new Promise(resolve => {
    // Use spawn + detached + unref so the process is fully independent of Node.js
    const child = spawn('swarm38', [
      'task', 'run',
      '--flow-id', FLOW_ID,
      '--registry', REGISTRY,
      '--input-json', JSON.stringify({
        org_id: WORKSPACE,
        workspace_id: WORKSPACE,
        headless: true,
        initial_company_text: contextText,
      }),
    ], {
      detached: true,
      stdio:    'ignore',
    })
    child.unref()  // fully detached — won't be killed if the parent process dies

    // Give CLI ~2s to register the task record, then fetch its ID
    setTimeout(async () => {
      try {
        const res  = await fetch('http://localhost:8080/api/tasks', { cache: 'no-store' })
        const data = await res.json()
        const tasks: Array<{ id: string; name: string; status: string; created_at: string; kind: string }> =
          Array.isArray(data.result) ? data.result : (data.tasks ?? [])
        const latest = tasks
          .filter(t => t.name === FLOW_ID && t.kind === 'task')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        resolve(latest?.id ?? null)
      } catch { resolve(null) }
    }, 2000)
  })
}

// ─── Single stage trigger ──────────────────────────────────────────────────────
async function triggerSingleStage(
  stage: string,
  sessionId: string,
  signalData: Record<string, unknown>,
  contextText: string
): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:3000/api/strategy/stage/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, stage, context_text: contextText, ...signalData }),
    })
    if (!res.ok) return null
    const data = await res.json() as { task_id?: string }
    return data.task_id ?? null
  } catch { return null }
}

// ─── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(
  researchSummary: string,
  artifactState: ArtifactConfirmedState
): string {
  const pending  = ARTIFACT_ORDER.filter(k => !artifactState[k]?.confirmed)
  const confirmed = ARTIFACT_ORDER.filter(k => artifactState[k]?.confirmed)

  const stateLines = ARTIFACT_ORDER.map(k => {
    const s = artifactState[k]
    if (s?.confirmed) return `  ✓ ${ARTIFACT_LABELS[k]} — confirmed`
    return `  ○ ${ARTIFACT_LABELS[k]} — pending`
  }).join('\n')

  const hasResearch = researchSummary && researchSummary !== '(no research data available)'
  const allConfirmed = pending.length === 0

  return `You are an AI sales strategist building a Phase 1 SDR strategy pack.
Your goal: build all 5 artifacts with minimal back-and-forth by leading with research, not questions.

## Research Summary
${hasResearch ? researchSummary : '(no research yet)'}

## Current Artifact State
${stateLines}

## Behavior Rules

${!hasResearch ? `### No research yet
Ask the user: "What's your company website or URL? I'll research it and build your full strategy pack."
` : allConfirmed ? `### All artifacts confirmed
Emit the profile_writer signal and say "All set — building your full strategy pack now."
` : confirmed.length === 0 ? `### First response — DRAFT ALL ARTIFACTS NOW
You have research. Do NOT ask questions first. Draft all 5 artifacts immediately.

Present them in this exact format:

---
**Company Profile**
- Company: [name · founded year · location]
- Product: [one sentence description]
- Value prop: [one sentence]
- Key features: [3-5 bullet points]
- Differentiators: [what makes them unique vs competitors]
- Target outcomes: [what customers achieve]

**ICP (Ideal Customer Profile)**
- Target buyer: [role/title]
- Industries: [list]
- Company sizes: [e.g. 50-500 employees or 20-200 vehicle fleets]
- Geographies: [where they sell]
- Pain points: [3-4 specific pains the product solves]
- Buying triggers: [what causes them to look for a solution]

**Competitive Positioning**
- Main competitors: [list with 1-line differentiator each]
- How we win: [key advantages over each]
- Where we lose: [honest weaknesses to prepare SDRs for]

**Scoring Rubric**
- Must-haves: [criteria a lead MUST meet]
- Deal-breakers: [automatic disqualifiers]
- Scoring priorities: [what separates A from B leads]

**Profile Documents**
Will be generated once the above are confirmed.
---

**Gaps I couldn't fill from research:**
[List ONLY genuine gaps — things no public source could tell you. Keep it short. If you can make a reasonable inference, do so and note it. Do not ask about things that don't materially affect the artifacts.]

Confirm what looks right, correct anything wrong, and fill in the gaps you know. I'll finalize all artifacts from your response.
` : `### Confirming / editing artifacts
Confirmed so far: ${confirmed.map(k => ARTIFACT_LABELS[k]).join(', ')}
Still pending: ${pending.map(k => ARTIFACT_LABELS[k]).join(', ')}

- For each artifact the user confirms or provides info for: emit its stage_signal
- If user changes a confirmed artifact: emit updated stage_signal, then re-present all downstream artifacts
- If gaps remain: present updated drafts for pending artifacts and ask about remaining gaps

## Cascade Rule
company_profiler → icp_builder → competition_researcher → scoring_rubric_builder → profile_writer
If artifact N changes, re-derive and re-present all artifacts after N.
`}

## Stage Signals
Emit inside \`\`\`json blocks when an artifact is confirmed.

**company_profiler**
\`\`\`json
{"stage_signal":"company_profiler","company_name":"","domain":"","product_description":"","value_proposition":"","key_features":[],"differentiators":[],"target_outcomes":[]}
\`\`\`

**icp_builder**
\`\`\`json
{"stage_signal":"icp_builder","target_customers":"","industries":[],"company_sizes":[],"geographies":[],"pain_points":[],"buying_triggers":[]}
\`\`\`

**competition_researcher**
\`\`\`json
{"stage_signal":"competition_researcher","competitors_mentioned":[],"competitive_notes":""}
\`\`\`

**scoring_rubric_builder**
\`\`\`json
{"stage_signal":"scoring_rubric_builder","scoring_priorities":"","must_haves":[],"deal_breakers":[]}
\`\`\`

**profile_writer**
\`\`\`json
{"stage_signal":"profile_writer","all_complete":true}
\`\`\`

After profile_writer signal: "All set — building your full strategy pack now."`
}

// ─── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { session_id, agent, message } = await req.json() as {
    session_id: string
    agent: string
    message: string
  }

  if (!session_id || !message?.trim()) {
    return new Response('session_id and message required', { status: 400 })
  }

  await ensureSchema()

  // Persist user message first so it appears in the history load below
  await sql`
    INSERT INTO strategy_chats (session_id, agent_name, role, content)
    VALUES (${session_id}, ${agent ?? 'profile_builder_web'}, 'user', ${message})
  `

  // Load history and artifact state in parallel
  const [historyRows, sessionRows] = await Promise.all([
    sql<{ role: string; content: string }[]>`
      SELECT role, content FROM strategy_chats
      WHERE session_id = ${session_id}
      ORDER BY created_at ASC
      LIMIT 60
    `,
    sql<{ artifact_state: ArtifactConfirmedState | null }[]>`
      SELECT artifact_state FROM strategy_sessions WHERE id = ${session_id}
    `,
  ])

  const history      = historyRows
  const artifactState: ArtifactConfirmedState = (sessionRows[0]?.artifact_state as ArtifactConfirmedState) ?? {}

  // Auto-title session from first user message
  if (history.length <= 1) {
    const title = message.length > 50 ? message.slice(0, 47) + '…' : message
    await sql`UPDATE strategy_sessions SET title = ${title}, updated_at = NOW() WHERE id = ${session_id} AND title = 'New Analysis'`
  } else {
    await sql`UPDATE strategy_sessions SET updated_at = NOW() WHERE id = ${session_id}`
  }

  // Research the company from all messages so far
  const allText = history.map(h => h.content).join(' ')
  const url    = extractUrl(allText)
  const domain = extractDomain(allText)

  let researchSummary = ''
  if (url && domain) {
    const packet = await researchCompany(url, domain)
    researchSummary = formatResearchForPrompt(packet, url)
  } else if (url) {
    try {
      const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).then(r => r.text()).catch(() => '')
      researchSummary = html ? `Website content:\n${html.replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n').trim().slice(0, 6000)}` : ''
    } catch { researchSummary = '' }
  }

  // Build dynamic system prompt with research + current artifact state
  const systemPrompt = buildSystemPrompt(researchSummary, artifactState)

  const historyText = history.length > 1
    ? '\n\nConversation so far:\n' + history.slice(0, -1).map(r => `${r.role === 'user' ? 'User' : 'Assistant'}: ${r.content}`).join('\n\n')
    : ''

  const fullPrompt = `${systemPrompt}${historyText}\n\nUser: ${message}\n\nAssistant:`

  let fullContent = ''

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()

      if (domain) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ event: 'researching', domain })}\n\n`))
      }

      const proc = spawn(
        '/home/shanks/.local/bin/claude',
        ['-p', fullPrompt, '--output-format', 'text'],
        { env: process.env }
      )

      proc.stdout.on('data', (chunk: Buffer) => {
        const token = chunk.toString()
        fullContent += token
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ token })}\n\n`))
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        console.error('[claude stream stderr]', chunk.toString().slice(0, 200))
      })

      proc.on('close', async (code) => {
        try {
          if (fullContent.trim()) {
            await sql`
              INSERT INTO strategy_chats (session_id, agent_name, role, content)
              VALUES (${session_id}, ${agent ?? 'profile_builder_web'}, 'assistant', ${fullContent})
            `
          }

          // Detect per-stage signals — trigger each stage immediately as it's ready
          const stageSignals: Array<{ stage: string; data: Record<string, unknown> }> = []
          let accumulatedContext = ''

          const jsonBlocks = [...fullContent.matchAll(/```json\s*([\s\S]*?)```/g)]
          for (const match of jsonBlocks) {
            try {
              const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>
              if (typeof parsed.stage_signal === 'string') {
                stageSignals.push({ stage: parsed.stage_signal, data: parsed })
              }
              // Legacy work_complete support
              if (parsed.work_complete === true) {
                stageSignals.push({ stage: 'company_profiler', data: parsed })
                stageSignals.push({ stage: 'icp_builder', data: parsed })
                stageSignals.push({ stage: 'competition_researcher', data: parsed })
                stageSignals.push({ stage: 'scoring_rubric_builder', data: parsed })
                stageSignals.push({ stage: 'profile_writer', data: parsed })
              }
            } catch {}
          }

          // Build context text from company_profiler signal (or first signal)
          const companySignal = stageSignals.find(s => s.stage === 'company_profiler')
          if (companySignal) {
            const d = companySignal.data
            const parts: string[] = []
            if (d.company_name)        parts.push(`Company: ${d.company_name}`)
            if (d.domain)              parts.push(`Domain: ${d.domain}`)
            if (d.product_description) parts.push(`Product: ${d.product_description}`)
            if (d.value_proposition)   parts.push(`Value Proposition: ${d.value_proposition}`)
            if ((d.key_features as string[])?.length) parts.push(`Key Features: ${(d.key_features as string[]).join(', ')}`)
            if ((d.differentiators as string[])?.length) parts.push(`Differentiators: ${(d.differentiators as string[]).join(', ')}`)
            if ((d.target_outcomes as string[])?.length) parts.push(`Target Outcomes: ${(d.target_outcomes as string[]).join(', ')}`)
            // Append conversation history for full context
            const histCtx = history.map(r => `${r.role === 'user' ? 'User' : 'AI'}: ${r.content}`).join('\n')
            if (histCtx) parts.push('\nConversation:\n' + histCtx)
            accumulatedContext = parts.join('\n')
          }

          // Trigger stages in order, streaming each stage_task_id back to client
          let lastTaskId: string | null = null
          for (const sig of stageSignals) {
            const stageTaskId = await triggerSingleStage(sig.stage, session_id, sig.data, accumulatedContext)
            if (stageTaskId) {
              lastTaskId = stageTaskId
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ stage_signal: sig.stage, stage_task_id: stageTaskId })}\n\n`))
            }
          }

          // Save context + pipeline task ID if we triggered anything
          if (accumulatedContext && lastTaskId) {
            await sql`
              UPDATE strategy_sessions
              SET context_text = ${accumulatedContext}, pipeline_task_id = ${lastTaskId}, updated_at = NOW()
              WHERE id = ${session_id}
            `
          }

          // Persist confirmed artifact state
          if (stageSignals.length > 0) {
            const updatedState: ArtifactConfirmedState = { ...artifactState }
            for (const sig of stageSignals) {
              const key = sig.stage as keyof ArtifactConfirmedState
              updatedState[key] = { confirmed: true, data: sig.data }
            }
            await sql`
              UPDATE strategy_sessions
              SET artifact_state = ${JSON.stringify(updatedState)}, updated_at = NOW()
              WHERE id = ${session_id}
            `
          }

          // Legacy: emit pipeline_task_id for the last task started
          if (lastTaskId) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ pipeline_task_id: lastTaskId })}\n\n`))
          }

          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        }
        if (code !== 0) console.error('[claude stream] exited with code', code)
      })

      proc.on('error', err => controller.error(err))
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
