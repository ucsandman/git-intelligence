# Sprint 1: Safety Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three agent modules (Sensory Cortex, Immune System, Memory) that observe, judge, and remember — the safety layer that gates all future autonomous changes.

**Architecture:** Each agent is a standalone TypeScript module under `src/agents/` with its own types, logic, and CLI entrypoint registered in the main `giti` CLI. Agents communicate through JSON files in the `.organism/` directory. All logic is deterministic (no LLM calls). Each agent has collectors/checks that are pure functions, independently testable by mocking child_process and filesystem.

**Tech Stack:** TypeScript (strict, ESM), vitest, simple-git, chalk, ora, node:child_process (execFileSync for running vitest/tsc/npm safely), node:crypto (randomUUID)

**Security note:** Use `execFileSync` (not `execSync`) for running external commands to prevent shell injection. Arguments are passed as arrays, not interpolated into shell strings.

---

## Pre-existing Files (DO NOT recreate)

- `src/index.ts` — CLI entry point, needs new commands added (Task 14)
- `src/types/index.ts` — Sprint 0 types, do not modify
- `src/utils/git.ts` — git wrapper, reuse `createGitClient`, `validateGitRepo`, `getMainBranch`
- `src/utils/time.ts` — reuse `formatRelativeTime`
- `src/formatters/terminal.ts` — Sprint 0 formatters, do not modify
- `organism.json` — quality standards and boundaries (read by agents at runtime)
- `package.json` — no new deps needed (crypto.randomUUID is built-in Node 18+)
- `.gitignore` — add `.organism/` entry

## File Map

### Shared Agent Infrastructure (foundation)
- **Create:** `src/agents/types.ts` — Shared agent types: AgentRole, AgentOutput, OrganismEvent, OrganismConfig
- **Create:** `src/agents/utils.ts` — Shared agent utilities: ensureOrganismDir, readJsonFile, writeJsonFile, loadOrganismConfig, runCommand

### Sensory Cortex
- **Create:** `src/agents/sensory-cortex/types.ts` — StateReport interface and collector return types
- **Create:** `src/agents/sensory-cortex/collectors/git-stats.ts` — Git statistics collector
- **Create:** `src/agents/sensory-cortex/collectors/test-health.ts` — Test runner and coverage collector
- **Create:** `src/agents/sensory-cortex/collectors/code-quality.ts` — Lint errors, file length, complexity
- **Create:** `src/agents/sensory-cortex/collectors/dependency-health.ts` — npm audit and outdated
- **Create:** `src/agents/sensory-cortex/collectors/performance.ts` — Benchmark giti commands
- **Create:** `src/agents/sensory-cortex/analyzers/trend-detector.ts` — Trend detection across reports
- **Create:** `src/agents/sensory-cortex/index.ts` — Orchestrator: run all collectors, detect trends, write report
- **Create:** `src/agents/sensory-cortex/formatter.ts` — Human-readable summary output

### Immune System
- **Create:** `src/agents/immune-system/types.ts` — ReviewVerdict, CheckResult, Baselines interfaces
- **Create:** `src/agents/immune-system/checks/test-check.ts` — Run tests, compare coverage to baseline
- **Create:** `src/agents/immune-system/checks/quality-check.ts` — tsc errors, file length, complexity
- **Create:** `src/agents/immune-system/checks/performance-check.ts` — Benchmark against budgets
- **Create:** `src/agents/immune-system/checks/boundary-check.ts` — Verify organism.json boundaries
- **Create:** `src/agents/immune-system/checks/regression-check.ts` — Query memory for fragile files
- **Create:** `src/agents/immune-system/checks/dependency-check.ts` — Audit new dependencies
- **Create:** `src/agents/immune-system/verdict.ts` — Verdict generation from check results
- **Create:** `src/agents/immune-system/baselines.ts` — Read/update baselines.json
- **Create:** `src/agents/immune-system/index.ts` — Orchestrator: run all checks, generate verdict
- **Create:** `src/agents/immune-system/formatter.ts` — Human-readable verdict output

### Memory Agent
- **Create:** `src/agents/memory/types.ts` — KnowledgeBase, Event, Lesson, QueryResult interfaces
- **Create:** `src/agents/memory/store.ts` — Read/write knowledge-base.json
- **Create:** `src/agents/memory/curator.ts` — Extract lessons and patterns from events
- **Create:** `src/agents/memory/query.ts` — Keyword search across events, lessons, patterns
- **Create:** `src/agents/memory/index.ts` — Orchestrator: record, query, summarize
- **Create:** `src/agents/memory/formatter.ts` — Human-readable summary output

### CLI Entrypoints
- **Create:** `src/cli/sense.ts` — `giti sense` command handler
- **Create:** `src/cli/review.ts` — `giti review <branch>` command handler
- **Create:** `src/cli/remember.ts` — `giti remember` command handler
- **Modify:** `src/index.ts` — Register sense, review, remember commands

### Tests
- **Create:** `tests/agents/utils.test.ts`
- **Create:** `tests/agents/sensory-cortex/collectors.test.ts`
- **Create:** `tests/agents/sensory-cortex/trend-detector.test.ts`
- **Create:** `tests/agents/immune-system/checks.test.ts`
- **Create:** `tests/agents/immune-system/verdict.test.ts`
- **Create:** `tests/agents/immune-system/baselines.test.ts`
- **Create:** `tests/agents/memory/store.test.ts`
- **Create:** `tests/agents/memory/curator.test.ts`
- **Create:** `tests/agents/memory/query.test.ts`
- **Create:** `tests/fixtures/agent-fixtures/README.md`

---

## Task 1: Shared Agent Types and Utilities

**Files:**
- Create: `src/agents/types.ts`
- Create: `src/agents/utils.ts`
- Modify: `.gitignore` (add `.organism/`)
- Create: `tests/agents/utils.test.ts`
- Create: `tests/fixtures/agent-fixtures/README.md`

- [ ] **Step 1: Add `.organism/` to .gitignore**

Append `.organism/` to the existing `.gitignore`.

- [ ] **Step 2: Create shared agent types in `src/agents/types.ts`**

```typescript
export type AgentRole =
  | 'sensory-cortex'
  | 'immune-system'
  | 'memory'
  | 'prefrontal-cortex'
  | 'motor-cortex'
  | 'growth-hormone';

export interface AgentOutput<T> {
  agent: AgentRole;
  timestamp: string;
  cycle?: number;
  data: T;
}

export interface OrganismEvent {
  id: string;
  timestamp: string;
  cycle: number;
  type: EventType;
  agent: AgentRole;
  summary: string;
  data: Record<string, unknown>;
  tags: string[];
}

export type EventType =
  | 'change-merged'
  | 'change-rejected'
  | 'regression-detected'
  | 'regression-fixed'
  | 'growth-proposed'
  | 'growth-approved'
  | 'growth-rejected'
  | 'baseline-updated'
  | 'anomaly-detected';

export interface OrganismConfig {
  quality_standards: {
    test_coverage_floor: number;
    max_complexity_per_function: number;
    max_file_length: number;
    zero_tolerance: string[];
    performance_budget: Record<string, string>;
  };
  boundaries: {
    growth_zone: string[];
    forbidden_zone: string[];
  };
  lifecycle: {
    cycle_frequency: string;
    max_changes_per_cycle: number;
    mandatory_cooldown_after_regression: string;
    branch_naming: string;
    requires_immune_approval: boolean;
  };
}
```

- [ ] **Step 3: Create shared utilities in `src/agents/utils.ts`**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ORGANISM_DIR = '.organism';

export async function ensureOrganismDir(repoPath: string, ...subdirs: string[]): Promise<string> {
  const dir = path.join(repoPath, ORGANISM_DIR, ...subdirs);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadOrganismConfig(repoPath: string): Promise<import('./types.js').OrganismConfig> {
  const configPath = path.join(repoPath, 'organism.json');
  const config = await readJsonFile<Record<string, unknown>>(configPath);
  if (!config) {
    throw new Error(`organism.json not found at ${configPath}`);
  }
  return config as unknown as import('./types.js').OrganismConfig;
}

export function getOrganismPath(repoPath: string, ...parts: string[]): string {
  return path.join(repoPath, ORGANISM_DIR, ...parts);
}

export function runCommand(command: string, args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      status: err.status ?? 1,
    };
  }
}
```

- [ ] **Step 4: Write tests for utils**

Test `ensureOrganismDir`, `readJsonFile`, `writeJsonFile`, `getOrganismPath`, `runCommand`. Use a temp directory for filesystem tests. For `runCommand`, test with a simple known command like `node --version`.

- [ ] **Step 5: Create fixture directory**

Create `tests/fixtures/agent-fixtures/README.md`:
```markdown
# Agent Test Fixtures
Mock data for agent unit tests. Each agent's tests create their own mock data inline.
```

- [ ] **Step 6: Run tests, type check, commit**

```bash
npx vitest run tests/agents/utils.test.ts
npx tsc --noEmit
git add src/agents/types.ts src/agents/utils.ts tests/agents/utils.test.ts tests/fixtures/agent-fixtures/ .gitignore
git commit -m "feat: add shared agent types and filesystem utilities"
```

---

## Task 2: Sensory Cortex Types

**Files:**
- Create: `src/agents/sensory-cortex/types.ts`

- [ ] **Step 1: Create sensory cortex types**

```typescript
export interface StateReport {
  timestamp: string;
  version: string;

  git: {
    total_commits: number;
    commits_last_7d: number;
    commits_last_30d: number;
    unique_authors_30d: number;
    active_branches: number;
    stale_branches: number;
    last_commit_age_hours: number;
    avg_commit_size_lines: number;
  };

  quality: {
    test_file_count: number;
    source_file_count: number;
    test_ratio: number;
    test_pass_rate: number;
    test_coverage_percent: number;
    lint_error_count: number;
    files_exceeding_length_limit: string[];
    functions_exceeding_complexity: string[];
  };

  performance: {
    pulse_execution_ms: number;
    hotspots_execution_ms: number;
    ghosts_execution_ms: number;
    benchmarked_against: string;
  };

  dependencies: {
    total_count: number;
    outdated_count: number;
    vulnerable_count: number;
    outdated_packages: OutdatedPackage[];
    vulnerabilities: Vulnerability[];
  };

  codebase: {
    total_files: number;
    total_lines: number;
    avg_file_length: number;
    largest_files: Array<{ path: string; lines: number }>;
    file_type_distribution: Record<string, number>;
  };

  anomalies: Anomaly[];
  growth_signals: GrowthSignal[];
}

export interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
  severity: 'patch' | 'minor' | 'major';
}

export interface Vulnerability {
  package: string;
  severity: string;
  description: string;
}

export interface Anomaly {
  type: 'quality_floor_approaching' | 'performance_regression' | 'dependency_vulnerability' | 'complexity_spike';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, unknown>;
}

export interface GrowthSignal {
  signal: string;
  evidence: string;
  confidence: number;
}

export interface TrendResult {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change_percent: number;
  period_cycles: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/sensory-cortex/types.ts
git commit -m "feat: add sensory cortex type definitions"
```

---

## Task 3: Sensory Cortex Collectors (git-stats, test-health)

**Files:**
- Create: `src/agents/sensory-cortex/collectors/git-stats.ts`
- Create: `src/agents/sensory-cortex/collectors/test-health.ts`
- Create: `tests/agents/sensory-cortex/collectors.test.ts` (partial — git-stats and test-health tests)

- [ ] **Step 1: Write tests for git-stats collector**

Test `collectGitStats(git: SimpleGit): Promise<StateReport['git']>`. Mock simple-git to return known data. Test: total commits, 7d/30d commit counts, unique authors, branch counts, last commit age, avg commit size.

- [ ] **Step 2: Implement `src/agents/sensory-cortex/collectors/git-stats.ts`**

```typescript
import type { SimpleGit } from 'simple-git';
import type { StateReport } from '../types.js';

export async function collectGitStats(git: SimpleGit): Promise<StateReport['git']> {
  const [allLog, weekLog, monthLog, branchInfo] = await Promise.all([
    git.log(),
    git.log({ '--since': '7 days ago' }),
    git.log({ '--since': '30 days ago' }),
    git.branch(),
  ]);

  const monthAuthors = new Set(monthLog.all.map(c => c.author_name));
  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  // Count stale branches by checking last commit date per branch

  const lastCommit = allLog.all[0];
  const lastCommitAge = lastCommit
    ? (Date.now() - new Date(lastCommit.date).getTime()) / (1000 * 60 * 60)
    : 0;

  // Calculate avg commit size from weekly log with --stat
  const weekStatLog = await git.log({ '--since': '7 days ago', '--stat': null });
  let totalSize = 0;
  let countWithDiff = 0;
  for (const commit of weekStatLog.all) {
    const diff = (commit as unknown as { diff?: { insertions: number; deletions: number } }).diff;
    if (diff) {
      totalSize += diff.insertions + diff.deletions;
      countWithDiff++;
    }
  }

  return {
    total_commits: allLog.total,
    commits_last_7d: weekLog.all.length,
    commits_last_30d: monthLog.all.length,
    unique_authors_30d: monthAuthors.size,
    active_branches: branchInfo.all.length,
    stale_branches: 0, // calculated from branch dates
    last_commit_age_hours: Math.round(lastCommitAge * 10) / 10,
    avg_commit_size_lines: countWithDiff > 0 ? Math.round(totalSize / countWithDiff) : 0,
  };
}
```

- [ ] **Step 3: Write tests for test-health collector**

Test `collectTestHealth(repoPath: string): Promise<{test_pass_rate: number; test_coverage_percent: number; lint_error_count: number}>`. Mock `runCommand` from `../../utils.js` to return known JSON output. Test: all pass → rate 1.0, some fail → correct rate, coverage parsed, lint error count.

- [ ] **Step 4: Implement `src/agents/sensory-cortex/collectors/test-health.ts`**

Uses `runCommand('npx', ['vitest', 'run', '--reporter=json'], repoPath)` to get test results. Parses JSON output for pass/fail counts. Uses `runCommand('npx', ['vitest', 'run', '--coverage', '--reporter=json'], repoPath)` for coverage. Uses `runCommand('npx', ['tsc', '--noEmit'], repoPath)` and counts `error TS` lines for lint errors. Each wrapped in try/catch with sensible defaults.

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run tests/agents/sensory-cortex/collectors.test.ts
git add src/agents/sensory-cortex/collectors/git-stats.ts src/agents/sensory-cortex/collectors/test-health.ts tests/agents/sensory-cortex/collectors.test.ts
git commit -m "feat: add git-stats and test-health collectors for sensory cortex"
```

---

## Task 4: Sensory Cortex Collectors (code-quality, dependency-health, performance)

**Files:**
- Create: `src/agents/sensory-cortex/collectors/code-quality.ts`
- Create: `src/agents/sensory-cortex/collectors/dependency-health.ts`
- Create: `src/agents/sensory-cortex/collectors/performance.ts`
- Modify: `tests/agents/sensory-cortex/collectors.test.ts` (add tests for these 3)

- [ ] **Step 1: Write tests and implement code-quality collector**

`collectCodeQuality(repoPath: string)` scans source files for line counts and cyclomatic complexity. The complexity calculator counts branching statements (`if`, `else if`, `else`, `switch`, `case`, `for`, `while`, `do`, `catch`, `&&`, `||`, `??`, ternary `?`) per function. Uses regex to find function declarations and count branches within each. Returns `files_exceeding_length_limit` (>300 lines), `functions_exceeding_complexity` (>15), plus total file/line stats.

Mock filesystem via `vi.mock('node:fs/promises')`. Test: file over 300 lines flagged, complex function flagged, simple code passes.

- [ ] **Step 2: Write tests and implement dependency-health collector**

`collectDependencyHealth(repoPath: string)` runs `runCommand('npm', ['outdated', '--json'], repoPath)` and `runCommand('npm', ['audit', '--json'], repoPath)`. Note: `npm outdated` exits code 1 when outdated packages exist — that's normal, parse stdout anyway. Determines severity by comparing semver. Mock `runCommand`. Test: no outdated → counts 0, outdated packages parsed correctly, audit findings parsed.

- [ ] **Step 3: Write tests and implement performance collector**

`collectPerformance(repoPath: string)` runs each giti command via `runCommand('node', ['dist/index.js', 'pulse', '--json'], repoPath)` 3 times, measures execution time, takes median. Mock `runCommand`. Test: median calculation, all commands benchmarked.

- [ ] **Step 4: Run tests, type check, commit**

```bash
npx vitest run tests/agents/sensory-cortex/collectors.test.ts
npx tsc --noEmit
git add src/agents/sensory-cortex/collectors/ tests/agents/sensory-cortex/collectors.test.ts
git commit -m "feat: add code-quality, dependency-health, and performance collectors"
```

---

## Task 5: Sensory Cortex Trend Detector

**Files:**
- Create: `src/agents/sensory-cortex/analyzers/trend-detector.ts`
- Create: `tests/agents/sensory-cortex/trend-detector.test.ts`

- [ ] **Step 1: Write trend detector tests**

Test `detectTrends(reports: StateReport[]): TrendResult[]` and `detectAnomalies(current: StateReport, trends: TrendResult[], config: OrganismConfig): Anomaly[]`.

Provide sequences of mock StateReport objects and verify:
- Coverage trending down triggers anomaly
- Complexity trending up triggers anomaly
- Performance regression detected when command exceeds budget
- Stable metrics produce no anomalies
- Short history (< 3 reports) returns empty trends

- [ ] **Step 2: Implement trend-detector.ts**

`detectTrends` compares the last 5 reports (or fewer if not enough history). For each numeric metric (coverage, complexity total, performance times), calculates percentage change between oldest and newest in window. Direction: >5% increase = "up", >5% decrease = "down", else "stable".

`detectAnomalies` checks current report against organism.json thresholds:
- `quality_floor_approaching`: coverage within 5% of the floor (80%) → warning
- `performance_regression`: any command exceeds its budget (parse "< 2 seconds" → 2000ms) → critical
- `dependency_vulnerability`: vulnerable_count > 0 → critical
- `complexity_spike`: complexity trending up >10% → warning

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/agents/sensory-cortex/trend-detector.test.ts
git add src/agents/sensory-cortex/analyzers/trend-detector.ts tests/agents/sensory-cortex/trend-detector.test.ts
git commit -m "feat: add trend detector for sensory cortex historical analysis"
```

---

## Task 6: Sensory Cortex Orchestrator and Formatter

**Files:**
- Create: `src/agents/sensory-cortex/index.ts`
- Create: `src/agents/sensory-cortex/formatter.ts`

- [ ] **Step 1: Implement formatter**

`formatSenseReport(report: StateReport): string` — produces human-readable output using chalk:

```
🧠 Sensory Scan Complete
────────────────────────
Quality:      ✅ 83% coverage | 0 lint errors | 0 files over limit
Performance:  ✅ pulse: 340ms | hotspots: 1.2s | ghosts: 890ms
Dependencies: ⚠️  2 outdated (minor) | 0 vulnerabilities
Anomalies:    1 warning — complexity trending up 8% over last 5 cycles
Growth:       2 signals detected

Full report: .organism/state-reports/{timestamp}.json
```

Use ✅ if section has no issues, ⚠️ if warnings exist, ❌ if critical issues.

- [ ] **Step 2: Implement orchestrator**

`runSensoryCortex(repoPath: string): Promise<StateReport>`:
1. Load organism.json config via `loadOrganismConfig`
2. Create git client via `createGitClient`
3. Run all 5 collectors in parallel
4. Scan codebase for total files, lines, distribution, largest files
5. Load historical reports from `.organism/state-reports/` (glob for JSON files)
6. Run trend detector with historical + current
7. Assemble anomalies and growth signals
8. Assemble full StateReport with timestamp and version from package.json
9. Write report to `.organism/state-reports/{ISO-timestamp}.json`
10. Return the report

- [ ] **Step 3: Run all sensory cortex tests, type check, commit**

```bash
npx vitest run tests/agents/sensory-cortex/
npx tsc --noEmit
git add src/agents/sensory-cortex/index.ts src/agents/sensory-cortex/formatter.ts
git commit -m "feat: add sensory cortex orchestrator and formatter"
```

---

## Task 7: Immune System Types and Baselines

**Files:**
- Create: `src/agents/immune-system/types.ts`
- Create: `src/agents/immune-system/baselines.ts`
- Create: `tests/agents/immune-system/baselines.test.ts`

- [ ] **Step 1: Create immune system types**

```typescript
export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: Record<string, unknown>;
}

export interface ReviewRisk {
  description: string;
  severity: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface ReviewVerdict {
  branch: string;
  timestamp: string;
  verdict: 'approve' | 'reject' | 'request-changes';
  confidence: number;
  summary: string;
  checks: CheckResult[];
  risks: ReviewRisk[];
  recommendation: string;
}

export interface Baselines {
  last_updated: string;
  test_coverage: number;
  test_count: number;
  lint_errors: number;
  performance: {
    pulse_ms: number;
    hotspots_ms: number;
    ghosts_ms: number;
  };
  complexity: {
    total: number;
    avg_per_file: number;
  };
  dependency_count: number;
  file_count: number;
  total_lines: number;
}
```

- [ ] **Step 2: Write baselines tests**

Test `readBaselines`, `writeBaselines`, `createBaselinesFromReport`. Use temp directory for filesystem tests. Test: read returns null for missing file, write then read round-trips, createBaselinesFromReport maps fields correctly.

- [ ] **Step 3: Implement baselines.ts**

`readBaselines(repoPath)` reads `.organism/baselines.json`. `writeBaselines(repoPath, baselines)` writes it. `createBaselinesFromReport(report: StateReport)` maps StateReport fields to Baselines shape.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/immune-system/baselines.test.ts
git add src/agents/immune-system/types.ts src/agents/immune-system/baselines.ts tests/agents/immune-system/baselines.test.ts
git commit -m "feat: add immune system types and baseline management"
```

---

## Task 8: Immune System Checks (test, quality, performance)

**Files:**
- Create: `src/agents/immune-system/checks/test-check.ts`
- Create: `src/agents/immune-system/checks/quality-check.ts`
- Create: `src/agents/immune-system/checks/performance-check.ts`
- Create: `tests/agents/immune-system/checks.test.ts` (partial — these 3 checks)

- [ ] **Step 1: Write test-check tests and implement**

`runTestCheck(repoPath: string, baselines: Baselines | null, config: OrganismConfig): Promise<CheckResult>`. Runs vitest, compares coverage against floor (80%) and baseline. Returns: fail if any test fails or coverage below floor, warn if coverage decreased but still above floor, pass otherwise. Mock `runCommand`.

- [ ] **Step 2: Write quality-check tests and implement**

`runQualityCheck(repoPath: string, baselines: Baselines | null, config: OrganismConfig): Promise<CheckResult>`. Runs tsc, scans for file length (>300) and complexity (>15). Returns: fail if new lint errors, warn if files over limit or complexity exceeded, pass otherwise. Mock `runCommand` and filesystem.

- [ ] **Step 3: Write performance-check tests and implement**

`runPerformanceCheck(repoPath: string, config: OrganismConfig, baselines: Baselines | null): Promise<CheckResult>`. Benchmarks giti commands. Parses performance budgets from organism.json (e.g., "< 2 seconds" → 2000ms). Returns: fail if over budget, warn if degraded >10% from baseline, pass otherwise. Mock `runCommand`.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/immune-system/checks.test.ts
git add src/agents/immune-system/checks/test-check.ts src/agents/immune-system/checks/quality-check.ts src/agents/immune-system/checks/performance-check.ts tests/agents/immune-system/checks.test.ts
git commit -m "feat: add test, quality, and performance checks for immune system"
```

---

## Task 9: Immune System Checks (boundary, regression, dependency)

**Files:**
- Create: `src/agents/immune-system/checks/boundary-check.ts`
- Create: `src/agents/immune-system/checks/regression-check.ts`
- Create: `src/agents/immune-system/checks/dependency-check.ts`
- Modify: `tests/agents/immune-system/checks.test.ts` (add tests for these 3)

- [ ] **Step 1: Write boundary-check tests and implement**

`runBoundaryCheck(repoPath: string, branch: string, config: OrganismConfig): Promise<CheckResult>`. Gets diff between branch and main. Checks forbidden_zone keywords in new code. Checks if new dependencies added. Returns: fail if forbidden zone violated, warn if new deps, pass otherwise. Mock simple-git.

- [ ] **Step 2: Write regression-check tests and implement**

`runRegressionCheck(repoPath: string, branch: string, knowledgeBase: KnowledgeBase | null): Promise<CheckResult>`. Gets changed files from diff. Checks knowledge base `patterns.fragile_files`. Returns: fail if file with 3+ regressions touched, warn if 1-2 regressions, pass if no fragile files. Mock git diff and KB.

- [ ] **Step 3: Write dependency-check tests and implement**

`runDependencyCheck(repoPath: string, branch: string): Promise<CheckResult>`. Compares package.json between main and branch. If new deps, runs npm audit. Returns: fail if new dep has vulnerability, warn if new deps added, pass if no new deps. Mock git show and runCommand.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/immune-system/checks.test.ts
git add src/agents/immune-system/checks/boundary-check.ts src/agents/immune-system/checks/regression-check.ts src/agents/immune-system/checks/dependency-check.ts tests/agents/immune-system/checks.test.ts
git commit -m "feat: add boundary, regression, and dependency checks for immune system"
```

---

## Task 10: Immune System Verdict and Orchestrator

**Files:**
- Create: `src/agents/immune-system/verdict.ts`
- Create: `src/agents/immune-system/index.ts`
- Create: `src/agents/immune-system/formatter.ts`
- Create: `tests/agents/immune-system/verdict.test.ts`

- [ ] **Step 1: Write verdict tests**

Test `generateVerdict(branch: string, checks: CheckResult[], risks: ReviewRisk[]): ReviewVerdict`:
- All pass, 0 warns → approve, confidence 1.0
- Any fail → reject
- No fail, 3+ warns → request-changes
- No fail, <3 warns → approve
- Confidence = checks that didn't fail / total checks
- Summary describes verdict reason
- Recommendation paragraph generated

- [ ] **Step 2: Implement verdict.ts**

```typescript
export function generateVerdict(branch: string, checks: CheckResult[], risks: ReviewRisk[] = []): ReviewVerdict {
  const hasFailure = checks.some(c => c.status === 'fail');
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const passCount = checks.filter(c => c.status !== 'fail').length;

  let verdict: 'approve' | 'reject' | 'request-changes';
  if (hasFailure) verdict = 'reject';
  else if (warnCount >= 3) verdict = 'request-changes';
  else verdict = 'approve';

  const confidence = Math.round((passCount / checks.length) * 100) / 100;

  const failedChecks = checks.filter(c => c.status === 'fail').map(c => c.name);
  const warnedChecks = checks.filter(c => c.status === 'warn').map(c => c.name);

  let summary: string;
  if (verdict === 'reject') summary = `Rejected: ${failedChecks.join(', ')} failed.`;
  else if (verdict === 'request-changes') summary = `Changes requested: ${warnCount} warnings need attention.`;
  else summary = 'All checks passed. Change is clean and within boundaries.';

  let recommendation: string;
  if (verdict === 'reject') recommendation = `Fix the following before resubmitting: ${failedChecks.join(', ')}.`;
  else if (verdict === 'request-changes') recommendation = `Address warnings in: ${warnedChecks.join(', ')}.`;
  else recommendation = 'Approve. Change is clean, tested, and within boundaries.';

  return { branch, timestamp: new Date().toISOString(), verdict, confidence, summary, checks, risks, recommendation };
}
```

- [ ] **Step 3: Implement formatter.ts**

`formatReviewVerdict(verdict: ReviewVerdict): string` — chalk-formatted review output showing verdict (color-coded), all checks with ✅/❌/⚠️, risks, and recommendation.

- [ ] **Step 4: Implement orchestrator index.ts**

`runImmuneReview(repoPath: string, branch: string): Promise<ReviewVerdict>`:
1. Load organism.json config
2. Read baselines
3. Load knowledge base (for regression check)
4. Create git client
5. Run all 6 checks in parallel
6. Collect risks from failed/warned checks
7. Generate verdict
8. Write to `.organism/reviews/{branch-slug}-{timestamp}.json`
9. Return verdict

- [ ] **Step 5: Run all immune system tests, commit**

```bash
npx vitest run tests/agents/immune-system/
npx tsc --noEmit
git add src/agents/immune-system/verdict.ts src/agents/immune-system/index.ts src/agents/immune-system/formatter.ts tests/agents/immune-system/verdict.test.ts
git commit -m "feat: add immune system verdict logic, orchestrator, and formatter"
```

---

## Task 11: Memory Agent Store

**Files:**
- Create: `src/agents/memory/types.ts`
- Create: `src/agents/memory/store.ts`
- Create: `tests/agents/memory/store.test.ts`

- [ ] **Step 1: Create memory types**

```typescript
import type { OrganismEvent } from '../types.js';

export interface Lesson {
  id: string;
  learned_at: string;
  lesson: string;
  evidence_event_ids: string[];
  confidence: number;
  category: LessonCategory;
  times_referenced: number;
}

export type LessonCategory = 'architecture' | 'quality' | 'performance' | 'dependencies' | 'testing' | 'growth' | 'regressions';

export interface FragileFile {
  path: string;
  regression_count: number;
  last_regression: string;
  notes: string;
}

export interface Preference {
  preference: string;
  evidence_count: number;
  first_observed: string;
  last_observed: string;
}

export interface KnowledgeBase {
  created: string;
  last_updated: string;
  cycle_count: number;
  events: OrganismEvent[];
  lessons: Lesson[];
  patterns: {
    fragile_files: FragileFile[];
    rejection_reasons: Record<string, number>;
    successful_change_types: Record<string, number>;
    failed_change_types: Record<string, number>;
  };
  preferences: Preference[];
}

export interface QueryResult {
  query: string;
  results: Array<{
    type: 'event' | 'lesson' | 'pattern' | 'preference';
    content: string;
    relevance: number;
    timestamp: string;
  }>;
  total_results: number;
}
```

- [ ] **Step 2: Write store tests**

Test `loadKnowledgeBase`, `saveKnowledgeBase`, `recordEvent`, `initKnowledgeBase`, `createEvent`. Use temp directory. Test: init creates empty KB, record adds event with UUID, load returns saved data, load returns fresh KB for missing file.

- [ ] **Step 3: Implement store.ts**

```typescript
import crypto from 'node:crypto';
import type { KnowledgeBase } from './types.js';
import type { OrganismEvent, EventType, AgentRole } from '../types.js';
import { readJsonFile, writeJsonFile, getOrganismPath } from '../utils.js';

export async function loadKnowledgeBase(repoPath: string): Promise<KnowledgeBase> {
  const kb = await readJsonFile<KnowledgeBase>(getOrganismPath(repoPath, 'knowledge-base.json'));
  return kb ?? initKnowledgeBase();
}

export async function saveKnowledgeBase(repoPath: string, kb: KnowledgeBase): Promise<void> {
  await writeJsonFile(getOrganismPath(repoPath, 'knowledge-base.json'), kb);
}

export function initKnowledgeBase(): KnowledgeBase {
  const now = new Date().toISOString();
  return {
    created: now, last_updated: now, cycle_count: 0,
    events: [], lessons: [],
    patterns: { fragile_files: [], rejection_reasons: {}, successful_change_types: {}, failed_change_types: {} },
    preferences: [],
  };
}

export function createEvent(type: EventType, agent: AgentRole, summary: string, data: Record<string, unknown> = {}, tags: string[] = [], cycle: number = 0): OrganismEvent {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), cycle, type, agent, summary, data, tags };
}

export function recordEvent(kb: KnowledgeBase, event: OrganismEvent): KnowledgeBase {
  return { ...kb, last_updated: new Date().toISOString(), events: [...kb.events, event] };
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/memory/store.test.ts
git add src/agents/memory/types.ts src/agents/memory/store.ts tests/agents/memory/store.test.ts
git commit -m "feat: add memory agent store with knowledge base persistence"
```

---

## Task 12: Memory Agent Curator

**Files:**
- Create: `src/agents/memory/curator.ts`
- Create: `tests/agents/memory/curator.test.ts`

- [ ] **Step 1: Write curator tests**

Test `curateKnowledgeBase(kb: KnowledgeBase): KnowledgeBase`:
- Regression event with file data → lesson created: "Changes to {file} have caused regressions"
- Same file in multiple regression events → fragile_files updated with correct count
- 5+ rejection events with same reason → lesson about rejection pattern
- Existing lesson with new supporting evidence → confidence increases
- 10+ merge events with same tag → preference emerges
- Empty KB → returns unchanged KB
- Already-curated lessons not duplicated

- [ ] **Step 2: Implement curator.ts**

```typescript
import crypto from 'node:crypto';
import type { KnowledgeBase, Lesson } from './types.js';

export function curateKnowledgeBase(kb: KnowledgeBase): KnowledgeBase {
  let result = structuredClone(kb);
  result = extractRegressionLessons(result);
  result = updateFragileFiles(result);
  result = analyzeRejectionPatterns(result);
  result = detectPreferences(result);
  return result;
}
```

`extractRegressionLessons`: Find `regression-detected` events. For each file mentioned in event.data.file, check if a lesson already exists for it. If not, create one with confidence 0.5. If yes, increment confidence by 0.1 (cap at 1.0) and add event ID to evidence.

`updateFragileFiles`: Count regressions per file across all regression events. Update `patterns.fragile_files` with counts and last regression timestamp.

`analyzeRejectionPatterns`: Tally `change-rejected` events. Extract rejection reason from event.data.reason or event.summary. If any reason has 5+ occurrences, create lesson if none exists.

`detectPreferences`: Count tags across `change-merged` events. If any tag appears 10+ times, add to preferences list if not already present.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/agents/memory/curator.test.ts
git add src/agents/memory/curator.ts tests/agents/memory/curator.test.ts
git commit -m "feat: add memory curator for lesson extraction and pattern detection"
```

---

## Task 13: Memory Agent Query and Orchestrator

**Files:**
- Create: `src/agents/memory/query.ts`
- Create: `src/agents/memory/index.ts`
- Create: `src/agents/memory/formatter.ts`
- Create: `tests/agents/memory/query.test.ts`

- [ ] **Step 1: Write query tests**

Test `queryKnowledgeBase(kb: KnowledgeBase, query: string): QueryResult`:
- Keyword matching against event summaries returns results
- Keyword matching against lesson text returns results
- Keyword matching against fragile file paths returns results
- Results sorted by relevance (match count) then recency
- Empty query returns empty results
- No matches returns empty results
- Short words (<3 chars) filtered out

- [ ] **Step 2: Implement query.ts**

Split query into words, filter words < 3 chars. Score each event/lesson/pattern/preference by counting how many query words appear in its text. Normalize relevance: matches / total_keywords. Return top 20 sorted by relevance desc, then timestamp desc.

- [ ] **Step 3: Implement formatter.ts**

`formatMemorySummary(kb: KnowledgeBase): string` — chalk-formatted summary with cycle count, event count, top lessons by confidence, emerged preferences, fragile files.

`formatQueryResults(result: QueryResult): string` — chalk-formatted query results with relevance scores.

- [ ] **Step 4: Implement orchestrator index.ts**

```typescript
export async function recordMemoryEvent(repoPath: string, type: EventType, summary: string, data?: Record<string, unknown>, tags?: string[]): Promise<void> {
  const kb = await loadKnowledgeBase(repoPath);
  const event = createEvent(type, 'memory', summary, data, tags);
  const updated = recordEvent(kb, event);
  const curated = curateKnowledgeBase(updated);
  await saveKnowledgeBase(repoPath, curated);
}

export async function queryMemory(repoPath: string, query: string): Promise<QueryResult> {
  const kb = await loadKnowledgeBase(repoPath);
  return queryKnowledgeBase(kb, query);
}

export async function getMemorySummary(repoPath: string): Promise<KnowledgeBase> {
  return loadKnowledgeBase(repoPath);
}
```

- [ ] **Step 5: Run all memory tests, commit**

```bash
npx vitest run tests/agents/memory/
npx tsc --noEmit
git add src/agents/memory/query.ts src/agents/memory/index.ts src/agents/memory/formatter.ts tests/agents/memory/query.test.ts
git commit -m "feat: add memory query engine, orchestrator, and formatter"
```

---

## Task 14: CLI Entrypoints and Command Registration

**Files:**
- Create: `src/cli/sense.ts`
- Create: `src/cli/review.ts`
- Create: `src/cli/remember.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement `src/cli/sense.ts`**

```typescript
import { runSensoryCortex } from '../agents/sensory-cortex/index.js';
import { formatSenseReport } from '../agents/sensory-cortex/formatter.js';
import ora from 'ora';

export async function executeSense(options: { path?: string; json?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const spinner = options.json ? null : ora('Running sensory scan...').start();
  try {
    const report = await runSensoryCortex(repoPath);
    spinner?.stop();
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatSenseReport(report));
    }
  } catch (error) {
    spinner?.fail('Sensory scan failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
```

- [ ] **Step 2: Implement `src/cli/review.ts`**

Same pattern. `executeReview(branch: string, options: { path?: string; json?: boolean })` calls `runImmuneReview` and formats output.

- [ ] **Step 3: Implement `src/cli/remember.ts`**

`executeRemember(subcommand: string, args: string[], options: { path?: string; json?: boolean; type?: string; data?: string; category?: string })` dispatches to `recordMemoryEvent`, `queryMemory`, or `getMemorySummary` based on subcommand.

- [ ] **Step 4: Modify `src/index.ts` to register new commands**

Add imports for `executeSense`, `executeReview`, `executeRemember`. Register three new commander commands: `sense`, `review <branch>`, `remember <subcommand> [args...]` with their options.

- [ ] **Step 5: Build and verify**

```bash
npm run build
node dist/index.js --help    # should show 6 commands
node dist/index.js sense --help
node dist/index.js review --help
node dist/index.js remember --help
```

- [ ] **Step 6: Run all tests, type check, commit**

```bash
npx vitest run
npx tsc --noEmit
git add src/cli/ src/index.ts
git commit -m "feat: add CLI entrypoints for sense, review, and remember commands"
```

---

## Task 15: Integration Test and Final Verification

**Files:**
- Modify: various (fixes from integration testing)

- [ ] **Step 1: Run end-to-end manual test sequence**

```bash
npm run build

# 1. Sensory scan
node dist/index.js sense
node dist/index.js sense --json

# 2. Record an event in memory
node dist/index.js remember record --type=baseline-updated --data='{"source":"sprint1"}'

# 3. Query memory
node dist/index.js remember query "baseline sprint1"

# 4. View memory summary
node dist/index.js remember summary

# 5. Verify existing commands still work
node dist/index.js pulse
node dist/index.js hotspots --since 7d
node dist/index.js ghosts
```

Note: `giti review <branch>` requires a branch that differs from main. If no suitable branch exists, test with `--json` mode and verify it handles the case gracefully.

- [ ] **Step 2: Fix any issues discovered during integration**

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit           # zero errors
npx vitest run             # all tests pass
npx vitest run --coverage  # 80%+ on all new code
npm run build              # clean build
```

- [ ] **Step 4: Commit fixes, push**

```bash
git add -A
git commit -m "fix: integration fixes for sprint 1 agents"
git push origin main
```

---
