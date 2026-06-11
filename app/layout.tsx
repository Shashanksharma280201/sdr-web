'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import {
  Brain,
  Package,
  Calendar,
  LayoutList,
  Terminal,
  Target,
  Users,
  MessageSquare,
  BarChart2,
  GitBranch,
  Plug,
  Search,
  Bell,
  ShieldCheck,
  Code2,
  Megaphone,
  ChevronRight,
  Activity,
  FileText,
  Pencil,
  Settings,
  GitMerge,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  count?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const sdrNavGroups: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'My Day', href: '/', icon: <Calendar size={13} /> },
      { label: 'Account Pipeline', href: '/pipeline', icon: <LayoutList size={13} /> },
      { label: 'Task Console', href: '/console', icon: <Terminal size={13} /> },
    ],
  },
  {
    label: 'Workbench',
    items: [
      { label: 'Strategy', href: '/strategy', icon: <Target size={13} /> },
      { label: 'Prospect', href: '/prospect', icon: <Users size={13} /> },
      { label: 'Engagement', href: '/engagement', icon: <MessageSquare size={13} /> },
    ],
  },
  {
    label: 'Insight',
    items: [
      { label: 'Outcomes', href: '/outcomes', icon: <BarChart2 size={13} /> },
    ],
  },
  {
    label: 'Authoring',
    items: [
      { label: 'Flow Graph', href: '/flows', icon: <GitBranch size={13} /> },
      { label: 'SDR × CMD', href: '/sample', icon: <GitMerge size={13} /> },
      { label: 'Connectors', href: '/connectors', icon: <Plug size={13} /> },
      { label: 'Profile Builder', href: '/setup', icon: <Brain size={13} /> },
    ],
  },
]

const cmdNavGroups: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { label: 'Studio', href: '/cmd/studio', icon: <Activity size={13} /> },
      { label: 'Content', href: '/cmd/content', icon: <FileText size={13} /> },
      { label: 'Flow Graph', href: '/cmd/flow', icon: <GitBranch size={13} /> },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Prompts', href: '/cmd/prompts', icon: <Pencil size={13} /> },
      { label: 'Setup', href: '/cmd/setup', icon: <Settings size={13} /> },
    ],
  },
]

const installedPacks = [
  {
    id: 'sdr',
    name: 'SDR',
    desc: 'Sales development & outreach',
    glyphBg: 'var(--ink)',
    glyphColor: 'var(--accent)',
    icon: <Target size={14} strokeWidth={1.8} />,
    active: true,
  },
  {
    id: 'content',
    name: 'Content Marketing',
    desc: 'Content pipeline & distribution',
    glyphBg: 'var(--info)',
    glyphColor: 'white',
    icon: <Megaphone size={14} strokeWidth={1.8} />,
    active: false,
  },
  {
    id: 'sdlc',
    name: 'SDLC',
    desc: 'Engineering delivery & tracking',
    glyphBg: 'var(--good)',
    glyphColor: 'white',
    icon: <Code2 size={14} strokeWidth={1.8} />,
    active: false,
  },
  {
    id: 'grc',
    name: 'GRC',
    desc: 'Governance, risk & compliance',
    glyphBg: 'var(--warn)',
    glyphColor: 'white',
    icon: <ShieldCheck size={14} strokeWidth={1.8} />,
    active: false,
  },
]

const availablePacks = [
  { id: 'cs', name: 'Customer Success', desc: 'Retention & expansion workflows' },
  { id: 'rec', name: 'Recruiting', desc: 'Hiring pipelines & candidate tracking' },
  { id: 'fin', name: 'Finance Ops', desc: 'Budget tracking & approvals' },
  { id: 'more', name: '+ 3 more in the marketplace', desc: '', isMore: true },
]

function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [packsOpen, setPacksOpen] = useState(false)
  const packsRef = useRef<HTMLDivElement>(null)

  const isBrainActive = pathname === '/brain' || pathname.startsWith('/brain/')
  const isCmdActive   = pathname.startsWith('/cmd')

  useEffect(() => {
    if (!packsOpen) return
    function handleClick(e: MouseEvent) {
      if (packsRef.current && !packsRef.current.contains(e.target as Node)) {
        setPacksOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [packsOpen])

  return (
    <div style={{
      height: '44px',
      background: 'var(--ink)',
      color: 'var(--paper)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '14px',
      flexShrink: 0,
      borderBottom: '1px solid rgba(0,0,0,0.3)',
      position: 'relative',
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 4px 2px 0', lineHeight: 1.05 }}>
        <span style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: '19px',
          fontStyle: 'italic',
          letterSpacing: '-0.01em',
          color: 'var(--paper)',
        }}>
          SwarmStudio
        </span>
        <span style={{
          fontSize: '8px',
          letterSpacing: '0.04em',
          color: 'var(--paper-3)',
          opacity: 0.5,
          fontWeight: 400,
        }}>
          built by NebulaIQ
        </span>
      </div>

      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px 4px 8px', borderRadius: '4px' }}>
        <div style={{ width: '7px', height: '7px', background: 'var(--good)', borderRadius: '50%', flexShrink: 0 }} />
        <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '14px', fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--paper)', lineHeight: 1 }}>
          Flo Mobility
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '8px' }}>
        {/* Brain link */}
        <Link
          href="/brain"
          style={{
            padding: '5px 11px',
            fontSize: '12px',
            background: isBrainActive ? 'var(--paper)' : 'transparent',
            color: isBrainActive ? 'var(--ink)' : 'rgba(246,243,238,0.6)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <Brain size={13} strokeWidth={1.6} />
          Brain
        </Link>

        {/* Packs dropdown trigger */}
        <div ref={packsRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setPacksOpen((o) => !o)}
            style={{
              padding: '5px 11px',
              fontSize: '12px',
              background: packsOpen ? 'rgba(255,255,255,0.15)' : 'var(--paper)',
              color: packsOpen ? 'var(--paper)' : 'var(--ink)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              fontWeight: 500,
              userSelect: 'none',
            }}
          >
            <Package size={13} strokeWidth={1.6} />
            Packs
            <span style={{ fontSize: '11px', padding: '1px 6px', background: packsOpen ? 'rgba(255,255,255,0.2)' : 'var(--ink)', color: packsOpen ? 'var(--paper)' : 'var(--paper)', borderRadius: '3px', fontWeight: 600, letterSpacing: '0.05em' }}>
              {isCmdActive ? 'CMD' : 'SDR'}
            </span>
          </div>

          {/* Packs dropdown */}
          {packsOpen && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                left: '-180px',
                width: '380px',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lift)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              {/* Installed section */}
              <div style={{ padding: '10px 14px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                INSTALLED · 4
              </div>
              {installedPacks.map((pack) => (
                <div
                  key={pack.id}
                  onClick={() => {
                    if (pack.id === 'sdr') {
                      setPacksOpen(false)
                      router.push('/')
                    } else if (pack.id === 'content') {
                      setPacksOpen(false)
                      router.push('/cmd/studio')
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '5px',
                    background: (pack.id === 'sdr' && !isCmdActive) || (pack.id === 'content' && isCmdActive) ? 'var(--paper-2)' : 'transparent',
                    cursor: pack.id === 'sdr' || pack.id === 'content' ? 'pointer' : 'default',
                    margin: '0 6px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '7px',
                      background: pack.glyphBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: pack.glyphColor,
                    }}
                  >
                    {pack.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{pack.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{pack.desc}</div>
                  </div>
                  <ChevronRight size={13} color="var(--ink-4)" />
                </div>
              ))}

              <div style={{ height: '1px', background: 'var(--line)', margin: '6px 0' }} />

              {/* Available section */}
              <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                AVAILABLE · 6
              </div>
              {availablePacks.map((pack) => (
                <div
                  key={pack.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    margin: '0 6px',
                    borderRadius: '5px',
                  }}
                >
                  {!('isMore' in pack && pack.isMore) && (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '7px',
                        border: '1px dashed var(--line-2)',
                        background: 'var(--paper-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'isMore' in pack && pack.isMore ? 400 : 500, color: 'isMore' in pack && pack.isMore ? 'var(--ink-3)' : 'var(--ink)', fontStyle: 'isMore' in pack && pack.isMore ? 'italic' : 'normal' }}>
                      {pack.name}
                    </div>
                    {pack.desc && <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{pack.desc}</div>}
                  </div>
                  {!('isMore' in pack && pack.isMore) && (
                    <button
                      style={{
                        padding: '3px 10px',
                        borderRadius: '5px',
                        border: '1px solid var(--line)',
                        background: 'var(--paper)',
                        fontSize: '11px',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Install
                    </button>
                  )}
                </div>
              ))}

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  gap: '0',
                  borderTop: '1px solid var(--line)',
                  marginTop: '6px',
                }}
              >
                <button
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: 'var(--ink-2)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                  }}
                >
                  Browse marketplace →
                </button>
                <div style={{ width: '1px', background: 'var(--line)', margin: '8px 0' }} />
                <button
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: 'var(--ink-2)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                  }}
                >
                  Author a pack
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button style={{ padding: '5px 10px', fontSize: '11px', color: 'rgba(246,243,238,0.6)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Search size={12} strokeWidth={1.5} />
        Search
        <span style={{ opacity: 0.5, fontSize: '10px' }}>⌘K</span>
      </button>

      <div style={{ position: 'relative' }}>
        <button style={{ padding: '5px', color: 'rgba(246,243,238,0.6)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Bell size={14} strokeWidth={1.5} />
        </button>
        <div style={{ position: 'absolute', top: '3px', right: '3px', width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%' }} />
      </div>

      <div style={{
        width: '26px', height: '26px',
        borderRadius: '50%',
        background: 'var(--accent)',
        color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 600,
        flexShrink: 0,
        cursor: 'pointer',
      }}>
        S
      </div>
    </div>
  )
}

function LeftRail({ pathname }: { pathname: string }) {
  const isCmd = pathname.startsWith('/cmd')
  const navGroups = isCmd ? cmdNavGroups : sdrNavGroups

  return (
    <div style={{
      width: '220px',
      background: 'var(--paper-2)',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '24px', height: '24px',
          background: isCmd ? 'var(--info)' : 'var(--accent)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isCmd ? <Megaphone size={12} color="white" strokeWidth={2} /> : <Target size={12} color="white" strokeWidth={2} />}
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{isCmd ? 'CMD' : 'SDR'}</div>
          <div style={{ fontSize: '10px', color: 'var(--ink-4)' }}>{isCmd ? 'Content Pack' : 'Sales Pack'}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: '4px' }}>
            <div style={{
              padding: '8px 14px 4px',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--ink-4)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{ display: 'block', padding: '0 8px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '5px',
                    background: isActive ? 'var(--ink)' : 'transparent',
                    color: isActive ? 'var(--paper)' : 'var(--ink-2)',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'background 0.1s, color 0.1s',
                    cursor: 'pointer',
                  }}>
                    <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.count !== undefined && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--line)',
                        color: isActive ? 'var(--paper)' : 'var(--ink-3)',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        minWidth: '18px',
                        textAlign: 'center',
                      }}>
                        {item.count}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBrainRoute = pathname.startsWith('/brain')

  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar />
        {isBrainRoute ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {children}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1, overflow: 'hidden' }}>
            <LeftRail pathname={pathname} />
            <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)' }}>
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  )
}
