'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Brain,
  Home,
  MessageSquare,
  Users,
  Building2,
  Calendar,
  Mail,
  Lightbulb,
  Zap,
  Plus,
  Download,
  Mic,
  Clock,
  Search,
  ChevronRight,
  ArrowRight,
  Globe,
  Database,
  FileText,
  Send,
  Upload,
  Grid,
  List,
  Filter,
  Activity,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Surface =
  | 'home'
  | 'chat'
  | 'people'
  | 'companies'
  | 'meetings'
  | 'conversations'
  | 'ideas'
  | 'signals'
  | 'capture'
  | 'sources'
  | 'graph'
  | 'dream'

// ─── Brain Left Rail ──────────────────────────────────────────────────────────

function BrainGlyphIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="12" cy="12" r="4" stroke="var(--accent)" strokeWidth="0.8" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="1.5" fill="var(--accent)" />
    </svg>
  )
}

function BrainLeftRail({
  active,
  onNav,
}: {
  active: Surface
  onNav: (s: Surface) => void
}) {
  const navItem = (
    label: string,
    surface: Surface,
    count?: number,
    italic?: boolean
  ) => {
    const isActive = active === surface
    return (
      <div
        key={surface}
        onClick={() => onNav(surface)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          margin: '1px 8px',
          borderRadius: '5px',
          background: isActive ? 'var(--ink)' : 'transparent',
          color: isActive ? 'var(--paper)' : 'var(--ink-2)',
          fontSize: '12.5px',
          fontStyle: italic ? 'italic' : 'normal',
          fontWeight: isActive ? 500 : 400,
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--paper-3)'
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        {count !== undefined && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--line)',
              color: isActive ? 'var(--paper)' : 'var(--ink-3)',
              borderRadius: '10px',
              padding: '1px 6px',
              minWidth: '18px',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {count}
          </span>
        )}
      </div>
    )
  }

  const sectionLabel = (label: string) => (
    <div
      style={{
        padding: '10px 18px 4px',
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--ink-4)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )

  return (
    <div
      style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--paper-2)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 14px 12px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--ink)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BrainGlyphIcon />
        </div>
        <div>
          <div
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: '20px',
              lineHeight: 1.1,
              color: 'var(--ink)',
            }}
          >
            Brain
          </div>
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--ink-3)',
              marginTop: '1px',
            }}
          >
            Acme brain
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {/* No label section */}
        {navItem('Home', 'home')}
        {navItem('Chat', 'chat')}

        {sectionLabel('Entities')}
        {navItem('People', 'people', 412)}
        {navItem('Companies', 'companies', 187)}
        {navItem('Meetings', 'meetings', 94)}
        {navItem('Conversations', 'conversations', 203)}
        {navItem('Ideas', 'ideas', 68)}
        {navItem('Signals', 'signals', 312)}
        <div
          style={{
            padding: '6px 10px',
            margin: '1px 8px',
            fontSize: '12px',
            fontStyle: 'italic',
            color: 'var(--ink-4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={11} />
          Add organization
        </div>

        {sectionLabel('Operations')}
        {navItem('Capture', 'capture')}
        {navItem('Sources', 'sources', 7)}
        {navItem('Graph view', 'graph')}
        {navItem('Dream cycle', 'dream')}
      </div>

      {/* Footer stats */}
      <div
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--line)',
          padding: '10px 14px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 10px',
          }}
        >
          {[
            { label: 'Pages', value: '1,276' },
            { label: 'Edges', value: '8,419' },
            { label: 'Indexed', value: '4m ago' },
            { label: 'Last dream', value: '2h' },
          ].map((stat) => (
            <div key={stat.label}>
              <div
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ink-4)',
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Brain Topbar ─────────────────────────────────────────────────────────────

const surfaceLabels: Record<Surface, string> = {
  home: 'Home',
  chat: 'Chat',
  people: 'People',
  companies: 'Companies',
  meetings: 'Meetings',
  conversations: 'Conversations',
  ideas: 'Ideas',
  signals: 'Signals',
  capture: 'Capture',
  sources: 'Sources',
  graph: 'Graph view',
  dream: 'Dream cycle',
}

function BrainTopbar({ active }: { active: Surface }) {
  return (
    <div
      style={{
        height: '40px',
        background: 'var(--paper)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '6px',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '13px', color: 'var(--ink-3)' }}>Brain</span>
      <ChevronRight size={12} color="var(--ink-4)" />
      <span style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 500 }}>
        {surfaceLabels[active]}
      </span>
    </div>
  )
}

// ─── HOME Surface ─────────────────────────────────────────────────────────────

function HomeSurface() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      {/* Greeting */}
      <div
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: '30px',
          fontStyle: 'italic',
          color: 'var(--ink)',
          lineHeight: 1.3,
          maxWidth: '680px',
          marginBottom: '8px',
        }}
      >
        Good morning.{' '}
        <em>
          Five new captures arrived overnight
        </em>{' '}
        — three from email replies, two from your voice notes on the walk.
      </div>

      {/* Meta */}
      <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: '28px' }}>
        Tuesday, May 26 · last dream cycle ran at 04:00 · indexed 4 min ago
      </div>

      {/* Capture box */}
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line-2)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow)',
          padding: '16px 18px',
          marginBottom: '32px',
          maxWidth: '780px',
        }}
      >
        {/* Head */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            CAPTURE
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 8px',
              borderRadius: '20px',
              background: 'var(--good-soft)',
              fontSize: '11px',
              color: 'var(--good)',
              fontWeight: 500,
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--good)',
                flexShrink: 0,
              }}
            />
            Auto-extracting entities + edges
          </div>
        </div>

        {/* Textarea */}
        <textarea
          readOnly
          defaultValue="Met with Priya at Snowflake again — she's now reporting to a new SVP Engineering, name is Vikram Joshi (used to be at Cloudera). She mentioned they're consolidating observability across three regions and DataDog spend is up 38% YoY. They want a side-by-side bake-off in Q3, probably September. Vikram came from a Splunk-replacement deal at Cloudera so he's predisposed to consider alternatives."
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--ink)',
            background: 'transparent',
            minHeight: '64px',
            marginBottom: '12px',
            fontFamily: "'Instrument Sans', sans-serif",
          }}
        />

        {/* Preview */}
        <div
          style={{
            background: 'var(--paper-2)',
            borderLeft: '3px solid var(--info)',
            borderRadius: '0 6px 6px 0',
            padding: '10px 12px',
            marginBottom: '12px',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--info)',
              marginBottom: '8px',
            }}
          >
            I&apos;LL CREATE OR UPDATE
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {[
              { type: 'person', id: 'priya-sharma', isNew: false },
              { type: 'person', id: 'vikram-joshi', isNew: true },
              { type: 'company', id: 'snowflake', isNew: false },
              { type: 'company', id: 'cloudera', isNew: true },
              { type: 'company', id: 'datadog', isNew: false },
              { type: 'meeting', id: '2026-05-26-priya-snowflake', isNew: true },
              { type: 'idea', id: 'snowflake-q3-bakeoff', isNew: true },
            ].map((ent) => (
              <span
                key={ent.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: ent.isNew ? 'var(--good-soft)' : 'var(--paper-3)',
                  border: `1px solid ${ent.isNew ? '#b8d4ae' : 'var(--line)'}`,
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: ent.isNew ? 'var(--good)' : 'var(--ink-2)',
                }}
              >
                <span style={{ opacity: 0.6, fontSize: '10px' }}>{ent.type}/</span>
                {ent.id}
                {ent.isNew && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      color: 'var(--good)',
                      marginLeft: '2px',
                    }}
                  >
                    NEW
                  </span>
                )}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {[
              'priya-sharma → vikram-joshi',
              'vikram-joshi → cloudera',
              'snowflake → datadog',
            ].map((edge) => (
              <span
                key={edge}
                style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: 'var(--info-soft)',
                  border: '1px solid #b0ccd8',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--info)',
                }}
              >
                {edge}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            borderTop: '1px solid var(--line)',
            paddingTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          {['Drop file', 'Voice note', 'Paste email', 'Paste meeting notes'].map((label) => (
            <button
              key={label}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid var(--line)',
                background: 'var(--paper-2)',
                fontSize: '11px',
                color: 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontStyle: 'italic',
              color: 'var(--ink-3)',
            }}
          >
            ⌘↵ to save
          </span>
          <button
            style={{
              padding: '5px 14px',
              borderRadius: '5px',
              background: 'var(--ink)',
              color: 'var(--paper)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Save to brain
          </button>
        </div>
      </div>

      {/* Sources section */}
      <div style={{ maxWidth: '780px', marginBottom: '28px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            SOURCES
          </span>
          <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
            7 connected · ingesting continuously
          </span>
          <div style={{ flex: 1 }} />
          <button
            style={{
              fontSize: '12px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Manage all →
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}
        >
          {[
            { name: 'Gmail', status: 'connected', detail: '18 new today', icon: '✉' },
            { name: 'Google Calendar', status: 'connected', detail: '3 meetings', icon: '📅' },
            { name: 'Granola', status: 'connected', detail: 'Last meeting 1h ago', icon: '🌿' },
            { name: 'LinkedIn', status: 'connected', detail: 'Profile changes 4 today', icon: 'in' },
            { name: 'Slack', status: 'warn', detail: 'Auth expires in 5 days', icon: '#' },
            { name: 'Voice / Telegram', status: 'connected', detail: '2 voice notes', icon: '🎙' },
            { name: 'Crunchbase', status: 'connected', detail: 'Funding feed 22 today', icon: 'cb' },
            { name: '+ Connect a source', status: 'empty', detail: '', icon: '+' },
          ].map((src) => (
            <div
              key={src.name}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                border:
                  src.status === 'empty'
                    ? '1px dashed var(--line-2)'
                    : '1px solid var(--line)',
                borderLeft:
                  src.status === 'connected'
                    ? '3px solid var(--good)'
                    : src.status === 'warn'
                    ? '3px solid var(--warn)'
                    : '1px dashed var(--line-2)',
                background: src.status === 'empty' ? 'transparent' : 'var(--paper)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              {src.status === 'empty' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '40px',
                    fontSize: '12px',
                    color: 'var(--ink-4)',
                    fontStyle: 'italic',
                  }}
                >
                  {src.name}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{src.icon}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      {src.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: src.status === 'warn' ? 'var(--warn)' : 'var(--ink-3)',
                    }}
                  >
                    {src.detail}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div
        style={{
          maxWidth: '780px',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--paper-2)',
          }}
        >
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ink)',
              flex: 1,
            }}
          >
            Recent brain activity
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
            All sources · last 24h
          </span>
        </div>

        {[
          {
            color: '#4a7c3a',
            initials: 'VJ',
            summary: (
              <>
                <strong>NEW person</strong> — Vikram Joshi{' '}
                <span style={{ color: 'var(--ink-2)' }}>(SVP Eng at Snowflake, prev Cloudera)</span>
              </>
            ),
            source: 'Voice',
            time: '2 min ago',
          },
          {
            color: '#3a6478',
            initials: '💡',
            summary: (
              <>
                <strong>NEW idea</strong> — Q3 Snowflake bake-off{' '}
                <span style={{ color: 'var(--ink-2)' }}>(DataDog 38% YoY)</span>
              </>
            ),
            source: 'Voice',
            time: '2 min ago',
          },
          {
            color: '#5a5aaa',
            initials: 'PL',
            summary: (
              <>
                <strong>Signal update</strong> —{' '}
                <span style={{ fontWeight: 600 }}>Plaid</span> new platform engineering hires
              </>
            ),
            source: 'LinkedIn',
            time: '1h ago',
          },
          {
            color: '#2c4c6a',
            initials: 'AN',
            summary: (
              <>
                <strong>Meeting captured</strong> —{' '}
                <span style={{ fontWeight: 600 }}>Anduril Industries</span> demo 47 min, 3 action items
              </>
            ),
            source: 'Granola',
            time: '3h ago',
          },
          {
            color: '#8c6a3a',
            initials: 'MC',
            summary: (
              <>
                <strong>Email reply</strong> —{' '}
                <span style={{ fontWeight: 600 }}>Marcus Chen</span> (Figma) replied, interested but waiting Q3
              </>
            ),
            source: 'Email',
            time: '5h ago',
          },
          {
            color: '#635bff',
            initials: 'ST',
            summary: (
              <>
                <strong>Company updated</strong> —{' '}
                <span style={{ fontWeight: 600 }}>Stripe</span> added Honeycomb alongside DataDog
              </>
            ),
            source: 'Web',
            time: '6h ago',
          },
          {
            color: '#4a7c3a',
            initials: '💡',
            summary: (
              <>
                <strong>NEW idea</strong> — DataDog hub-and-spoke positioning angle
              </>
            ),
            source: 'Voice',
            time: 'yesterday 06:14',
          },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 16px',
              borderBottom: i < 6 ? '1px solid var(--line)' : 'none',
              background: 'var(--paper)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: row.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                flexShrink: 0,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {row.initials}
            </div>
            <div style={{ flex: 1, fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.4 }}>
              {row.summary}
            </div>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--paper-2)',
                color: 'var(--ink-3)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {row.source}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--ink-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {row.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CHAT Surface ─────────────────────────────────────────────────────────────

function ChatSurface() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Chat scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* User message */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ maxWidth: '560px' }}>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--ink-3)',
                textAlign: 'right',
                marginBottom: '4px',
              }}
            >
              You · 14:08
            </div>
            <div
              style={{
                background: 'var(--paper-2)',
                border: '1px solid var(--line)',
                borderRadius: '8px 8px 2px 8px',
                padding: '12px 14px',
                fontSize: '14px',
                color: 'var(--ink)',
                lineHeight: 1.5,
              }}
            >
              what do I need to know before my meeting with the Anduril SVP tomorrow?
            </div>
          </div>
        </div>

        {/* Brain response */}
        <div style={{ maxWidth: '640px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                background: 'var(--ink)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BrainGlyphIcon />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
              Brain · 1.4s · 12 sources
            </span>
          </div>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '2px 8px 8px 8px',
              padding: '14px 16px',
              fontSize: '13.5px',
              color: 'var(--ink)',
              lineHeight: 1.65,
            }}
          >
            <p style={{ marginBottom: '10px' }}>
              The Anduril SVP you&apos;re meeting tomorrow is <strong>Anita Krishnan</strong>, Founder/CTO. Based on yesterday&apos;s demo meeting, she was highly engaged — the session ran 47 minutes versus a 30-minute slot. There are currently{' '}
              <strong>3 open commitments</strong> from that meeting: a technical architecture deep-dive, a cost-ratio breakdown comparing current spend vs. your platform, and a security posture one-pager she specifically requested.
            </p>
            <p style={{ marginBottom: '10px' }}>
              Context worth having: Anduril&apos;s current observability cost ratio is a known pain point internally — Honeycomb has been mentioned as a reference but DataDog appears to dominate their stack. The cost narrative will land well here.
            </p>
            <p style={{ color: 'var(--ink-2)' }}>
              ⚠ Note: The LinkedIn hiring signal for Anduril platform engineering is from 6 hours ago and hasn&apos;t been re-indexed into the relationship graph yet — treat edge weights as approximate.
            </p>
          </div>

          {/* Citation chips */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[
              'Anduril demo meeting · 3h ago',
              'Anita Krishnan profile',
              'Hiring signal · LinkedIn',
            ].map((cit) => (
              <span
                key={cit}
                style={{
                  padding: '3px 9px',
                  borderRadius: '20px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  fontSize: '11px',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                }}
              >
                {cit}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          padding: '16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          background: 'var(--paper)',
        }}
      >
        <textarea
          placeholder="Ask about people, companies, meetings, or anything the brain has captured…"
          rows={2}
          style={{
            flex: 1,
            border: '1px solid var(--line)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '13px',
            resize: 'none',
            background: 'var(--paper)',
            color: 'var(--ink)',
            outline: 'none',
            fontFamily: "'Instrument Sans', sans-serif",
          }}
        />
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--ink)',
            color: 'var(--paper)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <Send size={12} />
          Ask Brain
        </button>
      </div>
    </div>
  )
}

// ─── Entity card helpers ──────────────────────────────────────────────────────

function Avatar({ initials, bg, rounded }: { initials: string; bg: string; rounded?: boolean }) {
  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: rounded ? '6px' : '50%',
        background: bg,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {initials}
    </div>
  )
}

function EdgePill({ verb, obj }: { verb: string; obj: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 7px',
        borderRadius: '4px',
        background: 'var(--paper-2)',
        border: '1px solid var(--line)',
        fontSize: '11px',
        marginRight: '4px',
        marginBottom: '3px',
      }}
    >
      <span style={{ color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{verb}</span>
      <span style={{ color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>{obj}</span>
    </span>
  )
}

function NewBadge() {
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: '4px',
        background: 'var(--good-soft)',
        color: 'var(--good)',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      NEW
    </span>
  )
}

function SurfaceHead({
  title,
  meta,
  buttons,
  filters,
}: {
  title: string
  meta: string
  buttons?: React.ReactNode
  filters?: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: '28px 36px 0',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '4px',
        }}
      >
        <h2
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: '32px',
            fontWeight: 400,
            color: 'var(--ink)',
          }}
        >
          {title}
        </h2>
        {buttons && (
          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
            {buttons}
          </div>
        )}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '16px' }}>{meta}</div>
      {filters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {filters}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: '20px',
        border: '1px solid var(--line)',
        background: active ? 'var(--ink)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink-3)',
        fontSize: '11px',
        cursor: 'pointer',
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </span>
  )
}

function SearchInput({ placeholder }: { placeholder?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        border: '1px solid var(--line)',
        borderRadius: '5px',
        background: 'var(--paper)',
        minWidth: '180px',
      }}
    >
      <Search size={12} color="var(--ink-4)" />
      <input
        placeholder={placeholder || 'Search…'}
        style={{
          border: 'none',
          outline: 'none',
          fontSize: '12px',
          background: 'transparent',
          color: 'var(--ink)',
          width: '100%',
        }}
      />
    </div>
  )
}

function ActionButton({ label, icon, primary }: { label: string; icon?: React.ReactNode; primary?: boolean }) {
  return (
    <button
      style={{
        padding: '5px 12px',
        borderRadius: '5px',
        border: primary ? 'none' : '1px solid var(--line)',
        background: primary ? 'var(--ink)' : 'var(--paper)',
        color: primary ? 'var(--paper)' : 'var(--ink-2)',
        fontSize: '12px',
        fontWeight: primary ? 500 : 400,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── PEOPLE Surface ───────────────────────────────────────────────────────────

function PeopleSurface() {
  const people = [
    {
      initials: 'PS',
      bg: '#4a7c3a',
      name: 'Priya Sharma',
      sub: 'VP Platform Engineering · Snowflake',
      line: 'Met yesterday — 38% YoY DataDog spend consolidation across 3 regions',
      edges: [
        { verb: 'works-at', obj: 'snowflake' },
        { verb: 'reports-to', obj: 'vikram-joshi' },
        { verb: 'previously-at', obj: 'cribl' },
      ],
      meetings: 3,
      convos: 7,
      time: '2m',
      isNew: false,
    },
    {
      initials: 'VJ',
      bg: '#2c4c6a',
      name: 'Vikram Joshi',
      sub: 'SVP Engineering · Snowflake',
      line: 'Just added via Priya — prev Cloudera, Splunk-replacement background',
      edges: [
        { verb: 'works-at', obj: 'snowflake' },
        { verb: 'previously-at', obj: 'cloudera' },
        { verb: 'manages', obj: 'priya-sharma' },
      ],
      meetings: 0,
      convos: 0,
      time: 'Just now',
      isNew: true,
    },
    {
      initials: 'MC',
      bg: '#8c6a3a',
      name: 'Marcus Chen',
      sub: 'Director of Infra · Figma',
      line: 'Replied 5h ago — interested but waiting on Q3 budget unlock',
      edges: [
        { verb: 'works-at', obj: 'figma' },
        { verb: 'replied-to', obj: 'seq_eng_cold v8' },
        { verb: 'knows', obj: 'jamie-park' },
      ],
      meetings: 1,
      convos: 4,
      time: '5h ago',
      isNew: false,
    },
    {
      initials: 'JP',
      bg: '#635bff',
      name: 'Jamie Park',
      sub: 'Distinguished Engineer · Stripe',
      line: 'Has positive intent signals — Sapient cohort 2018, mutual network',
      edges: [
        { verb: 'works-at', obj: 'stripe' },
        { verb: 'advises', obj: 'three-portfolio-cos' },
        { verb: 'cohort', obj: 'sapient-2018' },
      ],
      meetings: 2,
      convos: 9,
      time: '3d ago',
      isNew: false,
    },
    {
      initials: 'AK',
      bg: '#1a1814',
      name: 'Anita Krishnan',
      sub: 'Founder/CTO · Anduril Industries',
      line: 'Demo went well — 47 min, 3 action items outstanding before tomorrow',
      edges: [
        { verb: 'founded', obj: 'anduril' },
        { verb: 'attended-demo', obj: '2026-05-26' },
      ],
      meetings: 1,
      convos: 2,
      time: '3h ago',
      isNew: false,
    },
    {
      initials: 'RT',
      bg: '#4a4438',
      name: 'Rohan Thakkar',
      sub: 'VP Eng · Vercel',
      line: 'Strongest historical replier in seq_eng_cold — prev Netflix',
      edges: [
        { verb: 'works-at', obj: 'vercel' },
        { verb: 'previously-at', obj: 'netflix' },
        { verb: 'in-sequence', obj: 'seq_eng_cold v8' },
      ],
      meetings: 0,
      convos: 3,
      time: '2d ago',
      isNew: false,
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SurfaceHead
        title="People"
        meta="412 entities · 1,847 typed edges · last updated 2 min ago"
        buttons={
          <>
            <ActionButton label="Export" icon={<Download size={11} />} />
            <ActionButton label="+ New person" primary />
          </>
        }
        filters={
          <>
            <SearchInput placeholder="Search people…" />
            <FilterChip label="Touched in 30d" active />
            <FilterChip label="Role: Eng/Platform" />
            <FilterChip label="Has unresolved commitment" />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <ActionButton label="Cards" />
              <ActionButton label="Table" />
              <ActionButton label="Graph" />
            </div>
          </>
        }
      />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 36px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          alignContent: 'start',
        }}
      >
        {people.map((p) => (
          <div
            key={p.name}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Avatar initials={p.initials} bg={p.bg} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {p.name}
                  {p.isNew && <NewBadge />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{p.sub}</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-2)', margin: '8px 0' }}>
              {p.line}
            </div>
            <div style={{ marginBottom: '10px' }}>
              {p.edges.map((e) => (
                <EdgePill key={e.verb + e.obj} verb={e.verb} obj={e.obj} />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                fontSize: '10px',
                color: 'var(--ink-3)',
                borderTop: '1px solid var(--line)',
                paddingTop: '8px',
              }}
            >
              <span>{p.meetings} meetings</span>
              <span>{p.convos} conversations</span>
              <span style={{ marginLeft: 'auto' }}>{p.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── COMPANIES Surface ────────────────────────────────────────────────────────

function CompaniesSurface() {
  const companies = [
    {
      initials: 'S',
      bg: '#1292d6',
      name: 'Snowflake',
      domain: 'snowflake.com',
      emp: '7,800',
      industry: 'Data platform',
      line: 'Active score 94 — Q3 bake-off in motion, DataDog 38% YoY',
      edges: [
        { verb: 'uses', obj: 'datadog' },
        { verb: 'has-person', obj: 'priya-sharma' },
        { verb: 'has-person', obj: 'vikram-joshi' },
      ],
      contacts: 7,
      meetings: 3,
      time: '2m',
      isNew: false,
    },
    {
      initials: 'A',
      bg: '#1a1814',
      name: 'Anduril',
      domain: 'anduril.com',
      emp: '2,400',
      industry: 'Defense tech',
      line: 'Demo 3h ago — cost quote requested, 3 open commitments',
      edges: [
        { verb: 'demo-attended', obj: '2026-05-26' },
        { verb: 'hiring', obj: 'platform-eng' },
      ],
      contacts: 3,
      meetings: 1,
      time: '3h',
      isNew: false,
    },
    {
      initials: 'S',
      bg: '#635bff',
      name: 'Stripe',
      domain: 'stripe.com',
      emp: '8,000',
      industry: 'Fintech infra',
      line: 'New Honeycomb signal — uses DataDog + Honeycomb, Jamie Park advises',
      edges: [
        { verb: 'uses', obj: 'datadog' },
        { verb: 'uses', obj: 'honeycomb' },
        { verb: 'advised-by', obj: 'jamie-park' },
      ],
      contacts: 7,
      meetings: 2,
      time: '6h',
      isNew: false,
    },
    {
      initials: 'F',
      bg: '#a259ff',
      name: 'Figma',
      domain: 'figma.com',
      emp: '1,300',
      industry: 'Design',
      line: 'Marcus replied — interested Q3 budget cycle, in active sequence',
      edges: [
        { verb: 'in-sequence', obj: 'seq_eng_cold v8' },
        { verb: 'has-person', obj: 'marcus-chen' },
      ],
      contacts: 4,
      meetings: 0,
      time: '5h',
      isNew: false,
    },
    {
      initials: 'C',
      bg: 'var(--paper-3)',
      name: 'Cloudera',
      domain: 'cloudera.com',
      emp: '2,200',
      industry: 'Data platform',
      line: 'Added via Vikram Joshi — previous employer, Splunk-replacement context',
      edges: [
        { verb: 'previous-employer-of', obj: 'vikram-joshi' },
      ],
      contacts: 0,
      meetings: 0,
      time: 'Just now',
      isNew: true,
    },
    {
      initials: 'V',
      bg: '#1a1814',
      name: 'Vercel',
      domain: 'vercel.com',
      emp: '480',
      industry: 'Cloud platform',
      line: 'Strongest reply rate in seq_eng_cold — Rohan previously at Netflix',
      edges: [
        { verb: 'in-sequence', obj: 'seq_eng_cold' },
        { verb: 'previously-employed', obj: 'rohan-thakkar' },
      ],
      contacts: 3,
      meetings: 0,
      time: '2d',
      isNew: false,
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SurfaceHead
        title="Companies"
        meta="187 entities · 23 active engagement · 38 closed-won lifetime"
        buttons={
          <>
            <ActionButton label="Export" icon={<Download size={11} />} />
            <ActionButton label="+ New company" primary />
          </>
        }
        filters={
          <>
            <SearchInput placeholder="Search companies…" />
            <FilterChip label="Has active engagement" active />
            <FilterChip label="Industry: SaaS" />
            <FilterChip label="Recent signals" />
          </>
        }
      />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 36px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          alignContent: 'start',
        }}
      >
        {companies.map((c) => (
          <div
            key={c.name}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Avatar initials={c.initials} bg={c.bg} rounded />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {c.name}
                  {c.isNew && <NewBadge />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
                  {c.domain} · {c.emp} emp · {c.industry}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-2)', margin: '8px 0' }}>
              {c.line}
            </div>
            <div style={{ marginBottom: '10px' }}>
              {c.edges.map((e) => (
                <EdgePill key={e.verb + e.obj} verb={e.verb} obj={e.obj} />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                fontSize: '10px',
                color: 'var(--ink-3)',
                borderTop: '1px solid var(--line)',
                paddingTop: '8px',
              }}
            >
              <span>{c.contacts} contacts</span>
              <span>{c.meetings} meetings</span>
              <span style={{ marginLeft: 'auto' }}>{c.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MEETINGS Surface ─────────────────────────────────────────────────────────

function MeetingsSurface() {
  const meetings = [
    {
      when: 'Tomorrow',
      time: '14:30',
      title: 'Anita Krishnan (Anduril) · Follow-up',
      detail: '3 open commitments from yesterday\'s demo',
      avatars: ['A', 'S'],
      extra: 0,
      action: 'Prep',
      isUpcoming: true,
    },
    {
      when: 'Today',
      time: '11:00',
      title: 'Priya Sharma (Snowflake) · 1:1',
      detail: 'Captured 47 min, 5 action items',
      avatars: ['P', 'S'],
      extra: 0,
      action: 'View transcript',
      isUpcoming: false,
    },
    {
      when: 'Today',
      time: '09:30',
      title: 'Anita Krishnan (Anduril) · Demo',
      detail: 'Captured 47 min, 3 action items',
      avatars: ['A', 'S'],
      extra: 2,
      action: 'View transcript',
      isUpcoming: false,
    },
    {
      when: 'Yesterday',
      time: '16:00',
      title: 'Jamie Park (Stripe) · Discovery',
      detail: '32 min, 2 action items',
      avatars: ['J', 'S'],
      extra: 0,
      action: 'View transcript',
      isUpcoming: false,
    },
    {
      when: 'May 22',
      time: '10:00',
      title: 'Internal · weekly SDR review',
      detail: '38 min, 8 action items, drift event',
      avatars: ['S', 'A'],
      extra: 4,
      action: 'View transcript',
      isUpcoming: false,
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SurfaceHead
        title="Meetings"
        meta="94 meetings captured · 287 action items · 4 happening today"
        filters={
          <>
            <SearchInput placeholder="Search meetings…" />
            <FilterChip label="This week" active />
            <FilterChip label="Has open commitments" />
            <FilterChip label="External attendees" />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <ActionButton label="List" />
              <ActionButton label="Calendar" />
            </div>
          </>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 36px 32px' }}>
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {meetings.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                borderBottom: i < meetings.length - 1 ? '1px solid var(--line)' : 'none',
                background: m.isUpcoming ? 'var(--accent-tint)' : 'var(--paper)',
              }}
            >
              {/* When */}
              <div style={{ minWidth: '90px', flexShrink: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                  {m.when}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.time}
                </div>
              </div>

              {/* Detail */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '2px' }}>
                  {m.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{m.detail}</div>
              </div>

              {/* Avatars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {m.avatars.map((av, j) => (
                  <div
                    key={j}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: j === 0 ? 'var(--ink-2)' : 'var(--accent)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {av}
                  </div>
                ))}
                {m.extra > 0 && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--paper-3)',
                      color: 'var(--ink-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    +{m.extra}
                  </div>
                )}
              </div>

              {/* Action */}
              <button
                style={{
                  padding: '5px 12px',
                  borderRadius: '5px',
                  border: '1px solid var(--line)',
                  background: m.isUpcoming ? 'var(--ink)' : 'var(--paper)',
                  color: m.isUpcoming ? 'var(--paper)' : 'var(--ink-2)',
                  fontSize: '12px',
                  fontWeight: m.isUpcoming ? 600 : 400,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {m.action}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── CONVERSATIONS Surface ────────────────────────────────────────────────────

function ConversationsSurface() {
  const convos = [
    {
      initials: 'MC',
      bg: '#8c6a3a',
      name: 'Marcus Chen → You',
      sub: 'Email thread · 3 messages · seq_eng_cold v8',
      line: '"Interested but Q3 budget gates are real — let\'s reconnect in July."',
      edges: [
        { verb: 'reply-to', obj: 'touch-7' },
        { verb: 'sentiment', obj: 'positive-delayed' },
      ],
      time: '5h ago',
      isNew: false,
    },
    {
      initials: 'PS',
      bg: '#4a7c3a',
      name: 'Priya Sharma → You',
      sub: 'Slack DM · 11:14 · auto-captured',
      line: '"Can you send the architecture comparison doc before our 1:1?"',
      edges: [
        { verb: 'references', obj: 'arch-comparison' },
        { verb: 'action-needed', obj: 'send-doc' },
      ],
      time: '1h ago',
      isNew: false,
    },
    {
      initials: 'JD',
      bg: '#5a5aaa',
      name: 'Jordan Decker (Plaid) → Sequence',
      sub: 'Email · seq_eng_cold v8 · touch 2',
      line: 'Opened email twice, no reply. Hiring 3 platform engineers right now.',
      edges: [
        { verb: 'opened', obj: 'touch-2' },
        { verb: 'signal', obj: 'hiring' },
      ],
      time: '3h ago',
      isNew: true,
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SurfaceHead
        title="Conversations"
        meta="203 entities · 47 active threads · 12 need response"
        buttons={
          <>
            <ActionButton label="Export" icon={<Download size={11} />} />
            <ActionButton label="+ New conversation" primary />
          </>
        }
        filters={
          <>
            <SearchInput placeholder="Search conversations…" />
            <FilterChip label="Needs response" active />
            <FilterChip label="Has intent signal" />
          </>
        }
      />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {convos.map((c) => (
          <div
            key={c.name}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Avatar initials={c.initials} bg={c.bg} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {c.name}
                  {c.isNew && <NewBadge />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{c.sub}</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-4)', flexShrink: 0 }}>{c.time}</span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--ink-2)',
                fontStyle: 'italic',
                margin: '8px 0',
                borderLeft: '2px solid var(--line-2)',
                paddingLeft: '10px',
              }}
            >
              {c.line}
            </div>
            <div>
              {c.edges.map((e) => (
                <EdgePill key={e.verb + e.obj} verb={e.verb} obj={e.obj} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── IDEAS Surface ────────────────────────────────────────────────────────────

function IdeasSurface() {
  const ideas = [
    {
      initials: '💡',
      bg: '#b5871e',
      name: 'Snowflake Q3 bake-off',
      sub: 'idea/snowflake-q3-bakeoff · Created 2 min ago',
      line: 'DataDog spend up 38% YoY, Q3 September side-by-side. Vikram from Cloudera / Splunk background — positioned to consider alternatives.',
      edges: [
        { verb: 'involves', obj: 'snowflake' },
        { verb: 'involves', obj: 'vikram-joshi' },
        { verb: 'competing-with', obj: 'datadog' },
      ],
      time: '2m ago',
      isNew: true,
    },
    {
      initials: '💡',
      bg: '#3a6478',
      name: 'DataDog hub-and-spoke positioning',
      sub: 'idea/datadog-hub-spoke-angle · Created yesterday',
      line: 'Pattern across Stripe, Snowflake, Anduril: all using DataDog as default. Opportunity for wedge positioning as costs scale.',
      edges: [
        { verb: 'pattern-across', obj: 'snowflake, stripe' },
        { verb: 'angle', obj: 'cost-wedge' },
      ],
      time: 'yesterday',
      isNew: false,
    },
    {
      initials: '💡',
      bg: '#4a7c3a',
      name: 'Sapient cohort warm intro path',
      sub: 'idea/sapient-cohort-path · Created 5d ago',
      line: 'Jamie Park (Stripe) and two other signals in the 2018 Sapient cohort. Potential warm intro chain to 4 ICP accounts.',
      edges: [
        { verb: 'via', obj: 'jamie-park' },
        { verb: 'targets', obj: 'sapient-2018 cohort' },
      ],
      time: '5d ago',
      isNew: false,
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SurfaceHead
        title="Ideas"
        meta="68 entities · 12 active · 4 linked to open opportunities"
        buttons={
          <>
            <ActionButton label="Export" icon={<Download size={11} />} />
            <ActionButton label="+ New idea" primary />
          </>
        }
        filters={
          <>
            <SearchInput placeholder="Search ideas…" />
            <FilterChip label="Active" active />
            <FilterChip label="Has linked contact" />
          </>
        }
      />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {ideas.map((idea) => (
          <div
            key={idea.name}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Avatar initials={idea.initials} bg={idea.bg} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {idea.name}
                  {idea.isNew && <NewBadge />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{idea.sub}</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-4)', flexShrink: 0 }}>{idea.time}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '8px 0', lineHeight: 1.5 }}>
              {idea.line}
            </div>
            <div>
              {idea.edges.map((e) => (
                <EdgePill key={e.verb + e.obj} verb={e.verb} obj={e.obj} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SIGNALS Surface ──────────────────────────────────────────────────────────

function SignalsSurface() {
  const signals = [
    {
      initials: '⚡',
      bg: '#5a5aaa',
      name: 'Plaid — platform engineering hiring',
      sub: 'signal/plaid-hiring-platform-eng · LinkedIn · 1h ago',
      line: '3 new platform engineering JDs posted. 2 explicitly mention observability tooling consolidation.',
      edges: [
        { verb: 'at-company', obj: 'plaid' },
        { verb: 'type', obj: 'hiring' },
        { verb: 'relevance', obj: 'high' },
      ],
      time: '1h ago',
      isNew: true,
    },
    {
      initials: '⚡',
      bg: '#635bff',
      name: 'Stripe — added Honeycomb alongside DataDog',
      sub: 'signal/stripe-honeycomb-tooling · Web crawl · 6h ago',
      line: 'Job listing mentions Honeycomb as preferred tool alongside existing DataDog. Signal: multi-tool fatigue likely.',
      edges: [
        { verb: 'at-company', obj: 'stripe' },
        { verb: 'type', obj: 'tooling-change' },
      ],
      time: '6h ago',
      isNew: false,
    },
    {
      initials: '⚡',
      bg: '#2c4c6a',
      name: 'Anduril — funding round rumour',
      sub: 'signal/anduril-series-f · Crunchbase · 2d ago',
      line: 'Crunchbase activity suggests Series F preparation. Could accelerate platform consolidation timelines.',
      edges: [
        { verb: 'at-company', obj: 'anduril' },
        { verb: 'type', obj: 'funding' },
      ],
      time: '2d ago',
      isNew: false,
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SurfaceHead
        title="Signals"
        meta="312 entities · 47 unread · 12 high-relevance"
        buttons={
          <>
            <ActionButton label="Mark all read" />
            <ActionButton label="Configure alerts" primary />
          </>
        }
        filters={
          <>
            <SearchInput placeholder="Search signals…" />
            <FilterChip label="Unread" active />
            <FilterChip label="High relevance" />
            <FilterChip label="From active accounts" />
          </>
        }
      />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {signals.map((sig) => (
          <div
            key={sig.name}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Avatar initials={sig.initials} bg={sig.bg} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {sig.name}
                  {sig.isNew && <NewBadge />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{sig.sub}</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-4)', flexShrink: 0 }}>{sig.time}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '8px 0', lineHeight: 1.5 }}>
              {sig.line}
            </div>
            <div>
              {sig.edges.map((e) => (
                <EdgePill key={e.verb + e.obj} verb={e.verb} obj={e.obj} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Placeholder surfaces ─────────────────────────────────────────────────────

function PlaceholderSurface({ label }: { label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-3)',
        fontSize: '14px',
        fontStyle: 'italic',
      }}
    >
      {label} surface
    </div>
  )
}

// ─── Main Brain Page ──────────────────────────────────────────────────────────

export default function BrainPage() {
  const [active, setActive] = useState<Surface>('home')

  function renderSurface() {
    switch (active) {
      case 'home':
        return <HomeSurface />
      case 'chat':
        return <ChatSurface />
      case 'people':
        return <PeopleSurface />
      case 'companies':
        return <CompaniesSurface />
      case 'meetings':
        return <MeetingsSurface />
      case 'conversations':
        return <ConversationsSurface />
      case 'ideas':
        return <IdeasSurface />
      case 'signals':
        return <SignalsSurface />
      default:
        return <PlaceholderSurface label={surfaceLabels[active]} />
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--paper)',
      }}
    >
      {/* Brain Left Rail */}
      <BrainLeftRail active={active} onNav={setActive} />

      {/* Main area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <BrainTopbar active={active} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderSurface()}
        </div>
      </div>
    </div>
  )
}
