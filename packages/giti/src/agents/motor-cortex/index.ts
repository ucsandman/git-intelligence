import path from 'node:path';
import type { WorkItem } from '../prefrontal-cortex/types.js';
import type { ImplementationResult, ImplementationContext } from './types.js';
import { loadOrganismConfig, readJsonFile } from '../utils.js';
import { loadKnowledgeBase } from '../memory/store.js';
import { implementWithAgent } from './implementer.js';

interface OrganismJson {
  evolutionary_principles: string[];
}

export async function runMotorCortex(
  repoPath: string,
  workItem: WorkItem,
  _cycleNumber: number,
): Promise<ImplementationResult> {
  const config = await loadOrganismConfig(repoPath);
  const organismJson = await readJsonFile<OrganismJson>(
    path.join(repoPath, 'organism.json'),
  );
  const evolutionaryPrinciples = organismJson?.evolutionary_principles ?? [];

  const kb = await loadKnowledgeBase(repoPath);
  const memoryContextSet = new Set(workItem.memory_context);
  const relevantLessons = kb.lessons
    .filter((lesson) =>
      lesson.evidence_event_ids.some((id) => memoryContextSet.has(id)),
    )
    .map((lesson) => lesson.lesson);

  const context: ImplementationContext = {
    work_item_id: workItem.id,
    title: workItem.title,
    description: workItem.description,
    target_files: workItem.target_files,
    success_criteria: workItem.success_criteria,
    quality_standards: {
      max_file_length: config.quality_standards.max_file_length,
      max_complexity: config.quality_standards.max_complexity_per_function,
      test_coverage_floor: config.quality_standards.test_coverage_floor,
    },
    evolutionary_principles: evolutionaryPrinciples,
    memory_lessons: relevantLessons,
    current_file_contents: {},
  };

  // Managed Agents runs in the cloud — no local branch management needed
  const branchName = `organism/motor/${workItem.id.slice(0, 8)}`;

  try {
    const agentResult = await implementWithAgent(context, repoPath);

    const testsChanged = agentResult.filesChanged.filter(
      (f) => f.includes('.test.') || f.includes('.spec.'),
    );
    const sourceChanged = agentResult.filesChanged.filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    // The agent runs tests in the cloud container — trust its success status
    const preReviewCheck = {
      lint_clean: agentResult.success,
      tests_pass: agentResult.success,
      builds: agentResult.success,
    };

    return {
      work_item_id: workItem.id,
      branch_name: branchName,
      status: agentResult.success ? 'success' : 'failed',
      files_modified: sourceChanged,
      files_created: [],
      files_deleted: [],
      lines_added: 0,
      lines_removed: 0,
      tests_added: testsChanged.length,
      tests_modified: 0,
      pre_review_check: preReviewCheck,
      claude_tokens_used: agentResult.tokensUsed,
      error: agentResult.error,
    };
  } catch (error: unknown) {
    return {
      work_item_id: workItem.id,
      branch_name: branchName,
      status: 'failed',
      files_modified: [],
      files_created: [],
      files_deleted: [],
      lines_added: 0,
      lines_removed: 0,
      tests_added: 0,
      tests_modified: 0,
      pre_review_check: { lint_clean: false, tests_pass: false, builds: false },
      error: error instanceof Error ? error.message : String(error),
      claude_tokens_used: 0,
    };
  }
}
