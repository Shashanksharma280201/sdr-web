import { NextRequest, NextResponse } from 'next/server'

const SWARM_BASE = 'http://localhost:8080'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const qs = searchParams.toString()
    const res = await fetch(`${SWARM_BASE}/api/reviews${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })
    // SwarmStudio may not have a reviews endpoint — treat 404 as empty
    if (res.status === 404) return NextResponse.json({ reviews: [], total: 0 })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    const reviews = json.result?.reviews ?? []
    const total = json.result?.total ?? reviews.length
    return NextResponse.json({ reviews, total })
  } catch (err) {
    console.error('Reviews fetch error:', err)
    return NextResponse.json({ reviews: [], total: 0 })
  }
}
