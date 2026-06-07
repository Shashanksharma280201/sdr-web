// lib/research.ts

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
  const raw = html.slice(0, 200_000)
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n').trim().slice(0, cap)
}

const SUB_PAGES = ['/about', '/product', '/products', '/solutions', '/pricing', '/customers', '/careers']

async function fetchSitePages(baseUrl: string): Promise<{ content: string; sources: string[] }> {
  try {
    const homepageHtml = await fetchText(baseUrl)
    const homepage = stripHtml(homepageHtml, 3000)
    if (!homepage) return { content: '', sources: [] }

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
  } catch {
    return { content: '', sources: [] }
  }
}

async function fetchDDGInstantAnswer(domain: string): Promise<string> {
  try {
    const q = encodeURIComponent(`${domain} company`)
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return ''
    const data = await res.json() as {
      Abstract?: string
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

async function fetchGoogleNewsRSS(query: string, cap = 2000): Promise<string> {
  try {
    const q = encodeURIComponent(query)
    const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`)
    if (!xml || xml.length < 200) return ''
    const items: string[] = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRe.exec(xml)) !== null) {
      const titleMatch = m[1].match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
        ?? m[1].match(/<title>([\s\S]*?)<\/title>/)
      const descMatch  = m[1].match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
        ?? m[1].match(/<description>([\s\S]*?)<\/description>/)
      const title = titleMatch ? stripHtml(titleMatch[1], 150).trim() : ''
      const desc  = descMatch  ? stripHtml(descMatch[1],  250).trim() : ''
      if (title) items.push(desc ? `${title}: ${desc}` : title)
      if (items.length >= 6) break
    }
    return items.join('\n').slice(0, cap)
  } catch { return '' }
}

async function fetchLinkedIn(domain: string): Promise<string> {
  const slug = domain.replace(/^www\./, '').split('.')[0]
  try {
    const html = await fetchText(`https://www.linkedin.com/company/${slug}/about`)
    if (!html || html.length < 300) return ''
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]{30,800})"/)
    return descMatch ? `LinkedIn: ${descMatch[1]}` : ''
  } catch { return '' }
}

export async function researchCompany(url: string, domain: string): Promise<ResearchPacket> {
  const companyName = domain.replace(/^www\./, '').split('.')[0]

  const [siteResult, instantAnswer, linkedIn, competitorNews, fundingNews] = await Promise.all([
    fetchSitePages(url),
    fetchDDGInstantAnswer(domain),
    fetchLinkedIn(domain),
    fetchGoogleNewsRSS(`${companyName} competitors alternatives market`),
    fetchGoogleNewsRSS(`"${companyName}" funding investment launch product`),
  ])

  const enrichmentParts = [instantAnswer, linkedIn].filter(Boolean)

  return {
    siteContent:       siteResult.content,
    enrichment:        enrichmentParts.join('\n\n'),
    competitorContext: competitorNews,
    newsContext:       fundingNews,
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
