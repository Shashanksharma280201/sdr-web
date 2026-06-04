import { Database, Zap, Link2, Globe, CheckCircle, AlertCircle, Clock, Code2 } from 'lucide-react'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--ink-4)',
      marginBottom: '12px', marginTop: '24px',
    }}>
      {children}
    </div>
  )
}

interface ConnectorCardProps {
  icon: React.ReactNode
  name: string
  detail: string
  status: 'connected' | 'warn' | 'error'
  statusLabel: string
  stat: string
}

function ConnectorCard({ icon, name, detail, status, statusLabel, stat }: ConnectorCardProps) {
  const borderColor = status === 'connected' ? 'var(--good)' : status === 'warn' ? 'var(--warn)' : 'var(--bad)'
  const statusColor = status === 'connected' ? 'var(--good)' : status === 'warn' ? 'var(--warn)' : 'var(--bad)'
  const statusBg = status === 'connected' ? 'var(--good-soft)' : status === 'warn' ? 'var(--warn-soft)' : 'var(--accent-soft)'

  return (
    <div style={{
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: '6px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'var(--paper-2)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--ink-3)',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
            <span style={{
              fontSize: '10px', fontWeight: 500,
              background: statusBg, color: statusColor,
              padding: '1px 6px', borderRadius: '3px',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              {status === 'connected' ? <CheckCircle size={9} /> : status === 'warn' ? <AlertCircle size={9} /> : <AlertCircle size={9} />}
              {statusLabel}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>
            {detail}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink-2)' }}>{stat}</div>
        </div>
      </div>
    </div>
  )
}

interface AvailableCardProps {
  icon: React.ReactNode
  name: string
  description: string
}

function AvailableCard({ icon, name, description }: AvailableCardProps) {
  return (
    <div style={{
      background: 'var(--paper)',
      border: '1px dashed var(--line-2)',
      borderRadius: '6px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'var(--paper-2)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--ink-4)',
          opacity: 0.7,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '4px' }}>{name}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginBottom: '12px' }}>{description}</div>
          <button style={{
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 500,
            background: 'var(--paper)',
            border: '1px solid var(--line-2)',
            borderRadius: '5px',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}>
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConnectorsPage() {
  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Surface header */}
      <div style={{
        padding: '28px 32px 16px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '24px',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: '32px',
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            lineHeight: 1,
          }}>
            Connectors
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '4px' }}>
            7 integrations configured
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px', flex: 1 }}>
        <SectionLabel>Connected</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <ConnectorCard
            icon={<Database size={18} />}
            name="PostgreSQL (Local)"
            detail="swarm_local · localhost:5433"
            status="connected"
            statusLabel="Connected"
            stat="Records: 847"
          />
          <ConnectorCard
            icon={<Zap size={18} />}
            name="SwarmStudio API"
            detail="localhost:8080 · v1.1.0"
            status="connected"
            statusLabel="Connected"
            stat="Last ping: just now"
          />
          <ConnectorCard
            icon={<Link2 size={18} />}
            name="LinkedIn Sales Nav"
            detail="OAuth · expires in 28 days"
            status="connected"
            statusLabel="Connected"
            stat="Quota: 450 / 500 used"
          />
          <ConnectorCard
            icon={<Globe size={18} />}
            name="Clay Enrichment"
            detail="API key · ws-09Dymwpl"
            status="connected"
            statusLabel="Connected"
            stat="Credits: 1,240 remaining"
          />
        </div>

        <SectionLabel>Available</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <AvailableCard
            icon={<Globe size={18} />}
            name="HubSpot CRM"
            description="Sync contacts, deals, and activities bidirectionally."
          />
          <AvailableCard
            icon={<Globe size={18} />}
            name="Salesforce"
            description="Bi-directional sync for enterprise CRM workflows."
          />
          <AvailableCard
            icon={<Globe size={18} />}
            name="Google Workspace"
            description="Calendar and Gmail integration for outreach tracking."
          />
        </div>

        <SectionLabel>API Reference</SectionLabel>
        <div style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Code2 size={13} color="var(--ink-3)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>SwarmStudio REST API</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--ink-4)' }}>v1.1.0</span>
          </div>
          <div style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '8px', fontWeight: 500 }}>Start a flow session</div>
            <pre style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11.5px',
              color: 'var(--ink-2)',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '12px 14px',
              overflowX: 'auto',
              lineHeight: 1.7,
            }}>
{`POST http://localhost:8080/api/flow-sessions
Content-Type: application/json

{
  "flow_id": "lead-scorer",
  "input": {
    "company": "Tata Projects",
    "domain": "tata.com"
  }
}`}
            </pre>

            <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '8px', fontWeight: 500, marginTop: '16px' }}>Poll task status</div>
            <pre style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11.5px',
              color: 'var(--ink-2)',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '5px',
              padding: '12px 14px',
              overflowX: 'auto',
              lineHeight: 1.7,
            }}>
{`GET http://localhost:8080/api/tasks/{task_id}
Authorization: Bearer <token>

# Returns task status, phases, and artifact references`}
            </pre>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px',
                background: 'var(--good-soft)',
                border: '1px solid var(--good)',
                borderRadius: '4px',
                fontSize: '11px', color: 'var(--good)', fontWeight: 500,
              }}>
                <Clock size={10} />
                API latency avg: 42ms
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px',
                background: 'var(--info-soft)',
                border: '1px solid var(--info)',
                borderRadius: '4px',
                fontSize: '11px', color: 'var(--info)', fontWeight: 500,
              }}>
                <CheckCircle size={10} />
                All endpoints healthy
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
