import Anthropic from '@anthropic-ai/sdk';
import crypto from 'node:crypto';
import type { GrowthSignal, GrowthProposal } from './types.js';
import type { OrganismConfig } from '../types.js';
import type { KnowledgeBase } from '../memory/types.js';

const MAX_PROPOSALS_PER_CYCLE = 2;

/**
 * Build a prompt for Claude that presents growth signals and asks for feature proposals.
 */
export function buildProposalPrompt(signals: GrowthSignal[], config: OrganismConfig): string {
  const growthZones = config.boundaries.growth_zone.map(z => `  - ${z}`).join('\n');
  const forbiddenZones = config.boundaries.forbidden_zone.map(z => `  - ${z}`).join('\n');

  const principles = [
    'Every new feature must be discoverable without documentation',
    'Never break existing commands or change output formats without a migration path',
    'Prefer depth over breadth — master one analysis before adding another',
    'Performance matters more than features — a fast tool gets used, a slow tool gets uninstalled',
    'If a feature requires configuration, the organism hasn\'t understood the problem well enough',
  ];
  const principlesList = principles.map(p => `  - ${p}`).join('\n');

  const signalsList = signals.map((s, i) =>
    `  ${i + 1}. [${s.type}] ${s.title}\n     Evidence: ${s.evidence}\n     Confidence: ${s.confidence}`,
  ).join('\n');

  return `You are the Growth Hormone agent for giti, a CLI tool that transforms raw git repository data into actionable intelligence for developers.

giti's philosophy: Surface insights humans miss. Never require configuration. Work on any repo.

## Growth Zones (allowed areas for new features)
${growthZones}

## Forbidden Zones (NEVER propose features in these areas)
${forbiddenZones}

## Evolutionary Principles
${principlesList}

## Detected Growth Signals
The following signals have been detected from usage telemetry:
${signalsList}

## Task
Based on the signals above, propose 1-2 new features for giti. Each proposal must:
- Align with a growth zone
- Respect all forbidden zones
- Follow evolutionary principles
- Be supported by at least 2 evidence points from the signals

Respond with a JSON array of proposals inside a \`\`\`json code block. Each proposal should have this structure:

\`\`\`json
[
  {
    "title": "Short feature title",
    "description": "What the feature does",
    "rationale": "Why this feature should exist",
    "evidence": [
      { "signal_type": "type", "data_point": "description", "confidence": 0.8 }
    ],
    "proposed_interface": {
      "command": "giti <command>",
      "flags": ["--flag"],
      "output_description": "What the output looks like"
    },
    "estimated_complexity": "small|medium|large",
    "target_files": ["src/commands/example.ts"],
    "dependencies_needed": [],
    "alignment": {
      "purpose_alignment": "How it aligns with giti's purpose",
      "growth_zone_category": "Which growth zone",
      "principle_compliance": ["Which principles it follows"]
    },
    "risks": ["Potential risks"],
    "success_metrics": ["How to measure success"]
  }
]
\`\`\``;
}

/**
 * Extract JSON proposals from Claude's response text.
 */
export function parseProposalResponse(text: string): GrowthProposal[] {
  if (!text) return [];

  try {
    let jsonStr: string | undefined;

    // Try extracting from ```json code block
    const codeBlockMatch = /```json\s*\n?([\s\S]*?)\n?\s*```/.exec(text);
    if (codeBlockMatch?.[1]) {
      jsonStr = codeBlockMatch[1];
    } else {
      // Try plain JSON array
      const arrayMatch = /\[[\s\S]*\]/.exec(text);
      if (arrayMatch?.[0]) {
        jsonStr = arrayMatch[0];
      }
    }

    if (!jsonStr) return [];

    const parsed: unknown = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: Record<string, unknown>) => ({
      ...item,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'proposed' as const,
    })) as GrowthProposal[];
  } catch {
    return [];
  }
}

const STOP_WORDS = new Set([
  'the', 'in', 'any', 'way', 'or', 'and', 'a', 'an', 'to', 'of', 'for',
  'with', 'without', 'stay', 'by', 'not', 'no', 'is', 'it', 'on', 'at',
]);

function extractKeywords(zone: string): string[] {
  return zone
    .toLowerCase()
    .replace(/[()]/g, '')
    .split(/\s+/)
    .filter(w => !STOP_WORDS.has(w) && w.length > 3);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate a proposal against organism boundaries and knowledge base.
 */
export function validateProposal(
  proposal: GrowthProposal,
  config: OrganismConfig,
  kb: KnowledgeBase | null,
): { valid: boolean; reason?: string } {
  // Forbidden zone check: search title + description for forbidden zone keywords
  const combinedText = `${proposal.title} ${proposal.description}`.toLowerCase();
  for (const zone of config.boundaries.forbidden_zone) {
    const zoneKeywords = extractKeywords(zone);
    const match = zoneKeywords.some(keyword => {
      const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
      return pattern.test(combinedText);
    });
    if (match) {
      return { valid: false, reason: `Proposal touches forbidden zone: "${zone}"` };
    }
  }

  // Evidence threshold: must have >= 2 evidence points
  if (proposal.evidence.length < 2) {
    return { valid: false, reason: 'Insufficient evidence: proposal must have at least 2 evidence points' };
  }

  // Redundancy check: look for similar rejected proposals in KB
  if (kb) {
    const rejectedEvents = kb.events.filter(e => e.type === 'growth-rejected');
    const proposalPrefix = proposal.title.substring(0, 20).toLowerCase();
    for (const event of rejectedEvents) {
      const eventTitle = (event.data['title'] as string) ?? '';
      const eventPrefix = eventTitle.substring(0, 20).toLowerCase();
      if (proposalPrefix === eventPrefix) {
        return { valid: false, reason: 'Proposal is similar to a previously rejected growth proposal' };
      }
    }
  }

  // Dependencies check: max 2 dependencies
  if (proposal.dependencies_needed.length > 2) {
    return { valid: false, reason: `Too many dependencies: ${proposal.dependencies_needed.length} (max 2)` };
  }

  return { valid: true };
}

/**
 * Generate growth proposals by analyzing signals via Claude API.
 */
export async function generateProposals(
  signals: GrowthSignal[],
  config: OrganismConfig,
  kb: KnowledgeBase | null,
): Promise<GrowthProposal[]> {
  const strongSignals = signals.filter(s => s.confidence >= 0.6);
  if (strongSignals.length < 2) return [];

  const client = new Anthropic();
  const prompt = buildProposalPrompt(strongSignals, config);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const proposals = parseProposalResponse(text);

  return proposals
    .filter(p => validateProposal(p, config, kb).valid)
    .slice(0, MAX_PROPOSALS_PER_CYCLE);
}
