# Claude Code Prompt: Sprint 2 — Activate the Organism

## Context

You are building Sprint 2 of **The Living Codebase** project. Sprint 0 built the seed (`giti` CLI with three commands). Sprint 1 built the safety layer (Sensory Cortex, Immune System, Memory). Now you're giving the organism the ability to think and act.

This is the sprint where the organism comes alive. After this, it can observe its own state, decide what to do, implement changes, get those changes reviewed, and learn from the outcomes. The full lifecycle loop will be operational.

Read `living-codebase-architecture.md` for the full vision. Read the Sprint 0 and Sprint 1 prompts for context on what already exists.

## What You're Building

Two new agents (Prefrontal Cortex and Motor Cortex), the lifecycle orchestrator that coordinates all agents through a complete cycle, and OpenClaw integration for agent instrumentation.

## Project Structure Additions

```
giti/
├── src/
│   ├── agents/
│   │   ├── prefrontal-cortex/
│   │   │   ├── index.ts              # Main planning logic
│   │   │   ├── prioritizer.ts        # Work item prioritization engine
│   │   │   ├── backlog.ts            # Backlog management
│   │   │   └── types.ts
│   │   ├── motor-cortex/
│   │   │   ├── index.ts              # Main builder logic
│   │   │   ├── implementer.ts        # Code change implementation
│   │   │   ├── branch-manager.ts     # Git branch operations
│   │   │   ├── test-writer.ts        # Generate tests for changes
│   │   │   └── types.ts
│   │   └── orchestrator/
│   │       ├── index.ts              # Lifecycle orchestrator
│   │       ├── cycle.ts              # Single lifecycle cycle logic
│   │       ├── scheduler.ts          # Cycle scheduling (cron)
│   │       ├── safety.ts             # Safety checks and kill switches
│   │       └── types.ts
│   ├── integrations/
│   │   └── openclaw/
│   │       ├── client.ts             # OpenClaw API client
│   │       ├── instrument.ts         # Agent instrumentation helpers
│   │       └── types.ts
│   └── cli/
│       ├── plan.ts                   # CLI: run prefrontal cortex
│       ├── build.ts                  # CLI: run motor cortex on a work item
│       ├── cycle.ts                  # CLI: run a full lifecycle cycle
│       └── organism.ts               # CLI: organism management (start, stop, status)
├── .organism/
│   ├── backlog/                      # Pending work items
│   ├── cycle-history/                # Records of completed cycles
│   └── active-cycle.json             # Current cycle state (if running)
└── tests/
    ├── agents/
    │   ├── prefrontal-cortex/
    │   │   ├── prioritizer.test.ts
    │   │   └── backlog.test.ts
    │   ├── motor-cortex/
    │   │   ├── implementer.test.ts
    │   │   └── branch-manager.test.ts
    │   └── orchestrator/
    │       ├── cycle.test.ts
    │       └── safety.test.ts
    └── integration/
        └── full-cycle.test.ts        # End-to-end lifecycle cycle test
```

---

## Agent 4: Prefrontal Cortex (Strategic Planner)

### Purpose

Read the organism's current state, consult memory, and produce a prioritized plan of up to 3 work items for the current cycle.

### CLI Entrypoint

```bash
# Generate a cycle plan
giti plan

# Output: writes cycle plan to .organism/backlog/cycle-plan-{timestamp}.json
# Also prints human-readable plan to terminal

# Dry run (show what it would plan without committing)
giti plan --dry-run
```

### Inputs

The Prefrontal Cortex reads:
1. Latest state report from `.organism/state-reports/` (produced by Sensory Cortex)
2. `organism.json` for purpose, boundaries, and quality standards
3. Memory knowledge base for past decisions and lessons
4. Any existing backlog items from `.organism/backlog/`

### Planning Logic

The planner follows a strict priority hierarchy. It evaluates all potential work items and assigns each a priority tier and a score within that tier.

**Tier 1: Critical Fixes (must be addressed this cycle)**
- Security vulnerabilities flagged by Sensory Cortex (`npm audit`)
- Lint errors (`tsc --noEmit` failures)
- Test failures on main branch

**Tier 2: Regression Repair**
- Any metric that degraded since the last cycle
- Performance benchmarks exceeding 80% of budget
- Test coverage that dropped below the floor

**Tier 3: Quality Improvement**
- Increase test coverage (target files with lowest coverage)
- Reduce complexity in files exceeding the warning threshold (complexity > 10 but < 15)
- Update outdated dependencies (patch and minor versions)
- Files approaching the 300-line limit

**Tier 4: Feature Enhancement**
- Deepen existing commands based on growth signals from Sensory Cortex
- Improve error handling and edge cases
- Add missing test cases for untested code paths

**Tier 5: New Growth**
- Growth Hormone proposals that have been approved (Sprint 3 adds this)
- New capabilities identified by growth signals

### Work Item Schema

```typescript
interface WorkItem {
  id: string;                          // UUID
  tier: 1 | 2 | 3 | 4 | 5;
  priority_score: number;              // 0-100, within the tier
  title: string;                       // short description
  description: string;                 // detailed description of what to do
  rationale: string;                   // WHY this should be done (evidence-based)
  target_files: string[];              // files likely to be modified
  estimated_complexity: 'trivial' | 'small' | 'medium' | 'large';
  memory_context: string[];            // relevant lesson IDs from Memory
  success_criteria: string[];          // how to verify the change worked
  created_by: AgentRole;
  status: 'proposed' | 'planned' | 'in-progress' | 'completed' | 'rejected';
}

interface CyclePlan {
  cycle_number: number;
  timestamp: string;
  state_report_id: string;            // which state report this plan is based on
  selected_items: WorkItem[];          // max 3
  deferred_items: WorkItem[];          // items that didn't make the cut
  rationale: string;                   // why these items were selected
  estimated_risk: 'low' | 'medium' | 'high';
  memory_consulted: boolean;
}
```

### Constraints

- Maximum 3 work items per cycle (from organism.json `max_changes_per_cycle`)
- If the organism is in cooldown (regression detected in previous cycle), the Prefrontal Cortex can only plan Tier 1 and Tier 2 items
- Consults Memory before finalizing the plan. If Memory says "last time we modified X, it caused a regression," factor that into the risk assessment
- Never schedules work that violates organism.json boundaries

### Human-Readable Output

```
🧠 Cycle Plan #7
─────────────────
Based on: state report 2026-04-04T14:30:00
Organism status: healthy (no cooldown)

Planned work (3 items):

  1. [Tier 2] Fix performance regression in hotspots command
     Rationale: hotspots execution time increased 23% since last cycle (1.47s → 1.81s)
     Target: src/analyzers/file-analyzer.ts
     Risk: low (isolated change, good test coverage)
     Memory note: file-analyzer.ts has 0 historical regressions

  2. [Tier 3] Increase test coverage for ghost command
     Rationale: ghosts.test.ts only covers 2 of 5 code paths
     Target: tests/commands/ghosts.test.ts
     Risk: low (test-only change)

  3. [Tier 3] Update chalk from 5.3.0 to 5.4.1 (minor)
     Rationale: 1 minor update available, changelog shows no breaking changes
     Target: package.json, package-lock.json
     Risk: low (minor version bump)

Deferred:
  - [Tier 4] Add --verbose flag to pulse command (growth signal, low urgency)
  - [Tier 4] Improve error message when run outside git repo

Estimated cycle risk: low
```

---

## Agent 5: Motor Cortex (Builder)

### Purpose

Take a work item from the cycle plan and implement it. Writes code, creates branches, writes tests.

### CRITICAL: How the Motor Cortex Writes Code

The Motor Cortex uses the Anthropic API (Claude) to generate code changes. It does NOT use hard-coded templates or simple find-and-replace. It constructs a prompt that includes:

1. The work item description and success criteria
2. The current content of target files
3. Relevant lessons from Memory
4. The organism's quality standards from organism.json
5. The organism's evolutionary principles

It sends this to the Claude API and receives back the proposed code changes. It then applies those changes to a branch.

**Implementation approach:**

```typescript
// src/agents/motor-cortex/implementer.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function implementWorkItem(item: WorkItem, context: ImplementationContext): Promise<ImplementationResult> {
  // 1. Read current file contents for all target files
  // 2. Get relevant memory context
  // 3. Construct the implementation prompt
  // 4. Call Claude API
  // 5. Parse the response into file changes
  // 6. Apply changes to a new branch
  // 7. Run tests to verify
  // 8. Return result
}
```

The prompt to Claude should be structured and specific. Include the file contents, the exact change needed, the quality constraints, and ask for both the implementation and corresponding test updates. Ask Claude to respond with a structured format that maps filenames to their new content.

### CLI Entrypoint

```bash
# Implement a specific work item from the current plan
giti build <work-item-id>

# Implement all items in the current cycle plan sequentially
giti build --all

# Output: creates branches, writes code, prints summary
```

### Branch Management

Every change gets its own branch following the naming convention from organism.json:

```
organism/motor/{short-description}
```

The branch manager:
1. Creates the branch from main
2. Applies the Motor Cortex's changes
3. Commits with a structured commit message
4. Does NOT merge (that's the orchestrator's job after Immune System approval)

### Commit Message Format

```
organism(motor): {short description}

Work item: {work-item-id}
Tier: {tier}
Cycle: {cycle-number}

{detailed description of what was changed and why}

Rationale: {rationale from the work item}
```

### Implementation Result

```typescript
interface ImplementationResult {
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
  error?: string;                     // if status is 'failed'
  claude_tokens_used: number;         // track API usage
}
```

### Safety Rails

The Motor Cortex has hard limits:

- Can only modify files within the `giti` project directory
- Cannot modify `organism.json` (that's the human's domain)
- Cannot modify anything in `.organism/` (that's the other agents' domain)
- Cannot delete test files
- Cannot remove existing commands
- Must run `tsc --noEmit` after making changes. If it fails, attempt one self-correction cycle (re-prompt Claude with the error). If it still fails, mark the implementation as `failed`
- Must run `vitest run` after making changes. If tests fail, attempt one self-correction cycle. If still failing, mark as `failed`
- Maximum 2 Claude API calls per work item (initial + one retry)
- Cannot install dependencies with known vulnerabilities

### Human-Readable Output

```
🔧 Motor Cortex: Implementing work item abc123
────────────────────────────────────────────────
Task: Fix performance regression in hotspots command
Branch: organism/motor/fix-hotspots-perf

Changes:
  Modified: src/analyzers/file-analyzer.ts (+12 -28 lines)
  Modified: tests/analyzers/file-analyzer.test.ts (+8 lines)

Pre-review check:
  ✅ TypeScript compiles cleanly
  ✅ All tests pass (49/49)
  ✅ Build succeeds

Branch ready for Immune System review.
API usage: 1,247 tokens
```

---

## The Lifecycle Orchestrator

### Purpose

Coordinate all agents through a complete lifecycle cycle. This is the heartbeat of the organism.

### CLI Entrypoints

```bash
# Run a single lifecycle cycle
giti cycle

# Run with human approval gate (requires confirmation before merge)
giti cycle --supervised

# Start continuous lifecycle (runs on schedule)
giti organism start [--interval=24h]

# Stop continuous lifecycle
giti organism stop

# Check organism status
giti organism status
```

### Single Cycle Flow

```typescript
async function runCycle(options: CycleOptions): Promise<CycleResult> {
  const cycle = incrementCycleCounter();
  log(`Starting lifecycle cycle #${cycle}`);

  // Phase 1: SENSE
  log('Phase 1: Sensing...');
  const stateReport = await sensoryCortex.scan();
  await memory.record({ type: 'cycle-started', cycle, stateReport: stateReport.id });

  // Phase 2: PLAN
  log('Phase 2: Planning...');
  const plan = await prefrontalCortex.plan(stateReport);
  await memory.record({ type: 'plan-created', cycle, items: plan.selected_items.length });

  if (plan.selected_items.length === 0) {
    log('No work items identified. Organism is stable.');
    await memory.record({ type: 'cycle-complete', cycle, changes: 0, outcome: 'stable' });
    return { cycle, outcome: 'stable', changes: 0 };
  }

  // Phase 3: BUILD
  log('Phase 3: Building...');
  const implementations = [];
  for (const item of plan.selected_items) {
    const result = await motorCortex.implement(item);
    implementations.push(result);
    await memory.record({
      type: result.status === 'success' ? 'implementation-complete' : 'implementation-failed',
      cycle, workItem: item.id, branch: result.branch_name
    });
  }

  // Phase 4: DEFEND
  log('Phase 4: Defending...');
  const approvedBranches = [];
  for (const impl of implementations.filter(i => i.status === 'success')) {
    const verdict = await immuneSystem.review(impl.branch_name);
    await memory.record({
      type: verdict.verdict === 'approve' ? 'change-approved' : 'change-rejected',
      cycle, branch: impl.branch_name, verdict: verdict.verdict,
      reasons: verdict.checks.filter(c => c.status !== 'pass').map(c => c.message)
    });
    if (verdict.verdict === 'approve') {
      approvedBranches.push(impl.branch_name);
    }
  }

  // Phase 5: COMMIT
  if (options.supervised) {
    // In supervised mode, pause and ask for human confirmation
    const confirmed = await promptUser(
      `${approvedBranches.length} branches approved for merge. Proceed? (y/n)`
    );
    if (!confirmed) {
      log('Human declined merge. Branches preserved for manual review.');
      await memory.record({ type: 'merge-declined-by-human', cycle });
      return { cycle, outcome: 'human-declined', changes: 0 };
    }
  }

  log('Phase 5: Committing...');
  let mergedCount = 0;
  for (const branch of approvedBranches) {
    try {
      await gitMerge(branch, 'main');
      await gitDeleteBranch(branch);
      mergedCount++;
    } catch (error) {
      await memory.record({ type: 'merge-failed', cycle, branch, error: String(error) });
    }
  }

  // Phase 6: REFLECT
  log('Phase 6: Reflecting...');
  await immuneSystem.updateBaselines();
  await memory.record({
    type: 'cycle-complete', cycle,
    changes: mergedCount,
    attempted: implementations.length,
    approved: approvedBranches.length,
    outcome: mergedCount > 0 ? 'productive' : 'no-changes'
  });

  // Run curator to extract lessons from this cycle
  await memory.curate();

  // Post-merge verification: run sensory cortex again to check for regressions
  const postState = await sensoryCortex.scan();
  const regressionDetected = detectRegression(stateReport, postState);
  if (regressionDetected) {
    await memory.record({ type: 'regression-detected', cycle, details: regressionDetected });
    log('⚠️ Regression detected. Entering 48h cooldown.');
    await setCooldown(48 * 60 * 60 * 1000);
  }

  return {
    cycle,
    outcome: regressionDetected ? 'regression' : 'productive',
    changes: mergedCount,
    regressions: regressionDetected ? [regressionDetected] : []
  };
}
```

### Safety Systems

**Kill switch:** `giti organism stop` immediately halts any running cycle and prevents new cycles from starting. The organism writes a `.organism/kill-switch` file. The orchestrator checks for this file at the start of every phase and aborts if present.

**Cooldown:** After a regression is detected, write `.organism/cooldown-until.json` with the expiration timestamp. The orchestrator refuses to start a new cycle until cooldown expires. During cooldown, only Tier 1 and Tier 2 work items can be planned.

**Concurrent execution prevention:** Write `.organism/active-cycle.json` at the start of a cycle, delete it at the end. If the file exists when a new cycle tries to start, refuse (previous cycle is still running or crashed). Include a stale-lock timeout of 2 hours to handle crashes.

**Maximum consecutive failures:** If 3 consecutive cycles produce zero successful merges, the organism pauses and logs a warning. Something is systemically wrong and needs human attention.

**API cost tracking:** The orchestrator tracks total Claude API tokens used per cycle and cumulative. Write to `.organism/api-usage.json`. Add a configurable budget ceiling. If the ceiling is reached, the organism pauses.

### Scheduler

For continuous operation, the scheduler uses `node-cron` or a simple `setInterval` with the configured interval (default: 24 hours).

```bash
# Run every 24 hours
giti organism start --interval=24h

# Run every 12 hours
giti organism start --interval=12h

# Run every hour (aggressive, for testing)
giti organism start --interval=1h
```

The scheduler writes its PID and configuration to `.organism/scheduler.json` so `giti organism status` can report on it.

### Status Command

```bash
giti organism status
```

```
🧬 Organism Status
──────────────────
State:          running (cycle every 24h)
Last cycle:     #7, 6h ago (productive, 2 changes merged)
Next cycle:     in 18h
Cooldown:       none
Total cycles:   7
Total changes:  12 merged, 4 rejected
API usage:      23,456 tokens (budget: 100,000/month)

Recent activity:
  Cycle #7: merged 2 changes (perf fix + test coverage)
  Cycle #6: merged 1 change (dependency update)
  Cycle #5: 0 changes (all items rejected by Immune System)
```

---

## OpenClaw Integration

### Purpose

Instrument every agent action through OpenClaw so DashClaw can observe the organism. This is the bridge between the organism and its dashboard.

### Integration Approach

Wrap each agent's main function with OpenClaw instrumentation. Every agent action becomes a trace with spans for each phase.

```typescript
// src/integrations/openclaw/instrument.ts

interface AgentTrace {
  agent: AgentRole;
  action: string;
  cycle: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: 'success' | 'failure';
  inputs: Record<string, unknown>;    // sanitized inputs
  outputs: Record<string, unknown>;   // sanitized outputs
  metadata: Record<string, unknown>;
}
```

For Sprint 2, implement the instrumentation hooks but make OpenClaw optional. If the OPENCLAW_API_KEY environment variable is set, send traces. If not, skip silently. This lets the organism run locally without DashClaw and in production with full observability.

### What Gets Traced

- Sensory Cortex scan (duration, anomaly count, growth signal count)
- Prefrontal Cortex planning (items considered, items selected, tier distribution)
- Motor Cortex implementation (files changed, API tokens used, self-correction attempts)
- Immune System review (checks run, checks passed/failed, verdict)
- Memory recording and curation (events recorded, lessons extracted)
- Full cycle (total duration, outcome, changes merged)

---

## Testing Strategy

### Prefrontal Cortex Tests

- Test prioritization with mock state reports containing different combinations of issues
- Verify Tier 1 items always come before Tier 2, etc.
- Test cooldown behavior (only Tier 1 and 2 during cooldown)
- Test max_changes_per_cycle enforcement
- Test Memory consultation (mock memory responses that should influence planning)

### Motor Cortex Tests

- Mock the Anthropic API client to return predefined code changes
- Test branch creation and commit message formatting
- Test the self-correction loop (first API call returns broken code, second succeeds)
- Test safety rails (cannot modify organism.json, cannot delete tests, etc.)
- Test failure handling (API error, compilation failure, test failure)

### Orchestrator Tests

- Test full cycle flow with all agents mocked
- Test supervised mode (human approval gate)
- Test kill switch behavior
- Test cooldown enforcement
- Test concurrent execution prevention (stale lock detection)
- Test regression detection and cooldown triggering
- Test consecutive failure pause

### Integration Test

Create one end-to-end test (`full-cycle.test.ts`) that:
1. Sets up a temporary git repo with known state
2. Seeds it with the giti source code
3. Introduces a deliberate issue (a file over the complexity limit)
4. Runs a full lifecycle cycle in supervised mode
5. Verifies the cycle detected the issue, planned a fix, implemented it, and the Immune System reviewed it
6. This test can mock the Claude API but should run all other agents for real

---

## Environment Variables

```bash
# Required for Motor Cortex
ANTHROPIC_API_KEY=sk-...          # Claude API key for code generation

# Optional: OpenClaw integration
OPENCLAW_API_KEY=...              # OpenClaw API key
OPENCLAW_ENDPOINT=...             # OpenClaw API endpoint

# Optional: safety controls
GITI_API_BUDGET=100000            # max tokens per month
GITI_CYCLE_INTERVAL=86400000      # cycle interval in ms (default: 24h)
GITI_SUPERVISED=true              # require human approval for merges
```

---

## Definition of Done

Sprint 2 is complete when:

1. `giti plan` produces a valid, prioritized cycle plan based on state data
2. `giti build <item-id>` implements a work item on a branch using Claude API
3. `giti build` includes self-correction (retry on compilation/test failure)
4. Motor Cortex respects all safety rails
5. `giti cycle` runs a complete lifecycle loop: sense → plan → build → review → commit → reflect
6. `giti cycle --supervised` pauses for human confirmation before merging
7. `giti organism start` schedules recurring cycles
8. `giti organism stop` halts the organism (kill switch works)
9. `giti organism status` shows current state and history
10. Cooldown, concurrent execution prevention, and consecutive failure detection all work
11. OpenClaw instrumentation hooks exist and work when API key is present
12. End-to-end integration test passes
13. All tests pass with 80%+ coverage

## What NOT To Do

- Do not implement the Growth Hormone agent. That's Sprint 3.
- Do not add user-facing telemetry. That's Sprint 3.
- Do not build DashClaw dashboards. That's Sprint 4.
- Do not let the Motor Cortex modify organism.json under any circumstances.
- Do not skip the self-correction loop in Motor Cortex. This is essential for reliability.
- Do not use Claude API calls anywhere except Motor Cortex. All other agents are deterministic.
- Do not remove the supervised mode option. It's the safety net while we build trust.
