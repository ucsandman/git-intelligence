import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ImplementationContext, FileChange } from './types.js';
import { runCommand } from '../utils.js';

const FORBIDDEN_PATHS = ['organism.json', '.organism'];
const MAX_API_CALLS = 2;

function validateChange(change: FileChange): void {
  for (const forbidden of FORBIDDEN_PATHS) {
    if (
      change.path === forbidden ||
      change.path.startsWith(forbidden + '/') ||
      change.path.startsWith(forbidden + '\\')
    ) {
      throw new Error(`Cannot modify forbidden path: ${change.path}`);
    }
  }
  if (change.action === 'delete' && (change.path.includes('.test.') || change.path.includes('.spec.'))) {
    throw new Error(`Cannot delete test file: ${change.path}`);
  }
}

export function buildPrompt(context: ImplementationContext): string {
  const fileContents = Object.entries(context.current_file_contents)
    .map(([filePath, content]) => `### ${filePath}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  const successCriteria = context.success_criteria.map((c) => `- ${c}`).join('\n');
  const principles = context.evolutionary_principles.map((p) => `- ${p}`).join('\n');
  const lessons = context.memory_lessons.map((l) => `- ${l}`).join('\n');

  return `You are implementing a code change for the following work item.

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

## Current File Contents
${fileContents}

## Target Files
${context.target_files.join(', ')}

Respond with ONLY a JSON code block containing the file changes:
\`\`\`json
[
  { "path": "src/file.ts", "action": "modify", "content": "...full new content..." },
  { "path": "tests/file.test.ts", "action": "modify", "content": "...full new content..." }
]
\`\`\``;
}

export function parseResponse(text: string): FileChange[] {
  let json: string | undefined;

  // Try extracting from code block first
  const codeBlockMatch = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(text);
  if (codeBlockMatch?.[1]) {
    json = codeBlockMatch[1];
  } else {
    // Try plain JSON
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) {
      json = trimmed;
    }
  }

  if (!json) {
    return [];
  }

  let changes: FileChange[];
  try {
    changes = JSON.parse(json) as FileChange[];
  } catch {
    return [];
  }

  if (!Array.isArray(changes)) {
    return [];
  }

  for (const change of changes) {
    validateChange(change);
  }

  return changes;
}

export async function applyChanges(repoPath: string, changes: FileChange[]): Promise<void> {
  for (const change of changes) {
    validateChange(change);
    const fullPath = path.join(repoPath, change.path);

    if (change.action === 'modify' || change.action === 'create') {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, change.content ?? '', 'utf-8');
    } else if (change.action === 'delete') {
      await fs.unlink(fullPath);
    }
  }
}

export async function revertChanges(
  repoPath: string,
  changes: FileChange[],
  originals: Record<string, string>,
): Promise<void> {
  for (const change of changes) {
    const fullPath = path.join(repoPath, change.path);

    if (change.action === 'create') {
      try {
        await fs.unlink(fullPath);
      } catch {
        // File may not exist if apply partially failed
      }
    } else if (change.action === 'modify') {
      const original = originals[change.path];
      if (original !== undefined) {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, original, 'utf-8');
      }
    } else if (change.action === 'delete') {
      const original = originals[change.path];
      if (original !== undefined) {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, original, 'utf-8');
      }
    }
  }
}

export async function implementWorkItem(
  context: ImplementationContext,
  repoPath: string,
): Promise<{ changes: FileChange[]; tokensUsed: number }> {
  const client = new Anthropic();
  let tokensUsed = 0;
  let lastError = '';

  for (let attempt = 0; attempt < MAX_API_CALLS; attempt++) {
    const prompt =
      attempt === 0
        ? buildPrompt(context)
        : `${buildPrompt(context)}\n\n## Previous Attempt Failed\nThe previous attempt produced errors:\n${lastError}\n\nPlease fix these issues and try again.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const usage = response.usage;
    tokensUsed += usage.input_tokens + usage.output_tokens;

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      lastError = 'No text content in API response';
      continue;
    }

    const changes = parseResponse(textBlock.text);
    if (changes.length === 0) {
      lastError = 'Could not parse any file changes from response';
      continue;
    }

    // Save originals for potential revert
    const originals: Record<string, string> = {};
    for (const change of changes) {
      if (change.action === 'modify' || change.action === 'delete') {
        try {
          originals[change.path] = await fs.readFile(
            path.join(repoPath, change.path),
            'utf-8',
          );
        } catch {
          // File may not exist
        }
      }
    }

    await applyChanges(repoPath, changes);

    // Verify with tsc
    const tscResult = runCommand('npx', ['tsc', '--noEmit'], repoPath);
    if (tscResult.status !== 0) {
      lastError = `TypeScript compilation failed:\n${tscResult.stderr || tscResult.stdout}`;
      await revertChanges(repoPath, changes, originals);
      continue;
    }

    // Verify with vitest
    const testResult = runCommand('npx', ['vitest', 'run'], repoPath);
    if (testResult.status !== 0) {
      lastError = `Tests failed:\n${testResult.stderr || testResult.stdout}`;
      await revertChanges(repoPath, changes, originals);
      continue;
    }

    return { changes, tokensUsed };
  }

  throw new Error(`Implementation failed after ${MAX_API_CALLS} attempts`);
}
