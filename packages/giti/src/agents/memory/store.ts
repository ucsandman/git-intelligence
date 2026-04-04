import crypto from 'node:crypto';
import type { KnowledgeBase } from './types.js';
import type { OrganismEvent, EventType, AgentRole } from '../types.js';
import { readJsonFile, writeJsonFile, getOrganismPath } from '../utils.js';

export async function loadKnowledgeBase(repoPath: string): Promise<KnowledgeBase> {
  const kb = await readJsonFile<KnowledgeBase>(getOrganismPath(repoPath, 'knowledge-base.json'));
  return kb ?? initKnowledgeBase();
}

export async function saveKnowledgeBase(repoPath: string, kb: KnowledgeBase): Promise<void> {
  await writeJsonFile(getOrganismPath(repoPath, 'knowledge-base.json'), kb);
}

export function initKnowledgeBase(): KnowledgeBase {
  const now = new Date().toISOString();
  return {
    created: now,
    last_updated: now,
    cycle_count: 0,
    events: [],
    lessons: [],
    patterns: {
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    },
    preferences: [],
  };
}

export function createEvent(
  type: EventType,
  agent: AgentRole,
  summary: string,
  data: Record<string, unknown> = {},
  tags: string[] = [],
  cycle: number = 0,
): OrganismEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    cycle,
    type,
    agent,
    summary,
    data,
    tags,
  };
}

export function recordEvent(kb: KnowledgeBase, event: OrganismEvent): KnowledgeBase {
  return {
    ...kb,
    last_updated: new Date().toISOString(),
    events: [...kb.events, event],
  };
}
