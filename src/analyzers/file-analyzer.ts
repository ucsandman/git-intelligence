import type { SimpleGit } from 'simple-git';
import type { HotspotEntry, CouplingPair } from '../types/index.js';

const BUG_FIX_PATTERN = /\b(fix|bug|patch|resolve|revert)\b/i;

interface ParsedCommit {
  hash: string;
  author: string;
  message: string;
  files: string[];
}

function parseGitLog(raw: string): ParsedCommit[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  const blocks = trimmed.split('\n\n');
  const commits: ParsedCommit[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;

    const headerLine = lines[0]!;
    const pipeIndex = headerLine.indexOf('|');
    if (pipeIndex === -1) continue;

    const hash = headerLine.slice(0, pipeIndex);
    const rest = headerLine.slice(pipeIndex + 1);
    const secondPipe = rest.indexOf('|');
    if (secondPipe === -1) continue;

    const author = rest.slice(0, secondPipe);
    const message = rest.slice(secondPipe + 1);
    const files = lines.slice(1).map((f) => f.trim()).filter((f) => f.length > 0);

    if (files.length > 0) {
      commits.push({ hash, author, message, files });
    }
  }

  return commits;
}

export async function getHotspots(
  git: SimpleGit,
  since: Date,
  top: number = 10,
): Promise<HotspotEntry[]> {
  const raw = await git.raw([
    'log',
    `--since=${since.toISOString()}`,
    '--name-only',
    '--pretty=format:%H|%an|%s',
    '--',
  ]);

  const commits = parseGitLog(raw);
  if (commits.length === 0) return [];

  const fileStats = new Map<
    string,
    { changes: number; authors: Set<string>; bugFixes: number }
  >();

  for (const commit of commits) {
    const isBugFix = BUG_FIX_PATTERN.test(commit.message);

    for (const file of commit.files) {
      let stats = fileStats.get(file);
      if (!stats) {
        stats = { changes: 0, authors: new Set(), bugFixes: 0 };
        fileStats.set(file, stats);
      }
      stats.changes++;
      stats.authors.add(commit.author);
      if (isBugFix) {
        stats.bugFixes++;
      }
    }
  }

  const entries: HotspotEntry[] = [...fileStats.entries()].map(
    ([filepath, stats]) => ({
      filepath,
      changes: stats.changes,
      authors: stats.authors.size,
      bugFixes: stats.bugFixes,
    }),
  );

  entries.sort((a, b) => b.changes - a.changes);

  return entries.slice(0, top);
}

export async function getFileCouplings(
  git: SimpleGit,
  since: Date,
): Promise<CouplingPair[]> {
  const raw = await git.raw([
    'log',
    `--since=${since.toISOString()}`,
    '--name-only',
    '--pretty=format:%H|%an|%s',
    '--',
  ]);

  const commits = parseGitLog(raw);
  if (commits.length === 0) return [];

  // Track total changes per file
  const fileCounts = new Map<string, number>();
  // Track co-occurrences for each pair (key = sorted "fileA\0fileB")
  const coOccurrences = new Map<string, number>();

  for (const commit of commits) {
    const files = commit.files;

    for (const file of files) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }

    // Build pairs from this commit's files
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const pair = [files[i]!, files[j]!].sort();
        const key = pair.join('\0');
        coOccurrences.set(key, (coOccurrences.get(key) ?? 0) + 1);
      }
    }
  }

  const result: CouplingPair[] = [];

  for (const [key, count] of coOccurrences) {
    const [fileA, fileB] = key.split('\0') as [string, string];
    const changesA = fileCounts.get(fileA) ?? 0;
    const changesB = fileCounts.get(fileB) ?? 0;

    // Both files must have at least 5 individual changes
    if (changesA < 5 || changesB < 5) continue;

    const minChanges = Math.min(changesA, changesB);
    const percentage = (count / minChanges) * 100;

    // Must co-occur more than 60% of the time
    if (percentage <= 60) continue;

    result.push({
      fileA,
      fileB,
      percentage,
      coOccurrences: count,
    });
  }

  result.sort((a, b) => b.percentage - a.percentage);

  return result;
}
