'use client'

const D = { bg: 'var(--paper)', text: 'var(--ink)', muted: 'var(--ink-4)', surface: 'var(--paper-2)', border: 'var(--line)' }

export default function CmdSetup() {
  return (
    <div style={{ padding: '32px', color: D.text }}>
      <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>CMD Setup</div>
      <div style={{ fontSize: '13px', color: D.muted }}>Connect data sources, configure publish channels, and set workspace defaults.</div>
      <div style={{ marginTop: '24px', padding: '16px', background: D.surface, borderRadius: '8px', border: `1px solid ${D.border}`, fontSize: '12.5px', color: D.muted }}>
        Coming soon — workspace configuration for the Content Marketing pipeline.
      </div>
    </div>
  )
}
