import type { OrganismEvent } from '../types.js';

export interface Lesson {
  id: string;
  learned_at: string;
  lesson: string;
  evidence_event_ids: string[];
  confidence: number;
  category: LessonCategory;
  times_referenced: number;
}

export type LessonCategory = 'architecture' | 'quality' | 'performance' | 'dependencies' | 'testing' | 'growth' | 'regressions';

export interface FragileFile {
  path: string;
  regression_count: number;
  last_regression: string;
  notes: string;
}

export interface Preference {
  preference: string;
  evidence_count: number;
  first_observed: string;
  last_observed: string;
}

export interface KnowledgeBase {
  created: string;
  last_updated: string;
  cycle_count: number;
  events: OrganismEvent[];
  lessons: Lesson[];
  patterns: {
    fragile_files: FragileFile[];
    rejection_reasons: Record<string, number>;
    successful_change_types: Record<string, number>;
    failed_change_types: Record<string, number>;
  };
  preferences: Preference[];
}

export interface QueryResult {
  query: string;
  results: Array<{
    type: 'event' | 'lesson' | 'pattern' | 'preference';
    content: string;
    relevance: number;
    timestamp: string;
  }>;
  total_results: number;
}
