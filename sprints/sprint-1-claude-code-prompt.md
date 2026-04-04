# Claude Code Prompt: Sprint 1 — Build the Safety Layer

## Context

You are building Sprint 1 of **The Living Codebase** project. Sprint 0 is complete: `giti` is a working CLI tool with three commands (`pulse`, `hotspots`, `ghosts`), a test suite, and an `organism.json` manifest.

Now you're building the safety layer. Before the organism can ever modify itself, it needs three things: eyes to see its own state, an immune system to reject bad changes, and a memory to learn from experience. Nothing in this sprint gives the organism the ability to write code or make changes. This sprint is purely about observation, judgment, and knowledge.

Read `living-codebase-architecture.md` for the full vision. Read `organism.json` for the organism's identity, boundaries, and quality standards.

## What You're Building

Three agent modules that will eventually be orchestrated by OpenClaw, but for now are implemented as standalone TypeScript modules with CLI entrypoints for manual testing. Each agent reads inputs, performs analysis, and writes structured output files.

## Project Structure Additions

```
giti/
├── src/
│   ├── agents/
│   │   ├── sensory-cortex/
│   │   │   ├── index.ts              # Main sensory cortex logic
│   │   │   ├── collectors/
│   │   │   │   ├── git-stats.ts      # Collect git statistics
│   │   │   │   ├── test-health.ts    # Collect test results and coverage
│   │   │   │   ├── code-quality.ts   # Collect complexity and lint metrics
│   │   │   │   ├── dependency-health.ts  # npm audit, outdated packages
│   │   │   │   └── performance.ts    # Benchmark execution times
│   │   │   ├── analyzers/
│   │   │   │   └── trend-detector.ts # Detect trends across historical reports
│   │   │   └── types.ts
│   │   ├── immune-system/
│   │   │   ├── index.ts              # Main immune system logic
│   │   │   ├── checks/
│   │   │   │   ├── test-check.ts     # Run tests and verify pass/coverage
│   │   │   │   ├── quality-check.ts  # Complexity, file length, lint
│   │   │   │   ├── performance-check.ts  # Benchmark against budgets
│   │   │   │   ├── boundary-check.ts # Verify change respects organism.json
│   │   │   │   ├── regression-check.ts   # Compare against known baselines
│   │   │   │   └── dependency-check.ts   # Security audit new dependencies
│   │   │   ├── types.ts
│   │   │   └── verdict.ts            # Verdict generation logic
│   │   ├── memory/
│   │   │   ├── index.ts              # Main memory agent logic
│   │   │   ├── store.ts             # Read/write knowledge base
│   │   │   ├── curator.ts            # Synthesize lessons from raw events
│   │   │   ├── query.ts              # Query interface for other agents
│   │   │   └── types.ts
│   │   └── types.ts                  # Shared agent types
│   └── cli/
│       ├── sense.ts                  # CLI entrypoint: run sensory cortex
│       ├── review.ts                 # CLI entrypoint: run immune system review
│       └── remember.ts               # CLI entrypoint: interact with memory
├── .organism/
│   ├── state-reports/                # Historical sensory cortex outputs
│   ├── reviews/                      # Historical immune system verdicts
│   ├── knowledge-base.json           # Memory agent's curated knowledge
│   └── baselines.json                # Performance and quality baselines
└── tests/
    ├── agents/
    │   ├── sensory-cortex/
    │   │   ├── collectors.test.ts
    │   │   └── trend-detector.test.ts
    │   ├── immune-system/
    │   │   ├── checks.test.ts
    │   │   └── verdict.test.ts
    │   └── memory/
    │       ├── store.test.ts
    │       ├── curator.test.ts
    │       └── query.test.ts
    └── fixtures/
        └── agent-fixtures/           # Mock data for agent tests
```

## The `.organism/` Directory

This is the organism's brain. It stores all persistent state across lifecycle cycles. Add `.organism/` to `.gitignore` for now (the organism's internal state shouldn't be committed to the project repo). Later in Sprint 3, we'll decide what parts of this should be versioned.

Initialize the directory structure on first run if it doesn't exist.

---

## Agent 1: Sensory Cortex

### Purpose

Observe everything about the organism's current state and produce a comprehensive report. This agent never takes action. It only watches and reports.

### CLI Entrypoint

```bash
# Run a full sensory scan
giti sense

# Output: writes state report to .organism/state-reports/{timestamp}.json
# Also prints a human-readable summary to terminal
```

### State Report Schema

```typescript
interface StateReport {
  timestamp: string;                    // ISO 8601
  version: string;                      // current package.json version

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
    test_ratio: number;                 // test_files / source_files
    test_pass_rate: number;             // 0-1, from running vitest
    test_coverage_percent: number;      // from vitest --coverage
    lint_error_count: number;           // from tsc --noEmit
    files_exceeding_length_limit: string[];    // files > 300 lines
    functions_exceeding_complexity: string[];  // functions > 15 complexity
  };

  performance: {
    pulse_execution_ms: number;         // benchmark giti pulse
    hotspots_execution_ms: number;      // benchmark giti hotspots
    ghosts_execution_ms: number;        // benchmark giti ghosts
    benchmarked_against: string;        // path to the repo used for benchmarking
  };

  dependencies: {
    total_count: number;
    outdated_count: number;
    vulnerable_count: number;
    outdated_packages: Array<{
      name: string;
      current: string;
      latest: string;
      severity: 'patch' | 'minor' | 'major';
    }>;
    vulnerabilities: Array<{
      package: string;
      severity: string;
      description: string;
    }>;
  };

  codebase: {
    total_files: number;
    total_lines: number;
    avg_file_length: number;
    largest_files: Array<{ path: string; lines: number }>;
    file_type_distribution: Record<string, number>;  // e.g., { ".ts": 23, ".json": 5 }
  };

  anomalies: Array<{
    type: 'quality_floor_approaching' | 'performance_regression' | 'dependency_vulnerability' | 'complexity_spike';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    data: Record<string, unknown>;
  }>;

  growth_signals: Array<{
    signal: string;
    evidence: string;
    confidence: number;               // 0-1
  }>;
}
```

### Collectors

Each collector is a standalone async function that gathers one category of data.

**git-stats.ts:** Uses `simple-git` to gather commit history, branch info, and author stats. Should be efficient and reuse git log calls where possible.

**test-health.ts:** Runs `vitest run --reporter=json` and `vitest run --coverage --reporter=json` programmatically (use `child_process.execSync` or `execa`). Parses the JSON output to extract pass rate and coverage percentage.

**code-quality.ts:** Runs `tsc --noEmit` and counts errors. Scans all source files for length (line count). For complexity, implement a simple cyclomatic complexity calculator that counts branching statements (`if`, `else`, `switch`, `case`, `for`, `while`, `do`, `catch`, `&&`, `||`, `??`, ternary `?`). This doesn't need to be AST-based — regex counting is fine for now.

**dependency-health.ts:** Runs `npm outdated --json` and `npm audit --json` and parses the results.

**performance.ts:** Runs each giti command against the organism's own repo (or a configured benchmark repo) and measures execution time. Runs each command 3 times and takes the median.

### Trend Detection

After producing the current state report, the trend detector loads the last N historical reports from `.organism/state-reports/` and identifies trends:

- Is test coverage going up or down?
- Is complexity increasing?
- Are performance benchmarks degrading?
- Is commit velocity changing?

Trends are included in the anomalies array when they cross thresholds defined in organism.json.

### Human-Readable Output

After writing the JSON report, print a summary to the terminal:

```
🧠 Sensory Scan Complete
────────────────────────
Quality:     ✅ 83% coverage | 0 lint errors | 0 files over limit
Performance: ✅ pulse: 340ms | hotspots: 1.2s | ghosts: 890ms
Dependencies: ⚠️  2 outdated (minor) | 0 vulnerabilities
Anomalies:   1 warning — complexity trending up 8% over last 5 cycles
Growth:      2 signals detected

Full report: .organism/state-reports/2026-04-04T14:30:00.json
```

---

## Agent 2: Immune System

### Purpose

Review a proposed set of changes (on a branch) and produce a verdict: approve, reject, or request changes. This is the organism's quality gate. Nothing merges without its approval.

### CLI Entrypoint

```bash
# Review a branch against main
giti review <branch-name>

# Output: writes verdict to .organism/reviews/{branch-name}-{timestamp}.json
# Also prints human-readable summary to terminal

# Example:
giti review organism/motor/add-json-output
```

### Review Process

1. **Diff analysis:** Get the full diff between the branch and main. Identify which files were added, modified, and deleted.

2. **Run all checks** (in parallel where possible):

   **test-check.ts:**
   - Checkout the branch
   - Run `vitest run --coverage --reporter=json`
   - Compare test pass rate and coverage against main's baseline (stored in `.organism/baselines.json`)
   - Fail if any test fails
   - Fail if coverage drops below the floor in organism.json (80%)
   - Warn if coverage decreased at all (even above the floor)

   **quality-check.ts:**
   - Run `tsc --noEmit` on the branch
   - Fail if any new lint errors introduced
   - Scan modified/added files for length violations (> 300 lines)
   - Scan modified/added files for complexity violations (> 15 per function)
   - Compare total codebase complexity against baseline

   **performance-check.ts:**
   - Run performance benchmarks on the branch
   - Compare against baselines in `.organism/baselines.json`
   - Fail if any command exceeds its performance budget from organism.json
   - Warn if performance degraded more than 10% from baseline

   **boundary-check.ts:**
   - Parse the diff and verify changes don't violate organism.json boundaries
   - Check that no forbidden_zone concepts are introduced
   - Verify new dependencies (if any) are justified
   - Check that existing command output formats are not broken (compare output structure)

   **regression-check.ts:**
   - Query Memory for known fragile areas of the codebase
   - If the change touches a file that has caused regressions before, flag for extra scrutiny
   - Check if this type of change has historically caused problems

   **dependency-check.ts:**
   - If new dependencies were added, run `npm audit` on them
   - Check for known vulnerabilities
   - Flag dependencies with fewer than 100 weekly downloads or no recent maintenance
   - Count total new dependencies added (organism should prefer minimal dependencies)

3. **Generate verdict:**

```typescript
interface ReviewVerdict {
  branch: string;
  timestamp: string;
  verdict: 'approve' | 'reject' | 'request-changes';
  confidence: number;              // 0-1, how confident the immune system is
  summary: string;                 // one-sentence summary

  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    details?: Record<string, unknown>;
  }>;

  risks: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation?: string;
  }>;

  recommendation: string;          // detailed recommendation paragraph
}
```

### Verdict Logic

- If ANY check has status `fail` → verdict is `reject`
- If no fails but 3+ warnings → verdict is `request-changes`
- If no fails and fewer than 3 warnings → verdict is `approve`
- Confidence is calculated based on how many checks were able to run successfully (some might error out if the branch is in a broken state)

### Human-Readable Output

```
🛡️  Immune System Review: organism/motor/add-json-output
──────────────────────────────────────────────────────────
Verdict: ✅ APPROVED (confidence: 0.95)

Checks:
  ✅ Tests         — 47/47 passing, coverage 84% (was 83%)
  ✅ Quality       — 0 lint errors, no files over limit
  ✅ Performance   — pulse: 350ms (budget: 2000ms)
  ⚠️  Dependencies — 1 new dependency added (yargs-parser)
  ✅ Boundaries    — change within growth zone
  ✅ Regression    — no known fragile files touched

Risks:
  🟡 Low: new dependency adds 12KB to install size

Recommendation: Approve. Change is clean, well-tested, and within boundaries.
The new dependency is small and well-maintained (2.1M weekly downloads).

Full verdict: .organism/reviews/add-json-output-2026-04-04T14:45:00.json
```

### Baseline Management

The Immune System maintains `.organism/baselines.json` which stores the current "known good" state of main:

```typescript
interface Baselines {
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

Update baselines after every approved and merged change.

---

## Agent 3: Memory

### Purpose

Persistent institutional knowledge. Memory records what happened, synthesizes lessons, and provides a query interface for other agents.

### CLI Entrypoint

```bash
# Record an event
giti remember record --type=cycle-complete --data='{"cycle": 1, "changes_merged": 2}'

# Query memory
giti remember query "what happened last time we modified the hotspots analyzer?"
giti remember query "what types of changes get rejected most often?"

# View the knowledge base summary
giti remember summary

# View a specific category
giti remember summary --category=regressions
```

### Knowledge Base Structure

The knowledge base lives at `.organism/knowledge-base.json`:

```typescript
interface KnowledgeBase {
  created: string;
  last_updated: string;
  cycle_count: number;

  events: Array<{
    id: string;                         // UUID
    timestamp: string;
    cycle: number;
    type: 'change-merged' | 'change-rejected' | 'regression-detected' |
          'regression-fixed' | 'growth-proposed' | 'growth-approved' |
          'growth-rejected' | 'baseline-updated' | 'anomaly-detected';
    summary: string;
    data: Record<string, unknown>;
    tags: string[];                     // for queryability
  }>;

  lessons: Array<{
    id: string;
    learned_at: string;
    lesson: string;                     // natural language lesson
    evidence_event_ids: string[];       // which events led to this lesson
    confidence: number;                 // 0-1, increases with more evidence
    category: 'architecture' | 'quality' | 'performance' | 'dependencies' |
              'testing' | 'growth' | 'regressions';
    times_referenced: number;           // how often other agents queried this
  }>;

  patterns: {
    fragile_files: Array<{
      path: string;
      regression_count: number;
      last_regression: string;
      notes: string;
    }>;
    rejection_reasons: Record<string, number>;    // reason → count
    successful_change_types: Record<string, number>;
    failed_change_types: Record<string, number>;
  };

  preferences: Array<{
    preference: string;                 // e.g., "prefers decomposition over refactoring"
    evidence_count: number;
    first_observed: string;
    last_observed: string;
  }>;
}
```

### Curator Logic

The curator (`curator.ts`) runs after new events are recorded and synthesizes higher-order knowledge:

1. **Lesson extraction:** After a regression, look at the change that caused it and generate a lesson: "Changes to {file} that modify {pattern} have a {X}% regression rate."

2. **Pattern detection:** After 5+ rejections, analyze rejection reasons and identify patterns: "Most rejections are due to {reason}."

3. **Preference emergence:** After 10+ decisions, identify if the organism consistently favors certain approaches: "The organism has chosen to decompose files rather than refactor in place 8 out of 10 times."

4. **Confidence updates:** When a lesson is confirmed by additional events, increase its confidence. When contradicted, decrease it.

The curator does NOT need to use an LLM. It uses rule-based heuristics and string templates for now. The organism can evolve this later. Keep it simple and deterministic so it's testable.

### Query Interface

The query function (`query.ts`) takes a natural language question and does keyword matching against events, lessons, and patterns. For Sprint 1, this is simple keyword search — not vector search or LLM-powered. It returns relevant events and lessons sorted by relevance (keyword match count) and recency.

```typescript
interface QueryResult {
  query: string;
  results: Array<{
    type: 'event' | 'lesson' | 'pattern' | 'preference';
    content: string;
    relevance: number;         // 0-1
    timestamp: string;
  }>;
  total_results: number;
}
```

### Human-Readable Summary Output

```
🧠 Organism Memory Summary
───────────────────────────
Lifecycle cycles completed: 12
Total events recorded:      47
Lessons learned:            8
Preferences emerged:        3

Top lessons (by confidence):
  1. [0.92] Changes to commit-analyzer.ts frequently cause test failures in pulse.test.ts
  2. [0.85] Adding new dependencies increases Immune System rejection rate by 40%
  3. [0.78] Performance optimizations to git log parsing have highest approval rate

Emerged preferences:
  1. Prefers small, focused changes over large refactors (observed 8 times)
  2. Avoids adding third-party dependencies when stdlib alternatives exist (observed 5 times)
  3. Prioritizes test coverage improvements over new features (observed 4 times)

Fragile files:
  src/analyzers/commit-analyzer.ts — 3 regressions, last: 2 cycles ago
```

---

## Integration Points

### Agent Communication

For Sprint 1, agents communicate through the filesystem (`.organism/` directory). Each agent reads and writes JSON files. This is intentionally simple. In Sprint 2, we'll wire these into OpenClaw for real orchestration.

### Shared Types

Create `src/agents/types.ts` with shared interfaces that all agents use:

```typescript
// Agent identification
type AgentRole = 'sensory-cortex' | 'immune-system' | 'memory' |
                 'prefrontal-cortex' | 'motor-cortex' | 'growth-hormone';

// Standard agent output wrapper
interface AgentOutput<T> {
  agent: AgentRole;
  timestamp: string;
  cycle?: number;
  data: T;
}

// Event that Memory records
interface OrganismEvent {
  id: string;
  timestamp: string;
  cycle: number;
  type: string;
  agent: AgentRole;
  summary: string;
  data: Record<string, unknown>;
  tags: string[];
}
```

### CLI Registration

Add the new commands to the main `giti` CLI:

```bash
giti sense              # Run sensory cortex
giti review <branch>    # Run immune system review
giti remember ...       # Interact with memory
```

These sit alongside the existing `pulse`, `hotspots`, and `ghosts` commands.

---

## Testing Strategy

### Sensory Cortex Tests

- Mock `child_process` calls for vitest, tsc, npm audit, npm outdated
- Test each collector independently with fixture data
- Test trend detection with a sequence of mock historical reports
- Test anomaly detection thresholds

### Immune System Tests

- Create test fixtures with mock branch diffs
- Test each check independently
- Test verdict logic: all-pass → approve, any-fail → reject, multiple-warns → request-changes
- Test baseline management (read, update, compare)
- Test that boundary checking correctly catches forbidden zone violations

### Memory Tests

- Test event recording (add events, verify they persist)
- Test curator logic with sequences of events that should produce lessons
- Test keyword query matching
- Test preference emergence after N similar decisions
- Test confidence score updates

---

## Quality Requirements

Same standards as Sprint 0:
- 80%+ test coverage on all new code
- No function exceeds complexity of 15
- No file exceeds 300 lines
- Zero `tsc --noEmit` errors
- All existing tests continue to pass

---

## Definition of Done

Sprint 1 is complete when:

1. `giti sense` runs successfully and produces a valid state report JSON
2. `giti sense` prints a human-readable summary to the terminal
3. Historical state reports accumulate in `.organism/state-reports/`
4. Trend detection works across multiple sequential reports
5. `giti review <branch>` runs all six checks against a branch
6. `giti review` produces correct verdicts (approve/reject/request-changes)
7. `giti review` maintains and updates baselines
8. `giti remember record` persists events to the knowledge base
9. `giti remember query` returns relevant results for keyword queries
10. `giti remember summary` displays the organism's accumulated knowledge
11. Curator logic extracts lessons from event sequences
12. All tests pass with 80%+ coverage
13. The three agents can be run in sequence to simulate a partial lifecycle cycle:
    `giti sense` → `giti review some-branch` → `giti remember record --type=...`

## What NOT To Do

- Do not implement the Prefrontal Cortex, Motor Cortex, or Growth Hormone. Those are Sprint 2 and 3.
- Do not use any LLM calls. Everything in this sprint is deterministic and rule-based.
- Do not wire agents into OpenClaw yet. Filesystem-based communication only.
- Do not add telemetry collection from users. That's Sprint 3.
- Do not over-engineer the Memory query interface. Simple keyword matching is fine. The organism will improve it later.
- The curator should use templates and heuristics, not natural language generation. Keep it testable.
