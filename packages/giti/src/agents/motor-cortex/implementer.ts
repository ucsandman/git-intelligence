import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ImplementationContext } from './types.js';
import { runCommand } from '../utils.js';

export interface AgentImplementationResult {
  success: boolean;
  filesChanged: string[];
  tokensUsed: number;
  costUsd: number;
  turns: number;
  durationMs: number;
  summary: string;
  error?: string;
}

function buildAgentPrompt(context: ImplementationContext): string {
  const successCriteria = context.success_criteria.map((c) => `- ${c}`).join('\n');
  const principles = context.evolutionary_principles.map((p) => `- ${p}`).join('\n');
  const lessons = context.memory_lessons.length > 0
    ? context.memory_lessons.map((l) => `- ${l}`).join('\n')
    : '(none yet)';

  return `You are the Motor Cortex of a living codebase organism. Your job is to implement a single focused code change.

## Work Item: ${context.title}

${context.description}

## Success Criteria
${successCriteria}

## Quality Standards
- Max file length: ${context.quality_standards.max_file_length} lines
- Max complexity per function: ${context.quality_standards.max_complexity}
- Test coverage floor: ${context.quality_standards.test_coverage_floor}%

## Evolutionary Principles
${principles}

## Lessons from Memory
${lessons}

${context.target_files.length > 0 ? `## Target Files (start here)\n${context.target_files.join('\n')}` : '## No specific target files — explore the codebase to find the right files to change.'}

## Instructions

1. Read the relevant source files to understand the current code
2. Make the minimal changes needed to satisfy the success criteria
3. Write or update tests if the change affects behavior
4. Run \`npx vitest run\` to verify tests pass
5. If tests fail, read the error output and fix the issues

## STRICT Safety Rules — NEVER violate these
- ONLY modify files under packages/giti/src/ and packages/giti/tests/
- NEVER modify organism.json, .organism/, .claude/, docs/, .gitignore, package.json, package-lock.json
- NEVER modify anything under .next/, node_modules/, dist/
- NEVER modify files in packages/giti-observatory/ or packages/livingcode-core/
- NEVER delete test files (.test. or .spec.)
- Keep changes minimal and focused on the work item
- If you cannot complete the task within scope, stop and explain why`;
}

export async function implementWithAgent(
  context: ImplementationContext,
  repoPath: string,
): Promise<AgentImplementationResult> {
  const prompt = buildAgentPrompt(context);

  console.log(`[motor-cortex] Launching agent for: ${context.title}`);
  console.log(`[motor-cortex] Working directory: ${repoPath}`);

  let summary = '';
  let tokensUsed = 0;
  let costUsd = 0;
  let turns = 0;
  let durationMs = 0;
  let success = false;
  let error: string | undefined;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: repoPath,
        model: process.env['GITI_MODEL'] ?? 'claude-sonnet-4-6',
        pathToClaudeCodeExecutable: process.env['CLAUDE_CODE_PATH'] ?? 'claude',
        allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        maxTurns: 15,
        maxBudgetUsd: 0.50,
      },
    })) {
      if (message.type === 'result') {
        const result = message as Record<string, unknown>;
        summary = (result['result'] as string) ?? '';
        tokensUsed = ((result['usage'] as Record<string, number>)?.['inputTokens'] ?? 0)
          + ((result['usage'] as Record<string, number>)?.['outputTokens'] ?? 0);
        costUsd = (result['total_cost_usd'] as number) ?? 0;
        turns = (result['num_turns'] as number) ?? 0;
        durationMs = (result['duration_ms'] as number) ?? 0;
        success = (result['subtype'] as string) === 'success';

        if (!success) {
          error = `Agent ended with: ${result['subtype'] as string}`;
        }

        console.log(`[motor-cortex] Agent finished: ${result['subtype'] as string}, ${turns} turns, $${costUsd.toFixed(4)}, ${tokensUsed} tokens`);
      }
    }
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
    console.log(`[motor-cortex] Agent error: ${error}`);
  }

  // Detect changed files via git (only tracked source files, not .next/ or other noise)
  const gitResult = runCommand('git', ['diff', '--name-only', 'HEAD'], repoPath);
  const untrackedResult = runCommand('git', ['ls-files', '--others', '--exclude-standard'], repoPath);

  const allFiles = [
    ...gitResult.stdout.split('\n'),
    ...untrackedResult.stdout.split('\n'),
  ]
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    // Only count source files under packages/giti/
    .filter((f) => f.startsWith('packages/giti/src/') || f.startsWith('packages/giti/tests/'));

  const filesChanged = [...new Set(allFiles)];
  console.log(`[motor-cortex] Files changed: ${filesChanged.length} (${filesChanged.join(', ')})`);

  return {
    success: success && filesChanged.length > 0,
    filesChanged,
    tokensUsed,
    costUsd,
    turns,
    durationMs,
    summary,
    error: filesChanged.length === 0 && !error ? 'Agent completed but made no valid source file changes' : error,
  };
}
