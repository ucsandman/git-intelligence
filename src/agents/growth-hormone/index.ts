import type { GrowthSignal, GrowthProposal } from './types.js';
import { readEvents } from '../../telemetry/store.js';
import { aggregateTelemetry } from '../../telemetry/reporter.js';
import { loadOrganismConfig, readJsonFile, writeJsonFile, ensureOrganismDir, getOrganismPath } from '../utils.js';
import { loadKnowledgeBase } from '../memory/store.js';
import { recordMemoryEvent } from '../memory/index.js';
import { analyzeSignals } from './signal-analyzer.js';
import { generateProposals } from './proposal-generator.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const PROPOSALS_DIR = 'growth-proposals';

export async function runGrowthHormone(repoPath: string): Promise<{ signals: GrowthSignal[]; proposals: GrowthProposal[] }> {
  // 1. Read telemetry events
  const events = await readEvents(repoPath);
  if (events.length === 0) {
    return { signals: [], proposals: [] };
  }

  // 2. Aggregate
  const aggregate = aggregateTelemetry(events);

  // 3. Load config
  const config = await loadOrganismConfig(repoPath);

  // 4. Analyze signals
  const signals = analyzeSignals(aggregate, config);

  // 5. Load KB
  const kb = await loadKnowledgeBase(repoPath);

  // 6. Generate proposals (if strong signals exist)
  let proposals: GrowthProposal[] = [];
  try {
    proposals = await generateProposals(signals, config, kb);
  } catch {
    // API failure is non-critical for growth — just return signals without proposals
  }

  // 7. Save proposals
  if (proposals.length > 0) {
    await ensureOrganismDir(repoPath, PROPOSALS_DIR);
    for (const proposal of proposals) {
      await writeJsonFile(getOrganismPath(repoPath, PROPOSALS_DIR, `${proposal.id}.json`), proposal);
      await recordMemoryEvent(repoPath, 'growth-proposed', `Growth proposal: ${proposal.title}`, {
        proposalId: proposal.id, title: proposal.title,
      });
    }
  }

  return { signals, proposals };
}

export async function loadApprovedProposals(repoPath: string): Promise<GrowthProposal[]> {
  const dir = getOrganismPath(repoPath, PROPOSALS_DIR);
  let entries: string[];
  try { entries = await fs.readdir(dir); } catch { return []; }

  const proposals: GrowthProposal[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const proposal = await readJsonFile<GrowthProposal>(path.join(dir, entry));
    if (proposal && proposal.status === 'approved') {
      proposals.push(proposal);
    }
  }
  return proposals;
}

export async function loadAllProposals(repoPath: string): Promise<GrowthProposal[]> {
  const dir = getOrganismPath(repoPath, PROPOSALS_DIR);
  let entries: string[];
  try { entries = await fs.readdir(dir); } catch { return []; }

  const proposals: GrowthProposal[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const proposal = await readJsonFile<GrowthProposal>(path.join(dir, entry));
    if (proposal?.id) proposals.push(proposal);
  }
  return proposals;
}

export async function reviewProposal(
  repoPath: string,
  proposalId: string,
  approved: boolean,
  notes?: string,
): Promise<void> {
  const proposalPath = getOrganismPath(repoPath, PROPOSALS_DIR, `${proposalId}.json`);
  const proposal = await readJsonFile<GrowthProposal>(proposalPath);
  if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

  proposal.status = approved ? 'approved' : 'rejected';
  if (notes) proposal.immune_system_notes = notes;
  await writeJsonFile(proposalPath, proposal);

  const eventType = approved ? 'growth-approved' as const : 'growth-rejected' as const;
  await recordMemoryEvent(repoPath, eventType, `Proposal ${approved ? 'approved' : 'rejected'}: ${proposal.title}`, {
    proposalId, title: proposal.title, notes,
  });
}
