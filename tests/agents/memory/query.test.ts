import { describe, it, expect } from 'vitest';
import {
  initKnowledgeBase,
  createEvent,
  recordEvent,
} from '../../../src/agents/memory/store.js';
import { queryKnowledgeBase } from '../../../src/agents/memory/query.js';
import type { KnowledgeBase, Lesson, FragileFile, Preference, QueryResult } from '../../../src/agents/memory/types.js';

// ── helpers ─────────────────────────────────────────────────────────

function addEvent(
  kb: KnowledgeBase,
  summary: string,
  tags: string[] = [],
  type: 'change-merged' | 'regression-detected' | 'change-rejected' = 'change-merged',
): KnowledgeBase {
  const event = createEvent(type, 'memory', summary, {}, tags);
  return recordEvent(kb, event);
}

function addLesson(kb: KnowledgeBase, lesson: string, category: Lesson['category'] = 'quality', confidence = 0.8): KnowledgeBase {
  const l: Lesson = {
    id: crypto.randomUUID(),
    learned_at: new Date().toISOString(),
    lesson,
    evidence_event_ids: [],
    confidence,
    category,
    times_referenced: 0,
  };
  return { ...kb, lessons: [...kb.lessons, l] };
}

function addFragileFile(kb: KnowledgeBase, filePath: string, notes: string): KnowledgeBase {
  const f: FragileFile = {
    path: filePath,
    regression_count: 2,
    last_regression: new Date().toISOString(),
    notes,
  };
  return {
    ...kb,
    patterns: {
      ...kb.patterns,
      fragile_files: [...kb.patterns.fragile_files, f],
    },
  };
}

function addPreference(kb: KnowledgeBase, preference: string): KnowledgeBase {
  const p: Preference = {
    preference,
    evidence_count: 5,
    first_observed: new Date().toISOString(),
    last_observed: new Date().toISOString(),
  };
  return { ...kb, preferences: [...kb.preferences, p] };
}

// ── queryKnowledgeBase ──────────────────────────────────────────────

describe('queryKnowledgeBase', () => {
  it('returns empty results for an empty query string', () => {
    const kb = initKnowledgeBase();
    const result = queryKnowledgeBase(kb, '');

    expect(result.query).toBe('');
    expect(result.results).toEqual([]);
    expect(result.total_results).toBe(0);
  });

  it('returns empty results when query has only short words (< 3 chars)', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Regression in analyzer');

    const result = queryKnowledgeBase(kb, 'a in to');

    expect(result.results).toEqual([]);
    expect(result.total_results).toBe(0);
  });

  it('returns empty results when no items match', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Regression detected in commit analyzer');

    const result = queryKnowledgeBase(kb, 'performance optimization');

    expect(result.results).toEqual([]);
    expect(result.total_results).toBe(0);
  });

  it('matches event summary and returns event type', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Regression detected in commit analyzer', ['regression']);

    const result = queryKnowledgeBase(kb, 'commit analyzer');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('event');
    expect(result.results[0]!.content).toBe('Regression detected in commit analyzer');
    expect(result.results[0]!.relevance).toBeGreaterThan(0);
    expect(result.results[0]!.timestamp).toBeDefined();
  });

  it('matches event tags', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Something happened', ['regression', 'hotspot']);

    const result = queryKnowledgeBase(kb, 'hotspot');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('event');
  });

  it('matches event type', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Test coverage dropped', [], 'regression-detected');

    const result = queryKnowledgeBase(kb, 'regression');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('event');
  });

  it('matches lesson text and returns lesson type', () => {
    let kb = initKnowledgeBase();
    kb = addLesson(kb, 'Changes to commit-analyzer.ts frequently cause test failures');

    const result = queryKnowledgeBase(kb, 'commit analyzer');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('lesson');
    expect(result.results[0]!.content).toContain('commit-analyzer.ts');
    expect(result.results[0]!.relevance).toBeGreaterThan(0);
  });

  it('matches lesson category', () => {
    let kb = initKnowledgeBase();
    kb = addLesson(kb, 'Some insight about code', 'performance');

    const result = queryKnowledgeBase(kb, 'performance');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('lesson');
  });

  it('matches fragile file path and returns pattern type', () => {
    let kb = initKnowledgeBase();
    kb = addFragileFile(kb, 'src/analyzers/commit-analyzer.ts', 'Frequently regresses');

    const result = queryKnowledgeBase(kb, 'commit analyzer');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('pattern');
    expect(result.results[0]!.content).toContain('src/analyzers/commit-analyzer.ts');
  });

  it('matches fragile file notes', () => {
    let kb = initKnowledgeBase();
    kb = addFragileFile(kb, 'src/utils.ts', 'Frequently regresses after dependency updates');

    const result = queryKnowledgeBase(kb, 'dependency updates');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('pattern');
  });

  it('matches preference text and returns preference type', () => {
    let kb = initKnowledgeBase();
    kb = addPreference(kb, 'Prefers small focused changes');

    const result = queryKnowledgeBase(kb, 'small focused changes');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.type).toBe('preference');
    expect(result.results[0]!.content).toContain('Prefers small focused changes');
  });

  it('sorts results by relevance descending', () => {
    let kb = initKnowledgeBase();
    // This event matches 1 of 2 keywords → 0.5 relevance
    kb = addEvent(kb, 'Performance metrics collected');
    // This lesson matches 2 of 2 keywords → 1.0 relevance
    kb = addLesson(kb, 'Performance regression detected after changes');

    const result = queryKnowledgeBase(kb, 'performance regression');

    expect(result.results.length).toBeGreaterThanOrEqual(2);
    expect(result.results[0]!.relevance).toBeGreaterThanOrEqual(result.results[1]!.relevance);
  });

  it('sorts by timestamp descending when relevance is equal', () => {
    let kb = initKnowledgeBase();

    // Add two events with same keyword match potential but different timestamps
    const oldEvent = createEvent('change-merged', 'memory', 'Analyzer update completed', {}, []);
    // Override timestamp to be older
    (oldEvent as { timestamp: string }).timestamp = '2026-01-01T00:00:00.000Z';
    kb = recordEvent(kb, oldEvent);

    const newEvent = createEvent('change-merged', 'memory', 'Analyzer performance improved', {}, []);
    (newEvent as { timestamp: string }).timestamp = '2026-04-01T00:00:00.000Z';
    kb = recordEvent(kb, newEvent);

    const result = queryKnowledgeBase(kb, 'analyzer');

    expect(result.results).toHaveLength(2);
    // Both have same relevance (1 of 1 keyword), newer should come first
    expect(result.results[0]!.relevance).toBe(result.results[1]!.relevance);
    expect(new Date(result.results[0]!.timestamp).getTime())
      .toBeGreaterThanOrEqual(new Date(result.results[1]!.timestamp).getTime());
  });

  it('filters out words shorter than 3 characters from query', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Regression in the commit analyzer');

    // "in" and "the" should be filtered, only "commit" and "analyzer" used
    const result = queryKnowledgeBase(kb, 'in the commit analyzer');

    expect(result.results).toHaveLength(1);
    // Relevance should be based on 2 keywords (commit, analyzer), not 4
    expect(result.results[0]!.relevance).toBe(1.0);
  });

  it('returns max 20 results', () => {
    let kb = initKnowledgeBase();
    // Add 25 events that all match
    for (let i = 0; i < 25; i++) {
      kb = addEvent(kb, `Performance issue number ${i}`);
    }

    const result = queryKnowledgeBase(kb, 'performance issue');

    expect(result.results).toHaveLength(20);
    expect(result.total_results).toBe(20);
  });

  it('calculates relevance correctly (2 of 3 keywords match -> ~0.67)', () => {
    let kb = initKnowledgeBase();
    // "analyzer" and "performance" match, but "security" does not
    kb = addEvent(kb, 'Performance analyzer results');

    const result = queryKnowledgeBase(kb, 'analyzer performance security');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.relevance).toBeCloseTo(2 / 3, 2);
  });

  it('only includes items with relevance > 0', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'Commit analyzer regression');
    kb = addEvent(kb, 'Completely unrelated event about cooking');

    const result = queryKnowledgeBase(kb, 'analyzer regression');

    // Only the first event matches
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.content).toContain('analyzer');
  });

  it('performs case-insensitive matching', () => {
    let kb = initKnowledgeBase();
    kb = addEvent(kb, 'REGRESSION detected in ANALYZER');

    const result = queryKnowledgeBase(kb, 'regression analyzer');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.relevance).toBe(1.0);
  });

  it('uses learned_at as timestamp for lessons', () => {
    let kb = initKnowledgeBase();
    const learnedAt = '2026-03-15T10:00:00.000Z';
    const lesson: Lesson = {
      id: crypto.randomUUID(),
      learned_at: learnedAt,
      lesson: 'Important architectural lesson about modules',
      evidence_event_ids: [],
      confidence: 0.9,
      category: 'architecture',
      times_referenced: 0,
    };
    kb = { ...kb, lessons: [lesson] };

    const result = queryKnowledgeBase(kb, 'architectural modules');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.timestamp).toBe(learnedAt);
  });

  it('uses last_regression as timestamp for fragile files', () => {
    let kb = initKnowledgeBase();
    const lastRegression = '2026-03-20T12:00:00.000Z';
    const fragile: FragileFile = {
      path: 'src/critical-module.ts',
      regression_count: 3,
      last_regression: lastRegression,
      notes: 'Frequently breaks',
    };
    kb = {
      ...kb,
      patterns: { ...kb.patterns, fragile_files: [fragile] },
    };

    const result = queryKnowledgeBase(kb, 'critical module');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.timestamp).toBe(lastRegression);
  });

  it('uses last_observed as timestamp for preferences', () => {
    let kb = initKnowledgeBase();
    const lastObserved = '2026-04-01T08:00:00.000Z';
    const pref: Preference = {
      preference: 'Prefers minimal dependency footprint',
      evidence_count: 7,
      first_observed: '2026-01-01T00:00:00.000Z',
      last_observed: lastObserved,
    };
    kb = { ...kb, preferences: [pref] };

    const result = queryKnowledgeBase(kb, 'minimal dependency');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.timestamp).toBe(lastObserved);
  });
});
