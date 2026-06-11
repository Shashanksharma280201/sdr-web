import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'

const SWARM_DIR = process.env.SWARM_REGISTRY
  ?? '/home/shanks/Videos/swarmstudio-cli-1.1.0-linux-amd64/swarm-registry/swarm-registry'

const STAGE_TO_SWARM: Record<string, string> = {
  inspiration_researcher: 'inspiration-researcher',
  idea_generator:         'idea-generator',
  idea_scorer:            'idea-scorer',
  concept_builder:        'concept-builder',
  structure_builder:      'structure-builder',
  content_reviewer:       'content-reviewer',
  content_researcher:     'content-researcher',
  draft_writer:           'draft-writer',
  humanizer:              'humanizer',
  draft_editor:           'draft-editor',
  publisher:              'publisher',
  tracker:                'tracker',
  feedback_synthesizer:   'feedback-synthesizer',
  manual_reviewer:        'manual-reviewer',
}

function getPromptPath(stage: string): string | null {
  const swarmName = STAGE_TO_SWARM[stage]
  if (!swarmName) return null
  return path.join(SWARM_DIR, 'cmd', 'core', 'swarms', swarmName, 'prompts', 'headless.md')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  const { stage } = await params
  const promptPath = getPromptPath(stage)
  if (!promptPath) return NextResponse.json({ error: 'Unknown stage' }, { status: 404 })
  if (!existsSync(promptPath)) return NextResponse.json({ error: 'Prompt file not found', path: promptPath }, { status: 404 })

  const content = readFileSync(promptPath, 'utf-8')
  return NextResponse.json({ stage, content, path: promptPath })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  const { stage } = await params
  const { content } = await req.json() as { content: string }
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const promptPath = getPromptPath(stage)
  if (!promptPath) return NextResponse.json({ error: 'Unknown stage' }, { status: 404 })
  if (!existsSync(promptPath)) return NextResponse.json({ error: 'Prompt file not found' }, { status: 404 })

  writeFileSync(promptPath, content, 'utf-8')
  return NextResponse.json({ ok: true, stage, path: promptPath })
}
