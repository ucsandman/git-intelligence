# Sprint 0: giti Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working `giti` CLI with three commands (pulse, hotspots, ghosts) that analyze any git repository and surface intelligence.

**Architecture:** Thin command layer calls pure analyzer functions, pipes results through a formatter. All git access goes through a single wrapper (`src/utils/git.ts`). Each analyzer is independently testable by mocking git responses. Commands accept `--json` and `--path` flags.

**Tech Stack:** TypeScript (strict, ESM), tsup, vitest, commander, simple-git, chalk, ora

---

## Pre-existing Files (DO NOT recreate)

These files already exist and are correct:
- `package.json` — needs dependencies added
- `tsconfig.json` — strict mode, ESM, bundler resolution
- `tsup.config.ts` — ESM output, node18 target, shebang banner
- `vitest.config.ts` — v8 coverage, 80% thresholds, 30s timeout
- `.gitignore` — node_modules, dist, coverage, .env
- `living-codebase-architecture.md` — architecture doc (source of truth)

## File Map

### Types & Utilities (foundation — no dependencies on other src files)
- **Create:** `src/types/index.ts` — All shared interfaces (PulseResult, HotspotResult, GhostResult, etc.)
- **Create:** `src/utils/time.ts` — `formatRelativeTime(date: Date): string`
- **Create:** `src/utils/git.ts` — `createGitClient(path?: string)` wrapper around simple-git

### Analyzers (pure functions — depend on types, called by commands)
- **Create:** `src/analyzers/commit-analyzer.ts` — commit stats, author stats, bus factor
- **Create:** `src/analyzers/branch-analyzer.ts` — branch listing, staleness detection
- **Create:** `src/analyzers/file-analyzer.ts` — file change frequency, coupling detection
- **Create:** `src/analyzers/code-analyzer.ts` — dead code signals via import scanning

### Formatters (presentation — depend on types)
- **Create:** `src/formatters/terminal.ts` — chalk-formatted output for all three commands

### Commands (thin orchestrators — depend on analyzers + formatters)
- **Create:** `src/commands/pulse.ts` — pulse command handler
- **Create:** `src/commands/hotspots.ts` — hotspots command handler
- **Create:** `src/commands/ghosts.ts` — ghosts command handler

### Entry Point
- **Create:** `src/index.ts` — commander setup, registers all commands

### Tests
- **Create:** `tests/utils/time.test.ts`
- **Create:** `tests/utils/git.test.ts`
- **Create:** `tests/analyzers/commit-analyzer.test.ts`
- **Create:** `tests/analyzers/branch-analyzer.test.ts`
- **Create:** `tests/analyzers/file-analyzer.test.ts`
- **Create:** `tests/analyzers/code-analyzer.test.ts`
- **Create:** `tests/formatters/terminal.test.ts`
- **Create:** `tests/commands/pulse.test.ts`
- **Create:** `tests/commands/hotspots.test.ts`
- **Create:** `tests/commands/ghosts.test.ts`
- **Create:** `tests/fixtures/README.md`

### Root Files
- **Create:** `organism.json` — DNA manifest from architecture doc
- **Create:** `CLAUDE.md` — project-level instructions
- **Create:** `README.md` — user-facing docs
- **Create:** `LICENSE` — MIT
- **Create:** `.env.example` — empty placeholder
- **Create:** `tasks/todo.md` — sprint tracking
- **Create:** `tasks/lessons.md` — session lessons

---

## Task 1: Install Dependencies and Project Scaffolding

**Files:**
- Modify: `package.json` (add dependencies)
- Create: `organism.json`
- Create: `CLAUDE.md`
- Create: `.env.example`
- Create: `tasks/todo.md`
- Create: `tasks/lessons.md`
- Create: `LICENSE`
- Create: `tests/fixtures/README.md`

- [ ] **Step 1: Install all dependencies**

```bash
cd C:/Projects/git-intelligence
npm install commander simple-git chalk ora
npm install -D typescript tsup vitest @vitest/coverage-v8 @types/node
```

- [ ] **Step 2: Create organism.json**

Copy the exact JSON block from `living-codebase-architecture.md` lines 99-165 into `organism.json`.

- [ ] **Step 3: Create scaffolding files**

Create `CLAUDE.md`, `.env.example`, `tasks/todo.md`, `tasks/lessons.md`, `LICENSE` (MIT, 2026, ucsandman), `tests/fixtures/README.md`.

- [ ] **Step 4: Verify build toolchain works**

```bash
npx tsc --noEmit  # should succeed (no src files yet, that's fine)
npm test          # should pass (no tests yet)
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json organism.json CLAUDE.md .env.example tasks/ tests/fixtures/ LICENSE .gitignore tsconfig.json tsup.config.ts vitest.config.ts living-codebase-architecture.md
git commit -m "chore: scaffold project with dependencies and config"
```

---

## Task 2: Types and Utilities

**Files:**
- Create: `src/types/index.ts`
- Create: `src/utils/time.ts`
- Create: `src/utils/git.ts`
- Test: `tests/utils/time.test.ts`
- Test: `tests/utils/git.test.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

All interfaces used across the codebase:

```typescript
export interface PulseResult {
  repoName: string;
  lastCommit: {
    date: Date;
    message: string;
    author: string;
  };
  weeklyCommits: {
    count: number;
    authorCount: number;
  };
  branches: {
    active: number;
    stale: number;
  };
  hottestFile: {
    path: string;
    changeCount: number;
  } | null;
  testRatio: {
    testFiles: number;
    sourceFiles: number;
    percentage: number;
  };
  avgCommitSize: number;
  busFactor: {
    count: number;
    topAuthorsPercentage: number;
    topAuthorCount: number;
  };
}

export interface HotspotEntry {
  filepath: string;
  changes: number;
  authors: number;
  bugFixes: number;
}

export interface CouplingPair {
  fileA: string;
  fileB: string;
  percentage: number;
  coOccurrences: number;
}

export interface HotspotsResult {
  period: string;
  hotspots: HotspotEntry[];
  couplings: CouplingPair[];
}

export interface StaleBranch {
  name: string;
  lastCommitDate: Date;
  author: string;
  aheadOfMain: number;
  commitCount: number;
}

export interface DeadCodeSignal {
  filepath: string;
  lastModified: Date;
  importedByCount: number;
}

export interface GhostsResult {
  staleBranches: StaleBranch[];
  deadCode: DeadCodeSignal[];
}

export interface GitClient {
  log(options?: Record<string, unknown>): Promise<GitLogResult>;
  branch(options?: Record<string, unknown>): Promise<GitBranchResult>;
  diff(options: string[]): Promise<string>;
  raw(args: string[]): Promise<string>;
  revparse(args: string[]): Promise<string>;
}

export interface GitLogResult {
  all: GitLogEntry[];
  total: number;
}

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  diff?: {
    changed: number;
    insertions: number;
    deletions: number;
    files: Array<{ file: string; changes: number; insertions: number; deletions: number }>;
  };
}

export interface GitBranchResult {
  all: string[];
  current: string;
  branches: Record<string, { current: boolean; name: string; commit: string; label: string }>;
}
```

- [ ] **Step 2: Write time utility tests**

```typescript
// tests/utils/time.test.ts
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../src/utils/time.js';

describe('formatRelativeTime', () => {
  it('formats seconds ago', () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const date = new Date(Date.now() - 45 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('45m ago');
  });

  it('formats hours ago', () => {
    const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2h ago');
  });

  it('formats days ago', () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('3d ago');
  });

  it('formats weeks ago', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2 weeks ago');
  });

  it('formats months ago', () => {
    const date = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('4 months ago');
  });

  it('formats years ago', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('1 year ago');
  });
});
```

- [ ] **Step 3: Implement `src/utils/time.ts`**

```typescript
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes < 1) return 'just now';
  if (diffHours < 1) return `${diffMinutes}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  if (diffWeeks < 1) return `${diffDays}d ago`;
  if (diffMonths < 1) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  if (diffYears < 1) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}
```

- [ ] **Step 4: Run time tests**

```bash
npx vitest run tests/utils/time.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Write git utility tests**

```typescript
// tests/utils/git.test.ts
import { describe, it, expect } from 'vitest';
import { createGitClient, getRepoName, getMainBranch } from '../../src/utils/git.js';

describe('createGitClient', () => {
  it('creates a client for current directory', async () => {
    const client = createGitClient();
    expect(client).toBeDefined();
  });

  it('throws for non-git directory', async () => {
    await expect(createGitClient('/tmp/not-a-repo').revparse(['--git-dir']))
      .rejects.toThrow();
  });
});

describe('getRepoName', () => {
  it('extracts repo name from path', () => {
    expect(getRepoName('/home/user/projects/my-app')).toBe('my-app');
    expect(getRepoName('C:\\Projects\\git-intelligence')).toBe('git-intelligence');
  });
});

describe('getMainBranch', () => {
  it('returns main or master from branch list', () => {
    expect(getMainBranch(['main', 'develop', 'feature/x'])).toBe('main');
    expect(getMainBranch(['master', 'develop'])).toBe('master');
    expect(getMainBranch(['develop', 'feature/x'])).toBe('develop');
  });
});
```

- [ ] **Step 6: Implement `src/utils/git.ts`**

```typescript
import simpleGit from 'simple-git';
import path from 'node:path';

export function createGitClient(repoPath?: string) {
  const targetPath = repoPath ?? process.cwd();
  return simpleGit(targetPath);
}

export function getRepoName(repoPath: string): string {
  return path.basename(repoPath);
}

export function getMainBranch(branches: string[]): string {
  if (branches.includes('main')) return 'main';
  if (branches.includes('master')) return 'master';
  return branches[0] ?? 'main';
}

export async function validateGitRepo(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

export function parsePeriod(period: string): Date {
  const match = period.match(/^(\d+)(d|w|m|y)$/);
  if (!match) throw new Error(`Invalid period format: ${period}. Use format like 7d, 30d, 90d, 1y`);
  const [, valueStr, unit] = match;
  const value = parseInt(valueStr!, 10);
  const now = new Date();
  switch (unit) {
    case 'd': now.setDate(now.getDate() - value); break;
    case 'w': now.setDate(now.getDate() - value * 7); break;
    case 'm': now.setMonth(now.getMonth() - value); break;
    case 'y': now.setFullYear(now.getFullYear() - value); break;
  }
  return now;
}
```

- [ ] **Step 7: Run all util tests**

```bash
npx vitest run tests/utils/
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/types/ src/utils/ tests/utils/
git commit -m "feat: add types, time utility, and git client wrapper"
```

---

## Task 3: Commit Analyzer

**Files:**
- Create: `src/analyzers/commit-analyzer.ts`
- Test: `tests/analyzers/commit-analyzer.test.ts`

- [ ] **Step 1: Write commit analyzer tests**

Test all functions: `getRecentCommits`, `getWeeklyStats`, `getAvgCommitSize`, `getBusFactor`. Mock git log responses — do not hit real git.

- [ ] **Step 2: Implement `src/analyzers/commit-analyzer.ts`**

Functions:
- `getLastCommit(git)` — returns `{ date, message, author }`
- `getWeeklyStats(git)` — commits in last 7d, unique author count
- `getAvgCommitSize(git)` — mean (insertions + deletions) per commit over last 7d
- `getBusFactor(git)` — sort authors by commit count (90d window), count how many reach 50%
- `getHottestFile(git)` — file with most modifications in last 7d

Each function takes a simple-git instance and returns a Promise.

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/analyzers/commit-analyzer.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/analyzers/commit-analyzer.ts tests/analyzers/commit-analyzer.test.ts
git commit -m "feat: add commit analyzer with weekly stats, bus factor, hottest file"
```

---

## Task 4: Branch Analyzer

**Files:**
- Create: `src/analyzers/branch-analyzer.ts`
- Test: `tests/analyzers/branch-analyzer.test.ts`

- [ ] **Step 1: Write branch analyzer tests**

Test: `getStaleBranches`, `getBranchStats`. Mock branch listing and log per branch.

- [ ] **Step 2: Implement `src/analyzers/branch-analyzer.ts`**

Functions:
- `getBranchStats(git)` — total active branches, count of stale (no commits > 30d)
- `getStaleBranches(git, staleDays)` — returns StaleBranch[] with name, lastCommitDate, author, ahead count

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/analyzers/branch-analyzer.test.ts
git add src/analyzers/branch-analyzer.ts tests/analyzers/branch-analyzer.test.ts
git commit -m "feat: add branch analyzer with staleness detection"
```

---

## Task 5: File Analyzer

**Files:**
- Create: `src/analyzers/file-analyzer.ts`
- Test: `tests/analyzers/file-analyzer.test.ts`

- [ ] **Step 1: Write file analyzer tests**

Test: `getHotspots`, `getFileCouplings`. Provide mock commit data with known file co-occurrences.

- [ ] **Step 2: Implement `src/analyzers/file-analyzer.ts`**

Functions:
- `getHotspots(git, since, top)` — files ranked by modification count with author count and bug fix count
- `getFileCouplings(git, since)` — co-occurrence matrix, report pairs with both files >= 5 changes and >= 60% co-occurrence

Bug fix detection: match commit message against `/\b(fix|bug|patch|resolve|revert)\b/i`.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/analyzers/file-analyzer.test.ts
git add src/analyzers/file-analyzer.ts tests/analyzers/file-analyzer.test.ts
git commit -m "feat: add file analyzer with hotspots and coupling detection"
```

---

## Task 6: Code Analyzer

**Files:**
- Create: `src/analyzers/code-analyzer.ts`
- Test: `tests/analyzers/code-analyzer.test.ts`

- [ ] **Step 1: Write code analyzer tests**

Test: `getDeadCodeSignals`. Use mock file system data — list of files and their contents.

- [ ] **Step 2: Implement `src/analyzers/code-analyzer.ts`**

Functions:
- `getDeadCodeSignals(git, repoPath, deadMonths)` — find source files not modified in N months, then scan all project source files for import/require references. Return files with 0 importers.

Scan extensions: `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.go`, `.rs`, `.rb`.
Import regex: match `import ... from '...'`, `require('...')`, and relative path references.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/analyzers/code-analyzer.test.ts
git add src/analyzers/code-analyzer.ts tests/analyzers/code-analyzer.test.ts
git commit -m "feat: add code analyzer with dead code signal detection"
```

---

## Task 7: Terminal Formatter

**Files:**
- Create: `src/formatters/terminal.ts`
- Test: `tests/formatters/terminal.test.ts`

- [ ] **Step 1: Write formatter tests**

Test `formatPulse`, `formatHotspots`, `formatGhosts` — pass in known result objects, assert output contains expected strings. Strip ANSI for assertions.

- [ ] **Step 2: Implement `src/formatters/terminal.ts`**

Functions:
- `formatPulse(result: PulseResult): string`
- `formatHotspots(result: HotspotsResult): string`
- `formatGhosts(result: GhostsResult): string`

Use chalk for colors. Match the output formats from the architecture doc exactly.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/formatters/terminal.test.ts
git add src/formatters/terminal.ts tests/formatters/terminal.test.ts
git commit -m "feat: add terminal formatter with chalk output for all commands"
```

---

## Task 8: Pulse Command

**Files:**
- Create: `src/commands/pulse.ts`
- Test: `tests/commands/pulse.test.ts`

- [ ] **Step 1: Write pulse command tests**

Test: `executePulse` returns correct PulseResult. Test JSON output mode. Mock all analyzer calls.

- [ ] **Step 2: Implement `src/commands/pulse.ts`**

```typescript
export async function executePulse(options: { path?: string; json?: boolean }): Promise<void>
```

Calls commit-analyzer functions, branch-analyzer for branch count, assembles PulseResult, formats output.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/commands/pulse.test.ts
git add src/commands/pulse.ts tests/commands/pulse.test.ts
git commit -m "feat: add pulse command — repo health snapshot"
```

---

## Task 9: Hotspots Command

**Files:**
- Create: `src/commands/hotspots.ts`
- Test: `tests/commands/hotspots.test.ts`

- [ ] **Step 1: Write hotspots tests**

- [ ] **Step 2: Implement `src/commands/hotspots.ts`**

```typescript
export async function executeHotspots(options: { path?: string; json?: boolean; since?: string; top?: number }): Promise<void>
```

Calls file-analyzer functions, formats output.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/commands/hotspots.test.ts
git add src/commands/hotspots.ts tests/commands/hotspots.test.ts
git commit -m "feat: add hotspots command — codebase volatility analysis"
```

---

## Task 10: Ghosts Command

**Files:**
- Create: `src/commands/ghosts.ts`
- Test: `tests/commands/ghosts.test.ts`

- [ ] **Step 1: Write ghosts tests**

- [ ] **Step 2: Implement `src/commands/ghosts.ts`**

```typescript
export async function executeGhosts(options: { path?: string; json?: boolean; staleDays?: number; deadMonths?: number }): Promise<void>
```

Calls branch-analyzer + code-analyzer, formats output.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/commands/ghosts.test.ts
git add src/commands/ghosts.ts tests/commands/ghosts.test.ts
git commit -m "feat: add ghosts command — abandoned work detection"
```

---

## Task 11: CLI Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement `src/index.ts`**

Commander setup with all three commands registered. Include `process.on('unhandledRejection', ...)` handler. Wire `--path`, `--json`, and command-specific flags.

- [ ] **Step 2: Build and test manually**

```bash
npm run build
node dist/index.js pulse
node dist/index.js hotspots --since 7d --top 5
node dist/index.js ghosts
node dist/index.js pulse --json
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with commander — all commands wired"
```

---

## Task 12: README and Final Polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

Sections: What is giti, Installation, Commands (pulse/hotspots/ghosts with example output), "Why Living Codebase?", Contributing, License badge.

- [ ] **Step 2: Full verification**

```bash
npm run lint          # tsc --noEmit, zero errors
npm test              # all tests pass
npm run test:coverage # 80%+ coverage
npm run build         # clean build
```

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: add README with installation, usage, and project vision"
```

- [ ] **Step 4: Push to remote**

```bash
git push -u origin main
```

---
