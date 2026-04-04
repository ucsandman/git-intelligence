import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SimpleGit } from 'simple-git';
import type { DeadCodeSignal } from '../types/index.js';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.rb',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'coverage', '.git',
]);

const TEST_FILE_PATTERN = /\.(test|spec)\./;

function isExcludedPath(relativePath: string): boolean {
  const parts = relativePath.split('/');
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
    if (part === '__tests__') return true;
  }
  return false;
}

function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERN.test(filename);
}

function isSupportedExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Scan the repo for all source files using readdir with recursive option.
 * Returns relative paths (forward-slashed) from repoPath.
 */
async function getSourceFiles(repoPath: string): Promise<string[]> {
  const entries = await readdir(repoPath, {
    withFileTypes: true,
    recursive: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isSupportedExtension(entry.name)) continue;
    if (isTestFile(entry.name)) continue;

    // Build relative path from the parentPath
    const parentPath = (entry as unknown as { parentPath: string }).parentPath ?? '';
    const fullPath = path.join(parentPath, entry.name);
    const relativePath = path.relative(repoPath, fullPath).replace(/\\/g, '/');

    if (isExcludedPath(relativePath)) continue;

    files.push(relativePath);
  }

  return files;
}

/**
 * Get the last modified date for a file from git history.
 * Returns null if the file has no git history.
 */
async function getLastModified(
  git: SimpleGit,
  filepath: string,
): Promise<Date | null> {
  const raw = await git.raw(['log', '-1', '--format=%aI', '--', filepath]);
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Count how many source files import/require a given file.
 * Uses naive regex matching on the file's basename (without extension).
 */
async function countImporters(
  repoPath: string,
  targetFilepath: string,
  allSourceFiles: string[],
): Promise<number> {
  const basename = path.basename(targetFilepath).replace(/\.[^.]+$/, '');

  // Build regex patterns for import/require containing the basename
  // Match: import ... from '...<basename>...' or require('...<basename>...')
  const importPattern = new RegExp(
    `(?:import\\s.*from\\s+['"][^'"]*\\b${escapeRegex(basename)}\\b[^'"]*['"]|require\\s*\\(\\s*['"][^'"]*\\b${escapeRegex(basename)}\\b[^'"]*['"]\\s*\\))`,
  );

  let count = 0;

  for (const sourceFile of allSourceFiles) {
    // Don't count self-references
    if (sourceFile === targetFilepath) continue;

    const fullPath = path.join(repoPath, sourceFile);
    try {
      const content = await readFile(fullPath, 'utf-8');
      if (importPattern.test(content)) {
        count++;
      }
    } catch {
      // File read error — skip
    }
  }

  return count;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect potential dead code — files that haven't been modified recently
 * AND aren't imported by any other file in the project.
 */
export async function getDeadCodeSignals(
  git: SimpleGit,
  repoPath: string,
  deadMonths: number = 6,
): Promise<DeadCodeSignal[]> {
  const allSourceFiles = await getSourceFiles(repoPath);
  if (allSourceFiles.length === 0) return [];

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - deadMonths);

  // Step 1: Get last modified dates and filter to stale files
  const staleFiles: Array<{ filepath: string; lastModified: Date }> = [];

  for (const filepath of allSourceFiles) {
    const lastModified = await getLastModified(git, filepath);
    if (lastModified === null) continue; // no git history
    if (lastModified >= cutoff) continue; // recently modified

    staleFiles.push({ filepath, lastModified });
  }

  if (staleFiles.length === 0) return [];

  // Step 2: For each stale file, check if it's imported by anything
  const signals: DeadCodeSignal[] = [];

  for (const { filepath, lastModified } of staleFiles) {
    const importedByCount = await countImporters(
      repoPath,
      filepath,
      allSourceFiles,
    );

    if (importedByCount === 0) {
      signals.push({ filepath, lastModified, importedByCount });
    }
  }

  // Sort by lastModified ascending (oldest first)
  signals.sort(
    (a, b) => a.lastModified.getTime() - b.lastModified.getTime(),
  );

  return signals;
}
