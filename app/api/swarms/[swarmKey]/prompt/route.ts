import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// Map swarm key (e.g. "sdr:core:company-profiler") to file system slug
function swarmKeyToSlug(key: string): string {
  // "sdr:core:company-profiler" → "company-profiler"
  const parts = key.split(':')
  return parts[parts.length - 1]
}

function promptPath(swarmKey: string): string {
  const slug = swarmKeyToSlug(swarmKey)
  return path.join(
    process.cwd(),
    '..', 'swarm-registry', 'swarm-registry', 'sdr', 'core', 'swarms',
    slug, 'prompts', 'headless.md'
  )
}

function schemaPath(swarmKey: string): string {
  const slug = swarmKeyToSlug(swarmKey)
  return path.join(
    process.cwd(),
    '..', 'swarm-registry', 'swarm-registry', 'sdr', 'core', 'swarms',
    slug, 'output_schema.json'
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ swarmKey: string }> }
) {
  const { swarmKey } = await params
  const decodedKey = decodeURIComponent(swarmKey)

  try {
    const [prompt, schema] = await Promise.allSettled([
      fs.readFile(promptPath(decodedKey), 'utf-8'),
      fs.readFile(schemaPath(decodedKey), 'utf-8'),
    ])

    return NextResponse.json({
      swarmKey: decodedKey,
      prompt: prompt.status === 'fulfilled' ? prompt.value : null,
      schema: schema.status === 'fulfilled' ? schema.value : null,
      promptPath: promptPath(decodedKey),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ swarmKey: string }> }
) {
  const { swarmKey } = await params
  const decodedKey = decodeURIComponent(swarmKey)

  try {
    const body = await req.json()
    const { prompt } = body as { prompt: string }
    if (typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt must be a string' }, { status: 400 })
    }

    await fs.writeFile(promptPath(decodedKey), prompt, 'utf-8')
    return NextResponse.json({ ok: true, swarmKey: decodedKey })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
