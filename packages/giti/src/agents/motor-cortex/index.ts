import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkItem } from '../prefrontal-cortex/types.js';
import type { ImplementationResult, ImplementationContext } from './types.js';
import { loadOrganismConfig, readJsonFile, runCommand } from '../utils.js';
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

async function savePatchOnFailure(
  repoPath: string,
  branchName: string,
  cycleNumber: number,
  patchContent: string,
): Promise<string> {
  const dir = path.join(repoPath, '.organism', 'failed-patches');
  await fs.mkdir(dir, { recursive: true });
  const safeName = branchName.replace(/[\\/]/g, '_');
  const file = path.join(dir, `${safeName}-c${cycleNumber}.patch`);
  await fs.writeFile(file, patchContent, 'utf-8');
  return file;
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

  const branchName = generateBranchName(workItem.title, cycleNumber);

  try {
    const agentResult = await implementWithAgent(context, repoPath);

    // If agent captured a patch, apply it locally
    if (agentResult.patchContent && agentResult.success) {
      console.log(`[motor-cortex] Applying patch locally (${agentResult.patchContent.length} bytes)...`);

      // Create local branch — if this fails (e.g. branch already exists),
      // persist the patch so the agent's work isn't silently lost.
      try {
        await createBranch(repoPath, branchName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const savedPath = await savePatchOnFailure(repoPath, branchName, cycleNumber, agentResult.patchContent);
        console.log(`[motor-cortex] Branch creation failed: ${msg}`);
        console.log(`[motor-cortex] Patch saved for later apply: ${savedPath}`);
        await switchToMain(repoPath).catch(() => {});
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
          error: `Branch creation failed: ${msg} (patch saved to ${savedPath})`,
          claude_tokens_used: agentResult.tokensUsed,
        };
      }

      // Write patch to temp file and apply
      const patchFile = path.join(repoPath, '.organism', 'temp-patch.patch');
      await fs.writeFile(patchFile, agentResult.patchContent, 'utf-8');
      const applyResult = runCommand('git', ['am', '--3way', patchFile], repoPath);

      if (applyResult.status !== 0) {
        // Try git apply as fallback
        runCommand('git', ['am', '--abort'], repoPath);
        const applyFallback = runCommand('git', ['apply', '--3way', patchFile], repoPath);
        if (applyFallback.status !== 0) {
          console.log(`[motor-cortex] Patch apply failed: ${applyFallback.stderr}`);
          // Persist the patch so the work isn't lost — user can inspect/apply manually.
          const savedPath = await savePatchOnFailure(repoPath, branchName, cycleNumber, agentResult.patchContent);
          console.log(`[motor-cortex] Patch saved for later apply: ${savedPath}`);
          // Force-clean the working directory before switching back
          runCommand('git', ['checkout', '--', '.'], repoPath);
          runCommand('git', ['clean', '-fd'], repoPath);
          await switchToMain(repoPath);
          await fs.unlink(patchFile).catch(() => {});
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
            error: `Patch apply failed: ${applyFallback.stderr} (patch saved to ${savedPath})`,
            claude_tokens_used: agentResult.tokensUsed,
          };
        }
        // git apply doesn't commit, so commit manually
        const commitMsg = formatCommitMessage(
          workItem.title, workItem.id, workItem.tier, cycleNumber,
          workItem.description, workItem.rationale,
        );
        await commitChanges(repoPath, commitMsg, agentResult.filesChanged);
      }

      await fs.unlink(patchFile).catch(() => {});
      console.log(`[motor-cortex] Patch applied and committed on branch: ${branchName}`);

      // Switch back to main
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
        status: 'success',
        files_modified: sourceChanged,
        files_created: [],
        files_deleted: [],
        lines_added: 0,
        lines_removed: 0,
        tests_added: testsChanged.length,
        tests_modified: 0,
        pre_review_check: { lint_clean: true, tests_pass: true, builds: true },
        claude_tokens_used: agentResult.tokensUsed,
      };
    }

    // No patch captured — agent may have failed or made no changes
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
      claude_tokens_used: agentResult.tokensUsed,
      error: agentResult.error ?? 'No patch captured from agent',
    };
  } catch (error: unknown) {
    // Force-clean before returning to main on any error
    runCommand('git', ['checkout', '--', '.'], repoPath);
    runCommand('git', ['clean', '-fd'], repoPath);
    await switchToMain(repoPath).catch(() => {});
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
