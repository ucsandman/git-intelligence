import simpleGit from 'simple-git';
import type { CheckResult } from '../types.js';
import type { OrganismConfig } from '../../types.js';

/**
 * Mapping of forbidden_zone concept descriptions to keywords
 * that indicate a violation when found in added diff lines.
 */
const FORBIDDEN_KEYWORDS: Record<string, string[]> = {
  'modifying the target repository': ['git push', 'git commit'],
  'accessing external apis': ['fetch(', 'http.get', 'axios'],
  'collecting or transmitting user data': ['analytics', 'telemetry', 'tracking'],
  'requiring authentication': ['login', 'auth token', 'api key'],
  'adding gui or web interface': ['express', 'http.createserver', 'react', 'html'],
};

function extractAddedLines(diff: string): string {
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .join('\n')
    .toLowerCase();
}

function findForbiddenViolations(
  addedContent: string,
  forbiddenZone: string[],
): string[] {
  const violations: string[] = [];

  for (const concept of forbiddenZone) {
    const normalised = concept.toLowerCase();
    const keywords = FORBIDDEN_KEYWORDS[normalised];
    if (!keywords) continue;

    for (const keyword of keywords) {
      if (addedContent.includes(keyword.toLowerCase())) {
        violations.push(`Forbidden zone violation: "${concept}" (found "${keyword}")`);
        break; // one match per concept is enough
      }
    }
  }

  return violations;
}

function countNewDependencies(diff: string): { count: number; names: string[] } {
  const names: string[] = [];

  // Look for added lines in package.json diff that look like dependencies
  const addedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'));

  for (const line of addedLines) {
    // Match lines like:  +"some-package": "^1.0.0"
    const match = line.match(/^\+\s*"([^"]+)"\s*:\s*"\^?[~^]?\d/);
    if (match?.[1]) {
      names.push(match[1]);
    }
  }

  return { count: names.length, names };
}

export async function runBoundaryCheck(
  repoPath: string,
  branch: string,
  config: OrganismConfig,
): Promise<CheckResult> {
  const name = 'Boundary';
  const git = simpleGit(repoPath);

  // 1. Get changed files and full diff
  let changedFiles: string;
  let diffContent: string;
  try {
    changedFiles = await git.diff(['main...' + branch, '--name-only']);
    diffContent = await git.diff(['main...' + branch]);
  } catch {
    return {
      name,
      status: 'pass',
      message: 'Could not compute diff (branch may not exist yet)',
    };
  }

  if (!changedFiles.trim()) {
    return {
      name,
      status: 'pass',
      message: 'No changes detected',
    };
  }

  // 2. Check for forbidden zone violations in added lines
  const addedContent = extractAddedLines(diffContent);
  const violations = findForbiddenViolations(addedContent, config.boundaries.forbidden_zone);

  if (violations.length > 0) {
    return {
      name,
      status: 'fail',
      message: violations[0]!,
      details: { all_violations: violations },
    };
  }

  // 3. Check if package.json was modified and new dependencies added
  const fileList = changedFiles.split('\n').map((f) => f.trim());
  if (fileList.includes('package.json')) {
    const pkgDiff = await git.diff(['main...' + branch, '--', 'package.json']);
    const newDeps = countNewDependencies(pkgDiff);

    if (newDeps.count > 0) {
      return {
        name,
        status: 'warn',
        message: `${newDeps.count} new dependencies added: ${newDeps.names.join(', ')}`,
        details: { new_dependencies: newDeps.names },
      };
    }
  }

  // 4. All clear
  return {
    name,
    status: 'pass',
    message: 'No boundary violations detected',
  };
}
