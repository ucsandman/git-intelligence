import type { KnowledgeBase, QueryResult } from './types.js';

interface ScoredItem {
  type: 'event' | 'lesson' | 'pattern' | 'preference';
  content: string;
  relevance: number;
  timestamp: string;
}

export function queryKnowledgeBase(kb: KnowledgeBase, query: string): QueryResult {
  const keywords = query
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3);

  if (keywords.length === 0) {
    return { query, results: [], total_results: 0 };
  }

  const scored: ScoredItem[] = [];

  // Score events
  for (const event of kb.events) {
    const searchText = [event.summary, event.tags.join(' '), event.type].join(' ').toLowerCase();
    const matchCount = keywords.filter((kw) => searchText.includes(kw)).length;
    const relevance = matchCount / keywords.length;
    if (relevance > 0) {
      scored.push({
        type: 'event',
        content: event.summary,
        relevance,
        timestamp: event.timestamp,
      });
    }
  }

  // Score lessons
  for (const lesson of kb.lessons) {
    const searchText = [lesson.lesson, lesson.category].join(' ').toLowerCase();
    const matchCount = keywords.filter((kw) => searchText.includes(kw)).length;
    const relevance = matchCount / keywords.length;
    if (relevance > 0) {
      scored.push({
        type: 'lesson',
        content: lesson.lesson,
        relevance,
        timestamp: lesson.learned_at,
      });
    }
  }

  // Score fragile files
  for (const file of kb.patterns.fragile_files) {
    const searchText = [file.path, file.notes].join(' ').toLowerCase();
    const matchCount = keywords.filter((kw) => searchText.includes(kw)).length;
    const relevance = matchCount / keywords.length;
    if (relevance > 0) {
      scored.push({
        type: 'pattern',
        content: file.path,
        relevance,
        timestamp: file.last_regression,
      });
    }
  }

  // Score preferences
  for (const pref of kb.preferences) {
    const searchText = pref.preference.toLowerCase();
    const matchCount = keywords.filter((kw) => searchText.includes(kw)).length;
    const relevance = matchCount / keywords.length;
    if (relevance > 0) {
      scored.push({
        type: 'preference',
        content: pref.preference,
        relevance,
        timestamp: pref.last_observed,
      });
    }
  }

  // Sort by relevance desc, then timestamp desc
  scored.sort((a, b) => {
    if (b.relevance !== a.relevance) {
      return b.relevance - a.relevance;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Take top 20
  const results = scored.slice(0, 20);

  return {
    query,
    results,
    total_results: results.length,
  };
}
