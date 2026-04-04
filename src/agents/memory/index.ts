import type { EventType } from '../types.js';
import type { KnowledgeBase, QueryResult } from './types.js';
import { loadKnowledgeBase, saveKnowledgeBase, createEvent, recordEvent } from './store.js';
import { curateKnowledgeBase } from './curator.js';
import { queryKnowledgeBase } from './query.js';

export async function recordMemoryEvent(
  repoPath: string,
  type: EventType,
  summary: string,
  data?: Record<string, unknown>,
  tags?: string[],
): Promise<void> {
  const kb = await loadKnowledgeBase(repoPath);
  const event = createEvent(type, 'memory', summary, data, tags);
  const updated = recordEvent(kb, event);
  const curated = curateKnowledgeBase(updated);
  await saveKnowledgeBase(repoPath, curated);
}

export async function queryMemory(repoPath: string, query: string): Promise<QueryResult> {
  const kb = await loadKnowledgeBase(repoPath);
  return queryKnowledgeBase(kb, query);
}

export async function getMemorySummary(repoPath: string): Promise<KnowledgeBase> {
  return loadKnowledgeBase(repoPath);
}
