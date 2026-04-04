import Anthropic from '@anthropic-ai/sdk';
import type { CycleResult } from '../agents/orchestrator/types.js';

interface NarrativeContext {
  cycleResult: CycleResult;
  decisions: string[];
  growthProposals: string[];
  topLessons: string[];
  preferences: string[];
  milestone?: string;
}

interface NarrativeResult {
  headline: string;
  narrative: string;
  key_moments: Array<{ moment: string; significance: string }>;
  content_hooks: string[];
}

export async function generateNarrative(context: NarrativeContext): Promise<NarrativeResult> {
  try {
    const client = new Anthropic();
    const prompt = buildNarrativePrompt(context);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return parseNarrativeResponse(text);
  } catch {
    return generateFallbackNarrative(context);
  }
}

function buildNarrativePrompt(context: NarrativeContext): string {
  return [
    'You are narrating the evolution of a living codebase — a software organism that maintains and evolves itself through AI agents.',
    'Write in a nature documentary style. The organism is a subject being observed, not a tool being described.',
    '',
    `Cycle #${context.cycleResult.cycle} just completed.`,
    `Outcome: ${context.cycleResult.outcome}`,
    `Changes merged: ${context.cycleResult.changes_merged}`,
    `Changes rejected: ${context.cycleResult.changes_rejected}`,
    context.milestone ? `MILESTONE: ${context.milestone}` : '',
    '',
    context.decisions.length > 0 ? `Decisions made:\n${context.decisions.map(d => `- ${d}`).join('\n')}` : '',
    context.growthProposals.length > 0 ? `Growth proposals: ${context.growthProposals.join(', ')}` : '',
    context.topLessons.length > 0 ? `Lessons the organism has learned: ${context.topLessons.join('; ')}` : '',
    context.preferences.length > 0 ? `Emerged personality traits: ${context.preferences.join('; ')}` : '',
    '',
    'Respond with a JSON object:',
    '```json',
    '{ "headline": "one-line summary", "narrative": "2-3 paragraph story", "key_moments": [{"moment": "...", "significance": "..."}], "content_hooks": ["interesting angle 1", "interesting angle 2"] }',
    '```',
  ].filter(Boolean).join('\n');
}

function parseNarrativeResponse(text: string): NarrativeResult {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) ?? [null, text];
  try {
    const parsed = JSON.parse(jsonMatch[1] ?? text) as NarrativeResult;
    return {
      headline: parsed.headline ?? 'Cycle completed',
      narrative: parsed.narrative ?? '',
      key_moments: Array.isArray(parsed.key_moments) ? parsed.key_moments : [],
      content_hooks: Array.isArray(parsed.content_hooks) ? parsed.content_hooks : [],
    };
  } catch {
    return { headline: 'Cycle completed', narrative: text.slice(0, 500), key_moments: [], content_hooks: [] };
  }
}

export function generateFallbackNarrative(context: NarrativeContext): NarrativeResult {
  const { cycleResult } = context;
  const headline = cycleResult.outcome === 'productive'
    ? `Cycle #${cycleResult.cycle}: ${cycleResult.changes_merged} change${cycleResult.changes_merged !== 1 ? 's' : ''} merged`
    : cycleResult.outcome === 'stable'
    ? `Cycle #${cycleResult.cycle}: organism is stable`
    : `Cycle #${cycleResult.cycle}: ${cycleResult.outcome}`;

  const narrative = [
    `On cycle ${cycleResult.cycle}, the organism ${cycleResult.outcome === 'productive' ? 'made progress' : 'held steady'}.`,
    cycleResult.changes_merged > 0 ? `It merged ${cycleResult.changes_merged} change${cycleResult.changes_merged !== 1 ? 's' : ''} and rejected ${cycleResult.changes_rejected}.` : '',
    context.milestone ? `This cycle marked a milestone: ${context.milestone}.` : '',
    cycleResult.api_tokens_used > 0 ? `The Motor Cortex consumed ${cycleResult.api_tokens_used} tokens.` : '',
  ].filter(Boolean).join(' ');

  const key_moments: Array<{ moment: string; significance: string }> = [];
  if (context.milestone) key_moments.push({ moment: context.milestone, significance: 'First time this has happened' });
  if (cycleResult.changes_rejected > 0) key_moments.push({ moment: `${cycleResult.changes_rejected} changes rejected`, significance: 'Immune System active' });

  return { headline, narrative, key_moments, content_hooks: [] };
}
