# Sprint 3: Enable Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the organism the ability to evolve by adding telemetry (usage signal), a usage simulator (bootstrap signal before real users), and the Growth Hormone agent (proposes new features from evidence). After this sprint the organism doesn't just maintain itself — it imagines and grows new capabilities.

**Architecture:** Telemetry collects anonymous, opt-in usage events to `.organism/telemetry/events.jsonl`. The simulator generates synthetic telemetry across diverse repo types. Growth Hormone reads telemetry, detects signal patterns, calls Claude API to generate evidence-based feature proposals, which are reviewed by the Immune System and fed to the Prefrontal Cortex as Tier 5 work items. The lifecycle cycle gains a GROW phase between PLAN and BUILD.

**Tech Stack:** TypeScript (strict, ESM), @anthropic-ai/sdk (Growth Hormone proposals), simple-git, vitest, chalk, ora, node:crypto, node:os, node:path

---

## Pre-existing Modules (DO NOT recreate)

- `src/agents/types.ts` — AgentRole (already includes 'growth-hormone'), EventType (already includes 'growth-proposed/approved/rejected'), OrganismConfig
- `src/agents/utils.ts` — ensureOrganismDir, readJsonFile, writeJsonFile, getOrganismPath, runCommand
- `src/agents/sensory-cortex/index.ts` — `runSensoryCortex(repoPath)`
- `src/agents/immune-system/index.ts` — `runImmuneReview(repoPath, branch)`
- `src/agents/memory/index.ts` — `recordMemoryEvent`, `queryMemory`, `getMemorySummary`
- `src/agents/memory/store.ts` — `loadKnowledgeBase`
- `src/agents/prefrontal-cortex/index.ts` — `runPrefrontalCortex(repoPath, stateReport, dryRun?)`
- `src/agents/prefrontal-cortex/prioritizer.ts` — `generateWorkItems`, `prioritizeItems`
- `src/agents/motor-cortex/index.ts` — `runMotorCortex(repoPath, workItem, cycle)`
- `src/agents/orchestrator/cycle.ts` — `runLifecycleCycle(options)` — needs GROW phase added
- `src/index.ts` — CLI entry, currently 10 commands

## File Map

### Telemetry System
- **Create:** `src/telemetry/types.ts` — TelemetryEvent, TelemetryConfig interfaces
- **Create:** `src/telemetry/collector.ts` — Record events, wrap commands with telemetry hooks
- **Create:** `src/telemetry/store.ts` — Read/write events.jsonl, user config in ~/.giti/
- **Create:** `src/telemetry/anonymizer.ts` — Bucket values, strip identifying info
- **Create:** `src/telemetry/reporter.ts` — Aggregate telemetry for Growth Hormone consumption

### Simulator
- **Create:** `src/simulator/types.ts` — SimulationConfig, ScenarioResult
- **Create:** `src/simulator/repo-generator.ts` — Create temporary git repos with varying characteristics
- **Create:** `src/simulator/scenarios.ts` — Predefined usage patterns
- **Create:** `src/simulator/index.ts` — Orchestrator: generate repos, run scenarios, produce telemetry

### Growth Hormone Agent
- **Create:** `src/agents/growth-hormone/types.ts` — GrowthProposal, GrowthSignal interfaces
- **Create:** `src/agents/growth-hormone/signal-analyzer.ts` — Detect patterns in telemetry data
- **Create:** `src/agents/growth-hormone/proposal-generator.ts` — Generate proposals via Claude API
- **Create:** `src/agents/growth-hormone/index.ts` — Orchestrator: analyze signals, generate/review proposals
- **Create:** `src/agents/growth-hormone/formatter.ts` — Human-readable growth output

### Integration Updates
- **Modify:** `src/agents/prefrontal-cortex/prioritizer.ts` — Add Tier 5 items from approved proposals
- **Modify:** `src/agents/orchestrator/cycle.ts` — Add GROW phase between PLAN and BUILD

### CLI Entrypoints
- **Create:** `src/cli/telemetry-cmd.ts` — `giti telemetry on|off|status|show|clear`
- **Create:** `src/cli/simulate.ts` — `giti simulate`
- **Create:** `src/cli/grow.ts` — `giti grow`
- **Modify:** `src/index.ts` — Register 3 new commands

### Documentation
- **Create:** `TELEMETRY.md` — Transparency document

### Tests
- **Create:** `tests/telemetry/collector.test.ts`
- **Create:** `tests/telemetry/anonymizer.test.ts`
- **Create:** `tests/telemetry/reporter.test.ts`
- **Create:** `tests/simulator/simulator.test.ts`
- **Create:** `tests/agents/growth-hormone/signal-analyzer.test.ts`
- **Create:** `tests/agents/growth-hormone/proposal-generator.test.ts`

---

## Task 1: Telemetry Types and Store

**Files:**
- Create: `src/telemetry/types.ts`
- Create: `src/telemetry/store.ts`
- Create: `tests/telemetry/store.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface TelemetryEvent {
  event_id: string;
  timestamp: string;
  giti_version: string;
  node_version: string;
  os_platform: string;
  command: string;
  flags_used: string[];
  execution_time_ms: number;
  exit_code: number;
  error_type?: string;
  repo_characteristics: RepoCharacteristics;
}

export interface RepoCharacteristics {
  commit_count_bucket: string;
  branch_count_bucket: string;
  author_count_bucket: string;
  primary_language: string;
  has_monorepo_structure: boolean;
  age_bucket: string;
}

export interface TelemetryConfig {
  enabled: boolean;
  first_prompt_shown: boolean;
}
```

- [ ] **Step 2: Write store tests**

Test:
- `getUserConfig()` returns default (disabled, not prompted) when no config file exists
- `setUserConfig(config)` writes to `~/.giti/config.json`
- Round-trip: set then get
- `appendEvent(repoPath, event)` appends JSONL line to `.organism/telemetry/events.jsonl`
- `readEvents(repoPath)` reads all events from JSONL
- `readEvents` returns empty array for missing file
- `clearEvents(repoPath)` deletes the events file
- `getRecentEvents(repoPath, n)` returns last N events

- [ ] **Step 3: Implement store.ts**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { TelemetryEvent, TelemetryConfig } from './types.js';
import { ensureOrganismDir, getOrganismPath } from '../agents/utils.js';

const CONFIG_DIR = path.join(os.homedir(), '.giti');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const EVENTS_FILE = 'telemetry/events.jsonl';

export async function getUserConfig(): Promise<TelemetryConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as TelemetryConfig;
  } catch {
    return { enabled: false, first_prompt_shown: false };
  }
}

export async function setUserConfig(config: TelemetryConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function appendEvent(repoPath: string, event: TelemetryEvent): Promise<void> {
  await ensureOrganismDir(repoPath, 'telemetry');
  const filePath = getOrganismPath(repoPath, EVENTS_FILE);
  await fs.appendFile(filePath, JSON.stringify(event) + '\n', 'utf-8');
}

export async function readEvents(repoPath: string): Promise<TelemetryEvent[]> {
  try {
    const content = await fs.readFile(getOrganismPath(repoPath, EVENTS_FILE), 'utf-8');
    return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as TelemetryEvent);
  } catch { return []; }
}

export async function getRecentEvents(repoPath: string, count: number): Promise<TelemetryEvent[]> {
  const all = await readEvents(repoPath);
  return all.slice(-count);
}

export async function clearEvents(repoPath: string): Promise<void> {
  try { await fs.unlink(getOrganismPath(repoPath, EVENTS_FILE)); } catch { /* ok */ }
}
```

- [ ] **Step 4: Run tests, type check, commit**

```bash
npx vitest run tests/telemetry/store.test.ts
npx tsc --noEmit
git add src/telemetry/types.ts src/telemetry/store.ts tests/telemetry/store.test.ts
git commit -m "feat: add telemetry types and local JSONL store"
```

---

## Task 2: Telemetry Anonymizer

**Files:**
- Create: `src/telemetry/anonymizer.ts`
- Create: `tests/telemetry/anonymizer.test.ts`

- [ ] **Step 1: Write anonymizer tests**

Test `bucketCommitCount`, `bucketBranchCount`, `bucketAuthorCount`, `bucketRepoAge`, `detectPrimaryLanguage`, `detectMonorepo`, `buildRepoCharacteristics`:
- 50 commits → '0-100'
- 500 commits → '100-1k'
- 5000 → '1k-10k', 50000 → '10k-100k', 200000 → '100k+'
- Branch buckets: 3 → '0-5', 15 → '5-20', 30 → '20-50', 60 → '50+'
- Author buckets: 1 → '1', 3 → '2-5', 10 → '5-20', 25 → '20+'
- Age buckets based on first commit date
- Language detection from file extension distribution
- Monorepo detection: multiple package.json files or packages/ directory

- [ ] **Step 2: Implement anonymizer.ts**

```typescript
import type { RepoCharacteristics } from './types.js';
import type { SimpleGit } from 'simple-git';

export function bucketCommitCount(count: number): string {
  if (count <= 100) return '0-100';
  if (count <= 1000) return '100-1k';
  if (count <= 10000) return '1k-10k';
  if (count <= 100000) return '10k-100k';
  return '100k+';
}

export function bucketBranchCount(count: number): string {
  if (count <= 5) return '0-5';
  if (count <= 20) return '5-20';
  if (count <= 50) return '20-50';
  return '50+';
}

export function bucketAuthorCount(count: number): string {
  if (count <= 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 20) return '5-20';
  return '20+';
}

export function bucketRepoAge(firstCommitDate: Date): string {
  const months = (Date.now() - firstCommitDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (months < 1) return '<1mo';
  if (months < 6) return '1-6mo';
  if (months < 24) return '6mo-2y';
  return '2y+';
}

export function detectPrimaryLanguage(fileDistribution: Record<string, number>): string {
  const langMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.java': 'Java',
  };
  let maxCount = 0;
  let primary = 'Unknown';
  for (const [ext, count] of Object.entries(fileDistribution)) {
    if (langMap[ext] && count > maxCount) {
      maxCount = count;
      primary = langMap[ext]!;
    }
  }
  return primary;
}

export async function buildRepoCharacteristics(git: SimpleGit, repoPath: string): Promise<RepoCharacteristics> {
  // Use git log, branch, and filesystem scanning to build bucketed characteristics
  // All values are bucketed — never exact numbers
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/telemetry/anonymizer.test.ts
git add src/telemetry/anonymizer.ts tests/telemetry/anonymizer.test.ts
git commit -m "feat: add telemetry anonymizer with bucketing functions"
```

---

## Task 3: Telemetry Collector and Reporter

**Files:**
- Create: `src/telemetry/collector.ts`
- Create: `src/telemetry/reporter.ts`
- Create: `tests/telemetry/collector.test.ts`
- Create: `tests/telemetry/reporter.test.ts`

- [ ] **Step 1: Write collector tests**

Test `recordCommandTelemetry(repoPath, command, flags, executionMs, exitCode, errorType?)`:
- Records event with all fields populated
- Silently swallows errors (never throws)
- Does nothing when telemetry is disabled
- Event has valid UUID, timestamp, version info
- Repo characteristics are bucketed

- [ ] **Step 2: Implement collector.ts**

```typescript
import crypto from 'node:crypto';
import os from 'node:os';
import type { TelemetryEvent } from './types.js';
import { getUserConfig, appendEvent } from './store.js';
import { buildRepoCharacteristics } from './anonymizer.js';
import { createGitClient } from '../utils/git.js';

export async function recordCommandTelemetry(
  repoPath: string,
  command: string,
  flags: string[],
  executionMs: number,
  exitCode: number,
  errorType?: string,
): Promise<void> {
  try {
    const config = await getUserConfig();
    if (!config.enabled) return;

    const git = createGitClient(repoPath);
    const characteristics = await buildRepoCharacteristics(git, repoPath);

    const event: TelemetryEvent = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      giti_version: '0.1.0', // read from package.json in real impl
      node_version: process.version,
      os_platform: os.platform(),
      command,
      flags_used: flags,
      execution_time_ms: executionMs,
      exit_code: exitCode,
      error_type: errorType,
      repo_characteristics: characteristics,
    };

    await appendEvent(repoPath, event);
  } catch {
    // Telemetry must NEVER crash the main command
  }
}
```

- [ ] **Step 3: Write reporter tests**

Test `aggregateTelemetry(events: TelemetryEvent[])`:
- Counts commands by frequency
- Identifies most used flags
- Calculates error rate per command
- Identifies common usage sequences (based on timestamps within 60s of each other)
- Returns aggregate stats object

- [ ] **Step 4: Implement reporter.ts**

```typescript
import type { TelemetryEvent } from './types.js';

export interface TelemetryAggregate {
  total_events: number;
  period_days: number;
  command_frequency: Record<string, number>;
  flag_frequency: Record<string, number>;
  error_rate_by_command: Record<string, number>;
  avg_execution_ms_by_command: Record<string, number>;
  repo_size_distribution: Record<string, number>;
  usage_sequences: Array<{ commands: string[]; count: number }>;
  json_usage_percent: number;
}

export function aggregateTelemetry(events: TelemetryEvent[]): TelemetryAggregate {
  // Aggregate all events into summary statistics
  // Detect sequences: group events by timestamp proximity (<60s apart)
}
```

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run tests/telemetry/
npx tsc --noEmit
git add src/telemetry/collector.ts src/telemetry/reporter.ts tests/telemetry/collector.test.ts tests/telemetry/reporter.test.ts
git commit -m "feat: add telemetry collector and reporter with silent-failure guarantee"
```

---

## Task 4: Usage Simulator

**Files:**
- Create: `src/simulator/types.ts`
- Create: `src/simulator/repo-generator.ts`
- Create: `src/simulator/scenarios.ts`
- Create: `src/simulator/index.ts`
- Create: `tests/simulator/simulator.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface SimulationConfig {
  scenario_count: number;
  repo_types: RepoType[];
}

export type RepoType = 'small' | 'medium' | 'large' | 'monorepo' | 'ancient' | 'fresh';

export interface ScenarioResult {
  repo_type: RepoType;
  scenario: string;
  commands_run: string[];
  events_generated: number;
  duration_ms: number;
}

export interface SimulationResult {
  timestamp: string;
  total_scenarios: number;
  total_events: number;
  results: ScenarioResult[];
  duration_ms: number;
}
```

- [ ] **Step 2: Write tests for repo-generator**

Test `generateRepo(type: RepoType, baseDir: string)`: creates a temp git repo with the expected characteristics for each type (commit count, author count, file count). Mock `simple-git` for speed.

- [ ] **Step 3: Implement repo-generator.ts**

Creates temporary git repos using `simple-git`:
- **small:** 50 commits, 1 author, 10 .ts files
- **medium:** 100 commits, 3 authors, 30 files
- **large:** 500 commits, 5 authors, 80 files (use fewer than spec says for speed)
- **monorepo:** 100 commits, packages/ directory with 3 sub-packages
- **ancient:** 100 commits spread over 3 years (backdate commits)
- **fresh:** 5 commits, 3 files

Each creates a real temp directory with `fs.mkdtemp`, runs `git init`, creates files, and makes commits.

- [ ] **Step 4: Write tests for scenarios**

Test scenario execution produces valid telemetry events with expected command distribution (pulse 3x more common, --json 20%, 5% errors).

- [ ] **Step 5: Implement scenarios.ts**

Predefined scenario functions that run giti commands against a repo:
- `quickCheck(repoPath)` — runs pulse only
- `deepAnalysis(repoPath)` — runs pulse, hotspots, ghosts in sequence
- `hotspotFocus(repoPath)` — runs hotspots with varying --since values
- `cleanupMode(repoPath)` — runs ghosts with different thresholds
- `jsonPipeline(repoPath)` — runs commands with --json
- `errorPath(repoPath)` — runs against invalid paths

Each scenario calls `recordCommandTelemetry` with measured timing.

- [ ] **Step 6: Implement index.ts orchestrator**

`runSimulation(repoPath: string, config: SimulationConfig): Promise<SimulationResult>`:
1. For each repo type in config, generate a temp repo
2. Select scenarios with weighted randomness: pulse-heavy (60%), deep analysis (30%), error (5%), json (5%)
3. Run scenarios against repos
4. Clean up temp repos
5. Return summary

- [ ] **Step 7: Run tests, commit**

```bash
npx vitest run tests/simulator/
npx tsc --noEmit
git add src/simulator/ tests/simulator/
git commit -m "feat: add usage simulator with diverse repo generation and scenarios"
```

---

## Task 5: Growth Hormone Types and Signal Analyzer

**Files:**
- Create: `src/agents/growth-hormone/types.ts`
- Create: `src/agents/growth-hormone/signal-analyzer.ts`
- Create: `tests/agents/growth-hormone/signal-analyzer.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface GrowthSignal {
  type: 'usage-concentration' | 'usage-sequence' | 'error-pattern' | 'flag-pattern' | 'missing-capability' | 'ecosystem-signal';
  title: string;
  evidence: string;
  confidence: number;       // 0-1
  data: Record<string, unknown>;
}

export interface GrowthProposal {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  rationale: string;
  evidence: Array<{ signal_type: string; data_point: string; confidence: number }>;
  proposed_interface: {
    command: string;
    flags: string[];
    output_description: string;
  };
  estimated_complexity: 'small' | 'medium' | 'large';
  target_files: string[];
  dependencies_needed: string[];
  alignment: {
    purpose_alignment: string;
    growth_zone_category: string;
    principle_compliance: string[];
  };
  risks: string[];
  success_metrics: string[];
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  immune_system_notes?: string;
}
```

- [ ] **Step 2: Write signal-analyzer tests**

Test `analyzeSignals(aggregate: TelemetryAggregate, config: OrganismConfig): GrowthSignal[]`:
- Detects usage concentration: one command has >50% of invocations → signal
- Detects usage sequences: a pair of commands run together >40% of multi-command sessions → signal
- Detects error patterns: a command has >5% error rate → signal
- Detects flag underuse: a flag available but used <5% → signal (low confidence)
- No signals for evenly distributed, low-error telemetry
- Confidence values between 0-1
- At most 6 signals returned (top by confidence)

Use fixture TelemetryAggregate data with known patterns.

- [ ] **Step 3: Implement signal-analyzer.ts**

```typescript
import type { TelemetryAggregate } from '../../telemetry/reporter.js';
import type { OrganismConfig } from '../types.js';
import type { GrowthSignal } from './types.js';

export function analyzeSignals(aggregate: TelemetryAggregate, config: OrganismConfig): GrowthSignal[] {
  const signals: GrowthSignal[] = [];
  
  // Usage concentration
  const totalCommands = Object.values(aggregate.command_frequency).reduce((a, b) => a + b, 0);
  for (const [cmd, count] of Object.entries(aggregate.command_frequency)) {
    const ratio = count / totalCommands;
    if (ratio > 0.5) {
      signals.push({
        type: 'usage-concentration',
        title: `${cmd} dominates usage at ${Math.round(ratio * 100)}%`,
        evidence: `${cmd} accounts for ${count}/${totalCommands} invocations`,
        confidence: Math.min(ratio, 0.95),
        data: { command: cmd, ratio, count },
      });
    }
  }
  
  // Usage sequences
  for (const seq of aggregate.usage_sequences) {
    if (seq.count >= 5) {
      const pairKey = seq.commands.join(' → ');
      signals.push({
        type: 'usage-sequence',
        title: `Users frequently run ${pairKey}`,
        evidence: `${seq.count} sessions follow this sequence`,
        confidence: Math.min(seq.count / 20, 0.9),
        data: { commands: seq.commands, count: seq.count },
      });
    }
  }

  // Error patterns
  for (const [cmd, rate] of Object.entries(aggregate.error_rate_by_command)) {
    if (rate > 0.05) {
      signals.push({
        type: 'error-pattern',
        title: `${cmd} has ${Math.round(rate * 100)}% error rate`,
        evidence: `${cmd} fails in ${Math.round(rate * 100)}% of runs`,
        confidence: Math.min(rate * 5, 0.85),
        data: { command: cmd, error_rate: rate },
      });
    }
  }

  // Flag underuse
  if (aggregate.json_usage_percent < 5 && aggregate.total_events > 50) {
    signals.push({
      type: 'flag-pattern',
      title: '--json flag rarely used',
      evidence: `--json used in only ${aggregate.json_usage_percent.toFixed(1)}% of runs`,
      confidence: 0.4,
      data: { json_usage_percent: aggregate.json_usage_percent },
    });
  }

  // Sort by confidence desc, take top 6
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals.slice(0, 6);
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/agents/growth-hormone/signal-analyzer.test.ts
npx tsc --noEmit
git add src/agents/growth-hormone/types.ts src/agents/growth-hormone/signal-analyzer.ts tests/agents/growth-hormone/signal-analyzer.test.ts
git commit -m "feat: add growth hormone types and signal analyzer"
```

---

## Task 6: Growth Hormone Proposal Generator

**Files:**
- Create: `src/agents/growth-hormone/proposal-generator.ts`
- Create: `tests/agents/growth-hormone/proposal-generator.test.ts`

- [ ] **Step 1: Write proposal-generator tests**

Mock `@anthropic-ai/sdk`. Test:
- `generateProposal(signal, config, kb)` calls Claude API with structured prompt
- `parseProposalResponse(text)` extracts GrowthProposal from Claude response
- `validateProposal(proposal, config, kb)` checks boundaries, evidence threshold, redundancy
- Proposals with forbidden_zone violations are rejected
- Proposals with <2 evidence points are rejected
- Proposals similar to previously rejected ones (in KB) are rejected
- Max 2 proposals per call

- [ ] **Step 2: Implement proposal-generator.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'node:crypto';
import type { GrowthSignal, GrowthProposal } from './types.js';
import type { OrganismConfig } from '../types.js';
import type { KnowledgeBase } from '../memory/types.js';

const MAX_PROPOSALS_PER_CYCLE = 2;

export function buildProposalPrompt(signals: GrowthSignal[], config: OrganismConfig): string {
  // Ask Claude to generate feature proposals based on signals
  // Include organism purpose, growth zones, forbidden zones, evolutionary principles
  // Request structured JSON output
}

export function parseProposalResponse(text: string): GrowthProposal[] {
  // Extract JSON from Claude response (handle code blocks)
  // Assign UUIDs and timestamps
  // Set status to 'proposed'
}

export function validateProposal(
  proposal: GrowthProposal,
  config: OrganismConfig,
  kb: KnowledgeBase | null,
): { valid: boolean; reason?: string } {
  // Check forbidden_zone: does the proposal involve anything forbidden?
  for (const forbidden of config.boundaries.forbidden_zone) {
    const lower = forbidden.toLowerCase();
    if (proposal.description.toLowerCase().includes(lower) || proposal.title.toLowerCase().includes(lower)) {
      return { valid: false, reason: `Violates forbidden zone: ${forbidden}` };
    }
  }

  // Check evidence threshold: at least 2 evidence points
  if (proposal.evidence.length < 2) {
    return { valid: false, reason: 'Insufficient evidence (need at least 2 data points)' };
  }

  // Check redundancy: similar proposal rejected before?
  if (kb) {
    const rejectedGrowth = kb.events.filter(e => e.type === 'growth-rejected');
    for (const event of rejectedGrowth) {
      const prevTitle = (event.data['title'] as string) ?? '';
      if (prevTitle && proposal.title.toLowerCase().includes(prevTitle.toLowerCase().slice(0, 20))) {
        return { valid: false, reason: `Similar proposal previously rejected: ${prevTitle}` };
      }
    }
  }

  // Check dependencies: prefer zero new deps
  if (proposal.dependencies_needed.length > 2) {
    return { valid: false, reason: 'Too many new dependencies (max 2)' };
  }

  return { valid: true };
}

export async function generateProposals(
  signals: GrowthSignal[],
  config: OrganismConfig,
  kb: KnowledgeBase | null,
): Promise<GrowthProposal[]> {
  // Filter signals to those with confidence >= 0.6
  const strongSignals = signals.filter(s => s.confidence >= 0.6);
  if (strongSignals.length < 2) return []; // Need at least 2 strong signals

  const client = new Anthropic();
  const prompt = buildProposalPrompt(strongSignals, config);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const proposals = parseProposalResponse(text);

  // Validate and filter
  const valid = proposals
    .filter(p => validateProposal(p, config, kb).valid)
    .slice(0, MAX_PROPOSALS_PER_CYCLE);

  return valid;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/agents/growth-hormone/proposal-generator.test.ts
npx tsc --noEmit
git add src/agents/growth-hormone/proposal-generator.ts tests/agents/growth-hormone/proposal-generator.test.ts
git commit -m "feat: add growth hormone proposal generator with Claude API and validation"
```

---

## Task 7: Growth Hormone Orchestrator and Formatter

**Files:**
- Create: `src/agents/growth-hormone/index.ts`
- Create: `src/agents/growth-hormone/formatter.ts`

- [ ] **Step 1: Implement formatter.ts**

`formatGrowthReport(signals: GrowthSignal[], proposals: GrowthProposal[]): string` — chalk-formatted output showing signals detected with confidence levels, proposals generated, and next steps.

- [ ] **Step 2: Implement index.ts orchestrator**

```typescript
export async function runGrowthHormone(repoPath: string): Promise<{ signals: GrowthSignal[]; proposals: GrowthProposal[] }>
```

Steps:
1. Read telemetry events from `.organism/telemetry/events.jsonl`
2. Aggregate via `aggregateTelemetry(events)`
3. Load organism config
4. Analyze signals via `analyzeSignals(aggregate, config)`
5. Load knowledge base
6. If strong signals exist, generate proposals via `generateProposals(signals, config, kb)`
7. Save proposals to `.organism/growth-proposals/{id}.json`
8. Record events in memory: 'growth-proposed' for each proposal
9. Return signals and proposals

```typescript
export async function loadApprovedProposals(repoPath: string): Promise<GrowthProposal[]>
```

Reads all proposals from `.organism/growth-proposals/`, filters to status 'approved'.

```typescript
export async function reviewProposal(repoPath: string, proposalId: string, approved: boolean, notes?: string): Promise<void>
```

Updates proposal status and records event in memory.

- [ ] **Step 3: Type check, commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/agents/growth-hormone/index.ts src/agents/growth-hormone/formatter.ts
git commit -m "feat: add growth hormone orchestrator and formatter"
```

---

## Task 8: Prefrontal Cortex Integration (Tier 5 Items)

**Files:**
- Modify: `src/agents/prefrontal-cortex/prioritizer.ts`

- [ ] **Step 1: Add Tier 5 generation from approved proposals**

Add to `generateWorkItems` function, after the existing Tier 3 section:

```typescript
// ── Tier 5: Growth proposals ────────────────────────────────────
// These come from approved Growth Hormone proposals
// They are passed in via the stateReport.growth_signals or loaded separately
```

Actually, the cleaner approach: add a new exported function:

```typescript
export function generateGrowthItems(proposals: GrowthProposal[], kb: KnowledgeBase | null): WorkItem[] {
  return proposals.map(p => createItem({
    tier: 5,
    priority_score: Math.round(p.evidence.reduce((sum, e) => sum + e.confidence, 0) / p.evidence.length * 100),
    title: p.title,
    description: p.description,
    rationale: p.rationale,
    target_files: p.target_files,
    estimated_complexity: p.estimated_complexity === 'small' ? 'small' : p.estimated_complexity === 'medium' ? 'medium' : 'large',
    success_criteria: p.success_metrics,
  }, kb));
}
```

And update the `runPrefrontalCortex` orchestrator to call `loadApprovedProposals`, generate Tier 5 items, and merge them into the item pool.

- [ ] **Step 2: Type check, run tests, commit**

```bash
npx tsc --noEmit
npx vitest run tests/agents/prefrontal-cortex/
git add src/agents/prefrontal-cortex/prioritizer.ts src/agents/prefrontal-cortex/index.ts
git commit -m "feat: integrate growth proposals as Tier 5 work items in prefrontal cortex"
```

---

## Task 9: Lifecycle Cycle GROW Phase

**Files:**
- Modify: `src/agents/orchestrator/cycle.ts`

- [ ] **Step 1: Add GROW phase between PLAN and BUILD**

After Phase 2 (PLAN) and before Phase 3 (BUILD), insert:

```typescript
    // Phase 2.5: GROW
    if (await safety.isKillSwitchActive(repoPath)) return makeResult(cycle, startTime, 'aborted');
    try {
      const { signals, proposals } = await runGrowthHormone(repoPath);
      if (proposals.length > 0) {
        await recordMemoryEvent(repoPath, 'growth-proposed', `${proposals.length} growth proposals generated`, {
          cycle, proposals: proposals.map(p => p.title),
        });
      }
    } catch {
      // Growth analysis failure is non-critical — continue with cycle
    }
```

Add import:
```typescript
import { runGrowthHormone } from '../growth-hormone/index.js';
```

- [ ] **Step 2: Run all tests (cycle tests should still pass with growth-hormone mocked), type check, commit**

```bash
npx vitest run
npx tsc --noEmit
git add src/agents/orchestrator/cycle.ts
git commit -m "feat: add GROW phase to lifecycle cycle between PLAN and BUILD"
```

---

## Task 10: CLI Entrypoints and TELEMETRY.md

**Files:**
- Create: `src/cli/telemetry-cmd.ts`
- Create: `src/cli/simulate.ts`
- Create: `src/cli/grow.ts`
- Create: `TELEMETRY.md`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement src/cli/telemetry-cmd.ts**

`executeTelemetry(subcommand: string, options: { path?, json?, last? })`:
- `on`: set config enabled=true
- `off`: set config enabled=false
- `status`: show current config
- `show`: display recent events (default 10, use --last flag)
- `clear`: delete all events

- [ ] **Step 2: Implement src/cli/simulate.ts**

`executeSimulate(options: { path?, json?, scenarios? })`: run the simulator, display results.

- [ ] **Step 3: Implement src/cli/grow.ts**

`executeGrow(options: { path?, json?, show?, proposalId? })`:
- Default: run growth analysis
- `--show`: list current proposals
- `--show <id>`: show specific proposal detail

- [ ] **Step 4: Create TELEMETRY.md**

Full transparency document as specified in the sprint spec. Covers what's collected, what's never collected, how to control it, how it's used, why it matters.

- [ ] **Step 5: Modify src/index.ts — register 3 new commands**

Add `telemetry <subcommand>`, `simulate`, `grow` commands.

- [ ] **Step 6: Build and verify**

```bash
npm run build
node dist/index.js --help    # Should show 13 commands
node dist/index.js telemetry --help
node dist/index.js simulate --help
node dist/index.js grow --help
```

- [ ] **Step 7: Run all tests, type check, commit**

```bash
npx vitest run
npx tsc --noEmit
git add src/cli/telemetry-cmd.ts src/cli/simulate.ts src/cli/grow.ts TELEMETRY.md src/index.ts
git commit -m "feat: add CLI for telemetry, simulate, and grow commands plus TELEMETRY.md"
```

---

## Task 11: Integration Test and Final Verification

**Files:**
- Various fixes from integration testing

- [ ] **Step 1: Manual test sequence**

```bash
npm run build

# Test telemetry commands
node dist/index.js telemetry status
node dist/index.js telemetry on
node dist/index.js telemetry status
node dist/index.js telemetry off

# Test existing commands still work
node dist/index.js pulse
node dist/index.js hotspots --since 7d
node dist/index.js ghosts

# Test plan (should now include Tier 5 if proposals exist)
node dist/index.js plan --dry-run

# Test organism status
node dist/index.js organism status

# Test grow (needs ANTHROPIC_API_KEY for proposal generation, but signal analysis should work)
node dist/index.js grow 2>&1

# Verify help
node dist/index.js --help
```

- [ ] **Step 2: Fix any issues**

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit
npx vitest run
npx vitest run --coverage
npm run build
```

- [ ] **Step 4: Update docs**

Update README.md to add the 3 new commands (telemetry, simulate, grow). Update CLAUDE.md with Sprint 3 architecture section. Update tasks/todo.md to mark Sprint 3 complete.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "docs: update documentation for Sprint 3"
git push origin main
```

---
