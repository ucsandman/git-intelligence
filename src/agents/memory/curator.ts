import crypto from 'node:crypto';
import type { KnowledgeBase, Lesson, FragileFile, Preference } from './types.js';
import type { OrganismEvent } from '../types.js';

export function curateKnowledgeBase(kb: KnowledgeBase): KnowledgeBase {
  let result = structuredClone(kb);
  result = extractRegressionLessons(result);
  result = updateFragileFiles(result);
  result = analyzeRejectionPatterns(result);
  result = detectPreferences(result);
  return result;
}

// ── helpers ─────────────────────────────────────────────────────────

function extractFilesFromEvent(event: OrganismEvent): string[] {
  const files: string[] = [];
  const file = event.data['file'];
  const fileArray = event.data['files'];

  if (typeof file === 'string') {
    files.push(file);
  }
  if (Array.isArray(fileArray)) {
    for (const f of fileArray) {
      if (typeof f === 'string') {
        files.push(f);
      }
    }
  }
  return files;
}

function findLessonByFile(lessons: Lesson[], filepath: string): Lesson | undefined {
  return lessons.find((l) => l.lesson.includes(filepath) && l.category === 'regressions');
}

function findLessonByRejectionReason(lessons: Lesson[], reason: string): Lesson | undefined {
  return lessons.find((l) => l.lesson.includes(reason) && l.category === 'quality');
}

// ── sub-functions ───────────────────────────────────────────────────

function extractRegressionLessons(kb: KnowledgeBase): KnowledgeBase {
  const regressionEvents = kb.events.filter((e) => e.type === 'regression-detected');

  for (const event of regressionEvents) {
    const files = extractFilesFromEvent(event);
    for (const filepath of files) {
      const existing = findLessonByFile(kb.lessons, filepath);
      if (existing) {
        if (!existing.evidence_event_ids.includes(event.id)) {
          existing.confidence = Math.min(1.0, existing.confidence + 0.1);
          existing.evidence_event_ids.push(event.id);
        }
      } else {
        const lesson: Lesson = {
          id: crypto.randomUUID(),
          learned_at: new Date().toISOString(),
          lesson: `Changes to ${filepath} have caused regressions. Extra scrutiny recommended.`,
          evidence_event_ids: [event.id],
          confidence: 0.5,
          category: 'regressions',
          times_referenced: 0,
        };
        kb.lessons.push(lesson);
      }
    }
  }

  return kb;
}

function updateFragileFiles(kb: KnowledgeBase): KnowledgeBase {
  const regressionEvents = kb.events.filter((e) => e.type === 'regression-detected');
  const fileCounts = new Map<string, { count: number; lastTimestamp: string }>();

  for (const event of regressionEvents) {
    const files = extractFilesFromEvent(event);
    for (const filepath of files) {
      const entry = fileCounts.get(filepath);
      if (entry) {
        entry.count++;
        if (event.timestamp > entry.lastTimestamp) {
          entry.lastTimestamp = event.timestamp;
        }
      } else {
        fileCounts.set(filepath, { count: 1, lastTimestamp: event.timestamp });
      }
    }
  }

  const fragileFiles: FragileFile[] = [];
  for (const [filepath, { count, lastTimestamp }] of fileCounts) {
    const existing = kb.patterns.fragile_files.find((f) => f.path === filepath);
    if (existing) {
      fragileFiles.push({
        ...existing,
        regression_count: count,
        last_regression: lastTimestamp,
      });
    } else {
      fragileFiles.push({
        path: filepath,
        regression_count: count,
        last_regression: lastTimestamp,
        notes: '',
      });
    }
  }

  fragileFiles.sort((a, b) => b.regression_count - a.regression_count);
  kb.patterns.fragile_files = fragileFiles;

  return kb;
}

function analyzeRejectionPatterns(kb: KnowledgeBase): KnowledgeBase {
  const rejectionEvents = kb.events.filter((e) => e.type === 'change-rejected');
  const reasons: Record<string, number> = {};

  for (const event of rejectionEvents) {
    const reason =
      typeof event.data['reason'] === 'string' ? event.data['reason'] : event.summary;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }

  kb.patterns.rejection_reasons = reasons;

  for (const [reason, count] of Object.entries(reasons)) {
    if (count >= 5) {
      const existing = findLessonByRejectionReason(kb.lessons, reason);
      if (!existing) {
        const lesson: Lesson = {
          id: crypto.randomUUID(),
          learned_at: new Date().toISOString(),
          lesson: `Changes are frequently rejected for: ${reason}. This is the most common rejection pattern.`,
          evidence_event_ids: [],
          confidence: 0.7,
          category: 'quality',
          times_referenced: 0,
        };
        kb.lessons.push(lesson);
      }
    }
  }

  return kb;
}

function detectPreferences(kb: KnowledgeBase): KnowledgeBase {
  const mergedEvents = kb.events.filter((e) => e.type === 'change-merged');
  const tagFreq = new Map<string, { count: number; first: string; last: string }>();

  for (const event of mergedEvents) {
    for (const tag of event.tags) {
      const entry = tagFreq.get(tag);
      if (entry) {
        entry.count++;
        if (event.timestamp < entry.first) {
          entry.first = event.timestamp;
        }
        if (event.timestamp > entry.last) {
          entry.last = event.timestamp;
        }
      } else {
        tagFreq.set(tag, {
          count: 1,
          first: event.timestamp,
          last: event.timestamp,
        });
      }
    }
  }

  for (const [tag, { count, first, last }] of tagFreq) {
    if (count >= 10) {
      const existing = kb.preferences.find((p) => p.preference.includes(`'${tag}'`));
      if (existing) {
        existing.evidence_count = count;
        existing.last_observed = last;
      } else {
        const pref: Preference = {
          preference: `Prefers changes tagged with '${tag}'`,
          evidence_count: count,
          first_observed: first,
          last_observed: last,
        };
        kb.preferences.push(pref);
      }
    }
  }

  return kb;
}
