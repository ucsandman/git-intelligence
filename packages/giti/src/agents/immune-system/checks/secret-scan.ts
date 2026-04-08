import simpleGit from 'simple-git';
import type { CheckResult } from '../types.js';

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret|secret_key|secretkey)\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]/ },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: 'GitHub Token', pattern: /gh[pous]_[A-Za-z0-9_]{36,}/ },
  { name: 'Slack Token', pattern: /xox[baprs]-[A-Za-z0-9\-]{10,}/ },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: 'Generic Secret', pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i },
  { name: 'Auth Token', pattern: /(?:bearer|token|auth)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{20,}['"]/i },
  { name: 'URL Password', pattern: /:\/\/[^:]+:[^@\s]+@/ },
];

function extractAddedLines(diff: string): string[] {
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'));
}

function maskSecret(match: string): string {
  if (match.length <= 8) {
    return '***';
  }
  return match.slice(0, 4) + '***' + match.slice(-4);
}

export async function runSecretScan(
  repoPath: string,
  branch: string,
): Promise<CheckResult> {
  const name = 'Secrets';
  const git = simpleGit(repoPath);

  let diffContent: string;
  try {
    diffContent = await git.diff(['main...' + branch]);
  } catch {
    return {
      name,
      status: 'pass',
      message: 'Could not compute diff',
    };
  }

  if (!diffContent.trim()) {
    return {
      name,
      status: 'pass',
      message: 'No changes to scan',
    };
  }

  const addedLines = extractAddedLines(diffContent);

  for (const line of addedLines) {
    for (const { name: patternName, pattern } of SECRET_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        return {
          name,
          status: 'fail',
          message: `Potential secret detected: ${patternName}`,
          details: {
            pattern_name: patternName,
            masked_match: maskSecret(match[0]),
          },
        };
      }
    }
  }

  return {
    name,
    status: 'pass',
    message: 'No secrets detected',
  };
}
