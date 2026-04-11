import { evaluatePredicateStep } from './evaluate-predicate.js';
import { generateArtifactStep } from './generate-artifact.js';
import { queryMemoryStep } from './query-memory.js';
import { readRepoStateStep } from './read-repo-state.js';
import { recordEventStep } from './record-event.js';
import { recordLessonStep } from './record-lesson.js';
import { selectTargetsStep } from './select-targets.js';
import type { ActionStep, ActionStepType } from '../types.js';
import type { StepExecutor } from './types.js';
import { writeArtifactStep } from './write-artifact.js';

const stepExecutors: Partial<Record<ActionStepType, StepExecutor<ActionStep>>> = {
  read_repo_state: readRepoStateStep as StepExecutor<ActionStep>,
  query_memory: queryMemoryStep as StepExecutor<ActionStep>,
  evaluate_predicate: evaluatePredicateStep as StepExecutor<ActionStep>,
  select_targets: selectTargetsStep as StepExecutor<ActionStep>,
  generate_artifact: generateArtifactStep as StepExecutor<ActionStep>,
  write_artifact: writeArtifactStep as StepExecutor<ActionStep>,
  record_event: recordEventStep as StepExecutor<ActionStep>,
  record_lesson: recordLessonStep as StepExecutor<ActionStep>,
};

export function getStepExecutor(type: ActionStepType): StepExecutor<ActionStep> | undefined {
  return stepExecutors[type];
}
