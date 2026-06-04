'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, HelpCircle, Activity, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react'

interface Task {
  id: string
  name: string
  status: string
  kind?: string
  priority?: string
  created_at: string
  updated_at: string
}

interface Review {
  es_id: string
  task_id: string
  kind: string
  status: string
  title?: string
  assigned_to?: string
  created_at: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

type IconType = 'flag' | 'decide' | 'running' | 'done'

function CardIcon({ type }: { type: IconType }) {
  const map = {
    flag:    { bg: 'var(--accent-tint)', color: 'var(--accent)',  Icon: Flag },
    decide:  { bg: 'var(--info-soft)',   color: 'var(--info)',    Icon: HelpCircle },
    running: { bg: 'var(--good-soft)',   color: 'var(--good)',    Icon: Activity },
    done:    { bg: 'var(--paper-3)',     color: 'var(--ink-3)',   Icon: Activity },
  }
  const { bg, color, Icon } = map[type]
  return (
    <div style={{ width: 24, height: 24, borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={12} color={color} />
    </div>
  )
}

function Card({ title, meta, iconType, onClick }: { title: string; meta: string[]; iconType: IconType; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 5,
      padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <CardIcon type={iconType} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {meta.map((m, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: 'var(--line-2)' }}>·</span>}
              {m}
            </span>
          ))}
        </div>
      </div>
      {onClick && <ArrowRight size={11} color="var(--ink-4)" style={{ flexShrink: 0, marginTop: 3 }} />}
    </div>
  )
}

function Section({ title, accent, count, loading, children }: {
  title: string; accent?: boolean; count?: number; loading?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: accent ? 'var(--accent)' : 'var(--ink-3)' }}>
          {title}
        </div>
        {count !== undefined && (
          <span style={{ fontSize: 10, fontWeight: 600, background: accent ? 'var(--accent-tint)' : 'var(--paper-3)', color: accent ? 'var(--accent)' : 'var(--ink-4)', padding: '0 6px', borderRadius: 10, lineHeight: '16px' }}>
            {count}
          </span>
        )}
        {loading && <RefreshCw size={11} color="var(--ink-4)" style={{ marginLeft: 'auto', animation: 'spin 1s linear infinite' }} />}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '12px 4px', fontStyle: 'italic' }}>{label}</div>
  )
}

export default function MyDayPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [tasksRes, reviewsRes] = await Promise.all([
          fetch('/api/tasks?limit=50&output_format=json'),
          fetch('/api/reviews?status=running&output_format=json'),
        ])
        const tasksJson = await tasksRes.json()
        const reviewsJson = await reviewsRes.json()
        setTasks(tasksJson.tasks ?? [])
        setReviews(reviewsJson.reviews ?? [])
      } catch (e) {
        console.error('My Day load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const ACTIVE = new Set(['open', 'running', 'active', 'in_progress'])
  const running   = tasks.filter(t => ACTIVE.has(t.status))
  const blocked   = tasks.filter(t => t.status === 'blocked' || t.status === 'crashed')
  const completed = tasks.filter(t => t.status === 'completed').slice(0, 5)

  const totalItems = reviews.length + running.length + blocked.length

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ padding: '28px 32px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', gap: 24, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>
            My Day
          </h1>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            {loading ? 'Loading…' : `${totalItems} item${totalItems !== 1 ? 's' : ''} need your attention`}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, padding: '20px 32px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 14, alignContent: 'start' }}>

        {/* Needs Review */}
        <Section title="Needs Review" accent count={reviews.length} loading={loading}>
          {reviews.length === 0 && !loading
            ? <EmptyState label="No pending reviews" />
            : reviews.map(r => (
              <Card
                key={r.es_id}
                iconType="decide"
                title={r.title ?? `Review: ${r.kind.replace(/_/g, ' ')}`}
                meta={[r.assigned_to ?? 'unassigned', relativeTime(r.created_at)]}
                onClick={() => router.push(`/console`)}
              />
            ))
          }
        </Section>

        {/* Running */}
        <Section title="Running" count={running.length} loading={loading}>
          {running.length === 0 && !loading
            ? <EmptyState label="No tasks currently running" />
            : running.map(t => (
              <Card
                key={t.id}
                iconType="running"
                title={t.name}
                meta={[t.kind ?? 'task', relativeTime(t.updated_at)]}
                onClick={() => router.push(`/console`)}
              />
            ))
          }
        </Section>

        {/* Blocked / Failed */}
        <Section title="Blocked / Failed" accent={blocked.length > 0} count={blocked.length} loading={loading}>
          {blocked.length === 0 && !loading
            ? <EmptyState label="Nothing blocked" />
            : blocked.map(t => (
              <Card
                key={t.id}
                iconType="flag"
                title={t.name}
                meta={[t.status, relativeTime(t.updated_at)]}
                onClick={() => router.push(`/console`)}
              />
            ))
          }
        </Section>

        {/* Recently Completed */}
        <Section title="Recently Completed" count={completed.length} loading={loading}>
          {completed.length === 0 && !loading
            ? <EmptyState label="No completed tasks yet" />
            : completed.map(t => (
              <Card
                key={t.id}
                iconType="done"
                title={t.name}
                meta={[t.kind ?? 'task', relativeTime(t.updated_at)]}
                onClick={() => router.push(`/console`)}
              />
            ))
          }
          {blocked.length === 0 && running.length === 0 && reviews.length === 0 && completed.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              <AlertCircle size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              No data yet. Run a flow from Setup to get started.
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
