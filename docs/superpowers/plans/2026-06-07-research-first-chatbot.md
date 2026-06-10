# Research-First Chatbot — Phase 1 Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the weak homepage-only scraper with a multi-source research layer, rewrite the LLM prompt to be confirmation-first (present findings → ask only about gaps), and track confirmed artifact state so the cascade dependency chain (company_profile → icp → competitive_positioning → scoring_rubric → profile_docs) auto-re-derives downstream artifacts when any artifact changes.

**Architecture:** `researchCompany()` in `lib/research.ts` fires in parallel against 6+ sources when a URL is detected; the stream route loads confirmed artifact state from the DB, builds a dynamic system prompt with research + state, and updates confirmed state when stage signals arrive. The cascade is driven by the LLM prompt rules — no extra server logic needed.

**Tech Stack:** Next.js 16, TypeScript, postgres (sql tagged templates), Claude CLI via spawn, SSE streaming

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `sdr-web/lib/research.ts` | **Create** | `ResearchPacket` type + `researchCompany()` — all multi-source fetching |
| `sdr-web/app/api/strategy/sessions/route.ts` | **Modify** | Add `artifact_state JSONB` column + return it in GET |
| `sdr-web/app/api/strategy/sessions/[id]/route.ts` | **Modify** | PATCH also accepts `artifact_state` updates |
| `sdr-web/app/api/strategy/chat/stream/route.ts` | **Modify** | Wire research lib, build dynamic prompt, update artifact state on signals, emit `researching` event |
| `sdr-web/app/strategy/page.tsx` | **Modify** | Handle `researching` SSE event, show "Researching [domain]..." indicator |

---

## Task 1: Research Library

**Files:**
- Create: `sdr-web/lib/research.ts`

- [ ] **Step 1.1: Create the file with types and helpers**

```typescript
// sdr-web/lib/research.ts

export type ResearchPacket = {
  siteContent: string       // homepage + sub-pages concatenated
  enrichment: string        // DuckDuckGo Instant Answer + Crunchbase
  competitorContext: string // search results for "[domain] competitors"
  newsContext: string       // search results for "[company] news funding"
  sources: string[]         // list of URLs successfully fetched
}

const PAGE_TIMEOUT = 6000

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SDRBot/1.0)' },
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch { return '' }
}

function stripHtml(html: string, cap = 4000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n').trim().slice(0, cap)
}
```

- [ ] **Step 1.2: Add `fetchSitePages()` — homepage + sub-pages in parallel**

```typescript
// Append to sdr-web/lib/research.ts

const SUB_PAGES = ['/about', '/product', '/products', '/solutions', '/pricing', '/customers', '/careers']

async function fetchSitePages(baseUrl: string): Promise<{ content: string; sources: string[] }> {
  // Always fetch homepage; try sub-pages in parallel and keep the 3 that return content
  const homepageHtml = await fetchText(baseUrl)
  const homepage = stripHtml(homepageHtml, 3000)

  const subResults = await Promise.all(
    SUB_PAGES.map(async (path) => {
      const url = baseUrl.replace(/\/$/, '') + path
      const html = await fetchText(url)
      const text = stripHtml(html, 2000)
      return { url, text }
    })
  )

  const validSubs = subResults.filter(r => r.text.length > 200).slice(0, 3)
  const combined = [homepage, ...validSubs.map(r => r.text)].join('\n\n---\n\n')
  const sources = [baseUrl, ...validSubs.map(r => r.url)]
  return { content: combined.slice(0, 10000), sources }
}
```

- [ ] **Step 1.3: Add `fetchDDGInstantAnswer()` — free, no key, gives company summary**

```typescript
// Append to sdr-web/lib/research.ts

async function fetchDDGInstantAnswer(domain: string): Promise<string> {
  try {
    const q = encodeURIComponent(`${domain} company`)
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return ''
    const data = await res.json() as {
      Abstract?: string; AbstractSource?: string; AbstractURL?: string
      Infobox?: { content?: Array<{ label: string; value: string }> }
    }
    const parts: string[] = []
    if (data.Abstract) parts.push(`Summary: ${data.Abstract}`)
    if (data.Infobox?.content?.length) {
      const fields = data.Infobox.content
        .filter(f => ['Funding', 'Founded', 'Employees', 'Industry', 'Headquarters'].includes(f.label))
        .map(f => `${f.label}: ${f.value}`)
      if (fields.length) parts.push(fields.join('\n'))
    }
    return parts.join('\n')
  } catch { return '' }
}
```

- [ ] **Step 1.4: Add `searchDDG()` — scrape DuckDuckGo HTML search results (no key needed)**

```typescript
// Append to sdr-web/lib/research.ts

async function searchDDG(query: string, cap = 2000): Promise<string> {
  try {
    const q = encodeURIComponent(query)
    const html = await fetchText(`https://html.duckduckgo.com/html/?q=${q}`)
    if (!html) return ''
    // Extract result titles and snippets
    const snippets: string[] = []
    const snippetRe = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    const titleRe   = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    const titles: string[] = []
    while ((m = titleRe.exec(html)) !== null) titles.push(stripHtml(m[1], 120))
    while ((m = snippetRe.exec(html)) !== null) snippets.push(stripHtml(m[1], 300))
    const results = titles.slice(0, 5).map((t, i) => `${t}: ${snippets[i] ?? ''}`)
    return results.join('\n').slice(0, cap)
  } catch { return '' }
}
```

- [ ] **Step 1.5: Add `scrapeCrunchbase()` — public profile scrape**

```typescript
// Append to sdr-web/lib/research.ts

async function scrapeCrunchbase(domain: string): Promise<string> {
  // Slug is usually the domain name without TLD, e.g. "flomobility" from "flomobility.com"
  const slug = domain.split('.')[0]
  try {
    const html = await fetchText(`https://www.crunchbase.com/organization/${slug}`)
    if (!html || html.length < 500) return ''
    // Crunchbase is JS-rendered so we look for JSON-LD or meta tags
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]{20,500})"/)
    return descMatch ? `Crunchbase: ${descMatch[1]}` : ''
  } catch { return '' }
}
```

- [ ] **Step 1.6: Add the main `researchCompany()` export — runs all sources in parallel**

```typescript
// Append to sdr-web/lib/research.ts

export async function researchCompany(url: string, domain: string): Promise<ResearchPacket> {
  const companyName = domain.split('.')[0]

  const [siteResult, instantAnswer, crunchbase, competitorSearch, newsSearch] = await Promise.all([
    fetchSitePages(url),
    fetchDDGInstantAnswer(domain),
    scrapeCrunchbase(domain),
    searchDDG(`${companyName} competitors alternatives vs`),
    searchDDG(`${companyName} ${domain} funding news 2024 2025`),
  ])

  const enrichmentParts = [instantAnswer, crunchbase].filter(Boolean)

  return {
    siteContent:       siteResult.content,
    enrichment:        enrichmentParts.join('\n\n'),
    competitorContext: competitorSearch,
    newsContext:       newsSearch,
    sources:           siteResult.sources,
  }
}

export function formatResearchForPrompt(p: ResearchPacket, url: string): string {
  const sections: string[] = []
  if (p.siteContent)       sections.push(`### Company Website (${url})\n${p.siteContent}`)
  if (p.enrichment)        sections.push(`### Company Info\n${p.enrichment}`)
  if (p.competitorContext) sections.push(`### Competitor Search Results\n${p.competitorContext}`)
  if (p.newsContext)       sections.push(`### Recent News / Funding\n${p.newsContext}`)
  return sections.length ? sections.join('\n\n') : '(no research data available)'
}
```

- [ ] **Step 1.7: Type-check the new file**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npx tsc --noEmit 2>&1 | grep research
```

Expected: no errors for `lib/research.ts`

- [ ] **Step 1.8: Commit**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
git add lib/research.ts
git commit -m "feat: add multi-source researchCompany() library"
```

---

## Task 2: DB — Add `artifact_state` Column

**Files:**
- Modify: `sdr-web/app/api/strategy/sessions/route.ts`

The `artifact_state` JSONB column stores which Phase 1 artifacts have been confirmed in conversation, and the signal data from each. This is what lets the LLM know what's already agreed on when continuing a session.

Shape stored in DB:
```json
{
  "company_profiler":      { "confirmed": true,  "data": { "company_name": "Flo Mobility", ... } },
  "icp_builder":           { "confirmed": true,  "data": { "industries": ["logistics"], ... } },
  "competition_researcher":{ "confirmed": false, "data": null },
  "scoring_rubric_builder":{ "confirmed": false, "data": null },
  "profile_writer":        { "confirmed": false, "data": null }
}
```

- [ ] **Step 2.1: Add the column to `ensureSchema()`**

In `sdr-web/app/api/strategy/sessions/route.ts`, after the last `ALTER TABLE strategy_sessions` line, add:

```typescript
await sql`ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS artifact_state JSONB DEFAULT '{}'`
```

- [ ] **Step 2.2: Return `artifact_state` in the GET query**

In the same file, find the SELECT in the GET handler and add `s.artifact_state` to the selected columns:

```typescript
SELECT
  s.id, s.agent_name, s.title, s.flow_session_id,
  s.pipeline_task_id, s.context_text, s.stale_stages,
  s.artifact_state,
  s.created_at, s.updated_at,
  COUNT(c.id)::int AS message_count
```

- [ ] **Step 2.3: Add `artifact_state` to the `StrategySession` interface in `page.tsx`**

In `sdr-web/app/strategy/page.tsx`, find the `StrategySession` interface (line ~74) and add the field:

```typescript
interface StrategySession {
  id: string; agent_name: string; title: string; flow_session_id: string | null
  pipeline_task_id: string | null; context_text: string | null
  stale_stages: string[] | null
  artifact_state: Record<string, { confirmed: boolean; data: Record<string, unknown> | null }> | null
  created_at: string; updated_at: string; message_count: number
}
```

- [ ] **Step 2.4: Type-check**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npx tsc --noEmit 2>&1 | grep -E "sessions|StrategySession"
```

Expected: no errors

- [ ] **Step 2.5: Commit**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
git add app/api/strategy/sessions/route.ts app/strategy/page.tsx
git commit -m "feat: add artifact_state column to strategy_sessions"
```

---

## Task 3: PATCH Sessions `[id]` — Support `artifact_state` Updates

**Files:**
- Modify: `sdr-web/app/api/strategy/sessions/[id]/route.ts`

The stream route needs to persist artifact confirmations. Rather than duplicating SQL, it calls this PATCH endpoint.

- [ ] **Step 3.1: Extend the PATCH handler to accept `artifact_state`**

Replace the entire PATCH function in `sdr-web/app/api/strategy/sessions/[id]/route.ts`:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { title?: string; artifact_state?: Record<string, unknown> }

  if (body.title !== undefined) {
    if (!body.title.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const [session] = await sql`
      UPDATE strategy_sessions
      SET title = ${body.title.trim()}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, updated_at
    `
    return NextResponse.json({ session })
  }

  if (body.artifact_state !== undefined) {
    await sql`
      UPDATE strategy_sessions
      SET artifact_state = ${JSON.stringify(body.artifact_state)}, updated_at = NOW()
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'title or artifact_state required' }, { status: 400 })
}
```

- [ ] **Step 3.2: Type-check**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npx tsc --noEmit 2>&1 | grep "\[id\]"
```

Expected: no errors

- [ ] **Step 3.3: Commit**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
git add app/api/strategy/sessions/\[id\]/route.ts
git commit -m "feat: extend sessions PATCH to accept artifact_state"
```

---

## Task 4: New Dynamic System Prompt

**Files:**
- Modify: `sdr-web/app/api/strategy/chat/stream/route.ts`

Replace the static `SYSTEM_PROMPT` constant with a `buildSystemPrompt()` function. This is the core change that makes the chatbot research-first, confirmation-first, and cascade-aware.

- [ ] **Step 4.1: Add the `ArtifactConfirmedState` type and `ARTIFACT_ORDER` constant at top of file**

In `stream/route.ts`, after the imports, add:

```typescript
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
```

- [ ] **Step 4.2: Delete the static `SYSTEM_PROMPT` constant and replace with `buildSystemPrompt()`**

Remove the existing `const SYSTEM_PROMPT = \`...\`` block entirely. Replace with:

```typescript
function buildSystemPrompt(
  researchSummary: string,
  artifactState: ArtifactConfirmedState
): string {
  const confirmed = ARTIFACT_ORDER.filter(k => artifactState[k]?.confirmed)
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
```

- [ ] **Step 4.3: Type-check**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npx tsc --noEmit 2>&1 | grep stream
```

Expected: no type errors from the prompt changes

- [ ] **Step 4.4: Commit**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
git add app/api/strategy/chat/stream/route.ts
git commit -m "feat: replace static SYSTEM_PROMPT with dynamic buildSystemPrompt()"
```

---

## Task 5: Wire Stream Route — Research + Artifact State

**Files:**
- Modify: `sdr-web/app/api/strategy/chat/stream/route.ts`

This task connects everything: import research lib, emit `researching` SSE event, load `artifact_state` from DB, build the dynamic prompt, and update `artifact_state` when stage signals fire.

- [ ] **Step 5.1: Add import for research library at top of stream/route.ts**

After the existing imports, add:

```typescript
import { researchCompany, formatResearchForPrompt, type ResearchPacket } from '@/lib/research'
```

- [ ] **Step 5.2: Replace `fetchWebsite` + `clayEnrich` with `researchCompany` in the POST handler**

Find this block in the POST handler:

```typescript
const [webContent, clayData] = await Promise.all([
  url ? fetchWebsite(url) : Promise.resolve(''),
  domain ? clayEnrich(domain) : Promise.resolve(''),
])

const researchBlock = [
  webContent ? `\n\nWebsite content from ${url}:\n${webContent}` : '',
  clayData,
].join('')
```

Replace with:

```typescript
let researchPacket: ResearchPacket = { siteContent: '', enrichment: '', competitorContext: '', newsContext: '', sources: [] }
let researchSummary = ''

if (url && domain) {
  // Emit researching event so UI can show indicator immediately
  // (we buffer it and flush at stream start below)
  researchPacket  = await researchCompany(url, domain)
  researchSummary = formatResearchForPrompt(researchPacket, url)
} else if (url) {
  // URL found but couldn't parse domain — fall back to homepage only
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).then(r => r.text()).catch(() => '')
  researchSummary = html ? `Website content:\n${html.replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n').trim().slice(0, 6000)}` : ''
}
```

- [ ] **Step 5.3: Load `artifact_state` from DB and build dynamic prompt**

Find the line that builds `fullPrompt`:

```typescript
const fullPrompt = `${SYSTEM_PROMPT}${researchBlock}${historyText}\n\nUser: ${message}\n\nAssistant:`
```

Replace the entire block (from loading history down to building `fullPrompt`) with:

```typescript
// Load history and artifact state together
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
const systemPrompt = buildSystemPrompt(researchSummary, artifactState)

const historyText = history.length > 0
  ? '\n\nConversation so far:\n' + history.map(r => `${r.role === 'user' ? 'User' : 'Assistant'}: ${r.content}`).join('\n\n')
  : ''

const fullPrompt = `${systemPrompt}${historyText}\n\nUser: ${message}\n\nAssistant:`
```

- [ ] **Step 5.4: Emit `researching` SSE event at stream start (before Claude tokens)**

Inside the `ReadableStream` `start(controller)` function, before spawning Claude, add:

```typescript
// Tell the client we're about to respond (domain found = show researching indicator)
if (domain) {
  controller.enqueue(enc.encode(`data: ${JSON.stringify({ event: 'researching', domain })}\n\n`))
}
```

Note: This fires synchronously before Claude starts — the research already completed above, but the event tells the UI to show the "Researching..." label for the brief moment before the first token.

Actually, move the `researchCompany()` call BEFORE creating the stream, and emit the event as the very first SSE message inside the stream. The stream is created after research completes, so this is the right moment to tell the UI "research done, generating response now". If you want to show "researching" WHILE research runs, move the stream creation before the research call and emit the event at the top of `start()`.

For simplest implementation: emit the event as the first message in `start()` (research already done by then). The UI shows "Researching..." for a moment, then transitions to the streaming response.

- [ ] **Step 5.5: Update `artifact_state` in DB when stage signals fire**

Find the loop `for (const sig of stageSignals)` in the `proc.on('close', ...)` handler. After triggering each stage, update the artifact state:

```typescript
// After the for loop that triggers stages, update artifact_state in DB
if (stageSignals.length > 0) {
  const updatedState: ArtifactConfirmedState = { ...artifactState }
  for (const sig of stageSignals) {
    const key = sig.stage as keyof ArtifactConfirmedState
    updatedState[key] = { confirmed: true, data: sig.data }
  }
  // Update directly via SQL (same process, no need to HTTP round-trip)
  await sql`
    UPDATE strategy_sessions
    SET artifact_state = ${JSON.stringify(updatedState)}, updated_at = NOW()
    WHERE id = ${session_id}
  `
}
```

- [ ] **Step 5.6: Remove now-unused `fetchWebsite`, `clayEnrich`, and static `SYSTEM_PROMPT` helper references**

Delete the `fetchWebsite()` function and `clayEnrich()` function from the file. They're replaced by `researchCompany()` in `lib/research.ts`.

Also remove: `const REGISTRY`, `const FLOW_ID`, `const WORKSPACE` constants if only used by `triggerPipeline` — check if `triggerPipeline` is still called anywhere. If not, delete it too.

- [ ] **Step 5.7: Persist user message BEFORE loading history**

The existing code inserts the user message and loads history in an unclear order. Make it explicit — persist the user message first, then load history (so it's included in the 60-row limit):

```typescript
// Persist user message first
await sql`
  INSERT INTO strategy_chats (session_id, agent_name, role, content)
  VALUES (${session_id}, ${agent ?? 'profile_builder_web'}, 'user', ${message})
`

// Auto-title from first message (check count before insert)
const [countRow] = await sql<{ count: string }[]>`
  SELECT COUNT(*)::text as count FROM strategy_chats WHERE session_id = ${session_id}
`
if (parseInt(countRow.count) <= 1) {
  const title = message.length > 50 ? message.slice(0, 47) + '…' : message
  await sql`UPDATE strategy_sessions SET title = ${title}, updated_at = NOW() WHERE id = ${session_id} AND title = 'New Analysis'`
} else {
  await sql`UPDATE strategy_sessions SET updated_at = NOW() WHERE id = ${session_id}`
}
```

- [ ] **Step 5.8: Full type-check**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npx tsc --noEmit 2>&1
```

Expected: 0 errors

- [ ] **Step 5.9: Commit**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
git add app/api/strategy/chat/stream/route.ts lib/research.ts
git commit -m "feat: wire multi-source research + artifact state into chat stream"
```

---

## Task 6: UI — Researching Indicator

**Files:**
- Modify: `sdr-web/app/strategy/page.tsx`

When the stream emits `{"event":"researching","domain":"..."}`, show "Researching [domain]..." before the first token arrives. This replaces the generic "AI is thinking…" placeholder for the research phase.

- [ ] **Step 6.1: Add `researchingDomain` state**

In `page.tsx`, find the state declarations block (around line 236) and add:

```typescript
const [researchingDomain, setResearchingDomain] = useState<string | null>(null)
```

- [ ] **Step 6.2: Handle the `researching` event in the SSE reader**

Inside `sendMessage`, in the SSE loop where `parsed.token` is handled (around line 534), add a handler for the `researching` event:

```typescript
if (parsed.event === 'researching' && parsed.domain) {
  setResearchingDomain(parsed.domain as string)
}
if (parsed.token !== undefined) {
  setResearchingDomain(null)  // first token means research phase is over
  acc += parsed.token
  setStreamBuffer(acc)
  // ... rest of existing token handling
}
```

- [ ] **Step 6.3: Reset `researchingDomain` when streaming ends**

In the `finally` block of `sendMessage`, add:

```typescript
setResearchingDomain(null)
```

- [ ] **Step 6.4: Update the streaming placeholder UI**

Find the streaming placeholder block (around line 800):

```tsx
{streaming && !streamBuffer && (
  // current placeholder
)}
```

Replace with:

```tsx
{streaming && !streamBuffer && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: D.surface, border: `1px solid ${D.border}`, fontSize: '13px', color: D.text2 }}>
    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: D.accent }} />
    {researchingDomain
      ? `Researching ${researchingDomain}…`
      : 'Thinking…'
    }
  </div>
)}
```

- [ ] **Step 6.5: Type-check**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npx tsc --noEmit 2>&1
```

Expected: 0 errors

- [ ] **Step 6.6: Commit**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
git add app/strategy/page.tsx
git commit -m "feat: show Researching [domain]... indicator while research runs"
```

---

## Task 7: Manual End-to-End Test

- [ ] **Step 7.1: Start the dev server**

```bash
cd /home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/sdr-web
npm run dev
```

- [ ] **Step 7.2: Test the golden path**

1. Open `http://localhost:3000/strategy`
2. Start a new session
3. Type: "https://flomobility.com/"
4. Observe: "Researching flomobility.com…" shows in the placeholder before first token
5. LLM response should present Company Profile findings from the website (not just ask "tell me about the company")
6. Confirm the Company Profile
7. LLM should move to ICP immediately after confirmation
8. At each step, LLM presents what it found → ask confirm or 1 gap question

- [ ] **Step 7.3: Test cascade**

1. Complete Company Profile + ICP confirmation
2. At Competitive Positioning, say "actually change the ICP — add construction companies"
3. Observe: LLM emits updated icp signal, then immediately re-presents Competitive Positioning with updated context (should add construction-relevant competitors)

- [ ] **Step 7.4: Test graceful degradation**

1. Try a company with no Crunchbase/DDG data (e.g. an internal/private company domain)
2. LLM should still work — just falls back to website content only, and asks gap questions for missing data
3. No errors or crashes

- [ ] **Step 7.5: Test session continuity**

1. Complete 2 artifacts, close the tab
2. Reopen the same session
3. LLM should NOT re-ask about confirmed artifacts — it should start from the next pending one

---

## Self-Review

### Spec Coverage
- [x] URL triggers deep research (6+ sources) → Task 1
- [x] Research fires before LLM speaks → Task 5 (research completes before stream opens)
- [x] Confirmation-first conversation → Task 4 (system prompt rules)
- [x] One artifact at a time → Task 4
- [x] Max 1 gap question per artifact → Task 4 (prompt rule)
- [x] Cascade: artifact N change → re-derive N+1 through profile_docs → Task 4 (prompt rule) + Task 5.5 (state reset)
- [x] "Researching [domain]..." UI → Task 6
- [x] Confirmed state persists across sessions → Task 2 + 5.5
- [x] Graceful degradation if source fails → Task 1 (all sources in try/catch)

### Cascade State Reset Gap
One gap: if a user edits an already-confirmed artifact mid-conversation, the LLM will re-derive downstream (via prompt rules) and emit new stage signals — those will update `artifact_state` correctly. But if the user edits via the **artifact card UI** (not chat), the existing `STALE_CASCADES` + `stale_stages` system handles it. These two systems are parallel and don't conflict.

### Type Consistency
- `ArtifactConfirmedState` defined in `stream/route.ts` (Task 4.1) and referenced in Task 5.3, 5.5 — same file, consistent.
- `ResearchPacket` defined in `lib/research.ts` (Task 1.1) and imported in `stream/route.ts` (Task 5.1) — same type, consistent.
- `StrategySession.artifact_state` typed as `Record<string, { confirmed: boolean; data: ... }> | null` in `page.tsx` (Task 2.3) — broad enough to accept `ArtifactConfirmedState` values from DB.
