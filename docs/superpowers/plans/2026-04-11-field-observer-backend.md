# Field Observer Backend (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach `giti` to observe `Practical Systems` as a read-only pre-phase of every lifecycle cycle, producing atomic markdown + JSON field reports to disk and ensuring every cycle produces tangible, visible output.

**Architecture:** A new `packages/giti/src/agents/field-observer/` subsystem is invoked at the top of `runLifecycleCycle()` before `SENSE`. The runner calls `src/analyzers/*` functions directly (not the CLI `execute*` wrappers, which `console.log` and `process.exit`) against the target repo path. A Claude Haiku call composes a human-readable narrative with prompt caching. Reports are written atomically to giti's own `.organism/field-reports/<slug>/`.

**Tech Stack:** TypeScript (strict ESM, Node ≥18), vitest, `@anthropic-ai/sdk`, `simple-git`, `node:fs/promises`.

**Spec reference:** [`docs/superpowers/specs/2026-04-11-field-observer-design.md`](../specs/2026-04-11-field-observer-design.md)

**Divergences from spec** (intentional, locked during plan authoring by reading the real code):

1. **Observation is a true pre-phase — not wired through the work item system.** Spec §6.2 proposed a seeder + `always_available` prioritizer flag. Reading `packages/giti/src/agents/prefrontal-cortex/prioritizer.ts` and `index.ts` revealed the prioritizer is not structurally broken — it returns empty when `generateWorkItems` produces nothing, which happens when the codebase is clean. That's correct behavior, not a bug. The field observer does not need to go through the work item system at all; it runs unconditionally before `SENSE` every cycle and writes its reports directly. The spec's seeder/prioritizer fix is dropped from Plan A. If the user wants a work-item audit trail of observations later, that becomes a follow-up plan.
2. **Runner calls analyzers directly, not `runSensoryCortex()`.** `runSensoryCortex(path)` writes state reports into `<path>/.organism/state-reports/`. Pointing it at Practical Systems would write into Practical Systems' directory, violating "never write to target." The runner composes its own `FieldObservation` from `src/analyzers/commit-analyzer.ts`, `file-analyzer.ts`, `branch-analyzer.ts`, and `code-analyzer.ts`. These are pure data functions. No writes occur inside the target repo.
3. **No fixture repo committed for tests.** Instead, tests initialize a bare git repo under `os.tmpdir()` per test and seed it with known commits/files. This keeps repo size down and avoids the "fixture too small to exercise hotspots" risk flagged in spec §12.

---

## File Structure

### New files

| Path | Responsibility | Max lines |
|---|---|---|
| `packages/giti/src/agents/field-observer/types.ts` | `FieldTarget`, `FieldObservation`, `ObserverMood` | 80 |
| `packages/giti/src/agents/field-observer/target-config.ts` | Read + validate `field_targets` from `organism.json` | 80 |
| `packages/giti/src/agents/field-observer/reporter.ts` | Atomic write of `.md` + `.json` pair, update `latest.json` | 120 |
| `packages/giti/src/agents/field-observer/runner.ts` | Compose `FieldObservation` by calling analyzers directly | 150 |
| `packages/giti/src/agents/field-observer/narrator.ts` | Claude Haiku call with prompt caching + deterministic fallback + mood derivation | 200 |
| `packages/giti/src/agents/field-observer/index.ts` | Public `observe()` entry point — wires target-config → runner → narrator → reporter | 80 |
| `packages/giti/tests/agents/field-observer/target-config.test.ts` | target-config unit tests | — |
| `packages/giti/tests/agents/field-observer/reporter.test.ts` | reporter unit tests with tmpdir | — |
| `packages/giti/tests/agents/field-observer/runner.test.ts` | runner unit tests against a temporary git repo | — |
| `packages/giti/tests/agents/field-observer/narrator.test.ts` | narrator unit tests with mocked SDK | — |
| `packages/giti/tests/agents/field-observer/index.test.ts` | index (wire-up) test with all components integrated | — |
| `packages/giti/tests/agents/field-observer/helpers.ts` | Shared test helper: create temporary git repo with seeded history | — |

### Modified files

| Path | Change | Lines affected |
|---|---|---|
| `packages/giti/src/agents/types.ts` | Extend `OrganismConfig` with optional `field_targets` + `narrator` fields | Add ~25 lines |
| `organism.json` | Add `field_targets` and `narrator` sections | Add ~15 lines |
| `packages/giti/src/agents/orchestrator/cycle.ts` | Insert `OBSERVE_EXTERNAL` phase after lock acquisition, before Phase 1 `SENSE` | ~25 line insertion |
| `packages/giti/tests/agents/orchestrator/cycle.test.ts` | Assert the new phase runs and is non-fatal when targets are missing | Add ~30 lines |

### Key existing code this plan depends on

- `packages/giti/src/utils/git.ts` — `createGitClient(repoPath)`, `validateGitRepo(repoPath)`
- `packages/giti/src/analyzers/commit-analyzer.ts` — `getLastCommit(git)`, `getWeeklyStats(git)`, `getAvgCommitSize(git)`, `getBusFactor(git)`, `getHottestFile(git)`, `getTestRatio(repoPath)`
- `packages/giti/src/analyzers/branch-analyzer.ts` — `getBranchStats(git)`, `getStaleBranches(git, mainBranch)`
- `packages/giti/src/analyzers/file-analyzer.ts` — `getHotspots(git, sinceDate, top)`, `getFileCouplings(git, sinceDate)`
- `packages/giti/src/analyzers/code-analyzer.ts` — `getDeadCodeSignals(git, repoPath, deadMonths)`
- `packages/giti/src/agents/utils.ts` — `loadOrganismConfig`, `readJsonFile`, `writeJsonFile`, `getOrganismPath`, `ensureOrganismDir`
- `packages/giti/src/agents/orchestrator/cycle.ts:26` — `runLifecycleCycle()` entry point, where the new phase is inserted
- `packages/giti/src/agents/types.ts` — `OrganismConfig` type to extend

---

## Task 1: Investigation — confirm planner behavior before writing code

**Files:** No code changes. This task produces a short markdown note only.

This task exists to validate the plan's assumption that the prioritizer is not structurally broken, and to lock in the "observation is a pre-phase, not a work item" decision. **If the investigation reveals a real structural bug in the prioritizer that blocks cycles from completing, this plan pauses and a separate planner-rebuild plan is filed.**

- [ ] **Step 1: Read the existing planner and cycle code end-to-end**

  Read these files in full:
  - `packages/giti/src/agents/orchestrator/cycle.ts` (all ~280 lines)
  - `packages/giti/src/agents/prefrontal-cortex/index.ts`
  - `packages/giti/src/agents/prefrontal-cortex/prioritizer.ts`
  - `packages/giti/src/agents/prefrontal-cortex/backlog.ts`

- [ ] **Step 2: Run a live cycle on the giti repo and capture the outcome**

  Run:
  ```bash
  cd C:/Projects/git-intelligence
  npm run build --workspace=packages/giti
  node packages/giti/dist/cli/giti.js cycle --dry-run 2>&1 | tee /tmp/giti-cycle-probe.log
  ```

  Note the `outcome` field in the log (`stable`, `no-changes`, `productive`, `regression`, `aborted`, `human-declined`). Note whether `plan.selected_items.length` was 0 or >0 and, if 0, whether the backlog fallback at `cycle.ts:59-74` found anything.

- [ ] **Step 3: Inspect the `.organism/backlog/` directory**

  ```bash
  ls -la .organism/backlog/ 2>&1 || echo "(no backlog dir)"
  ```

  Note whether backlog JSON files exist and what `status` field values they contain.

- [ ] **Step 4: Document findings**

  Create `docs/superpowers/plans/notes/2026-04-11-field-observer-investigation.md` with:

  ```markdown
  # Field Observer Plan — Investigation Notes (2026-04-11)

  ## Cycle probe results
  - Outcome: [from step 2]
  - plan.selected_items.length: [from step 2]
  - Backlog fallback: [did it find anything?]

  ## Backlog dir state
  [from step 3]

  ## Verdict
  Prioritizer is [structurally broken / not structurally broken — returns empty correctly when state report has nothing to flag].

  Proceeding with Plan A as written / PAUSING and filing separate planner-rebuild plan.
  ```

- [ ] **Step 5: Decision gate**

  If the verdict is "structurally broken," **STOP**. Do not continue to Task 2. File a new GSD phase for planner repair and revisit this plan after that phase ships.

  Otherwise, commit the notes file and continue.

- [ ] **Step 6: Commit**

  ```bash
  git add docs/superpowers/plans/notes/2026-04-11-field-observer-investigation.md
  git commit -m "docs: capture field-observer investigation notes"
  ```

---

## Task 2: Extend `OrganismConfig` type and `organism.json`

**Files:**
- Modify: `packages/giti/src/agents/types.ts` (add new optional fields to `OrganismConfig`)
- Modify: `organism.json` (add `field_targets` and `narrator` sections)
- Test: `packages/giti/tests/agents/types.test.ts` (new — asserts config load returns new fields)

- [ ] **Step 1: Write the failing test**

  Create `packages/giti/tests/agents/types.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import path from 'node:path';
  import { loadOrganismConfig } from '../../src/agents/utils.js';

  describe('OrganismConfig field_targets and narrator', () => {
    it('loads field_targets from organism.json with a practical-systems entry', async () => {
      const config = await loadOrganismConfig(path.resolve(__dirname, '..', '..', '..', '..'));
      expect(config.field_targets).toBeDefined();
      expect(Array.isArray(config.field_targets)).toBe(true);
      expect(config.field_targets!.length).toBeGreaterThanOrEqual(1);
      const practical = config.field_targets!.find((t) => t.slug === 'practical-systems');
      expect(practical).toBeDefined();
      expect(practical!.path).toBe('C:\\Projects\\Practical Systems');
      expect(practical!.enabled).toBe(true);
    });

    it('loads narrator config with enabled=true and a haiku model', async () => {
      const config = await loadOrganismConfig(path.resolve(__dirname, '..', '..', '..', '..'));
      expect(config.narrator).toBeDefined();
      expect(config.narrator!.enabled).toBe(true);
      expect(config.narrator!.model).toMatch(/haiku/i);
      expect(config.narrator!.max_tokens).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/types.test.ts
  ```
  Expected: FAIL — `config.field_targets` is undefined.

- [ ] **Step 3: Extend `OrganismConfig` in `packages/giti/src/agents/types.ts`**

  Add these interfaces and fields to the existing `OrganismConfig`:

  ```ts
  export interface FieldTarget {
    slug: string;
    path: string;
    enabled: boolean;
  }

  export interface NarratorConfig {
    enabled: boolean;
    model: string;
    max_tokens: number;
    cache_system_prompt: boolean;
  }

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
    field_targets?: FieldTarget[];
    narrator?: NarratorConfig;
  }
  ```

- [ ] **Step 4: Add the new sections to `organism.json`**

  Append before the closing `}`:

  ```json
    "field_targets": [
      {
        "slug": "practical-systems",
        "path": "C:\\Projects\\Practical Systems",
        "enabled": true
      }
    ],
    "narrator": {
      "enabled": true,
      "model": "claude-haiku-4-5-20251001",
      "max_tokens": 600,
      "cache_system_prompt": true
    }
  ```

  Remember to add a comma after the existing `"lifecycle": { ... }` block.

- [ ] **Step 5: Run test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/types.test.ts
  ```
  Expected: PASS.

- [ ] **Step 6: Run tsc to make sure nothing else broke**

  ```bash
  cd packages/giti && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/giti/src/agents/types.ts packages/giti/tests/agents/types.test.ts organism.json
  git commit -m "feat(field-observer): extend OrganismConfig with field_targets + narrator"
  ```

---

## Task 3: Define field-observer local types

**Files:**
- Create: `packages/giti/src/agents/field-observer/types.ts`

This file defines the local types used throughout the subsystem. It re-exports `FieldTarget` from `agents/types.ts` so callers can import from one place.

- [ ] **Step 1: Create the types file**

  ```ts
  // packages/giti/src/agents/field-observer/types.ts
  import type { PulseResult, HotspotsResult, GhostsResult } from '../../types/index.js';

  export type { FieldTarget } from '../types.js';

  export type ObserverMood = 'curious' | 'attentive' | 'alarmed' | 'dozing';

  export interface FieldObservation {
    target: string;              // slug
    targetPath: string;          // absolute path
    observedAt: string;          // ISO timestamp
    cycle: number;               // giti's cycle number
    pulse: PulseResult;
    hotspots: HotspotsResult;
    ghosts: GhostsResult;
    narrative: string;           // markdown
    mood: ObserverMood;
    partial: boolean;            // true if any analyzer timed out or errored
    errors: string[];            // analyzer failures, empty on success
  }
  ```

- [ ] **Step 2: Run tsc to verify it compiles**

  ```bash
  cd packages/giti && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/giti/src/agents/field-observer/types.ts
  git commit -m "feat(field-observer): add local types for observation"
  ```

---

## Task 4: `target-config.ts` — read and validate field targets

**Files:**
- Create: `packages/giti/src/agents/field-observer/target-config.ts`
- Test: `packages/giti/tests/agents/field-observer/target-config.test.ts`

- [ ] **Step 1: Write the failing test**

  ```ts
  // packages/giti/tests/agents/field-observer/target-config.test.ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import fs from 'node:fs/promises';
  import path from 'node:path';
  import os from 'node:os';
  import { loadFieldTargets } from '../../../src/agents/field-observer/target-config.js';

  async function writeConfig(dir: string, config: unknown): Promise<void> {
    await fs.writeFile(path.join(dir, 'organism.json'), JSON.stringify(config), 'utf-8');
  }

  async function mktmp(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-target-'));
  }

  describe('loadFieldTargets', () => {
    let tmp: string;

    beforeEach(async () => {
      tmp = await mktmp();
    });

    afterEach(async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    });

    it('returns empty array when organism.json lacks field_targets', async () => {
      await writeConfig(tmp, {
        quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
        boundaries: { growth_zone: [], forbidden_zone: [] },
        lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
      });
      const targets = await loadFieldTargets(tmp);
      expect(targets).toEqual([]);
    });

    it('returns only enabled targets whose path exists and contains .git', async () => {
      const good = await mktmp();
      await fs.mkdir(path.join(good, '.git'));

      const disabled = await mktmp();
      await fs.mkdir(path.join(disabled, '.git'));

      const missing = path.join(os.tmpdir(), 'giti-fo-nonexistent-' + Date.now());

      await writeConfig(tmp, {
        quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
        boundaries: { growth_zone: [], forbidden_zone: [] },
        lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
        field_targets: [
          { slug: 'good', path: good, enabled: true },
          { slug: 'disabled', path: disabled, enabled: false },
          { slug: 'missing', path: missing, enabled: true },
        ],
      });

      const targets = await loadFieldTargets(tmp);
      expect(targets.map((t) => t.slug)).toEqual(['good']);

      await fs.rm(good, { recursive: true, force: true });
      await fs.rm(disabled, { recursive: true, force: true });
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/target-config.test.ts
  ```
  Expected: FAIL — `loadFieldTargets` does not exist.

- [ ] **Step 3: Implement `target-config.ts`**

  ```ts
  // packages/giti/src/agents/field-observer/target-config.ts
  import fs from 'node:fs/promises';
  import path from 'node:path';
  import { loadOrganismConfig } from '../utils.js';
  import type { FieldTarget } from './types.js';

  /**
   * Load the field_targets array from organism.json, then filter to only
   * enabled entries whose path exists and appears to be a git repo.
   * Never throws — returns [] on any failure.
   */
  export async function loadFieldTargets(repoPath: string): Promise<FieldTarget[]> {
    let config;
    try {
      config = await loadOrganismConfig(repoPath);
    } catch {
      return [];
    }

    const raw = config.field_targets ?? [];
    const valid: FieldTarget[] = [];

    for (const target of raw) {
      if (!target.enabled) continue;
      const ok = await isValidGitRepo(target.path);
      if (!ok) continue;
      valid.push(target);
    }

    return valid;
  }

  async function isValidGitRepo(targetPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(targetPath);
      if (!stat.isDirectory()) return false;
      const gitStat = await fs.stat(path.join(targetPath, '.git'));
      return gitStat.isDirectory() || gitStat.isFile();
    } catch {
      return false;
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/target-config.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/giti/src/agents/field-observer/target-config.ts packages/giti/tests/agents/field-observer/target-config.test.ts
  git commit -m "feat(field-observer): loadFieldTargets reads + validates config"
  ```

---

## Task 5: `reporter.ts` — atomic write of field reports

**Files:**
- Create: `packages/giti/src/agents/field-observer/reporter.ts`
- Test: `packages/giti/tests/agents/field-observer/reporter.test.ts`

- [ ] **Step 1: Write the failing test**

  ```ts
  // packages/giti/tests/agents/field-observer/reporter.test.ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import fs from 'node:fs/promises';
  import path from 'node:path';
  import os from 'node:os';
  import { writeFieldReport, readLatestReport } from '../../../src/agents/field-observer/reporter.js';
  import type { FieldObservation } from '../../../src/agents/field-observer/types.js';

  function fakeObservation(overrides: Partial<FieldObservation> = {}): FieldObservation {
    return {
      target: 'sample',
      targetPath: '/tmp/sample',
      observedAt: '2026-04-11T09:00:00.000Z',
      cycle: 42,
      pulse: { repoName: 'sample', lastCommit: { date: new Date(), message: 'init', author: 'A' }, weeklyCommits: { count: 3, authorCount: 1 }, branches: { active: 1, stale: 0 }, hottestFile: null, testRatio: { testFiles: 1, sourceFiles: 2, percentage: 50 }, avgCommitSize: 10, busFactor: { count: 1, topAuthorsPercentage: 100, topAuthorCount: 1 } },
      hotspots: { period: '30d', hotspots: [], couplings: [] },
      ghosts: { staleBranches: [], deadCode: [] },
      narrative: '# Field note\n\nAll quiet.',
      mood: 'attentive',
      partial: false,
      errors: [],
      ...overrides,
    };
  }

  describe('writeFieldReport + readLatestReport', () => {
    let tmp: string;

    beforeEach(async () => {
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-reporter-'));
    });

    afterEach(async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    });

    it('writes both .md and .json with identical basenames', async () => {
      const obs = fakeObservation();
      const result = await writeFieldReport(tmp, obs);

      expect(result.mdPath).toMatch(/\.md$/);
      expect(result.jsonPath).toMatch(/\.json$/);

      const mdExists = await fs.stat(result.mdPath).then(() => true).catch(() => false);
      const jsonExists = await fs.stat(result.jsonPath).then(() => true).catch(() => false);

      expect(mdExists).toBe(true);
      expect(jsonExists).toBe(true);
    });

    it('updates latest.json to match most recent report', async () => {
      const first = fakeObservation({ observedAt: '2026-04-11T08:00:00.000Z', mood: 'attentive' });
      const second = fakeObservation({ observedAt: '2026-04-11T09:00:00.000Z', mood: 'curious' });

      await writeFieldReport(tmp, first);
      await writeFieldReport(tmp, second);

      const latest = await readLatestReport(tmp, 'sample');
      expect(latest).not.toBeNull();
      expect(latest!.mood).toBe('curious');
      expect(latest!.observedAt).toBe('2026-04-11T09:00:00.000Z');
    });

    it('returns null from readLatestReport when no reports exist', async () => {
      const latest = await readLatestReport(tmp, 'never-observed');
      expect(latest).toBeNull();
    });

    it('writes markdown with the narrative embedded', async () => {
      const obs = fakeObservation({ narrative: '# Custom\n\nLorem ipsum.' });
      const result = await writeFieldReport(tmp, obs);
      const md = await fs.readFile(result.mdPath, 'utf-8');
      expect(md).toContain('# Custom');
      expect(md).toContain('Lorem ipsum.');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/reporter.test.ts
  ```
  Expected: FAIL — `writeFieldReport` does not exist.

- [ ] **Step 3: Implement `reporter.ts`**

  ```ts
  // packages/giti/src/agents/field-observer/reporter.ts
  import fs from 'node:fs/promises';
  import path from 'node:path';
  import { getOrganismPath, ensureOrganismDir } from '../utils.js';
  import type { FieldObservation } from './types.js';

  const REPORTS_SUBDIR = 'field-reports';

  export interface WriteResult {
    mdPath: string;
    jsonPath: string;
  }

  /**
   * Write a field observation atomically to .organism/field-reports/<slug>/.
   * Produces a markdown + JSON pair with matching basenames, plus updates
   * latest.json pointing at the freshest observation.
   */
  export async function writeFieldReport(
    repoPath: string,
    observation: FieldObservation,
  ): Promise<WriteResult> {
    const slugDir = await ensureOrganismDir(repoPath, REPORTS_SUBDIR, observation.target);
    const safeStamp = observation.observedAt.replace(/:/g, '-');

    const mdPath = path.join(slugDir, `${safeStamp}.md`);
    const jsonPath = path.join(slugDir, `${safeStamp}.json`);
    const latestPath = path.join(slugDir, 'latest.json');

    const md = formatMarkdown(observation);
    const json = JSON.stringify(observation, null, 2);

    await atomicWrite(mdPath, md);
    await atomicWrite(jsonPath, json);
    await atomicWrite(latestPath, json);

    return { mdPath, jsonPath };
  }

  /**
   * Read the most recent observation for a target, or null if none exists.
   */
  export async function readLatestReport(
    repoPath: string,
    slug: string,
  ): Promise<FieldObservation | null> {
    const latestPath = getOrganismPath(repoPath, REPORTS_SUBDIR, slug, 'latest.json');
    try {
      const raw = await fs.readFile(latestPath, 'utf-8');
      return JSON.parse(raw) as FieldObservation;
    } catch {
      return null;
    }
  }

  function formatMarkdown(obs: FieldObservation): string {
    const lines: string[] = [];
    lines.push(`# Field Report: ${obs.target}`);
    lines.push('');
    lines.push(`**Observed:** ${obs.observedAt}`);
    lines.push(`**Cycle:** ${obs.cycle}`);
    lines.push(`**Mood:** ${obs.mood}`);
    if (obs.partial) {
      lines.push(`**⚠ Partial observation.** Errors: ${obs.errors.join('; ')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(obs.narrative);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Raw signals');
    lines.push('');
    lines.push(`- Pulse: ${obs.pulse.weeklyCommits.count} commits this week by ${obs.pulse.weeklyCommits.authorCount} author(s); ${obs.pulse.branches.active} active branches; test ratio ${obs.pulse.testRatio.percentage}%`);
    lines.push(`- Hotspots: ${obs.hotspots.hotspots.length} file(s), ${obs.hotspots.couplings.length} coupling(s) over ${obs.hotspots.period}`);
    lines.push(`- Ghosts: ${obs.ghosts.staleBranches.length} stale branch(es), ${obs.ghosts.deadCode.length} dead-code signal(s)`);
    return lines.join('\n');
  }

  async function atomicWrite(target: string, content: string): Promise<void> {
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, target);
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/reporter.test.ts
  ```
  Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

  ```bash
  git add packages/giti/src/agents/field-observer/reporter.ts packages/giti/tests/agents/field-observer/reporter.test.ts
  git commit -m "feat(field-observer): atomic reporter with latest.json pointer"
  ```

---

## Task 6: `runner.ts` — compose observations from existing analyzers

**Files:**
- Create: `packages/giti/src/agents/field-observer/runner.ts`
- Create: `packages/giti/tests/agents/field-observer/helpers.ts` (shared test helper)
- Test: `packages/giti/tests/agents/field-observer/runner.test.ts`

- [ ] **Step 1: Write the shared test helper**

  ```ts
  // packages/giti/tests/agents/field-observer/helpers.ts
  import fs from 'node:fs/promises';
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
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'sample', version: '0.0.1' }, null, 2), 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });

    return {
      path: dir,
      cleanup: async () => {
        await fs.rm(dir, { recursive: true, force: true });
      },
    };
  }

  /**
   * Add and commit a file in a temp repo with a given message.
   */
  export function commitFile(repoPath: string, relPath: string, content: string, message: string): void {
    const full = path.join(repoPath, relPath);
    const dir = path.dirname(full);
    execFileSync('mkdir', ['-p', dir], { cwd: repoPath, shell: true });
    // Use fs for cross-platform safety
    // (mkdir -p may not exist on Windows without git-bash; this helper is only used in tests where it does)
    // Callers who need Windows-pure can use fs.mkdir directly.
    import('node:fs').then(({ writeFileSync }) => writeFileSync(full, content));
    execFileSync('git', ['add', relPath], { cwd: repoPath });
    execFileSync('git', ['commit', '-q', '-m', message], { cwd: repoPath });
  }
  ```

  **Note for executor:** the above `commitFile` uses dynamic import which is race-prone in tests. Replace with a synchronous fs variant before relying on it:

  ```ts
  // Replace the body of commitFile with:
  import fsSync from 'node:fs';

  export function commitFile(repoPath: string, relPath: string, content: string, message: string): void {
    const full = path.join(repoPath, relPath);
    fsSync.mkdirSync(path.dirname(full), { recursive: true });
    fsSync.writeFileSync(full, content, 'utf-8');
    execFileSync('git', ['add', relPath], { cwd: repoPath });
    execFileSync('git', ['commit', '-q', '-m', message], { cwd: repoPath });
  }
  ```

  Import `fsSync` at the top of the helper file and use the sync version throughout.

- [ ] **Step 2: Write the failing runner test**

  ```ts
  // packages/giti/tests/agents/field-observer/runner.test.ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { runFieldObservation } from '../../../src/agents/field-observer/runner.js';
  import { createTempRepo, commitFile, type TempRepo } from './helpers.js';

  describe('runFieldObservation', () => {
    let repo: TempRepo;

    beforeEach(async () => {
      repo = await createTempRepo();
    });

    afterEach(async () => {
      await repo.cleanup();
    });

    it('returns a complete observation for a clean repo', async () => {
      const result = await runFieldObservation({ slug: 'sample', path: repo.path, enabled: true });

      expect(result.partial).toBe(false);
      expect(result.errors).toEqual([]);
      expect(result.pulse.repoName).toBeDefined();
      expect(result.pulse.weeklyCommits.count).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(result.hotspots.hotspots)).toBe(true);
      expect(Array.isArray(result.ghosts.staleBranches)).toBe(true);
    });

    it('reflects new commits in weeklyCommits', async () => {
      commitFile(repo.path, 'src/a.ts', 'export const a = 1;\n', 'feat: add a');
      commitFile(repo.path, 'src/b.ts', 'export const b = 2;\n', 'feat: add b');

      const result = await runFieldObservation({ slug: 'sample', path: repo.path, enabled: true });

      expect(result.pulse.weeklyCommits.count).toBeGreaterThanOrEqual(3);
    });

    it('returns partial=true when one analyzer times out', async () => {
      const result = await runFieldObservation(
        { slug: 'sample', path: repo.path, enabled: true },
        { perAnalyzerTimeoutMs: 1 },
      );

      expect(result.partial).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/runner.test.ts
  ```
  Expected: FAIL — `runFieldObservation` does not exist.

- [ ] **Step 4: Implement `runner.ts`**

  ```ts
  // packages/giti/src/agents/field-observer/runner.ts
  import { createGitClient, getRepoName, getMainBranch } from '../../utils/git.js';
  import {
    getLastCommit,
    getWeeklyStats,
    getAvgCommitSize,
    getBusFactor,
    getHottestFile,
    getTestRatio,
  } from '../../analyzers/commit-analyzer.js';
  import { getBranchStats, getStaleBranches } from '../../analyzers/branch-analyzer.js';
  import { getHotspots, getFileCouplings } from '../../analyzers/file-analyzer.js';
  import { getDeadCodeSignals } from '../../analyzers/code-analyzer.js';
  import type { PulseResult, HotspotsResult, GhostsResult } from '../../types/index.js';
  import type { FieldTarget, FieldObservation } from './types.js';

  export interface RunnerOptions {
    perAnalyzerTimeoutMs?: number;
  }

  const DEFAULT_TIMEOUT_MS = 30_000;

  /**
   * Run analyzers against a target repo path and return an observation.
   * Never writes to the target repo.
   *
   * Does NOT derive mood or narrative — those come from the narrator.
   * This function only returns raw signal data.
   */
  export async function runFieldObservation(
    target: FieldTarget,
    options: RunnerOptions = {},
  ): Promise<Omit<FieldObservation, 'narrative' | 'mood' | 'observedAt' | 'cycle'>> {
    const timeout = options.perAnalyzerTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const errors: string[] = [];

    const pulse = await withTimeout(collectPulse(target.path), timeout, 'pulse', errors);
    const hotspots = await withTimeout(collectHotspots(target.path), timeout, 'hotspots', errors);
    const ghosts = await withTimeout(collectGhosts(target.path), timeout, 'ghosts', errors);

    return {
      target: target.slug,
      targetPath: target.path,
      pulse: pulse ?? emptyPulse(target.path),
      hotspots: hotspots ?? emptyHotspots(),
      ghosts: ghosts ?? emptyGhosts(),
      partial: errors.length > 0,
      errors,
    };
  }

  async function collectPulse(repoPath: string): Promise<PulseResult> {
    const git = createGitClient(repoPath);
    const [lastCommit, weeklyCommits, avgCommitSize, busFactor, hottestFile, testRatio, branches] = await Promise.all([
      getLastCommit(git),
      getWeeklyStats(git),
      getAvgCommitSize(git),
      getBusFactor(git),
      getHottestFile(git),
      getTestRatio(repoPath),
      getBranchStats(git),
    ]);
    return {
      repoName: getRepoName(repoPath),
      lastCommit,
      weeklyCommits,
      branches,
      hottestFile,
      testRatio,
      avgCommitSize,
      busFactor,
    };
  }

  async function collectHotspots(repoPath: string): Promise<HotspotsResult> {
    const git = createGitClient(repoPath);
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [hotspots, couplings] = await Promise.all([
      getHotspots(git, sinceDate, 10),
      getFileCouplings(git, sinceDate),
    ]);
    return { period: '30d', hotspots, couplings };
  }

  async function collectGhosts(repoPath: string): Promise<GhostsResult> {
    const git = createGitClient(repoPath);
    const branchData = await git.branch();
    const mainBranch = getMainBranch(branchData.all);
    const [staleBranches, deadCode] = await Promise.all([
      getStaleBranches(git, mainBranch, 30),
      getDeadCodeSignals(git, repoPath, 6),
    ]);
    return { staleBranches, deadCode };
  }

  async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
    errors: string[],
  ): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
      ]);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function emptyPulse(repoPath: string): PulseResult {
    return {
      repoName: repoPath,
      lastCommit: { date: new Date(0), message: '(unavailable)', author: '(unavailable)' },
      weeklyCommits: { count: 0, authorCount: 0 },
      branches: { active: 0, stale: 0 },
      hottestFile: null,
      testRatio: { testFiles: 0, sourceFiles: 0, percentage: 0 },
      avgCommitSize: 0,
      busFactor: { count: 0, topAuthorsPercentage: 0, topAuthorCount: 0 },
    };
  }

  function emptyHotspots(): HotspotsResult {
    return { period: '30d', hotspots: [], couplings: [] };
  }

  function emptyGhosts(): GhostsResult {
    return { staleBranches: [], deadCode: [] };
  }
  ```

- [ ] **Step 5: Run test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/runner.test.ts
  ```
  Expected: PASS (all 3 tests).

- [ ] **Step 6: Commit**

  ```bash
  git add packages/giti/src/agents/field-observer/runner.ts packages/giti/tests/agents/field-observer/runner.test.ts packages/giti/tests/agents/field-observer/helpers.ts
  git commit -m "feat(field-observer): runner composes observations from analyzers"
  ```

---

## Task 7: `narrator.ts` — Claude Haiku call with caching and fallback

**Files:**
- Create: `packages/giti/src/agents/field-observer/narrator.ts`
- Test: `packages/giti/tests/agents/field-observer/narrator.test.ts`

- [ ] **Step 1: Write the failing test**

  ```ts
  // packages/giti/tests/agents/field-observer/narrator.test.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { narrate, deriveMood } from '../../../src/agents/field-observer/narrator.js';
  import type { FieldObservation, ObserverMood } from '../../../src/agents/field-observer/types.js';

  const mockCreate = vi.fn();

  vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  }));

  function fakeRaw(overrides: Partial<Omit<FieldObservation, 'narrative' | 'mood' | 'observedAt' | 'cycle'>> = {}) {
    return {
      target: 'sample',
      targetPath: '/tmp/sample',
      pulse: { repoName: 'sample', lastCommit: { date: new Date(), message: 'init', author: 'A' }, weeklyCommits: { count: 3, authorCount: 1 }, branches: { active: 1, stale: 0 }, hottestFile: null, testRatio: { testFiles: 1, sourceFiles: 2, percentage: 50 }, avgCommitSize: 10, busFactor: { count: 1, topAuthorsPercentage: 100, topAuthorCount: 1 } },
      hotspots: { period: '30d', hotspots: [], couplings: [] },
      ghosts: { staleBranches: [], deadCode: [] },
      partial: false,
      errors: [],
      ...overrides,
    };
  }

  describe('deriveMood', () => {
    it('returns curious on a first-ever observation (no previous)', () => {
      const raw = fakeRaw();
      expect(deriveMood(raw, null)).toBe('curious');
    });

    it('returns curious when new commits appeared since previous', () => {
      const prev: FieldObservation = { ...fakeRaw(), pulse: { ...fakeRaw().pulse, weeklyCommits: { count: 3, authorCount: 1 } }, observedAt: '2026-04-10T09:00:00.000Z', cycle: 41, narrative: '', mood: 'attentive' };
      const raw = fakeRaw({ pulse: { ...fakeRaw().pulse, weeklyCommits: { count: 5, authorCount: 1 } } });
      expect(deriveMood(raw, prev)).toBe('curious');
    });

    it('returns attentive when nothing changed', () => {
      const prev: FieldObservation = { ...fakeRaw(), observedAt: '2026-04-10T09:00:00.000Z', cycle: 41, narrative: '', mood: 'attentive' };
      const raw = fakeRaw();
      expect(deriveMood(raw, prev)).toBe('attentive');
    });

    it('returns alarmed when test ratio drops sharply', () => {
      const prev: FieldObservation = { ...fakeRaw(), pulse: { ...fakeRaw().pulse, testRatio: { testFiles: 10, sourceFiles: 10, percentage: 100 } }, observedAt: '2026-04-10T09:00:00.000Z', cycle: 41, narrative: '', mood: 'attentive' };
      const raw = fakeRaw({ pulse: { ...fakeRaw().pulse, testRatio: { testFiles: 1, sourceFiles: 10, percentage: 10 } } });
      expect(deriveMood(raw, prev)).toBe('alarmed');
    });
  });

  describe('narrate', () => {
    beforeEach(() => {
      mockCreate.mockReset();
    });

    it('calls Anthropic API and returns narrative text', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'All quiet on the sample front.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const raw = fakeRaw();
      const config = { enabled: true, model: 'claude-haiku-4-5-20251001', max_tokens: 600, cache_system_prompt: true };
      const result = await narrate(raw, null, config);

      expect(result.narrative).toBe('All quiet on the sample front.');
      expect(result.fallback).toBe(false);
      expect(mockCreate).toHaveBeenCalledOnce();

      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.model).toBe('claude-haiku-4-5-20251001');
      expect(callArg.max_tokens).toBe(600);
      // Prompt caching is set on the system block
      expect(Array.isArray(callArg.system)).toBe(true);
      expect(callArg.system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('returns deterministic fallback when API errors', async () => {
      mockCreate.mockRejectedValue(new Error('network down'));

      const raw = fakeRaw();
      const config = { enabled: true, model: 'claude-haiku-4-5-20251001', max_tokens: 600, cache_system_prompt: true };
      const result = await narrate(raw, null, config);

      expect(result.fallback).toBe(true);
      expect(result.narrative).toContain('sample');
      expect(result.narrative.length).toBeGreaterThan(0);
    });

    it('returns deterministic fallback when narrator is disabled', async () => {
      const raw = fakeRaw();
      const config = { enabled: false, model: 'claude-haiku-4-5-20251001', max_tokens: 600, cache_system_prompt: true };
      const result = await narrate(raw, null, config);

      expect(result.fallback).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/narrator.test.ts
  ```
  Expected: FAIL — `narrate`/`deriveMood` do not exist.

- [ ] **Step 3: Implement `narrator.ts`**

  ```ts
  // packages/giti/src/agents/field-observer/narrator.ts
  import Anthropic from '@anthropic-ai/sdk';
  import type { FieldObservation, ObserverMood } from './types.js';
  import type { NarratorConfig } from '../types.js';

  type RawObservation = Omit<FieldObservation, 'narrative' | 'mood' | 'observedAt' | 'cycle'>;

  export interface NarrateResult {
    narrative: string;
    mood: ObserverMood;
    fallback: boolean;
    tokens_used: number;
  }

  const SYSTEM_PROMPT = `You are a patient, curious field researcher taking notes on a codebase across the street. You watch it every day and write a short field journal entry (under 200 words) in a warm, observational voice. You reference continuity with prior entries when provided. No preamble, no code blocks, no bullet lists — just two or three short paragraphs of notes.`;

  /**
   * Compose a narrative for an observation, deriving mood and making a Claude
   * API call (or falling back to a deterministic template on any failure).
   */
  export async function narrate(
    raw: RawObservation,
    previous: FieldObservation | null,
    config: NarratorConfig,
  ): Promise<NarrateResult> {
    const mood = deriveMood(raw, previous);

    if (!config.enabled) {
      return {
        narrative: deterministicNarrative(raw, mood),
        mood,
        fallback: true,
        tokens_used: 0,
      };
    }

    try {
      const client = new Anthropic();
      const userText = buildUserMessage(raw, previous, mood);

      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.max_tokens,
        system: [
          {
            type: 'text' as const,
            text: SYSTEM_PROMPT,
            cache_control: config.cache_system_prompt ? { type: 'ephemeral' as const } : undefined,
          },
        ],
        messages: [{ role: 'user', content: userText }],
      });

      const block = response.content[0];
      const text = block && block.type === 'text' ? block.text : '';

      if (!text.trim()) {
        return {
          narrative: deterministicNarrative(raw, mood),
          mood,
          fallback: true,
          tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        };
      }

      return {
        narrative: text.trim(),
        mood,
        fallback: false,
        tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      };
    } catch {
      return {
        narrative: deterministicNarrative(raw, mood),
        mood,
        fallback: true,
        tokens_used: 0,
      };
    }
  }

  /**
   * Derive the observer's mood by comparing the fresh observation to the
   * previous one. First-run default is 'curious'.
   */
  export function deriveMood(raw: RawObservation, previous: FieldObservation | null): ObserverMood {
    if (!previous) return 'curious';

    // Alarmed: sharp test ratio drop
    const prevRatio = previous.pulse.testRatio.percentage;
    const nowRatio = raw.pulse.testRatio.percentage;
    if (prevRatio - nowRatio >= 20) return 'alarmed';

    // Alarmed: new stale branches spike
    if (raw.ghosts.staleBranches.length >= previous.ghosts.staleBranches.length + 3) {
      return 'alarmed';
    }

    // Curious: new commits since last observation
    if (raw.pulse.weeklyCommits.count > previous.pulse.weeklyCommits.count) {
      return 'curious';
    }
    if (raw.hotspots.hotspots.length > previous.hotspots.hotspots.length) {
      return 'curious';
    }

    // Dozing: no activity for multiple observations (approximated via 0 weekly commits AND prev also had 0)
    if (raw.pulse.weeklyCommits.count === 0 && previous.pulse.weeklyCommits.count === 0) {
      return 'dozing';
    }

    return 'attentive';
  }

  function buildUserMessage(raw: RawObservation, previous: FieldObservation | null, mood: ObserverMood): string {
    const parts: string[] = [];
    parts.push(`Target: ${raw.target}`);
    parts.push(`Current mood: ${mood}`);
    parts.push(`Weekly commits: ${raw.pulse.weeklyCommits.count} by ${raw.pulse.weeklyCommits.authorCount} author(s)`);
    parts.push(`Active branches: ${raw.pulse.branches.active} (${raw.pulse.branches.stale} stale)`);
    parts.push(`Test ratio: ${raw.pulse.testRatio.percentage}% (${raw.pulse.testRatio.testFiles} tests, ${raw.pulse.testRatio.sourceFiles} sources)`);
    parts.push(`Hotspots this month: ${raw.hotspots.hotspots.length}`);
    parts.push(`Stale branches: ${raw.ghosts.staleBranches.length}`);
    parts.push(`Dead code signals: ${raw.ghosts.deadCode.length}`);
    if (raw.partial) {
      parts.push(`Partial observation. Analyzer errors: ${raw.errors.join('; ')}`);
    }
    if (previous) {
      parts.push('');
      parts.push('Previous observation for continuity:');
      parts.push(previous.narrative.slice(0, 400));
    }
    parts.push('');
    parts.push('Write a short field journal entry reflecting on what changed and what you notice.');
    return parts.join('\n');
  }

  function deterministicNarrative(raw: RawObservation, mood: ObserverMood): string {
    const lines: string[] = [];
    lines.push(`Observed ${raw.target}. Mood: ${mood}.`);
    lines.push(`Pulse: ${raw.pulse.weeklyCommits.count} commits this week, ${raw.pulse.branches.active} active branches, test ratio ${raw.pulse.testRatio.percentage}%.`);
    lines.push(`Hotspots: ${raw.hotspots.hotspots.length} files flagged. Ghosts: ${raw.ghosts.staleBranches.length} stale branches, ${raw.ghosts.deadCode.length} dead-code signals.`);
    if (raw.partial) {
      lines.push(`(Partial observation — some analyzers failed: ${raw.errors.join('; ')}.)`);
    }
    return lines.join('\n\n');
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/narrator.test.ts
  ```
  Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

  ```bash
  git add packages/giti/src/agents/field-observer/narrator.ts packages/giti/tests/agents/field-observer/narrator.test.ts
  git commit -m "feat(field-observer): narrator with Claude Haiku + prompt caching + fallback"
  ```

---

## Task 8: `field-observer/index.ts` — public `observe()` entry point

**Files:**
- Create: `packages/giti/src/agents/field-observer/index.ts`
- Test: `packages/giti/tests/agents/field-observer/index.test.ts`

- [ ] **Step 1: Write the failing test**

  ```ts
  // packages/giti/tests/agents/field-observer/index.test.ts
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import fs from 'node:fs/promises';
  import path from 'node:path';
  import os from 'node:os';
  import { observe } from '../../../src/agents/field-observer/index.js';
  import { createTempRepo, type TempRepo } from './helpers.js';

  const mockCreate = vi.fn();

  vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  }));

  describe('observe', () => {
    let gitiHome: string;
    let target: TempRepo;

    beforeEach(async () => {
      gitiHome = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-home-'));
      target = await createTempRepo();

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Quiet morning at the sample repo.' }],
        usage: { input_tokens: 50, output_tokens: 15 },
      });

      // Write a valid organism.json into the temp giti home
      await fs.writeFile(
        path.join(gitiHome, 'organism.json'),
        JSON.stringify({
          quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
          boundaries: { growth_zone: [], forbidden_zone: [] },
          lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
          field_targets: [{ slug: 'sample', path: target.path, enabled: true }],
          narrator: { enabled: true, model: 'claude-haiku-4-5-20251001', max_tokens: 600, cache_system_prompt: true },
        }),
      );
    });

    afterEach(async () => {
      await fs.rm(gitiHome, { recursive: true, force: true });
      await target.cleanup();
      mockCreate.mockReset();
    });

    it('produces a field report on disk under gitiHome/.organism/field-reports/<slug>/', async () => {
      const observations = await observe(gitiHome, 99);

      expect(observations).toHaveLength(1);
      expect(observations[0]!.target).toBe('sample');
      expect(observations[0]!.cycle).toBe(99);
      expect(observations[0]!.narrative).toContain('Quiet morning');

      const reportsDir = path.join(gitiHome, '.organism', 'field-reports', 'sample');
      const entries = await fs.readdir(reportsDir);
      const mds = entries.filter((e) => e.endsWith('.md'));
      const jsons = entries.filter((e) => e.endsWith('.json'));
      const latest = entries.filter((e) => e === 'latest.json');

      expect(mds.length).toBeGreaterThanOrEqual(1);
      expect(jsons.length).toBeGreaterThanOrEqual(2); // timestamped + latest.json
      expect(latest).toHaveLength(1);
    });

    it('returns [] when no field_targets are configured', async () => {
      await fs.writeFile(
        path.join(gitiHome, 'organism.json'),
        JSON.stringify({
          quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
          boundaries: { growth_zone: [], forbidden_zone: [] },
          lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
        }),
      );

      const observations = await observe(gitiHome, 100);
      expect(observations).toEqual([]);
    });

    it('derives mood as curious on first ever observation', async () => {
      const [obs] = await observe(gitiHome, 99);
      expect(obs!.mood).toBe('curious');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/index.test.ts
  ```
  Expected: FAIL — `observe` does not exist.

- [ ] **Step 3: Implement `index.ts`**

  ```ts
  // packages/giti/src/agents/field-observer/index.ts
  import { loadOrganismConfig } from '../utils.js';
  import type { NarratorConfig } from '../types.js';
  import { loadFieldTargets } from './target-config.js';
  import { runFieldObservation } from './runner.js';
  import { narrate } from './narrator.js';
  import { writeFieldReport, readLatestReport } from './reporter.js';
  import type { FieldObservation } from './types.js';

  const DEFAULT_NARRATOR: NarratorConfig = {
    enabled: true,
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    cache_system_prompt: true,
  };

  /**
   * Run field observation against every enabled, valid target configured in
   * organism.json. Writes reports under gitiPath/.organism/field-reports/<slug>/.
   * Returns all completed observations. Never throws — individual target
   * failures are captured as partial observations.
   */
  export async function observe(gitiPath: string, cycle: number): Promise<FieldObservation[]> {
    const targets = await loadFieldTargets(gitiPath);
    if (targets.length === 0) return [];

    const config = await loadOrganismConfig(gitiPath);
    const narratorConfig = config.narrator ?? DEFAULT_NARRATOR;

    const observations: FieldObservation[] = [];

    for (const target of targets) {
      try {
        const raw = await runFieldObservation(target);
        const previous = await readLatestReport(gitiPath, target.slug);
        const { narrative, mood } = await narrate(raw, previous, narratorConfig);

        const observation: FieldObservation = {
          ...raw,
          observedAt: new Date().toISOString(),
          cycle,
          narrative,
          mood,
        };

        await writeFieldReport(gitiPath, observation);
        observations.push(observation);
      } catch (error) {
        // Individual target failure does not halt the others.
        // The failure is logged to stderr but observation is skipped.
        console.error(`[field-observer] ${target.slug} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return observations;
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/field-observer/index.test.ts
  ```
  Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

  ```bash
  git add packages/giti/src/agents/field-observer/index.ts packages/giti/tests/agents/field-observer/index.test.ts
  git commit -m "feat(field-observer): public observe() wires config, runner, narrator, reporter"
  ```

---

## Task 9: Cycle integration — insert `OBSERVE_EXTERNAL` phase

**Files:**
- Modify: `packages/giti/src/agents/orchestrator/cycle.ts` (insert new phase call after lock acquisition, before Phase 1 SENSE)
- Modify: `packages/giti/tests/agents/orchestrator/cycle.test.ts` (add test that the phase runs and handles missing targets gracefully)

- [ ] **Step 1: Read existing `tests/agents/orchestrator/cycle.test.ts`** to learn the current mocking pattern

  ```bash
  cat packages/giti/tests/agents/orchestrator/cycle.test.ts | head -80
  ```

  Take note of how other phases are mocked and how `runLifecycleCycle` is invoked in tests.

- [ ] **Step 2: Write the failing test**

  Add a new `describe` block to `packages/giti/tests/agents/orchestrator/cycle.test.ts`:

  ```ts
  describe('OBSERVE_EXTERNAL phase', () => {
    it('calls field-observer.observe before runSensoryCortex', async () => {
      const callOrder: string[] = [];

      vi.doMock('../../../src/agents/field-observer/index.js', () => ({
        observe: vi.fn(async () => {
          callOrder.push('observe');
          return [];
        }),
      }));

      vi.doMock('../../../src/agents/sensory-cortex/index.js', () => ({
        runSensoryCortex: vi.fn(async () => {
          callOrder.push('sense');
          return { report: {} as any, reportPath: '' };
        }),
      }));

      const { runLifecycleCycle } = await import('../../../src/agents/orchestrator/cycle.js');

      // Use a temp giti home with an empty backlog and no field_targets
      // so we exit cleanly after SENSE with outcome 'stable'.
      // (Details: see existing cycle.test.ts harness setup; reuse its tmp scaffold.)
      const tmpHome = await setupTmpGitiHome();
      await runLifecycleCycle({ repoPath: tmpHome, supervised: false });

      expect(callOrder[0]).toBe('observe');
      expect(callOrder[1]).toBe('sense');

      await cleanupTmpGitiHome(tmpHome);
    });

    it('does not fail the cycle when observe() throws', async () => {
      vi.doMock('../../../src/agents/field-observer/index.js', () => ({
        observe: vi.fn(async () => {
          throw new Error('boom');
        }),
      }));

      const { runLifecycleCycle } = await import('../../../src/agents/orchestrator/cycle.js');
      const tmpHome = await setupTmpGitiHome();
      const result = await runLifecycleCycle({ repoPath: tmpHome, supervised: false });

      // Cycle should still complete — observe failure is non-fatal
      expect(result.outcome).toBeDefined();
      expect(['stable', 'no-changes']).toContain(result.outcome);

      await cleanupTmpGitiHome(tmpHome);
    });
  });
  ```

  **Note:** `setupTmpGitiHome` and `cleanupTmpGitiHome` are test harness helpers. Check whether they already exist in the file. If they do not, create them at the top of `cycle.test.ts` (they should make a temp dir, write a minimal `organism.json`, create `.git`, and return the path).

- [ ] **Step 3: Run test to verify it fails**

  ```bash
  cd packages/giti && npx vitest run tests/agents/orchestrator/cycle.test.ts -t "OBSERVE_EXTERNAL"
  ```
  Expected: FAIL — field-observer is not yet wired into cycle.ts.

- [ ] **Step 4: Modify `cycle.ts` — add the import**

  In `packages/giti/src/agents/orchestrator/cycle.ts`, add this import near the top alongside other agent imports (after line 15):

  ```ts
  import { observe as runFieldObserver } from '../field-observer/index.js';
  ```

- [ ] **Step 5: Modify `cycle.ts` — insert the new phase**

  Find this block in `runLifecycleCycle` (around line 47, right after the `try {` that follows lock acquisition):

  ```ts
    try {
      // Phase 1: SENSE
      if (await safety.isKillSwitchActive(repoPath)) return makeResult(cycle, startTime, 'aborted');
      const { report } = await runSensoryCortex(repoPath);
      await recordMemoryEvent(repoPath, 'cycle-started', `Cycle ${cycle} started`, { cycle });
  ```

  Insert a new phase immediately before `// Phase 1: SENSE`:

  ```ts
    try {
      // Phase 0: OBSERVE_EXTERNAL
      // Watches configured field targets and writes field reports to disk.
      // Read-only against the target repo. Never fatal — individual target
      // failures are captured inside observe().
      try {
        const fieldObservations = await runFieldObserver(repoPath, cycle);
        if (fieldObservations.length > 0) {
          await recordMemoryEvent(
            repoPath,
            'cycle-started',
            `Field observations: ${fieldObservations.map((o) => `${o.target}=${o.mood}`).join(', ')}`,
            { cycle, field_observations: fieldObservations.map((o) => ({ target: o.target, mood: o.mood, partial: o.partial })) },
          );
        }
      } catch (error) {
        // Field observation failure is never fatal.
        console.error(`[cycle] field-observer phase failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Phase 1: SENSE
      if (await safety.isKillSwitchActive(repoPath)) return makeResult(cycle, startTime, 'aborted');
      const { report } = await runSensoryCortex(repoPath);
      await recordMemoryEvent(repoPath, 'cycle-started', `Cycle ${cycle} started`, { cycle });
  ```

- [ ] **Step 6: Run the test to verify it passes**

  ```bash
  cd packages/giti && npx vitest run tests/agents/orchestrator/cycle.test.ts -t "OBSERVE_EXTERNAL"
  ```
  Expected: PASS (both 2 tests).

- [ ] **Step 7: Run the full test suite for the giti package to verify nothing regressed**

  ```bash
  cd packages/giti && npx vitest run
  ```
  Expected: all existing tests still pass.

- [ ] **Step 8: Run tsc**

  ```bash
  cd packages/giti && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 9: Commit**

  ```bash
  git add packages/giti/src/agents/orchestrator/cycle.ts packages/giti/tests/agents/orchestrator/cycle.test.ts
  git commit -m "feat(cycle): run OBSERVE_EXTERNAL phase before SENSE"
  ```

---

## Task 10: End-to-end smoke test and manual verification

**Files:**
- No new files. Manual verification against the real Practical Systems path.

- [ ] **Step 1: Run the full giti test suite**

  ```bash
  cd packages/giti && npx vitest run
  ```
  Expected: all tests pass. Coverage reporter shows ≥80% on new `field-observer/` files (the `types.ts` file is excluded via `vitest.config.ts` — add it to the exclude list if not already there).

- [ ] **Step 2: Add `field-observer/types.ts` to the vitest coverage exclude list**

  Open `packages/giti/vitest.config.ts`. In the `coverage.exclude` array, add:

  ```ts
  'src/agents/field-observer/types.ts',
  ```

- [ ] **Step 3: Run coverage report**

  ```bash
  cd packages/giti && npx vitest run --coverage
  ```
  Expected: new `src/agents/field-observer/*.ts` files at ≥80% line coverage.

- [ ] **Step 4: Run the build**

  ```bash
  cd ../.. && npm run build --workspace=packages/giti
  ```
  Expected: clean tsup build, no errors.

- [ ] **Step 5: Run one real cycle against Practical Systems**

  ```bash
  export ANTHROPIC_API_KEY=<user provides>
  node packages/giti/dist/cli/giti.js cycle --dry-run
  ```

  Expected output includes a log line about field observations (e.g., `Field observations: practical-systems=curious`).

- [ ] **Step 6: Verify the field report landed on disk**

  ```bash
  ls -la .organism/field-reports/practical-systems/
  cat .organism/field-reports/practical-systems/latest.json | head -40
  ```

  Expected:
  - At least one `<timestamp>.md` and `<timestamp>.json` pair exists
  - `latest.json` exists and its `target` field is `practical-systems`
  - `mood` is one of `curious`, `attentive`, `alarmed`, `dozing`
  - `narrative` is a non-empty string (~2-3 paragraphs if API call succeeded, deterministic template otherwise)

- [ ] **Step 7: Run a second cycle and verify mood evolution**

  ```bash
  node packages/giti/dist/cli/giti.js cycle --dry-run
  ```

  Expected: mood differs from first cycle (or is still `attentive`/`curious` depending on what changed in Practical Systems between runs).

- [ ] **Step 8: Commit any fixes from the manual verification**

  If Steps 5-7 surface issues, commit individual fixes with descriptive messages before closing out the plan. If everything works cleanly, nothing to commit.

- [ ] **Step 9: Final commit (if no issues found)**

  ```bash
  git commit --allow-empty -m "chore(field-observer): Plan A complete — verified end-to-end against Practical Systems"
  ```

---

## Self-Review

### Spec coverage

| Spec section | Covered by |
|---|---|
| §2 Goal: field report every cycle | Task 9 (phase runs every cycle) + Task 8 (observe writes reports) |
| §2 Success 1: cycle runs to completion | Task 9 (observe never throws upward) + Task 1 (investigation confirms prioritizer not blocking) |
| §2 Success 2: fresh .md + .json per cycle | Task 5 (atomic write) + Task 10 step 6 (verify) |
| §2 Success 3: Observatory renders scene | **Not in Plan A** — deferred to Plan B (by agreement) |
| §2 Success 4: 80% coverage | Task 10 steps 1-3 |
| §5 field-observer module layout | Tasks 3, 4, 5, 6, 7, 8 (all modules except `types.ts` which is Task 3) |
| §5 Mood derivation with 4 states | Task 7 `deriveMood()` + tests |
| §5 First-run default mood | Task 7 (`deriveMood` returns `curious` when previous is null) |
| §5 organism.json additions | Task 2 |
| §6.1 OBSERVE_EXTERNAL phase | Task 9 |
| §6.2 Planner unstick | **Explicitly dropped from Plan A** — see Divergences section at top of plan |
| §7 Narrator with prompt caching + fallback + budget | Task 7 |
| §8 Observatory re-theme | **Plan B** |
| §9 Data flow | Task 8 (index.ts wires it), Task 9 (cycle integration), Task 10 (e2e verify) |
| §10 Safety + error handling | Task 6 (runner withTimeout), Task 7 (narrator fallback), Task 5 (atomic write), Task 8 (individual target failure non-fatal), Task 9 (phase failure non-fatal) |
| §11 Testing + fixtures | Tasks 2, 4, 5, 6, 7, 8, 9 (all have tests), Task 6 (temp git repo helper instead of committed fixture) |

### Placeholder scan

No `TBD`, `TODO`, `implement later`, `add appropriate X`, `similar to Task N` — all code blocks contain complete, compilable code. `setupTmpGitiHome` / `cleanupTmpGitiHome` in Task 9 step 2 are named helpers the executor may need to write if they don't already exist in the test file; Step 2 notes this explicitly and describes what they should do.

### Type consistency

- `FieldTarget` defined once in `agents/types.ts` (Task 2), re-exported from `field-observer/types.ts` (Task 3), consistently imported in Tasks 4, 6, 8.
- `FieldObservation` defined in `field-observer/types.ts` (Task 3) and used in Tasks 5, 6, 7, 8. `runFieldObservation` in Task 6 returns `Omit<FieldObservation, 'narrative' | 'mood' | 'observedAt' | 'cycle'>`, which is then spread + extended in Task 8 `index.ts`. The Omit-and-fill pattern is consistent.
- `ObserverMood` defined in Task 3, used as return type in Task 7 `deriveMood`, stored in Task 8.
- `NarratorConfig` defined in Task 2 on `OrganismConfig`, consumed in Task 7 `narrate()` and Task 8 `DEFAULT_NARRATOR`.
- `narrate()` signature: `(raw, previous, config) => Promise<NarrateResult>` — Task 7 defines it, Task 8 calls it with matching args.
- `writeFieldReport()` signature: `(repoPath, observation) => Promise<WriteResult>` — Task 5 defines, Task 8 calls.
- `readLatestReport()` signature: `(repoPath, slug) => Promise<FieldObservation | null>` — Task 5 defines, Task 8 calls.
- `observe()` signature: `(gitiPath, cycle) => Promise<FieldObservation[]>` — Task 8 defines, Task 9 calls (as `runFieldObserver`).

### Scope check

Plan A is one focused backend change: new subsystem + cycle hook + config extension. It produces working, testable software on its own (field reports on disk). No frontend work, no multi-target refactor, no motor cortex expansion. Appropriate size for a single implementation plan.

---

*This plan was produced via `superpowers:writing-plans` on 2026-04-11. Spec: [`docs/superpowers/specs/2026-04-11-field-observer-design.md`](../specs/2026-04-11-field-observer-design.md).*
