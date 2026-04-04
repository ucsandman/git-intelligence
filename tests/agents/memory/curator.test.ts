import { describe, it, expect } from 'vitest';
import {
  initKnowledgeBase,
  createEvent,
  recordEvent,
} from '../../../src/agents/memory/store.js';
import { curateKnowledgeBase } from '../../../src/agents/memory/curator.js';
import type { KnowledgeBase } from '../../../src/agents/memory/types.js';

// ── helpers ─────────────────────────────────────────────────────────

function addRegressionEvent(kb: KnowledgeBase, file: string): KnowledgeBase {
  const event = createEvent(
    'regression-detected',
    'immune-system',
    `Regression in ${file}`,
    { file },
    ['regression'],
  );
  return recordEvent(kb, event);
}

function addRegressionEventMultiFile(kb: KnowledgeBase, files: string[]): KnowledgeBase {
  const event = createEvent(
    'regression-detected',
    'immune-system',
    `Regression in ${files.join(', ')}`,
    { files },
    ['regression'],
  );
  return recordEvent(kb, event);
}

function addRejectionEvent(kb: KnowledgeBase, reason: string): KnowledgeBase {
  const event = createEvent(
    'change-rejected',
    'immune-system',
    `Rejected: ${reason}`,
    { reason },
    ['rejection'],
  );
  return recordEvent(kb, event);
}

function addMergeEvent(kb: KnowledgeBase, tags: string[]): KnowledgeBase {
  const event = createEvent(
    'change-merged',
    'motor-cortex',
    'Change merged',
    {},
    tags,
  );
  return recordEvent(kb, event);
}

// ── curateKnowledgeBase ───────────────────────────────────────────

describe('curateKnowledgeBase', () => {
  it('returns unchanged KB when no events exist', () => {
    const kb = initKnowledgeBase();
    const result = curateKnowledgeBase(kb);

    expect(result.lessons).toEqual([]);
    expect(result.patterns.fragile_files).toEqual([]);
    expect(result.patterns.rejection_reasons).toEqual({});
    expect(result.preferences).toEqual([]);
  });

  // ── extractRegressionLessons ──────────────────────────────────

  describe('regression lessons', () => {
    it('creates a lesson with confidence 0.5 for a single regression event', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEvent(kb, 'src/utils.ts');

      const result = curateKnowledgeBase(kb);

      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0]!.lesson).toContain('src/utils.ts');
      expect(result.lessons[0]!.lesson).toContain('regressions');
      expect(result.lessons[0]!.confidence).toBe(0.5);
      expect(result.lessons[0]!.category).toBe('regressions');
      expect(result.lessons[0]!.evidence_event_ids).toHaveLength(1);
    });

    it('increases confidence to 0.6 for two regression events on the same file', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEvent(kb, 'src/utils.ts');
      kb = addRegressionEvent(kb, 'src/utils.ts');

      const result = curateKnowledgeBase(kb);

      const lessons = result.lessons.filter((l) => l.lesson.includes('src/utils.ts'));
      expect(lessons).toHaveLength(1);
      expect(lessons[0]!.confidence).toBeCloseTo(0.6);
      expect(lessons[0]!.evidence_event_ids).toHaveLength(2);
    });

    it('handles events with data.files array (multiple files per regression)', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEventMultiFile(kb, ['src/a.ts', 'src/b.ts']);

      const result = curateKnowledgeBase(kb);

      const lessonA = result.lessons.find((l) => l.lesson.includes('src/a.ts'));
      const lessonB = result.lessons.find((l) => l.lesson.includes('src/b.ts'));

      expect(lessonA).toBeDefined();
      expect(lessonB).toBeDefined();
      expect(lessonA!.confidence).toBe(0.5);
      expect(lessonB!.confidence).toBe(0.5);
    });

    it('does not duplicate lessons on idempotent curation', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEvent(kb, 'src/utils.ts');

      const first = curateKnowledgeBase(kb);
      const second = curateKnowledgeBase(first);

      const lessons = second.lessons.filter((l) => l.lesson.includes('src/utils.ts'));
      expect(lessons).toHaveLength(1);
      // Confidence should not change on re-curation with same events
      expect(lessons[0]!.confidence).toBe(0.5);
    });

    it('caps confidence at 1.0', () => {
      let kb = initKnowledgeBase();
      // Add 7 regressions: 0.5 + 6*0.1 = 1.1, should cap at 1.0
      for (let i = 0; i < 7; i++) {
        kb = addRegressionEvent(kb, 'src/fragile.ts');
      }

      const result = curateKnowledgeBase(kb);

      const lessons = result.lessons.filter((l) => l.lesson.includes('src/fragile.ts'));
      expect(lessons).toHaveLength(1);
      expect(lessons[0]!.confidence).toBe(1.0);
    });
  });

  // ── updateFragileFiles ────────────────────────────────────────

  describe('fragile files', () => {
    it('adds a file to fragile_files on regression event', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEvent(kb, 'src/utils.ts');

      const result = curateKnowledgeBase(kb);

      expect(result.patterns.fragile_files).toHaveLength(1);
      expect(result.patterns.fragile_files[0]!.path).toBe('src/utils.ts');
      expect(result.patterns.fragile_files[0]!.regression_count).toBe(1);
      expect(result.patterns.fragile_files[0]!.last_regression).toBeDefined();
    });

    it('sorts fragile_files by regression_count descending', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEvent(kb, 'src/a.ts');
      kb = addRegressionEvent(kb, 'src/b.ts');
      kb = addRegressionEvent(kb, 'src/b.ts');
      kb = addRegressionEvent(kb, 'src/b.ts');
      kb = addRegressionEvent(kb, 'src/a.ts');

      const result = curateKnowledgeBase(kb);

      expect(result.patterns.fragile_files).toHaveLength(2);
      expect(result.patterns.fragile_files[0]!.path).toBe('src/b.ts');
      expect(result.patterns.fragile_files[0]!.regression_count).toBe(3);
      expect(result.patterns.fragile_files[1]!.path).toBe('src/a.ts');
      expect(result.patterns.fragile_files[1]!.regression_count).toBe(2);
    });
  });

  // ── analyzeRejectionPatterns ──────────────────────────────────

  describe('rejection patterns', () => {
    it('creates a rejection lesson when a reason has 5+ occurrences', () => {
      let kb = initKnowledgeBase();
      for (let i = 0; i < 5; i++) {
        kb = addRejectionEvent(kb, 'test coverage too low');
      }

      const result = curateKnowledgeBase(kb);

      expect(result.patterns.rejection_reasons['test coverage too low']).toBe(5);

      const lesson = result.lessons.find((l) => l.lesson.includes('test coverage too low'));
      expect(lesson).toBeDefined();
      expect(lesson!.confidence).toBe(0.7);
      expect(lesson!.category).toBe('quality');
    });

    it('does not create a lesson with fewer than 5 rejections', () => {
      let kb = initKnowledgeBase();
      for (let i = 0; i < 4; i++) {
        kb = addRejectionEvent(kb, 'missing docs');
      }

      const result = curateKnowledgeBase(kb);

      expect(result.patterns.rejection_reasons['missing docs']).toBe(4);
      const lesson = result.lessons.find((l) => l.lesson.includes('missing docs'));
      expect(lesson).toBeUndefined();
    });

    it('tallies rejection reasons correctly', () => {
      let kb = initKnowledgeBase();
      kb = addRejectionEvent(kb, 'reason-a');
      kb = addRejectionEvent(kb, 'reason-a');
      kb = addRejectionEvent(kb, 'reason-b');

      const result = curateKnowledgeBase(kb);

      expect(result.patterns.rejection_reasons['reason-a']).toBe(2);
      expect(result.patterns.rejection_reasons['reason-b']).toBe(1);
    });
  });

  // ── detectPreferences ─────────────────────────────────────────

  describe('preferences', () => {
    it('creates a preference when a tag appears 10+ times in merged events', () => {
      let kb = initKnowledgeBase();
      for (let i = 0; i < 10; i++) {
        kb = addMergeEvent(kb, ['refactor']);
      }

      const result = curateKnowledgeBase(kb);

      expect(result.preferences).toHaveLength(1);
      expect(result.preferences[0]!.preference).toContain('refactor');
      expect(result.preferences[0]!.evidence_count).toBe(10);
      expect(result.preferences[0]!.first_observed).toBeDefined();
      expect(result.preferences[0]!.last_observed).toBeDefined();
    });

    it('does not create a preference with fewer than 10 same-tag merges', () => {
      let kb = initKnowledgeBase();
      for (let i = 0; i < 9; i++) {
        kb = addMergeEvent(kb, ['feature']);
      }

      const result = curateKnowledgeBase(kb);

      expect(result.preferences).toHaveLength(0);
    });

    it('updates existing preference evidence_count and last_observed', () => {
      let kb = initKnowledgeBase();
      for (let i = 0; i < 12; i++) {
        kb = addMergeEvent(kb, ['bugfix']);
      }

      const first = curateKnowledgeBase(kb);
      expect(first.preferences).toHaveLength(1);
      expect(first.preferences[0]!.evidence_count).toBe(12);

      // Add more events and re-curate
      for (let i = 0; i < 3; i++) {
        first.events.push(
          createEvent('change-merged', 'motor-cortex', 'Change merged', {}, ['bugfix']),
        );
      }

      const second = curateKnowledgeBase(first);
      expect(second.preferences).toHaveLength(1);
      expect(second.preferences[0]!.evidence_count).toBe(15);
    });
  });
});
