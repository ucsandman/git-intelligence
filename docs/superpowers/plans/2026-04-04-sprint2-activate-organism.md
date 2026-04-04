# Sprint 2: Activate the Organism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the organism the ability to think (Prefrontal Cortex), act (Motor Cortex), and run complete lifecycle cycles (Orchestrator) — making it a self-evolving codebase.

**Architecture:** Prefrontal Cortex reads state reports + memory → produces prioritized work items. Motor Cortex takes work items → calls Anthropic Claude API → applies changes on branches. Orchestrator coordinates all agents through sense → plan → build → review → commit → reflect. Safety systems (kill switch, cooldown, concurrent lock, failure limits) prevent runaway behavior. OpenClaw instrumentation is optional (env var gated).

**Tech Stack:** TypeScript (strict, ESM), @anthropic-ai/sdk (Motor Cortex), simple-git, vitest, chalk, ora, node:crypto

---

## Pre-existing Modules (DO NOT recreate)

- `src/agents/types.ts` — AgentRole, OrganismEvent, EventType, OrganismConfig
- `src/agents/utils.ts` — ensureOrganismDir, readJsonFile, writeJsonFile, loadOrganismConfig, getOrganismPath, runCommand
- `src/agents/sensory-cortex/index.ts` — `runSensoryCortex(repoPath)` returns `{ report, reportPath }`
- `src/agents/immune-system/index.ts` — `runImmuneReview(repoPath, branch)` returns `{ verdict, verdictPath }`
- `src/agents/immune-system/baselines.ts` — `readBaselines`, `writeBaselines`, `createBaselinesFromReport`
- `src/agents/memory/index.ts` — `recordMemoryEvent(repoPath, type, summary, data, tags)`, `queryMemory`, `getMemorySummary`
- `src/agents/memory/store.ts` — `loadKnowledgeBase`, `saveKnowledgeBase`, `createEvent`, `recordEvent`
- `src/agents/memory/curator.ts` — `curateKnowledgeBase`
- `src/utils/git.ts` — `createGitClient`, `validateGitRepo`, `getMainBranch`
- `src/index.ts` — CLI entry, currently 6 commands

## File Map

### Prefrontal Cortex
- **Create:** `src/agents/prefrontal-cortex/types.ts` — WorkItem, CyclePlan interfaces
- **Create:** `src/agents/prefrontal-cortex/prioritizer.ts` — Score and rank work items from state report
- **Create:** `src/agents/prefrontal-cortex/backlog.ts` — Read/write backlog items from .organism/backlog/
- **Create:** `src/agents/prefrontal-cortex/index.ts` — Orchestrator: load state, generate items, prioritize, produce plan
- **Create:** `src/agents/prefrontal-cortex/formatter.ts` — Human-readable plan output

### Motor Cortex
- **Create:** `src/agents/motor-cortex/types.ts` — ImplementationResult, ImplementationContext
- **Create:** `src/agents/motor-cortex/branch-manager.ts` — Create branch, apply changes, commit
- **Create:** `src/agents/motor-cortex/implementer.ts` — Call Claude API, parse response, apply changes, self-correct
- **Create:** `src/agents/motor-cortex/index.ts` — Orchestrator: take work item, implement, verify
- **Create:** `src/agents/motor-cortex/formatter.ts` — Human-readable build output

### Orchestrator & Safety
- **Create:** `src/agents/orchestrator/types.ts` — CycleResult, CycleOptions, OrganismStatus
- **Create:** `src/agents/orchestrator/safety.ts` — Kill switch, cooldown, lock, failure counter, API budget
- **Create:** `src/agents/orchestrator/cycle.ts` — Single lifecycle cycle logic (sense→plan→build→review→commit→reflect)
- **Create:** `src/agents/orchestrator/scheduler.ts` — setInterval-based scheduler with PID tracking
- **Create:** `src/agents/orchestrator/index.ts` — Top-level: start, stop, status, run single cycle

### OpenClaw Integration (lightweight)
- **Create:** `src/integrations/openclaw/types.ts` — AgentTrace interface
- **Create:** `src/integrations/openclaw/instrument.ts` — Trace wrapper, sends to OpenClaw if API key set

### CLI Entrypoints
- **Create:** `src/cli/plan.ts` — `giti plan` command
- **Create:** `src/cli/build.ts` — `giti build` command
- **Create:** `src/cli/cycle.ts` — `giti cycle` command
- **Create:** `src/cli/organism.ts` — `giti organism start|stop|status` command
- **Modify:** `src/index.ts` — Register 4 new commands
- **Modify:** `.env.example` — Add ANTHROPIC_API_KEY, optional OpenClaw vars
- **Modify:** `src/agents/types.ts` — Add new EventType values for cycle events

### Tests
- **Create:** `tests/agents/prefrontal-cortex/prioritizer.test.ts`
- **Create:** `tests/agents/prefrontal-cortex/backlog.test.ts`
- **Create:** `tests/agents/motor-cortex/implementer.test.ts`
- **Create:** `tests/agents/motor-cortex/branch-manager.test.ts`
- **Create:** `tests/agents/orchestrator/cycle.test.ts`
- **Create:** `tests/agents/orchestrator/safety.test.ts`

---

## Task 1: Install Dependencies and Update Shared Types

**Files:**
- Modify: `package.json` (add @anthropic-ai/sdk)
- Modify: `src/agents/types.ts` (add new EventType values)
- Modify: `.env.example` (add env vars)
- Modify: `.gitignore` (add .env if not there already)

- [ ] **Step 1: Install Anthropic SDK**

```bash
cd C:/Projects/git-intelligence
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Update EventType in src/agents/types.ts**

Add new event types needed by the orchestrator. The current `EventType` union needs these additions: `'cycle-started'`, `'plan-created'`, `'implementation-complete'`, `'implementation-failed'`, `'change-approved'`, `'merge-failed'`, `'merge-declined-by-human'`, `'cycle-complete'`.

- [ ] **Step 3: Update .env.example**

```
# Required for Motor Cortex (giti build / giti cycle)
ANTHROPIC_API_KEY=

# Optional: OpenClaw integration
OPENCLAW_API_KEY=
OPENCLAW_ENDPOINT=

# Optional: safety controls
GITI_API_BUDGET=100000
GITI_CYCLE_INTERVAL=86400000
GITI_SUPERVISED=true
```

- [ ] **Step 4: Verify, commit**

```bash
npx tsc --noEmit
npx vitest run
git add package.json package-lock.json src/agents/types.ts .env.example
git commit -m "chore: add Anthropic SDK and extend event types for Sprint 2"
```

---

## Task 2: Prefrontal Cortex Types and Backlog

**Files:**
- Create: `src/agents/prefrontal-cortex/types.ts`
- Create: `src/agents/prefrontal-cortex/backlog.ts`
- Create: `tests/agents/prefrontal-cortex/backlog.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
import type { AgentRole } from '../types.js';

export interface WorkItem {
  id: string;
  tier: 1 | 2 | 3 | 4 | 5;
  priority_score: number;        // 0-100 within tier
  title: string;
  description: string;
  rationale: string;
  target_files: string[];
  estimated_complexity: 'trivial' | 'small' | 'medium' | 'large';
  memory_context: string[];      // lesson IDs
  success_criteria: string[];
  created_by: AgentRole;
  status: 'proposed' | 'planned' | 'in-progress' | 'completed' | 'rejected';
}

export interface CyclePlan {
  cycle_number: number;
  timestamp: string;
  state_report_id: string;
  selected_items: WorkItem[];
  deferred_items: WorkItem[];
  rationale: string;
  estimated_risk: 'low' | 'medium' | 'high';
  memory_consulted: boolean;
}
```

- [ ] **Step 2: Write backlog tests**

Test `loadBacklog`, `saveWorkItem`, `listPendingItems`, `updateWorkItemStatus`. Use temp directory.

- [ ] **Step 3: Implement backlog.ts**

Functions for reading/writing work items as individual JSON files in `.organism/backlog/`:
- `loadBacklog(repoPath)` → reads all JSON files from backlog dir, returns WorkItem[]
- `saveWorkItem(repoPath, item)` → writes item to `.organism/backlog/{id}.json`
- `updateWorkItemStatus(repoPath, id, status)` → reads item, updates status, writes back
- `saveCyclePlan(repoPath, plan)` → writes plan to `.organism/backlog/cycle-plan-{timestamp}.json`
- `loadLatestCyclePlan(repoPath)` → reads most recent cycle plan

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/prefrontal-cortex/backlog.test.ts
npx tsc --noEmit
git add src/agents/prefrontal-cortex/types.ts src/agents/prefrontal-cortex/backlog.ts tests/agents/prefrontal-cortex/backlog.test.ts
git commit -m "feat: add prefrontal cortex types and backlog management"
```

---

## Task 3: Prefrontal Cortex Prioritizer

**Files:**
- Create: `src/agents/prefrontal-cortex/prioritizer.ts`
- Create: `tests/agents/prefrontal-cortex/prioritizer.test.ts`

- [ ] **Step 1: Write prioritizer tests**

Test `generateWorkItems(stateReport, config, kb)` and `prioritizeItems(items, maxItems, inCooldown)`.

Tests:
- Generates Tier 1 items for vulnerabilities in state report
- Generates Tier 1 items for lint errors
- Generates Tier 2 items for performance regression (>80% of budget)
- Generates Tier 2 items for coverage below floor
- Generates Tier 3 items for outdated deps, files approaching limits
- Tier ordering: all Tier 1 before Tier 2, etc.
- Max items enforced (3)
- During cooldown: only Tier 1 and 2 returned
- Memory consulted: fragile files increase risk score
- Empty state report → no items generated

- [ ] **Step 2: Implement prioritizer.ts**

```typescript
import crypto from 'node:crypto';
import type { StateReport } from '../sensory-cortex/types.js';
import type { OrganismConfig } from '../types.js';
import type { KnowledgeBase } from '../memory/types.js';
import type { WorkItem } from './types.js';

export function generateWorkItems(
  stateReport: StateReport,
  config: OrganismConfig,
  kb: KnowledgeBase | null,
): WorkItem[] {
  const items: WorkItem[] = [];
  // Tier 1: vulnerabilities, lint errors, test failures
  // Tier 2: regressions, performance approaching budget, coverage drop
  // Tier 3: outdated deps (patch/minor), files near limits, coverage improvements
  // Tier 4: growth signals, error handling improvements
  // Each item gets a priority_score within its tier (0-100)
  return items;
}

export function prioritizeItems(
  items: WorkItem[],
  maxItems: number,
  inCooldown: boolean,
): { selected: WorkItem[]; deferred: WorkItem[] } {
  let eligible = inCooldown ? items.filter(i => i.tier <= 2) : items;
  eligible.sort((a, b) => a.tier - b.tier || b.priority_score - a.priority_score);
  return {
    selected: eligible.slice(0, maxItems).map(i => ({ ...i, status: 'planned' as const })),
    deferred: eligible.slice(maxItems),
  };
}
```

The `generateWorkItems` function scans the StateReport sections:
- `dependencies.vulnerabilities.length > 0` → Tier 1 item per vulnerability
- `quality.lint_error_count > 0` → Tier 1 item
- `quality.test_pass_rate < 1` → Tier 1 item
- Performance at >80% of budget → Tier 2
- `quality.test_coverage_percent < config.quality_standards.test_coverage_floor` → Tier 2
- Coverage trending down (check anomalies) → Tier 2
- `dependencies.outdated_packages` → Tier 3 items (one per package, patch/minor only)
- `quality.files_exceeding_length_limit` → Tier 3
- `quality.functions_exceeding_complexity` → Tier 3

For each item, consult KB fragile_files to annotate risk. Include relevant lesson IDs in `memory_context`.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/agents/prefrontal-cortex/prioritizer.test.ts
git add src/agents/prefrontal-cortex/prioritizer.ts tests/agents/prefrontal-cortex/prioritizer.test.ts
git commit -m "feat: add prefrontal cortex prioritizer with tiered work item generation"
```

---

## Task 4: Prefrontal Cortex Orchestrator and Formatter

**Files:**
- Create: `src/agents/prefrontal-cortex/index.ts`
- Create: `src/agents/prefrontal-cortex/formatter.ts`

- [ ] **Step 1: Implement formatter.ts**

`formatCyclePlan(plan: CyclePlan): string` — chalk-formatted plan showing cycle number, selected items with tier/rationale/target/risk, deferred items, overall risk.

- [ ] **Step 2: Implement index.ts orchestrator**

`runPrefrontalCortex(repoPath: string, stateReport: StateReport, dryRun?: boolean): Promise<CyclePlan>`:
1. Load organism config
2. Load knowledge base
3. Load existing backlog
4. Check cooldown status (read `.organism/cooldown-until.json`)
5. Generate work items from state report
6. Merge with existing backlog items
7. Prioritize (max items from config, cooldown awareness)
8. Assemble CyclePlan
9. If not dry run: save plan and update work item statuses
10. Return plan

- [ ] **Step 3: Type check, run tests, commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/agents/prefrontal-cortex/index.ts src/agents/prefrontal-cortex/formatter.ts
git commit -m "feat: add prefrontal cortex orchestrator and formatter"
```

---

## Task 5: Motor Cortex Types and Branch Manager

**Files:**
- Create: `src/agents/motor-cortex/types.ts`
- Create: `src/agents/motor-cortex/branch-manager.ts`
- Create: `tests/agents/motor-cortex/branch-manager.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface ImplementationContext {
  work_item_id: string;
  title: string;
  description: string;
  target_files: string[];
  success_criteria: string[];
  quality_standards: {
    max_file_length: number;
    max_complexity: number;
    test_coverage_floor: number;
  };
  evolutionary_principles: string[];
  memory_lessons: string[];
  current_file_contents: Record<string, string>;  // filepath → content
}

export interface FileChange {
  path: string;
  action: 'modify' | 'create' | 'delete';
  content?: string;   // new content for modify/create
}

export interface ImplementationResult {
  work_item_id: string;
  branch_name: string;
  status: 'success' | 'partial' | 'failed';
  files_modified: string[];
  files_created: string[];
  files_deleted: string[];
  lines_added: number;
  lines_removed: number;
  tests_added: number;
  tests_modified: number;
  pre_review_check: {
    tests_pass: boolean;
    lint_clean: boolean;
    builds: boolean;
  };
  error?: string;
  claude_tokens_used: number;
}
```

- [ ] **Step 2: Write branch-manager tests**

Mock simple-git. Test:
- `createBranch(repoPath, branchName)` creates and checks out branch
- `commitChanges(repoPath, message, files)` stages and commits
- `switchToMain(repoPath)` switches back to main
- `mergeBranch(repoPath, branch)` merges and deletes branch
- `deleteBranch(repoPath, branch)` deletes branch
- Branch name follows organism convention: `organism/motor/{slug}`

- [ ] **Step 3: Implement branch-manager.ts**

```typescript
import simpleGit from 'simple-git';

export async function createBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.checkoutLocalBranch(branchName);
}

export async function commitChanges(repoPath: string, message: string, files: string[]): Promise<string> {
  const git = simpleGit(repoPath);
  await git.add(files);
  const result = await git.commit(message);
  return result.commit;
}

export async function switchToMain(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const branches = await git.branch();
  const main = branches.all.includes('main') ? 'main' : 'master';
  await git.checkout(main);
}

export async function mergeBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.merge([branch, '--no-ff']);
}

export async function deleteBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.deleteLocalBranch(branch, true);
}

export function generateBranchName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return `organism/motor/${slug}`;
}

export function formatCommitMessage(title: string, workItemId: string, tier: number, cycleNumber: number, description: string, rationale: string): string {
  return `organism(motor): ${title}\n\nWork item: ${workItemId}\nTier: ${tier}\nCycle: ${cycleNumber}\n\n${description}\n\nRationale: ${rationale}`;
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/motor-cortex/branch-manager.test.ts
npx tsc --noEmit
git add src/agents/motor-cortex/types.ts src/agents/motor-cortex/branch-manager.ts tests/agents/motor-cortex/branch-manager.test.ts
git commit -m "feat: add motor cortex types and branch manager"
```

---

## Task 6: Motor Cortex Implementer

**Files:**
- Create: `src/agents/motor-cortex/implementer.ts`
- Create: `tests/agents/motor-cortex/implementer.test.ts`

- [ ] **Step 1: Write implementer tests**

Mock `@anthropic-ai/sdk`. Test:
- `buildPrompt(context)` produces a structured prompt with file contents, work item details, quality standards
- `parseResponse(text)` extracts file changes from Claude's response
- `implementWorkItem(context, repoPath)` makes API call, applies changes, verifies
- Self-correction: if first attempt causes tsc/test failure, retries once with error context
- Max 2 API calls enforced
- Safety: refuses to modify organism.json, refuses to delete test files
- Returns correct ImplementationResult shape

- [ ] **Step 2: Implement implementer.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ImplementationContext, FileChange, ImplementationResult } from './types.js';
import { runCommand } from '../utils.js';

const FORBIDDEN_FILES = ['organism.json', '.organism'];
const MAX_API_CALLS = 2;

export function buildPrompt(context: ImplementationContext): string {
  // Construct a detailed prompt including:
  // - Work item description and success criteria
  // - Current file contents
  // - Quality standards
  // - Evolutionary principles
  // - Memory lessons
  // - Request structured output: JSON array of {path, action, content}
}

export function parseResponse(text: string): FileChange[] {
  // Extract JSON from Claude's response (handle markdown code blocks)
  // Validate each change: no forbidden files, no test deletion
  // Return FileChange[]
}

export async function implementWorkItem(
  context: ImplementationContext,
  repoPath: string,
): Promise<{ changes: FileChange[]; tokensUsed: number }> {
  const client = new Anthropic();
  let totalTokens = 0;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_API_CALLS; attempt++) {
    const prompt = attempt === 0
      ? buildPrompt(context)
      : buildRetryPrompt(context, lastError!);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    totalTokens += response.usage.input_tokens + response.usage.output_tokens;

    const changes = parseResponse(text);

    // Apply changes to filesystem
    await applyChanges(repoPath, changes);

    // Verify: tsc and vitest
    const tscResult = runCommand('npx', ['tsc', '--noEmit'], repoPath);
    if (tscResult.status !== 0) {
      lastError = `TypeScript compilation failed:\n${tscResult.stderr}`;
      await revertChanges(repoPath, changes, context.current_file_contents);
      continue;
    }

    const testResult = runCommand('npx', ['vitest', 'run'], repoPath);
    if (testResult.status !== 0) {
      lastError = `Tests failed:\n${testResult.stdout}\n${testResult.stderr}`;
      await revertChanges(repoPath, changes, context.current_file_contents);
      continue;
    }

    return { changes, tokensUsed: totalTokens };
  }

  throw new Error(`Implementation failed after ${MAX_API_CALLS} attempts: ${lastError}`);
}

async function applyChanges(repoPath: string, changes: FileChange[]): Promise<void> {
  for (const change of changes) {
    validateChange(change);
    const fullPath = path.join(repoPath, change.path);
    if (change.action === 'delete') {
      await fs.unlink(fullPath);
    } else if (change.content !== undefined) {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, change.content, 'utf-8');
    }
  }
}

async function revertChanges(repoPath: string, changes: FileChange[], originals: Record<string, string>): Promise<void> {
  for (const change of changes) {
    const fullPath = path.join(repoPath, change.path);
    if (change.action === 'create') {
      try { await fs.unlink(fullPath); } catch { /* may not exist */ }
    } else if (change.action === 'modify' && originals[change.path]) {
      await fs.writeFile(fullPath, originals[change.path]!, 'utf-8');
    }
  }
}

function validateChange(change: FileChange): void {
  for (const forbidden of FORBIDDEN_FILES) {
    if (change.path.startsWith(forbidden) || change.path === forbidden) {
      throw new Error(`Cannot modify forbidden file: ${change.path}`);
    }
  }
  if (change.action === 'delete' && (change.path.includes('.test.') || change.path.includes('.spec.'))) {
    throw new Error(`Cannot delete test file: ${change.path}`);
  }
}

function buildRetryPrompt(context: ImplementationContext, error: string): string {
  return buildPrompt(context) + `\n\n## Previous Attempt Failed\n\nThe previous implementation attempt produced this error:\n\`\`\`\n${error}\n\`\`\`\n\nPlease fix the issue and provide corrected file changes.`;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/agents/motor-cortex/implementer.test.ts
npx tsc --noEmit
git add src/agents/motor-cortex/implementer.ts tests/agents/motor-cortex/implementer.test.ts
git commit -m "feat: add motor cortex implementer with Claude API and self-correction"
```

---

## Task 7: Motor Cortex Orchestrator and Formatter

**Files:**
- Create: `src/agents/motor-cortex/index.ts`
- Create: `src/agents/motor-cortex/formatter.ts`

- [ ] **Step 1: Implement formatter.ts**

`formatBuildResult(result: ImplementationResult): string` — shows branch, changes, pre-review checks, API usage.

- [ ] **Step 2: Implement index.ts orchestrator**

`runMotorCortex(repoPath: string, workItem: WorkItem, cycleNumber: number): Promise<ImplementationResult>`:
1. Read current file contents for target files
2. Load relevant memory lessons
3. Load organism.json for quality standards and principles
4. Build ImplementationContext
5. Create branch via branch-manager
6. Call implementer
7. Commit changes on branch
8. Run pre-review checks (tsc, vitest, build)
9. Switch back to main
10. Assemble and return ImplementationResult

Safety: if anything fails, ensure branch is cleaned up and main is checked out.

- [ ] **Step 3: Type check, commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/agents/motor-cortex/index.ts src/agents/motor-cortex/formatter.ts
git commit -m "feat: add motor cortex orchestrator and formatter"
```

---

## Task 8: Orchestrator Safety Systems

**Files:**
- Create: `src/agents/orchestrator/types.ts`
- Create: `src/agents/orchestrator/safety.ts`
- Create: `tests/agents/orchestrator/safety.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface CycleOptions {
  supervised: boolean;
  repoPath: string;
}

export interface CycleResult {
  cycle: number;
  outcome: 'productive' | 'stable' | 'no-changes' | 'regression' | 'human-declined' | 'aborted';
  changes_merged: number;
  changes_attempted: number;
  changes_approved: number;
  changes_rejected: number;
  duration_ms: number;
  api_tokens_used: number;
  regressions: string[];
}

export interface OrganismStatus {
  state: 'running' | 'stopped' | 'cooldown' | 'paused';
  last_cycle: CycleResult | null;
  next_cycle_at: string | null;
  total_cycles: number;
  total_changes_merged: number;
  total_changes_rejected: number;
  total_api_tokens: number;
  api_budget: number;
  cooldown_until: string | null;
  consecutive_failures: number;
}

export interface SchedulerConfig {
  pid: number;
  interval_ms: number;
  started_at: string;
  repo_path: string;
}
```

- [ ] **Step 2: Write safety tests**

Test all safety functions:
- `isKillSwitchActive(repoPath)` — returns true if `.organism/kill-switch` exists
- `activateKillSwitch(repoPath)` — creates the file
- `deactivateKillSwitch(repoPath)` — removes the file
- `isInCooldown(repoPath)` — checks `.organism/cooldown-until.json` against current time
- `setCooldown(repoPath, durationMs)` — writes cooldown expiry
- `acquireCycleLock(repoPath)` — creates `.organism/active-cycle.json`, fails if lock exists and not stale (< 2h)
- `releaseCycleLock(repoPath)` — removes lock file
- `isCycleLockStale(repoPath)` — lock older than 2 hours is stale
- `getConsecutiveFailures(repoPath)` / `incrementFailures` / `resetFailures`
- `checkApibudget(repoPath)` — reads `.organism/api-usage.json`, returns remaining budget
- `recordApiUsage(repoPath, tokens)` — adds tokens to usage tracking

- [ ] **Step 3: Implement safety.ts**

All functions read/write JSON files in `.organism/`. Use the existing `readJsonFile`/`writeJsonFile` utilities.

Kill switch: just the presence of `.organism/kill-switch` (empty file).
Cooldown: `.organism/cooldown-until.json` with `{ until: ISO_string }`.
Lock: `.organism/active-cycle.json` with `{ started: ISO_string, cycle: number }`.
Failures: `.organism/consecutive-failures.json` with `{ count: number }`.
API usage: `.organism/api-usage.json` with `{ total_tokens: number, monthly_tokens: number, month: string, budget: number }`.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/orchestrator/safety.test.ts
npx tsc --noEmit
git add src/agents/orchestrator/types.ts src/agents/orchestrator/safety.ts tests/agents/orchestrator/safety.test.ts
git commit -m "feat: add orchestrator safety systems (kill switch, cooldown, lock, budget)"
```

---

## Task 9: Lifecycle Cycle Logic

**Files:**
- Create: `src/agents/orchestrator/cycle.ts`
- Create: `tests/agents/orchestrator/cycle.test.ts`

- [ ] **Step 1: Write cycle tests**

Mock all agent orchestrators. Test:
- Full happy path: sense→plan→build→review(approve)→merge→reflect
- Plan produces no items → outcome 'stable'
- Build fails → skips review for that item
- Review rejects → does not merge
- Supervised mode blocks before merge
- Kill switch checked at each phase boundary
- Cooldown prevents non-critical work
- Regression detected in post-merge scan → enters cooldown
- API usage tracked and budget checked
- Lock acquired at start, released at end
- Lock released on error (try/finally)
- 3 consecutive failures → outcome 'paused'

- [ ] **Step 2: Implement cycle.ts**

```typescript
import type { CycleOptions, CycleResult } from './types.js';
import * as safety from './safety.js';
import { runSensoryCortex } from '../sensory-cortex/index.js';
import { runPrefrontalCortex } from '../prefrontal-cortex/index.js';
import { runMotorCortex } from '../motor-cortex/index.js';
import { runImmuneReview } from '../immune-system/index.js';
import { createBaselinesFromReport, writeBaselines } from '../immune-system/baselines.js';
import { recordMemoryEvent } from '../memory/index.js';
import { mergeBranch, deleteBranch, switchToMain } from '../motor-cortex/branch-manager.js';

export async function runLifecycleCycle(options: CycleOptions): Promise<CycleResult> {
  const { repoPath, supervised } = options;
  const startTime = Date.now();

  // Safety checks
  if (await safety.isKillSwitchActive(repoPath)) {
    return abortedResult(0, startTime, 'Kill switch active');
  }
  if (await safety.getConsecutiveFailures(repoPath) >= 3) {
    return abortedResult(0, startTime, '3+ consecutive failures — paused');
  }

  // Acquire lock
  const cycle = await safety.acquireCycleLock(repoPath);

  try {
    // Phase 1: SENSE
    if (await safety.isKillSwitchActive(repoPath)) return abortedResult(cycle, startTime);
    const { report } = await runSensoryCortex(repoPath);
    await recordMemoryEvent(repoPath, 'cycle-started', `Cycle ${cycle} started`, { cycle });

    // Phase 2: PLAN
    if (await safety.isKillSwitchActive(repoPath)) return abortedResult(cycle, startTime);
    const inCooldown = await safety.isInCooldown(repoPath);
    const plan = await runPrefrontalCortex(repoPath, report, false);
    await recordMemoryEvent(repoPath, 'plan-created', `Planned ${plan.selected_items.length} items`, { cycle, items: plan.selected_items.length });

    if (plan.selected_items.length === 0) {
      await safety.releaseCycleLock(repoPath);
      await recordMemoryEvent(repoPath, 'cycle-complete', `Cycle ${cycle} stable`, { cycle, outcome: 'stable' });
      return stableResult(cycle, startTime);
    }

    // Phase 3: BUILD
    let totalTokens = 0;
    const buildResults = [];
    for (const item of plan.selected_items) {
      if (await safety.isKillSwitchActive(repoPath)) break;
      if (!await safety.checkApiBudget(repoPath)) break;
      try {
        const result = await runMotorCortex(repoPath, item, cycle);
        buildResults.push(result);
        totalTokens += result.claude_tokens_used;
        await safety.recordApiUsage(repoPath, result.claude_tokens_used);
      } catch (error) {
        await recordMemoryEvent(repoPath, 'implementation-failed', `Build failed: ${item.title}`, { cycle, error: String(error) });
      }
    }

    // Phase 4: DEFEND
    const approvedBranches: string[] = [];
    const rejectedCount = { value: 0 };
    for (const result of buildResults.filter(r => r.status === 'success')) {
      const { verdict } = await runImmuneReview(repoPath, result.branch_name);
      if (verdict.verdict === 'approve') {
        approvedBranches.push(result.branch_name);
      } else {
        rejectedCount.value++;
        await recordMemoryEvent(repoPath, 'change-rejected', `Rejected: ${result.branch_name}`, { cycle, branch: result.branch_name, verdict: verdict.verdict });
      }
    }

    // Phase 5: COMMIT
    if (supervised && approvedBranches.length > 0) {
      // In supervised mode, we skip merging and leave branches for human review
      // The CLI layer handles the interactive prompt
    }

    let mergedCount = 0;
    if (!supervised) {
      for (const branch of approvedBranches) {
        try {
          await switchToMain(repoPath);
          await mergeBranch(repoPath, branch);
          await deleteBranch(repoPath, branch);
          mergedCount++;
          await recordMemoryEvent(repoPath, 'change-merged', `Merged: ${branch}`, { cycle, branch });
        } catch (error) {
          await recordMemoryEvent(repoPath, 'merge-failed', `Merge failed: ${branch}`, { cycle, branch, error: String(error) });
        }
      }
    }

    // Phase 6: REFLECT
    if (mergedCount > 0) {
      const { report: postReport } = await runSensoryCortex(repoPath);
      const baselines = createBaselinesFromReport(postReport);
      await writeBaselines(repoPath, baselines);

      // Check for regressions
      const regression = detectRegression(report, postReport);
      if (regression) {
        await recordMemoryEvent(repoPath, 'regression-detected', regression, { cycle });
        await safety.setCooldown(repoPath, 48 * 60 * 60 * 1000);
      }
    }

    await recordMemoryEvent(repoPath, 'cycle-complete', `Cycle ${cycle} done`, {
      cycle, merged: mergedCount, attempted: buildResults.length, approved: approvedBranches.length,
    });

    if (mergedCount === 0 && buildResults.length > 0) {
      await safety.incrementFailures(repoPath);
    } else {
      await safety.resetFailures(repoPath);
    }

    return {
      cycle,
      outcome: mergedCount > 0 ? 'productive' : 'no-changes',
      changes_merged: mergedCount,
      changes_attempted: buildResults.length,
      changes_approved: approvedBranches.length,
      changes_rejected: rejectedCount.value,
      duration_ms: Date.now() - startTime,
      api_tokens_used: totalTokens,
      regressions: [],
    };
  } finally {
    await switchToMain(repoPath).catch(() => {});
    await safety.releaseCycleLock(repoPath);
  }
}

function detectRegression(before: StateReport, after: StateReport): string | null {
  if (after.quality.test_pass_rate < before.quality.test_pass_rate) return 'Test pass rate decreased';
  if (after.quality.lint_error_count > before.quality.lint_error_count) return 'New lint errors introduced';
  if (after.quality.test_coverage_percent < before.quality.test_coverage_percent - 2) return 'Coverage dropped >2%';
  return null;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/agents/orchestrator/cycle.test.ts
npx tsc --noEmit
git add src/agents/orchestrator/cycle.ts tests/agents/orchestrator/cycle.test.ts
git commit -m "feat: add lifecycle cycle logic with full agent coordination"
```

---

## Task 10: Orchestrator Scheduler and Status

**Files:**
- Create: `src/agents/orchestrator/scheduler.ts`
- Create: `src/agents/orchestrator/index.ts`

- [ ] **Step 1: Implement scheduler.ts**

```typescript
import type { SchedulerConfig } from './types.js';
import { readJsonFile, writeJsonFile, getOrganismPath } from '../utils.js';
import { runLifecycleCycle } from './cycle.js';

export async function startScheduler(repoPath: string, intervalMs: number): Promise<void> {
  const config: SchedulerConfig = {
    pid: process.pid,
    interval_ms: intervalMs,
    started_at: new Date().toISOString(),
    repo_path: repoPath,
  };
  await writeJsonFile(getOrganismPath(repoPath, 'scheduler.json'), config);

  // Run first cycle immediately
  await runLifecycleCycle({ repoPath, supervised: false });

  // Schedule recurring
  setInterval(async () => {
    try {
      await runLifecycleCycle({ repoPath, supervised: false });
    } catch (error) {
      console.error('Cycle failed:', error);
    }
  }, intervalMs);
}

export async function stopScheduler(repoPath: string): Promise<void> {
  // Write kill switch to stop current and prevent future cycles
  const { activateKillSwitch } = await import('./safety.js');
  await activateKillSwitch(repoPath);
  // Remove scheduler config
  const fs = await import('node:fs/promises');
  try {
    await fs.unlink(getOrganismPath(repoPath, 'scheduler.json'));
  } catch { /* may not exist */ }
}

export async function getSchedulerStatus(repoPath: string): Promise<SchedulerConfig | null> {
  return readJsonFile<SchedulerConfig>(getOrganismPath(repoPath, 'scheduler.json'));
}
```

- [ ] **Step 2: Implement index.ts**

```typescript
export async function getOrganismStatus(repoPath: string): Promise<OrganismStatus>
```

Reads from `.organism/` directory: scheduler config, cycle history, API usage, cooldown, consecutive failures. Assembles OrganismStatus object.

- [ ] **Step 3: Type check, commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/agents/orchestrator/scheduler.ts src/agents/orchestrator/index.ts
git commit -m "feat: add orchestrator scheduler and status reporting"
```

---

## Task 11: OpenClaw Integration (Lightweight)

**Files:**
- Create: `src/integrations/openclaw/types.ts`
- Create: `src/integrations/openclaw/instrument.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface AgentTrace {
  agent: string;
  action: string;
  cycle: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: 'success' | 'failure';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

- [ ] **Step 2: Implement instrument.ts**

```typescript
import type { AgentTrace } from './types.js';

export async function traceAgent<T>(
  agent: string,
  action: string,
  cycle: number,
  inputs: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const apiKey = process.env['OPENCLAW_API_KEY'];
  const startedAt = new Date().toISOString();
  const start = Date.now();

  try {
    const result = await fn();
    const trace: AgentTrace = {
      agent, action, cycle,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      status: 'success',
      inputs,
      outputs: { result: typeof result === 'object' ? 'object' : String(result) },
      metadata: {},
    };
    if (apiKey) await sendTrace(trace, apiKey);
    return result;
  } catch (error) {
    const trace: AgentTrace = {
      agent, action, cycle,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      status: 'failure',
      inputs,
      outputs: { error: String(error) },
      metadata: {},
    };
    if (apiKey) await sendTrace(trace, apiKey).catch(() => {});
    throw error;
  }
}

async function sendTrace(trace: AgentTrace, _apiKey: string): Promise<void> {
  // Placeholder: when OpenClaw endpoint is available, POST the trace
  // For now, write to local file for debugging
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const tracesDir = path.join(process.cwd(), '.organism', 'traces');
  await fs.mkdir(tracesDir, { recursive: true });
  const filename = `${trace.agent}-${trace.started_at.replace(/:/g, '-')}.json`;
  await fs.writeFile(path.join(tracesDir, filename), JSON.stringify(trace, null, 2));
}
```

- [ ] **Step 3: Type check, commit**

```bash
npx tsc --noEmit
git add src/integrations/openclaw/
git commit -m "feat: add OpenClaw instrumentation (env-gated, local fallback)"
```

---

## Task 12: CLI Entrypoints and Command Registration

**Files:**
- Create: `src/cli/plan.ts`
- Create: `src/cli/build.ts`
- Create: `src/cli/cycle.ts`
- Create: `src/cli/organism.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement src/cli/plan.ts**

`executePlan(options: { path?, json?, dryRun? })` — runs sensory cortex then prefrontal cortex, formats output.

- [ ] **Step 2: Implement src/cli/build.ts**

`executeBuild(itemIdOrAll: string, options: { path?, json?, all? })` — loads cycle plan, runs motor cortex on specified item(s), formats output.

- [ ] **Step 3: Implement src/cli/cycle.ts**

`executeCycle(options: { path?, json?, supervised? })` — runs a full lifecycle cycle, formats output.

- [ ] **Step 4: Implement src/cli/organism.ts**

`executeOrganism(subcommand: string, options: { path?, json?, interval? })` — dispatches to start/stop/status.

- [ ] **Step 5: Modify src/index.ts**

Add 4 new commands: `plan`, `build`, `cycle`, `organism`. Register with commander.

- [ ] **Step 6: Build and verify**

```bash
npm run build
node dist/index.js --help    # should show 10 commands
node dist/index.js plan --help
node dist/index.js build --help
node dist/index.js cycle --help
node dist/index.js organism --help
```

- [ ] **Step 7: Run all tests, type check, commit**

```bash
npx vitest run
npx tsc --noEmit
git add src/cli/plan.ts src/cli/build.ts src/cli/cycle.ts src/cli/organism.ts src/index.ts
git commit -m "feat: add CLI entrypoints for plan, build, cycle, and organism commands"
```

---

## Task 13: Integration Test and Final Verification

**Files:**
- Various fixes from integration testing

- [ ] **Step 1: Manual test sequence**

```bash
npm run build

# Test plan command (doesn't need API key)
node dist/index.js sense
node dist/index.js plan
node dist/index.js plan --json
node dist/index.js plan --dry-run

# Test organism status
node dist/index.js organism status

# Test existing commands still work
node dist/index.js pulse
node dist/index.js hotspots --since 7d
node dist/index.js ghosts

# Test memory still works
node dist/index.js remember summary
```

Note: `giti build` and `giti cycle` require ANTHROPIC_API_KEY. They can be verified by confirming they show a clear error when the key is missing.

- [ ] **Step 2: Fix any issues**

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit
npx vitest run
npx vitest run --coverage
npm run build
```

- [ ] **Step 4: Commit fixes, push**

```bash
git add -A
git commit -m "fix: integration fixes for sprint 2 organism activation"
git push origin main
```

---
