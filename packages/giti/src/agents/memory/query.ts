import type { KnowledgeBase, QueryResult } from './types.js';
import { createIndex, addDocument, search, type FTSIndex } from './fts.js';

const FIELD_WEIGHTS = {
  lesson: 1.5,
  summary: 1.0,
  path: 1.0,
  preference: 1.0,
  tags: 0.8,
  notes: 0.8,
  category: 0.5,
  type: 0.5,
};

function buildIndex(kb: KnowledgeBase): FTSIndex {
  const index = createIndex(FIELD_WEIGHTS);

  for (const event of kb.events) {
    addDocument(index, {
      id: event.id,
      type: 'event',
      content: event.summary,
      timestamp: event.timestamp,
      fields: {
        summary: event.summary,
        tags: event.tags.join(' '),
        type: event.type,
      },
    });
  }

  for (const lesson of kb.lessons) {
    addDocument(index, {
      id: lesson.id,
      type: 'lesson',
      content: lesson.lesson,
      timestamp: lesson.learned_at,
      fields: {
        lesson: lesson.lesson,
        category: lesson.category,
      },
    });
  }

  for (const file of kb.patterns.fragile_files) {
    addDocument(index, {
      id: `fragile:${file.path}`,
      type: 'pattern',
      content: file.path,
      timestamp: file.last_regression,
      fields: {
        path: file.path,
        notes: file.notes,
      },
    });
  }

  for (const pref of kb.preferences) {
    addDocument(index, {
      id: `pref:${pref.preference}`,
      type: 'preference',
      content: pref.preference,
      timestamp: pref.last_observed,
      fields: {
        preference: pref.preference,
      },
    });
  }

  return index;
}

export function queryKnowledgeBase(kb: KnowledgeBase, query: string): QueryResult {
  if (!query.trim()) {
    return { query, results: [], total_results: 0 };
  }

  const index = buildIndex(kb);
  const ftsResults = search(index, query, 20);

  const results = ftsResults.map((r) => ({
    type: r.type,
    content: r.content,
    relevance: r.score,
    timestamp: r.timestamp,
  }));

  // Secondary sort: when scores are equal, prefer newer items
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) {
      return b.relevance - a.relevance;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return { query, results, total_results: results.length };
}
