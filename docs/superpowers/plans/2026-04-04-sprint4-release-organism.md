# Sprint 4: Release the Organism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release the organism to the world: DashClaw dashboards for public observation, GitHub integration for real PR-based workflow, a content pipeline that narrates the organism's evolution, and a reusable framework (`@livingcode/core`) so any project can become a living codebase.

**Architecture:** Four deliverables built sequentially. DashClaw reporter pushes cycle data to a dashboard. GitHub client replaces local merges with real PRs. Content pipeline uses Claude to generate evolution narratives. Framework extraction packages the agent infrastructure into a standalone npm package, then giti is refactored to consume it via npm workspaces monorepo.

**Tech Stack:** TypeScript (strict, ESM), @anthropic-ai/sdk (content narratives), @octokit/rest (GitHub API), npm workspaces (monorepo), tsup, vitest

---

## Pre-existing Modules

All Sprint 0-3 modules remain. Key files the plan touches:
- `src/agents/orchestrator/cycle.ts` — lifecycle cycle, needs post-cycle DashClaw reporting and GitHub PR workflow
- `src/agents/orchestrator/types.ts` — CycleResult, needs extension
- `src/agents/motor-cortex/branch-manager.ts` — needs remote push capability
- `src/index.ts` — CLI entry, currently 13 commands, will gain `dispatch` command
- `package.json` — needs @octokit/rest dep, version bump, workspace migration

## File Map

### Deliverable 1: DashClaw Dashboard
- **Create:** `src/integrations/dashclaw/types.ts` — DashClawCycleReport, VitalSigns, panel config types
- **Create:** `src/integrations/dashclaw/reporter.ts` — Build report from cycle data, push to DashClaw API or write locally
- **Create:** `src/integrations/dashclaw/fitness.ts` — Composite fitness score calculator
- **Create:** `src/integrations/dashclaw/config.ts` — Dashboard panel configuration (declarative JSON)
- **Create:** `tests/integrations/dashclaw/reporter.test.ts`
- **Create:** `tests/integrations/dashclaw/fitness.test.ts`

### Deliverable 2: GitHub Integration
- **Create:** `src/integrations/github/types.ts` — GitHubClient interface, PR params
- **Create:** `src/integrations/github/client.ts` — Octokit-based GitHub API client
- **Create:** `src/integrations/github/pr-formatter.ts` — Format PR descriptions with review data
- **Create:** `src/integrations/github/issue-triage.ts` — Scan issues, identify addressable ones
- **Create:** `src/integrations/github/release-notes.ts` — Generate release notes for growth features
- **Create:** `tests/integrations/github/client.test.ts`
- **Create:** `tests/integrations/github/pr-formatter.test.ts`
- **Create:** `tests/integrations/github/issue-triage.test.ts`
- **Modify:** `src/agents/motor-cortex/branch-manager.ts` — Add `pushBranch` function
- **Modify:** `src/agents/orchestrator/cycle.ts` — Replace local merge with PR workflow when GitHub configured

### Deliverable 3: Content Pipeline
- **Create:** `src/content/types.ts` — EvolutionDispatch, MilestoneType
- **Create:** `src/content/dispatch-generator.ts` — Build dispatch from cycle data
- **Create:** `src/content/narrative.ts` — Claude API narrative generation
- **Create:** `src/content/milestones.ts` — Milestone detection logic
- **Create:** `src/content/platform-formatter.ts` — Twitter, LinkedIn, HN, blog formatting
- **Create:** `src/cli/dispatch.ts` — CLI handler for `giti dispatch`
- **Create:** `tests/content/dispatch-generator.test.ts`
- **Create:** `tests/content/milestones.test.ts`
- **Create:** `tests/content/platform-formatter.test.ts`

### Deliverable 4: Framework Extraction + Monorepo
- **Create:** `packages/livingcode-core/` — full package structure
- **Create:** `packages/livingcode-core/src/index.ts` — Public API (`LivingCodebase` class)
- **Create:** `packages/livingcode-core/src/schema/organism.schema.json` — JSON Schema
- **Create:** `packages/livingcode-core/src/schema/validator.ts` — Schema validation
- **Create:** `packages/livingcode-core/package.json`
- **Create:** `packages/livingcode-core/tsconfig.json`
- **Create:** `packages/livingcode-core/tsup.config.ts`
- **Create:** `packages/livingcode-core/README.md`
- **Modify:** Root `package.json` — Add workspaces config
- **Move:** `src/` → `packages/giti/src/` (monorepo restructure)

### CLI & Docs
- **Modify:** `src/index.ts` — Add `dispatch` command
- **Modify:** `.env.example` — Add GitHub and DashClaw env vars
- **Modify:** `README.md` — Sprint 4 content

---

## Task 1: DashClaw Types and Fitness Score

**Files:**
- Create: `src/integrations/dashclaw/types.ts`
- Create: `src/integrations/dashclaw/fitness.ts`
- Create: `tests/integrations/dashclaw/fitness.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface VitalSigns {
  fitness_score: number;
  test_coverage: number;
  lint_errors: number;
  complexity_avg: number;
  performance: Record<string, number>;
  dependency_health: number;
  commit_velocity_7d: number;
  mutation_success_rate: number;
  regression_rate: number;
}

export interface CycleSummary {
  outcome: string;
  items_planned: number;
  items_implemented: number;
  items_approved: number;
  items_merged: number;
  growth_proposals: number;
  api_tokens_used: number;
}

export interface DecisionEntry {
  agent: string;
  action: string;
  reasoning: string;
  outcome: string;
}

export interface EvolutionaryState {
  total_commands: number;
  commands_list: string[];
  total_files: number;
  total_lines: number;
  organism_born: string;
  total_cycles: number;
  total_changes_merged: number;
  total_changes_rejected: number;
  growth_features_shipped: number;
  current_cooldown: boolean;
  emerged_preferences: string[];
  top_lessons: string[];
}

export interface DashClawCycleReport {
  cycle_number: number;
  timestamp: string;
  organism_version: string;
  vital_signs: VitalSigns;
  cycle_summary: CycleSummary;
  decisions: DecisionEntry[];
  evolutionary_state: EvolutionaryState;
}

export interface DashClawConfig {
  api_key?: string;
  endpoint?: string;
  dashboard_id?: string;
}
```

- [ ] **Step 2: Write fitness score tests**

Test `calculateFitnessScore(report: StateReport, cycleHistory: CycleResult[]): number`:
- Perfect health (100% coverage, 0 errors, fast perf, high mutation rate) → score near 100
- Low coverage (50%) → score drops significantly
- Lint errors → score drops
- Performance over budget → score drops
- High regression rate → score drops
- Empty cycle history → uses only current report metrics

- [ ] **Step 3: Implement fitness.ts**

Composite score (0-100) weighted across dimensions:
- Test coverage: 25% weight (0 at 0%, 25 at 100%)
- Lint health: 15% weight (15 at 0 errors, 0 at 10+ errors)
- Performance: 15% weight (15 if all under budget, scaled down by overages)
- Dependency health: 10% weight (10 at 0 vulns/outdated, scaled down)
- Mutation success: 20% weight (ratio of approved/attempted changes)
- Regression rate: 15% weight (15 at 0%, 0 at 20%+)

```typescript
import type { StateReport } from '../../agents/sensory-cortex/types.js';
import type { CycleResult } from '../../agents/orchestrator/types.js';

export function calculateFitnessScore(report: StateReport, history: CycleResult[]): number {
  let score = 0;
  // Coverage: 25 points max
  score += Math.min(25, (report.quality.test_coverage_percent / 100) * 25);
  // Lint: 15 points max
  score += Math.max(0, 15 - report.quality.lint_error_count * 1.5);
  // Performance: 15 points (simplified — all within budget = 15)
  const perfOverages = [report.performance.pulse_execution_ms, report.performance.hotspots_execution_ms, report.performance.ghosts_execution_ms]
    .filter(ms => ms > 5000).length;
  score += Math.max(0, 15 - perfOverages * 5);
  // Dependencies: 10 points
  score += Math.max(0, 10 - report.dependencies.vulnerable_count * 5 - report.dependencies.outdated_count * 0.5);
  // Mutation success rate: 20 points (from history)
  if (history.length > 0) {
    const totalAttempted = history.reduce((s, c) => s + c.changes_attempted, 0);
    const totalApproved = history.reduce((s, c) => s + c.changes_approved, 0);
    const mutationRate = totalAttempted > 0 ? totalApproved / totalAttempted : 1;
    score += mutationRate * 20;
  } else {
    score += 20; // No history = assume healthy
  }
  // Regression rate: 15 points
  if (history.length > 0) {
    const totalMerged = history.reduce((s, c) => s + c.changes_merged, 0);
    const totalRegressions = history.filter(c => c.regressions.length > 0).length;
    const regRate = totalMerged > 0 ? totalRegressions / totalMerged : 0;
    score += Math.max(0, 15 * (1 - regRate * 5));
  } else {
    score += 15;
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateDependencyHealth(report: StateReport): number {
  const vulnPenalty = report.dependencies.vulnerable_count * 20;
  const outdatedPenalty = report.dependencies.outdated_count * 5;
  return Math.max(0, 100 - vulnPenalty - outdatedPenalty);
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/integrations/dashclaw/fitness.test.ts
npx tsc --noEmit
git add src/integrations/dashclaw/types.ts src/integrations/dashclaw/fitness.ts tests/integrations/dashclaw/fitness.test.ts
git commit -m "feat: add DashClaw types and fitness score calculator"
```

---

## Task 2: DashClaw Reporter

**Files:**
- Create: `src/integrations/dashclaw/reporter.ts`
- Create: `src/integrations/dashclaw/config.ts`
- Create: `tests/integrations/dashclaw/reporter.test.ts`

- [ ] **Step 1: Write reporter tests**

Test `buildDashClawReport(cycle, report, plan, history, kb, config)` produces valid DashClawCycleReport. Test `pushReport(report, dashclawConfig)` writes locally when no API key, and would POST when key present (mock fetch).

- [ ] **Step 2: Implement reporter.ts**

`buildDashClawReport` assembles the full report from cycle data, state report, plan, history, and knowledge base. `pushReport` sends to DashClaw API if configured, otherwise writes to `.organism/dashclaw-reports/`.

- [ ] **Step 3: Implement config.ts**

Dashboard panel configuration as a JSON structure. Export `getDashboardConfig()` returning the 6-panel layout specification. This can be used to initialize a DashClaw dashboard via API or as documentation for manual setup.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/integrations/dashclaw/
npx tsc --noEmit
git add src/integrations/dashclaw/reporter.ts src/integrations/dashclaw/config.ts tests/integrations/dashclaw/reporter.test.ts
git commit -m "feat: add DashClaw reporter with cycle report builder and push"
```

---

## Task 3: GitHub Client and PR Formatter

**Files:**
- Create: `src/integrations/github/types.ts`
- Create: `src/integrations/github/client.ts`
- Create: `src/integrations/github/pr-formatter.ts`
- Create: `tests/integrations/github/client.test.ts`
- Create: `tests/integrations/github/pr-formatter.test.ts`

- [ ] **Step 1: Install @octokit/rest**

```bash
npm install @octokit/rest
```

- [ ] **Step 2: Create types.ts**

```typescript
export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  auto_merge: boolean;
  auto_merge_delay_ms: number;
}

export interface PRParams {
  branch: string;
  title: string;
  body: string;
  labels: string[];
}

export interface PRResult {
  number: number;
  url: string;
}
```

- [ ] **Step 3: Write client tests**

Mock `@octokit/rest`. Test `createPullRequest`, `mergePullRequest`, `closePullRequest`, `createComment`, `createRelease`, `getOpenIssues`. Verify correct Octokit method calls with expected params.

- [ ] **Step 4: Implement client.ts**

Wrap Octokit with the `GitHubClient` interface. Each method delegates to the appropriate Octokit REST method. Handle errors gracefully. Constructor takes `GitHubConfig`. Export a factory: `createGitHubClient(config)`. Return null if no token configured (GitHub integration is optional).

- [ ] **Step 5: Write pr-formatter tests**

Test `formatPRBody(workItem, cycleNumber, verdict, stateReport)` produces markdown with all required sections (what changed, why, immune review, memory context, metrics).

- [ ] **Step 6: Implement pr-formatter.ts**

Build the PR description markdown from work item data, cycle context, immune verdict, and state report metrics. Include the organism attribution footer.

- [ ] **Step 7: Run tests, commit**

```bash
npx vitest run tests/integrations/github/
npx tsc --noEmit
git add src/integrations/github/ tests/integrations/github/ package.json package-lock.json
git commit -m "feat: add GitHub integration with PR creation and formatting"
```

---

## Task 4: GitHub Issue Triage and Release Notes

**Files:**
- Create: `src/integrations/github/issue-triage.ts`
- Create: `src/integrations/github/release-notes.ts`
- Create: `tests/integrations/github/issue-triage.test.ts`

- [ ] **Step 1: Write issue triage tests**

Test `triageIssues(issues, config)`: identifies issues within growth zone, ignores others. Test `formatTriageComment(issue)` produces the right response.

- [ ] **Step 2: Implement issue-triage.ts**

```typescript
import type { OrganismConfig } from '../../agents/types.js';

export function triageIssues(
  issues: Array<{ number: number; title: string; body: string; labels: string[] }>,
  config: OrganismConfig,
): Array<{ number: number; addressable: boolean; reason: string }> {
  // For each issue, check if title/body keywords match growth_zone topics
  // Never engage with issues matching forbidden_zone
  // Be conservative — only mark as addressable if there's a clear match
}

export function formatTriageComment(issueTitle: string): string {
  return `This looks like something I might be able to address in a future growth cycle. I'll analyze it when I next run.\n\n---\n*Comment by the Living Codebase organism.*`;
}
```

- [ ] **Step 3: Implement release-notes.ts**

`formatReleaseNotes(proposal, implementationResult, cycleHistory)` generates markdown release notes with the discovery-to-ship journey, organism stats, version bump logic (patch for maintenance, minor for growth features).

`calculateNextVersion(currentVersion, isGrowthFeature)` bumps version.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/integrations/github/
npx tsc --noEmit
git add src/integrations/github/issue-triage.ts src/integrations/github/release-notes.ts tests/integrations/github/issue-triage.test.ts
git commit -m "feat: add GitHub issue triage and release notes generation"
```

---

## Task 5: Integrate GitHub into Lifecycle Cycle

**Files:**
- Modify: `src/agents/motor-cortex/branch-manager.ts` — Add `pushBranch`
- Modify: `src/agents/orchestrator/cycle.ts` — Replace local merge with PR workflow when GitHub configured
- Modify: `.env.example` — Add GitHub env vars

- [ ] **Step 1: Add pushBranch to branch-manager.ts**

```typescript
export async function pushBranch(repoPath: string, branchName: string, remote: string = 'origin'): Promise<void> {
  const git = simpleGit(repoPath);
  await git.push(remote, branchName);
}

export async function deleteRemoteBranch(repoPath: string, branchName: string, remote: string = 'origin'): Promise<void> {
  const git = simpleGit(repoPath);
  await git.push(remote, `:${branchName}`);
}
```

- [ ] **Step 2: Update cycle.ts COMMIT phase**

In the COMMIT phase (Phase 5), check if GitHub integration is configured (`process.env['GITHUB_TOKEN']`). If yes:
- Push branch to remote
- Create PR with formatted body
- If not supervised and auto-merge enabled: schedule merge after delay
- If supervised: leave PR open for human review

If no GitHub token: keep existing local merge behavior.

```typescript
import { createGitHubClient } from '../../integrations/github/client.js';
import { formatPRBody } from '../../integrations/github/pr-formatter.js';
import { pushBranch, deleteRemoteBranch } from '../motor-cortex/branch-manager.js';
```

- [ ] **Step 3: Update .env.example**

Add GitHub vars.

- [ ] **Step 4: Run all tests, commit**

```bash
npx vitest run
npx tsc --noEmit
git add src/agents/motor-cortex/branch-manager.ts src/agents/orchestrator/cycle.ts .env.example
git commit -m "feat: integrate GitHub PR workflow into lifecycle cycle"
```

---

## Task 6: Content Pipeline Types and Milestones

**Files:**
- Create: `src/content/types.ts`
- Create: `src/content/milestones.ts`
- Create: `tests/content/milestones.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface EvolutionDispatch {
  cycle: number;
  timestamp: string;
  headline: string;
  narrative: string;
  key_moments: Array<{ moment: string; significance: string }>;
  stats: {
    changes_merged: number;
    changes_rejected: number;
    growth_proposals: number;
    fitness_delta: number;
    streak: number;
  };
  content_hooks: string[];
  milestone?: string;
  platform_versions: {
    twitter: string;
    linkedin: string;
    hn: string;
    blog: string;
  };
}

export type MilestoneType =
  | 'first-cycle'
  | 'first-merge'
  | 'first-growth-proposal'
  | 'first-growth-shipped'
  | 'changes-10' | 'changes-25' | 'changes-50' | 'changes-100'
  | 'first-self-fix'
  | 'first-self-rejection'
  | 'ship-of-theseus';
```

- [ ] **Step 2: Write milestone tests**

Test `detectMilestone(cycleResult, history, kb)`: returns correct MilestoneType for each condition, returns undefined when no milestone.

- [ ] **Step 3: Implement milestones.ts**

```typescript
import type { MilestoneType } from './types.js';
import type { CycleResult } from '../agents/orchestrator/types.js';
import type { KnowledgeBase } from '../agents/memory/types.js';

export function detectMilestone(
  result: CycleResult,
  history: CycleResult[],
  kb: KnowledgeBase | null,
): MilestoneType | undefined {
  const totalCycles = history.length + 1;
  const totalMerged = history.reduce((s, c) => s + c.changes_merged, 0) + result.changes_merged;
  
  if (totalCycles === 1) return 'first-cycle';
  if (totalMerged === 1 && result.changes_merged === 1) return 'first-merge';
  if (totalMerged === 10) return 'changes-10';
  if (totalMerged === 25) return 'changes-25';
  if (totalMerged === 50) return 'changes-50';
  if (totalMerged === 100) return 'changes-100';
  
  // Check KB for growth proposals
  if (kb) {
    const growthShipped = kb.events.filter(e => e.type === 'growth-approved').length;
    const growthProposed = kb.events.filter(e => e.type === 'growth-proposed').length;
    if (growthProposed === 1 && result.cycle === kb.events.find(e => e.type === 'growth-proposed')?.cycle) return 'first-growth-proposal';
    if (growthShipped === 1) return 'first-growth-shipped';
    
    // First self-rejection
    const rejections = kb.events.filter(e => e.type === 'growth-rejected');
    if (rejections.length === 1 && result.cycle === rejections[0]?.cycle) return 'first-self-rejection';
  }
  
  // Self-fix: regression followed by fix in next cycle
  if (history.length > 0) {
    const prev = history[history.length - 1];
    if (prev && prev.regressions.length > 0 && result.changes_merged > 0 && result.regressions.length === 0) {
      return 'first-self-fix';
    }
  }
  
  return undefined;
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/content/milestones.test.ts
npx tsc --noEmit
git add src/content/types.ts src/content/milestones.ts tests/content/milestones.test.ts
git commit -m "feat: add content pipeline types and milestone detection"
```

---

## Task 7: Dispatch Generator and Narrative

**Files:**
- Create: `src/content/dispatch-generator.ts`
- Create: `src/content/narrative.ts`
- Create: `src/content/platform-formatter.ts`
- Create: `tests/content/dispatch-generator.test.ts`
- Create: `tests/content/platform-formatter.test.ts`

- [ ] **Step 1: Write platform-formatter tests**

Test `formatForTwitter(headline, stats)` produces <=280 chars. Test `formatForLinkedIn(headline, narrative)` produces professional tone. Test `formatForHN(headline, stats)` produces factual/technical summary. Test `formatForBlog(narrative, keyMoments, stats)` produces long-form with sections.

- [ ] **Step 2: Implement platform-formatter.ts**

```typescript
export function formatForTwitter(headline: string, stats: EvolutionDispatch['stats'], milestone?: string): string {
  const base = milestone ? `🎯 Milestone: ${milestone}\n\n` : '';
  const statLine = `${stats.changes_merged} changes merged | fitness ${stats.fitness_delta > 0 ? '+' : ''}${stats.fitness_delta}`;
  const tweet = `${base}🧬 ${headline}\n\n${statLine}\n\n#LivingCodebase #AI`;
  return tweet.length > 280 ? tweet.slice(0, 277) + '...' : tweet;
}

export function formatForLinkedIn(headline: string, narrative: string, stats: EvolutionDispatch['stats']): string {
  return `🧬 Living Codebase Update\n\n${headline}\n\n${narrative}\n\nStats: ${stats.changes_merged} changes merged, ${stats.growth_proposals} growth proposals\n\n#AI #DevTools #Autonomy`;
}

export function formatForHN(headline: string, stats: EvolutionDispatch['stats']): string {
  return `${headline} — ${stats.changes_merged} changes, ${stats.streak} cycle streak`;
}

export function formatForBlog(narrative: string, keyMoments: Array<{ moment: string; significance: string }>, stats: EvolutionDispatch['stats']): string {
  let blog = `# Evolution Update\n\n${narrative}\n\n`;
  if (keyMoments.length > 0) {
    blog += '## Key Moments\n\n';
    for (const km of keyMoments) {
      blog += `- **${km.moment}** — ${km.significance}\n`;
    }
    blog += '\n';
  }
  blog += `## Stats\n\n- Changes merged: ${stats.changes_merged}\n- Growth proposals: ${stats.growth_proposals}\n- Fitness delta: ${stats.fitness_delta}\n- Streak: ${stats.streak} productive cycles\n`;
  return blog;
}
```

- [ ] **Step 3: Implement narrative.ts**

Uses Claude API to generate the nature-documentary-style narrative. Accepts cycle decision log, verdicts, growth proposals, memory lessons.

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateNarrative(context: NarrativeContext): Promise<{ headline: string; narrative: string; key_moments: Array<{ moment: string; significance: string }>; content_hooks: string[] }> {
  const client = new Anthropic();
  // Construct prompt with cycle data, ask for JSON response with headline, narrative, key_moments, content_hooks
  // Return parsed response
  // If API fails, return a template-based fallback narrative
}
```

Include a fallback that generates a basic template narrative without the API (for when ANTHROPIC_API_KEY isn't set).

- [ ] **Step 4: Implement dispatch-generator.ts**

`generateDispatch(cycleResult, stateReport, plan, history, kb)` → EvolutionDispatch:
1. Detect milestone
2. Calculate fitness delta from previous cycle
3. Calculate streak (consecutive productive cycles)
4. Generate narrative (API or fallback)
5. Format for each platform
6. Write to `.organism/content/dispatches/{cycle}-{timestamp}.json`
7. Return dispatch

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run tests/content/
npx tsc --noEmit
git add src/content/ tests/content/
git commit -m "feat: add content pipeline with narrative generation and platform formatting"
```

---

## Task 8: Content CLI Command

**Files:**
- Create: `src/cli/dispatch.ts`
- Modify: `src/index.ts` — Add `dispatch` command

- [ ] **Step 1: Implement dispatch CLI handler**

```typescript
export async function executeDispatch(options: { path?, json?, cycle?, list?, platform? }): Promise<void>
```

Subcommands:
- Default (no flags): generate dispatch for most recent cycle data
- `--list`: list all dispatches in `.organism/content/dispatches/`
- `--cycle=N`: show dispatch for cycle N
- `--platform=twitter|linkedin|hn|blog`: show platform-specific version

- [ ] **Step 2: Register in index.ts**

Add `dispatch` command with options.

- [ ] **Step 3: Build and verify**

```bash
npm run build
node dist/index.js --help    # Should show 14 commands
node dist/index.js dispatch --help
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run
npx tsc --noEmit
git add src/cli/dispatch.ts src/index.ts
git commit -m "feat: add dispatch CLI command for evolution narratives"
```

---

## Task 9: Framework Package Scaffolding

**Files:**
- Create: `packages/livingcode-core/package.json`
- Create: `packages/livingcode-core/tsconfig.json`
- Create: `packages/livingcode-core/tsup.config.ts`
- Create: `packages/livingcode-core/src/index.ts` — Placeholder public API

- [ ] **Step 1: Create package structure**

```bash
mkdir -p packages/livingcode-core/src
```

`packages/livingcode-core/package.json`:
```json
{
  "name": "@livingcode/core",
  "version": "0.1.0",
  "description": "Make any codebase alive — autonomous AI-agent lifecycle framework",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "license": "MIT",
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.82.0",
    "simple-git": "^3.33.0"
  },
  "devDependencies": {
    "@types/node": "^25.5.2",
    "tsup": "^8.5.1",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2"
  }
}
```

`packages/livingcode-core/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: true,
  sourcemap: true,
});
```

- [ ] **Step 2: Create placeholder index.ts**

```typescript
// @livingcode/core — Public API
// Framework for creating living codebases

export interface LivingCodebaseConfig {
  manifestPath: string;
  workingDir: string;
  motorCortex?: { model?: string; maxTokensPerItem?: number; maxRetriesPerItem?: number };
  schedule?: string;
}

export class LivingCodebase {
  constructor(public readonly config: LivingCodebaseConfig) {}
  
  async start(): Promise<void> {
    throw new Error('Not yet implemented — framework extraction in progress');
  }
  
  async runCycle(options?: { supervised?: boolean }): Promise<unknown> {
    throw new Error('Not yet implemented — framework extraction in progress');
  }
}

export { type OrganismConfig } from './types.js';
```

Create `packages/livingcode-core/src/types.ts` re-exporting the OrganismConfig interface.

- [ ] **Step 3: Commit**

```bash
git add packages/livingcode-core/
git commit -m "feat: scaffold @livingcode/core framework package"
```

---

## Task 10: Organism JSON Schema and Validator

**Files:**
- Create: `packages/livingcode-core/src/schema/organism.schema.json`
- Create: `packages/livingcode-core/src/schema/validator.ts`
- Create: `packages/livingcode-core/tests/schema/validator.test.ts`

- [ ] **Step 1: Create JSON Schema**

Formal JSON Schema for organism.json validating:
- Required: identity.name, identity.purpose
- Required: boundaries.growth_zone (non-empty array), boundaries.forbidden_zone (non-empty array)
- quality_standards: test_coverage_floor (number 0-100), max_complexity_per_function (number > 0), max_file_length (number > 0)
- lifecycle: max_changes_per_cycle (number > 0), requires_immune_approval (boolean)

- [ ] **Step 2: Write validator tests**

Test valid configs pass, missing required fields fail with clear error, invalid ranges fail.

- [ ] **Step 3: Implement validator.ts**

Simple validation function (no JSON Schema library dependency — hand-validate the required fields and types to keep deps minimal):

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOrganismConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  // Check required fields, types, ranges
  // Return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
cd packages/livingcode-core && npx vitest run tests/schema/
cd ../..
git add packages/livingcode-core/src/schema/ packages/livingcode-core/tests/
git commit -m "feat: add organism.json schema and validator for framework"
```

---

## Task 11: Framework README

**Files:**
- Create: `packages/livingcode-core/README.md`

- [ ] **Step 1: Write the framework README**

Sections:
- What is a Living Codebase (2 paragraphs, link to giti showcase)
- Quick Start (5 steps: install, create organism.json, create entry point, first cycle, observe)
- organism.json Reference (table of all fields with types and defaults)
- Agent Overview (one paragraph each for the 6 agents)
- Safety Features (kill switch, cooldown, budget, supervised mode)
- FAQ: "Is this safe?", "How much does it cost?", "Can it break my project?"
- Link to full architecture doc

- [ ] **Step 2: Commit**

```bash
git add packages/livingcode-core/README.md
git commit -m "docs: add @livingcode/core framework README"
```

---

## Task 12: Monorepo Migration

**Files:**
- Modify: Root `package.json` — Add workspaces
- Create: `packages/giti/` — Move existing src/, tests/, configs

This is the most delicate task. The key constraint: **everything that worked before must continue to work**.

- [ ] **Step 1: Set up npm workspaces in root package.json**

Create a root `package.json` with workspaces pointing to `packages/*`. The existing `package.json` becomes `packages/giti/package.json`.

```bash
# Move giti into packages/giti/
mkdir -p packages/giti
# Move all giti-specific files
mv src packages/giti/
mv tests packages/giti/
mv organism.json packages/giti/
mv tsconfig.json packages/giti/
mv tsup.config.ts packages/giti/
mv vitest.config.ts packages/giti/
mv TELEMETRY.md packages/giti/
mv LICENSE packages/giti/
```

Update root package.json:
```json
{
  "name": "living-codebase",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces"
  }
}
```

Keep the original package.json as `packages/giti/package.json` (already has all the right content).

- [ ] **Step 2: Verify giti still builds and tests pass**

```bash
cd packages/giti && npm run build && npm test && cd ../..
```

- [ ] **Step 3: Run workspace install**

```bash
npm install
```

- [ ] **Step 4: Verify everything works from the workspace root**

```bash
npm run build
npm test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate to npm workspaces monorepo (packages/giti + packages/livingcode-core)"
```

---

## Task 13: Integration Test and Final Verification

**Files:**
- Various fixes

- [ ] **Step 1: Build and test all packages**

```bash
npm run build
npm test
```

- [ ] **Step 2: Test giti CLI still works**

```bash
node packages/giti/dist/index.js --help    # 14 commands
node packages/giti/dist/index.js pulse
node packages/giti/dist/index.js plan --dry-run
node packages/giti/dist/index.js organism status
node packages/giti/dist/index.js telemetry status
node packages/giti/dist/index.js dispatch --help
```

- [ ] **Step 3: Test framework package builds**

```bash
cd packages/livingcode-core && npm run build && cd ../..
```

- [ ] **Step 4: Fix issues, verify coverage**

```bash
npx vitest run --coverage
npx tsc --noEmit
```

- [ ] **Step 5: Update docs**

Update root README.md for monorepo structure. Update CLAUDE.md. Update tasks/todo.md.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "docs: update documentation for Sprint 4 — release the organism"
git push origin main
```

---
