import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export interface TempRepo {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a fresh git repo in a temp dir with one commit.
 * Caller can run more git operations against it.
 */
export async function createTempRepo(): Promise<TempRepo> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-repo-'));

  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });

  await fs.writeFile(path.join(dir, 'README.md'), '# sample\n', 'utf-8');
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'sample', version: '0.0.1' }, null, 2),
    'utf-8',
  );
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });

  return {
    path: dir,
    cleanup: async () => {
      // Retry cleanup on Windows — in-flight git processes can briefly hold
      // file handles after a test finishes (especially after analyzer timeouts),
      // causing EBUSY/EPERM on rmdir. A short backoff is enough to let them release.
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
          return;
        } catch (err) {
          if (attempt === maxAttempts) throw err;
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        }
      }
    },
  };
}

/**
 * Add and commit a file in a temp repo with a given message (synchronous).
 */
export function commitFile(
  repoPath: string,
  relPath: string,
  content: string,
  message: string,
): void {
  const full = path.join(repoPath, relPath);
  fsSync.mkdirSync(path.dirname(full), { recursive: true });
  fsSync.writeFileSync(full, content, 'utf-8');
  execFileSync('git', ['add', relPath], { cwd: repoPath });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: repoPath });
}
