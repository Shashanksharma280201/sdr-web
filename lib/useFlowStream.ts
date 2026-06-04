'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flowStreamUrl } from './swarm-api'

export type FlowEvent = { kind: string; id?: string; [k: string]: unknown }

export type Terminal =
  | { kind: 'flow.completed'; success: true; suspended: boolean; pending_gate_type?: string | null; auto_run_next_flow_session_id?: string | null; [k: string]: unknown }
  | { kind: 'flow.failed'; error: string; error_code?: string | null; [k: string]: unknown }

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'suspended' | 'completed' | 'failed' | 'closed'

type Prompt = { promptId: string; prompt: FlowEvent }

export function useFlowStream(
  flowSessionId: string | null,
  opts?: { skipReplay?: boolean; live?: boolean }
) {
  const [events, setEvents] = useState<FlowEvent[]>([])
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [status, setStatus] = useState<StreamStatus>('idle')

  const wsRef = useRef<WebSocket | null>(null)
  const lastSeq = useRef<number>(-1)
  const currentFs = useRef<string | null>(null)
  const closedByUs = useRef(false)

  const answer = useCallback((value: unknown) => {
    const ws = wsRef.current
    if (ws && prompt) {
      ws.send(JSON.stringify({ prompt_id: prompt.promptId, value }))
      setPrompt(null)
    }
  }, [prompt])

  useEffect(() => {
    if (!flowSessionId) return

    currentFs.current = flowSessionId
    closedByUs.current = false
    setEvents([])
    setPrompt(null)
    setTerminal(null)

    const connect = (fsId: string, firstConnect: boolean) => {
      const url = flowStreamUrl(fsId, {
        skipReplay: opts?.live ?? (opts?.skipReplay && firstConnect),
        fromSequence: lastSeq.current >= 0 ? lastSeq.current + 1 : undefined,
      })

      const ws = new WebSocket(url)
      wsRef.current = ws
      setStatus('connecting')

      ws.onopen = () => setStatus('streaming')

      ws.onmessage = (m) => {
        const frame = JSON.parse(m.data as string)

        if (frame.envelope === 'prompt') {
          setPrompt({ promptId: frame.prompt_id, prompt: frame.prompt })
          return
        }

        const ev: FlowEvent = frame.envelope === 'event' ? frame.event : frame
        if (typeof frame.sequence_number === 'number') {
          lastSeq.current = frame.sequence_number
        }

        setEvents(prev => [...prev, ev])

        if (ev.kind === 'flow.completed') {
          const t = ev as Terminal & { auto_run_next_flow_session_id?: string | null }
          const next = (t as { auto_run_next_flow_session_id?: string | null }).auto_run_next_flow_session_id
          if (!(t as { suspended?: boolean }).suspended && next) {
            closedByUs.current = true
            ws.close()
            currentFs.current = next
            lastSeq.current = -1
            connect(next, true)
            return
          }
          setTerminal(t as Terminal)
          setStatus((t as { suspended?: boolean }).suspended ? 'suspended' : 'completed')
          closedByUs.current = true
          ws.close()
        } else if (ev.kind === 'flow.failed') {
          setTerminal(ev as Terminal)
          setStatus('failed')
          closedByUs.current = true
          ws.close()
        }
      }

      ws.onclose = () => {
        if (closedByUs.current) {
          setStatus(s => s === 'streaming' ? 'closed' : s)
          return
        }
        // Unexpected drop — reconnect from cursor
        setTimeout(() => {
          if (currentFs.current) connect(currentFs.current, false)
        }, 1000)
      }

      ws.onerror = () => ws.close()
    }

    connect(flowSessionId, true)

    return () => {
      closedByUs.current = true
      wsRef.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowSessionId])

  return { events, prompt, answer, terminal, status }
}
