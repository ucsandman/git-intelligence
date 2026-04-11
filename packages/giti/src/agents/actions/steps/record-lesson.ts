import crypto from 'node:crypto';
import { loadKnowledgeBase, saveKnowledgeBase } from '../../memory/store.js';
import type { LessonCategory } from '../../memory/types.js';
import type { RecordLessonStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const recordLessonStep: StepExecutor<RecordLessonStep> = async ({
  repoPath,
  instance,
  step,
  stepOutputs,
}) => {
  const lessonText = stepOutputs[step.lesson_from] ?? instance.bound_inputs[step.lesson_from];
  if (typeof lessonText !== 'string') {
    throw new Error(`record_lesson could not resolve string lesson content from "${step.lesson_from}"`);
  }

  const kb = await loadKnowledgeBase(repoPath);
  kb.lessons.push({
    id: crypto.randomUUID(),
    learned_at: new Date().toISOString(),
    lesson: lessonText,
    evidence_event_ids: [],
    confidence: step.confidence,
    category: step.category as LessonCategory,
    times_referenced: 0,
  });
  kb.last_updated = new Date().toISOString();
  await saveKnowledgeBase(repoPath, kb);

  return { output: { lesson: lessonText } };
};
