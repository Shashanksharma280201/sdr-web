import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import sql from '@/lib/db'
import { ensureSchema } from '../../sessions/route'

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

// ─── Web scraping ──────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 6000)  // cap at 6k chars
}

async function fetchWebsite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SDRBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return stripHtml(html)
  } catch { return '' }
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/)
  if (m) return m[0].replace(/[.,;!?)]+$/, '')
  // bare domain like "flomobility.com"
  const d = text.match(/\b([a-zA-Z0-9-]+\.(?:com|io|ai|co|net|org|app)(?:\/\S*)?)\b/)
  return d ? `https://${d[1]}` : null
}

// ─── Clay enrichment (bonus layer if API key set) ──────────────────────────────
async function clayEnrich(domain: string): Promise<string> {
  if (!process.env.CLAY_API_KEY) return ''
  try {
    const res = await fetch('https://mcp.clay.run/v1/tools/mcp__clay__enrich_company', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.CLAY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const c = data?.result?.content?.[0]?.text ? JSON.parse(data.result.content[0].text) : data
    const parts: string[] = []
    if (c.company_name)      parts.push(`Company: ${c.company_name}`)
    if (c.industry)          parts.push(`Industry: ${c.industry}`)
    if (c.employee_count)    parts.push(`Size: ~${c.employee_count} employees`)
    if (c.funding_stage)     parts.push(`Funding: ${c.funding_stage}`)
    if (c.description)       parts.push(`Description: ${c.description}`)
    if (c.tech_stack?.length) parts.push(`Tech Stack: ${(c.tech_stack as string[]).slice(0, 5).join(', ')}`)
    return parts.length ? `\n\nClay Enrichment:\n${parts.join('\n')}` : ''
  } catch { return '' }
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
  const pending   = ARTIFACT_ORDER.filter(k => !artifactState[k]?.confirmed)

  const stateLines = ARTIFACT_ORDER.map(k => {
    const s = artifactState[k]
    if (s?.confirmed) return `  ✓ ${ARTIFACT_LABELS[k]} — confirmed`
    return `  ○ ${ARTIFACT_LABELS[k]} — pending`
  }).join('\n')

  const nextArtifact = pending[0] ? ARTIFACT_LABELS[pending[0]] : null

  return `You are an AI sales strategist building a Phase 1 SDR strategy pack.
Your job: complete all 5 artifacts efficiently through a focused, research-first conversation.

## Research Summary
Use this data. Do NOT ask for anything already covered here.

${researchSummary}

## Current Artifact State
${stateLines}
${nextArtifact ? `\nNext artifact to work on: **${nextArtifact}**` : '\nAll artifacts confirmed — emit profile_writer signal.'}

## Dependency Chain
company_profiler → icp_builder → competition_researcher → scoring_rubric_builder → profile_writer
Each artifact depends on all above it.

## Conversation Rules
1. Work ONE artifact at a time, strictly following the order above.
2. For each artifact: present what the research already shows, then ask for confirmation.
3. For gaps the research couldn't fill: ask EXACTLY ONE targeted question to fill the gap.
4. Once user confirms (says yes / looks good / ok / confirms), emit the stage_signal JSON block and immediately move to the next pending artifact.
5. NEVER ask for something that is already in the Research Summary.
6. If a confirmed artifact changes (user wants to edit it): emit an updated stage_signal for it, then automatically re-present the next downstream artifact — do not wait for the user to ask.

## Cascade Rule
If artifact N is updated → all artifacts after N in the chain are now stale.
Re-derive each stale artifact from the new context and present it for re-confirmation, one at a time.

## Stage Signals
Emit inside \`\`\`json blocks when an artifact is confirmed.

**company_profiler** (confirm when: company name, product, value prop, features, differentiators known)
\`\`\`json
{"stage_signal":"company_profiler","company_name":"","domain":"","product_description":"","value_proposition":"","key_features":[],"differentiators":[],"target_outcomes":[]}
\`\`\`

**icp_builder** (confirm when: target industries, sizes, geographies, pain points, buying triggers known)
\`\`\`json
{"stage_signal":"icp_builder","target_customers":"","industries":[],"company_sizes":[],"geographies":[],"pain_points":[],"buying_triggers":[]}
\`\`\`

**competition_researcher** (confirm after presenting competitors — research found them)
\`\`\`json
{"stage_signal":"competition_researcher","competitors_mentioned":[],"competitive_notes":""}
\`\`\`

**scoring_rubric_builder** (confirm when deal-breakers and scoring priorities known)
\`\`\`json
{"stage_signal":"scoring_rubric_builder","scoring_priorities":"","must_haves":[],"deal_breakers":[]}
\`\`\`

**profile_writer** (confirm after all 4 above are confirmed)
\`\`\`json
{"stage_signal":"profile_writer","all_complete":true}
\`\`\`

After profile_writer signal, say: "All set — building your full strategy pack now."`
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

  // Load history
  const history = await sql<{ role: string; content: string }[]>`
    SELECT role, content FROM strategy_chats
    WHERE session_id = ${session_id}
    ORDER BY created_at ASC
    LIMIT 60
  `

  // Persist user message
  await sql`
    INSERT INTO strategy_chats (session_id, agent_name, role, content)
    VALUES (${session_id}, ${agent ?? 'profile_builder_web'}, 'user', ${message})
  `

  // Auto-title from first message
  if (history.length === 0) {
    const title = message.length > 50 ? message.slice(0, 47) + '…' : message
    await sql`UPDATE strategy_sessions SET title = ${title}, updated_at = NOW() WHERE id = ${session_id} AND title = 'New Analysis'`
  } else {
    await sql`UPDATE strategy_sessions SET updated_at = NOW() WHERE id = ${session_id}`
  }

  // Research the company: fetch website + Clay enrichment
  const allText = [...history.map(h => h.content), message].join(' ')
  const url    = extractUrl(allText)
  const domain = extractDomain(allText)

  const [webContent, clayData] = await Promise.all([
    url ? fetchWebsite(url) : Promise.resolve(''),
    domain ? clayEnrich(domain) : Promise.resolve(''),
  ])

  const researchBlock = [
    webContent ? `\n\nWebsite content from ${url}:\n${webContent}` : '',
    clayData,
  ].join('')

  // Build prompt for Claude
  const historyText = history.length > 0
    ? '\n\nConversation so far:\n' + history.map(r => `${r.role === 'user' ? 'User' : 'Assistant'}: ${r.content}`).join('\n\n')
    : ''
  const fullPrompt = `${SYSTEM_PROMPT}${researchBlock}${historyText}\n\nUser: ${message}\n\nAssistant:`

  let fullContent = ''

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()

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
            if (clayData) parts.push(clayData)
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
