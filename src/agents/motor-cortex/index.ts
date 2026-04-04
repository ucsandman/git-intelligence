import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkItem } from '../prefrontal-cortex/types.js';
import type { ImplementationResult, ImplementationContext, FileChange } from './types.js';
import { loadOrganismConfig, runCommand, readJsonFile } from '../utils.js';
import { loadKnowledgeBase } from '../memory/store.js';
import { implementWorkItem } from './implementer.js';
import {
  createBranch,
  commitChanges,
  switchToMain,
  generateBranchName,
  formatCommitMessage,
} from './branch-manager.js';

// Full organism.json shape — only the fields we need beyond OrganismConfig
interface OrganismJson {
  evolutionary_principles: string[];
}

async function readFileContents(
  repoPath: string,
  files: string[],
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  for (const file of files) {
    try {
      contents[file] = await fs.readFile(path.join(repoPath, file), 'utf-8');
    } catch {
      // File doesn't exist yet — that's fine for new files
    }
  }
  return contents;
}

function countChanges(
  originals: Record<string, string>,
  changes: FileChange[],
): { added: number; removed: number; testsAdded: number; testsModified: number } {
  let added = 0,
    removed = 0,
    testsAdded = 0,
    testsModified = 0;
  for (const change of changes) {
    const isTest =
      change.path.includes('.test.') || change.path.includes('.spec.');
    if (change.action === 'create') {
      added += change.content?.split('\n').length ?? 0;
      if (isTest) testsAdded++;
    } else if (change.action === 'modify' && change.content) {
      const origLines = (originals[change.path] ?? '').split('\n').length;
      const newLines = change.content.split('\n').length;
      added += Math.max(0, newLines - origLines);
      removed += Math.max(0, origLines - newLines);
      if (isTest) testsModified++;
    } else if (change.action === 'delete') {
      removed += (originals[change.path] ?? '').split('\n').length;
    }
  }
  return { added, removed, testsAdded, testsModified };
}

export async function runMotorCortex(
  repoPath: string,
  workItem: WorkItem,
  cycleNumber: number,
): Promise<ImplementationResult> {
  // Step 1: Load organism config for quality standards
  const config = await loadOrganismConfig(repoPath);

  // Load full organism.json to get evolutionary_principles (not in OrganismConfig type)
  const organismJson = await readJsonFile<OrganismJson>(
    path.join(repoPath, 'organism.json'),
  );
  const evolutionaryPrinciples = organismJson?.evolutionary_principles ?? [];

  // Step 2: Load knowledge base for relevant lessons
  const kb = await loadKnowledgeBase(repoPath);
  const memoryContextSet = new Set(workItem.memory_context);
  const relevantLessons = kb.lessons
    .filter((lesson) =>
      lesson.evidence_event_ids.some((id) => memoryContextSet.has(id)),
    )
    .map((lesson) => lesson.lesson);

  // Step 3: Read current file contents for all target files
  const currentFileContents = await readFileContents(repoPath, workItem.target_files);

  // Step 4: Build ImplementationContext
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
    current_file_contents: currentFileContents,
  };

  // Step 5: Generate branch name
  const branchName = generateBranchName(workItem.title);

  // Step 6: Create branch — after this point use try/finally to ensure we switch back
  await createBranch(repoPath, branchName);

  try {
    // Step 7: Implement — API call + apply + verify
    const { changes, tokensUsed } = await implementWorkItem(context, repoPath);

    // Step 8: Commit changes on branch
    const commitMessage = formatCommitMessage(
      workItem.title,
      workItem.id,
      workItem.tier,
      cycleNumber,
      workItem.description,
      workItem.rationale,
    );
    const changedPaths = changes.map((c) => c.path);
    await commitChanges(repoPath, commitMessage, changedPaths);

    // Step 9: Run pre-review checks
    const tscResult = runCommand('npx', ['tsc', '--noEmit'], repoPath);
    const testsResult = runCommand('npx', ['vitest', 'run'], repoPath);
    const buildResult = runCommand('npm', ['run', 'build'], repoPath);

    const preReviewCheck = {
      lint_clean: tscResult.status === 0,
      tests_pass: testsResult.status === 0,
      builds: buildResult.status === 0,
    };

    // Step 10: Switch back to main
    await switchToMain(repoPath);

    // Step 11: Count lines added/removed and test changes
    const { added, removed, testsAdded, testsModified } = countChanges(
      currentFileContents,
      changes,
    );

    // Step 12: Assemble ImplementationResult
    const filesModified = changes
      .filter((c) => c.action === 'modify')
      .map((c) => c.path);
    const filesCreated = changes
      .filter((c) => c.action === 'create')
      .map((c) => c.path);
    const filesDeleted = changes
      .filter((c) => c.action === 'delete')
      .map((c) => c.path);

    const allChecksPass =
      preReviewCheck.lint_clean &&
      preReviewCheck.tests_pass &&
      preReviewCheck.builds;

    const status: ImplementationResult['status'] = allChecksPass
      ? 'success'
      : 'partial';

    const result: ImplementationResult = {
      work_item_id: workItem.id,
      branch_name: branchName,
      status,
      files_modified: filesModified,
      files_created: filesCreated,
      files_deleted: filesDeleted,
      lines_added: added,
      lines_removed: removed,
      tests_added: testsAdded,
      tests_modified: testsModified,
      pre_review_check: preReviewCheck,
      claude_tokens_used: tokensUsed,
    };

    return result;
  } catch (error: unknown) {
    // Ensure we always return to main, even on failure
    await switchToMain(repoPath);

    const errorMessage =
      error instanceof Error ? error.message : String(error);

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
      pre_review_check: {
        lint_clean: false,
        tests_pass: false,
        builds: false,
      },
      error: errorMessage,
      claude_tokens_used: 0,
    };
  }
}
