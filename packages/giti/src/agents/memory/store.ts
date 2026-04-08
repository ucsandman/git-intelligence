import crypto from 'node:crypto';
import type { KnowledgeBase, MemoryIndex, LessonCategory, Lesson } from './types.js';
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

export async function getMemoryIndex(repoPath: string): Promise<MemoryIndex> {
  const kb = await loadKnowledgeBase(repoPath);

  const categoryMap = new Map<LessonCategory, Lesson[]>();
  for (const lesson of kb.lessons) {
    const existing = categoryMap.get(lesson.category) ?? [];
    existing.push(lesson);
    categoryMap.set(lesson.category, existing);
  }

  const categories = [...categoryMap.entries()].map(([category, lessons]) => {
    const sorted = [...lessons].sort((a, b) => b.confidence - a.confidence);
    const newest = [...lessons].sort((a, b) =>
      new Date(b.learned_at).getTime() - new Date(a.learned_at).getTime(),
    );
    return {
      category,
      lesson_count: lessons.length,
      top_confidence: sorted[0]!.confidence,
      latest: newest[0]!.learned_at,
      top_lesson: sorted[0]!.lesson,
    };
  });

  const topFragile = [...kb.patterns.fragile_files]
    .sort((a, b) => b.regression_count - a.regression_count)
    .slice(0, 5)
    .map((f) => ({ path: f.path, regression_count: f.regression_count }));

  return {
    last_updated: kb.last_updated,
    cycle_count: kb.cycle_count,
    total_events: kb.events.length,
    categories,
    fragile_file_count: kb.patterns.fragile_files.length,
    preference_count: kb.preferences.length,
    top_fragile_files: topFragile,
  };
}
