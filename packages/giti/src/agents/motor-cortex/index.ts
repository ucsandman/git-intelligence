import path from 'node:path';
import type { WorkItem } from '../prefrontal-cortex/types.js';
import type { ImplementationResult, ImplementationContext } from './types.js';
import { loadOrganismConfig, runCommand, readJsonFile } from '../utils.js';
import { loadKnowledgeBase } from '../memory/store.js';
import { implementWithAgent } from './implementer.js';
import {
  createBranch,
  commitChanges,
  switchToMain,
  generateBranchName,
  formatCommitMessage,
} from './branch-manager.js';

interface OrganismJson {
  evolutionary_principles: string[];
}

export async function runMotorCortex(
  repoPath: string,
  workItem: WorkItem,
  cycleNumber: number,
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

  // Clean working directory before starting — prevents pollution from previous agents
  runCommand('git', ['checkout', '--', '.'], repoPath);
  runCommand('git', ['clean', '-fd', '--exclude=.organism', '--exclude=node_modules', '--exclude=.next', '--exclude=dist'], repoPath);

  const branchName = generateBranchName(workItem.title);
  await createBranch(repoPath, branchName);

  try {
    const agentResult = await implementWithAgent(context, repoPath);

    if (!agentResult.success || agentResult.filesChanged.length === 0) {
      await switchToMain(repoPath);
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
        error: agentResult.error ?? 'Agent produced no changes',
        claude_tokens_used: agentResult.tokensUsed,
      };
    }

    const commitMessage = formatCommitMessage(
      workItem.title, workItem.id, workItem.tier, cycleNumber,
      workItem.description, workItem.rationale,
    );
    await commitChanges(repoPath, commitMessage, agentResult.filesChanged);

    const tscResult = runCommand('npx', ['tsc', '--noEmit'], repoPath);
    const testsResult = runCommand('npx', ['vitest', 'run'], repoPath);
    const buildResult = runCommand('npm', ['run', 'build'], repoPath);
    const preReviewCheck = {
      lint_clean: tscResult.status === 0,
      tests_pass: testsResult.status === 0,
      builds: buildResult.status === 0,
    };

    await switchToMain(repoPath);

    const testsChanged = agentResult.filesChanged.filter(
      (f) => f.includes('.test.') || f.includes('.spec.'),
    );
    const sourceChanged = agentResult.filesChanged.filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    return {
      work_item_id: workItem.id,
      branch_name: branchName,
      status: preReviewCheck.lint_clean && preReviewCheck.tests_pass && preReviewCheck.builds
        ? 'success' : 'partial',
      files_modified: sourceChanged,
      files_created: [],
      files_deleted: [],
      lines_added: 0,
      lines_removed: 0,
      tests_added: testsChanged.length,
      tests_modified: 0,
      pre_review_check: preReviewCheck,
      claude_tokens_used: agentResult.tokensUsed,
    };
  } catch (error: unknown) {
    await switchToMain(repoPath);
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
