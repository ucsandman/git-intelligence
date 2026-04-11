# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Biological organism architecture with agent-based subsystems

**Key Characteristics:**
- Six specialized agent subsystems (cortex metaphor): sensory-cortex (observation), immune-system (defense), memory (persistence), prefrontal-cortex (planning), motor-cortex (execution), growth-hormone (evolution)
- Lifecycle cycle pattern: SENSE → PLAN → BUILD → DEFEND → COMMIT → REFLECT → GROW
- Event-driven state machine with safety guards, kill switches, and cooldown enforcement
- Persistent organism state stored in `.organism/` directory (JSON + JSON-lines files)
- Cloud-sandboxed execution via Claude Managed Agents for code changes
- Governance integration with optional DashClaw decision dashboard

## Layers

**CLI Layer:**
- Purpose: Command entry points and option parsing
- Location: `src/cli/` (12 subcommands: sense, review, remember, plan, build, cycle, organism, telemetry, simulate, grow, dispatch, observatory)
- Contains: CLI handlers that parse options and invoke agent/command logic
- Depends on: Agent implementations, utils, integrations
- Used by: End user via `giti` CLI

**Commands Layer (Analysis):**
- Purpose: Synchronous analysis operations that don't modify state
- Location: `src/commands/` (pulse, hotspots, ghosts)
- Contains: Pure analysis functions operating on git repository
- Depends on: Analyzers (commit, branch, file, code), git utils
- Used by: CLI commands and tests

**Agent Layer (Subsystems):**
- Purpose: Autonomous subsystems that observe, plan, execute, and defend
- Location: `src/agents/{sensory-cortex,immune-system,memory,prefrontal-cortex,motor-cortex,growth-hormone}/`
- Contains: Agent implementations with their checks, collectors, and logic
- Depends on: Git utils, utils, types, integrations (GitHub, DashClaw, audit)
- Used by: Orchestrator (lifecycle cycle), CLI handlers

**Orchestrator Layer:**
- Purpose: Lifecycle coordinator — manages full sense→plan→build→defend→commit cycle
- Location: `src/agents/orchestrator/` (cycle.ts, safety.ts, scheduler.ts, heartbeat.ts)
- Contains: Cycle runner, safety systems, kill switch, cooldown, API budget, lock management, scheduler
- Depends on: All agent subsystems, integrations, motor-cortex branch manager
- Used by: CLI commands (cycle, organism)

**Integration Layer:**
- Purpose: External service connections (GitHub, DashClaw, audit logging, OpenClaw tracing)
- Location: `src/integrations/{github,dashclaw,audit,openclaw}/`
- Contains: Client wrappers, governance logic, PR formatters, tracing instrumentation
- Depends on: @octokit/rest (GitHub), @anthropic-ai/sdk (tracing)
- Used by: Orchestrator (cycle), motor-cortex (GitHub PRs), agents (audit)

**Action Planning Layer:**
- Purpose: Declarative action schema and execution for complex decision trees
- Location: `src/agents/actions/` (schema.ts, types.ts, planner.ts, runner.ts, builtins/, steps/)
- Contains: Action templates, predicates, planning algorithm, step execution
- Depends on: Agent types, memory, sensory-cortex
- Used by: Orchestrator (runRecommendedAction), prefrontal-cortex (condition evaluation)

**Persistence Layer:**
- Purpose: Organism state and artifacts
- Location: `.organism/` directory in repository
- Contains: state-reports (sensory output), reviews (immune verdicts), backlog (work items), knowledge-base.json, baselines.json, cycle-counter, API usage tracking, cooldown expiry, kill switch, audit log
- Used by: All agents, orchestrator for state continuity across cycles

**Utilities Layer:**
- Purpose: Shared infrastructure
- Location: `src/utils/` (git.ts, time.ts), `src/agents/utils.ts` (filesystem ops, runCommand)
- Contains: Git operations (simple-git wrapper), file I/O helpers, command execution
- Depends on: simple-git, Node.js fs/path
- Used by: All layers

**Observatory Layer:**
- Purpose: Real-time 3D visualization of organism state and lifecycle
- Location: `packages/giti-observatory/` (Next.js 15 app)
- Contains: React Three Fiber terrarium scene, API endpoints, data providers, state management
- Depends on: next, react, three, react-three-fiber, @react-three/drei
- Used by: Browser visualization of `.organism/` state

**Framework Layer:**
- Purpose: Extracted reusable organism framework (under development)
- Location: `packages/livingcode-core/src/` (schema validator, types)
- Contains: OrganismConfig schema, validation logic, type definitions
- Depends on: @anthropic-ai/sdk, simple-git
- Used by: Future implementations of living codebases

## Data Flow

```
ENTRY
  ├─ CLI Command (sense, plan, build, cycle, organism, etc.)
  │   │
  │   ├─ SENSE Phase
  │   │   ├─ runSensoryCortex()
  │   │   │   ├─ collectGitStats() → git log, branches, merge analysis
  │   │   │   ├─ collectTestHealth() → test count, pass/fail patterns
  │   │   │   ├─ collectCodeQuality() → linter errors, complexity, coverage
  │   │   │   ├─ collectDependencyHealth() → npm audit, outdated packages
  │   │   │   ├─ collectPerformance() → metric timelines
  │   │   │   └─ detectTrends() + detectAnomalies()
  │   │   └─ StateReport → .organism/state-reports/{timestamp}.json
  │   │
  │   ├─ PLAN Phase
  │   │   ├─ runPrefrontalCortex()
  │   │   │   ├─ Read StateReport + Config + Baselines
  │   │   │   ├─ generateWorkItems() → 5-tier prioritization
  │   │   │   │   ├─ Tier 1: Critical (vulnerabilities, lint errors)
  │   │   │   │   ├─ Tier 2: High (failing tests, regressions)
  │   │   │   │   ├─ Tier 3: Medium (technical debt, quality improvement)
  │   │   │   │   ├─ Tier 4: Low (minor cleanup, style)
  │   │   │   │   └─ Tier 5: Growth proposals (approved features)
  │   │   │   └─ CyclePlan with selected_items[]
  │   │   │
  │   │   └─ Plan → .organism/backlog/{id}.json
  │   │
  │   ├─ GROW Phase (optional)
  │   │   └─ runGrowthHormone()
  │   │       ├─ Analyze telemetry signals (6 types)
  │   │       ├─ Generate proposals via Claude API
  │   │       └─ Proposals → .organism/growth-proposals/
  │   │
  │   ├─ BUILD Phase
  │   │   ├─ runMotorCortex() for each WorkItem
  │   │   │   ├─ Load quality standards + memory context + principles
  │   │   │   ├─ implementWithAgent()
  │   │   │   │   ├─ Cloud sandbox execution (Claude Managed Agents)
  │   │   │   │   ├─ Capture patch → ImplementationResult
  │   │   │   │   └─ Apply patch locally via git am/apply
  │   │   │   ├─ createBranch() + commitChanges()
  │   │   │   └─ ImplementationResult (status, branch, files modified, tokens used)
  │   │   │
  │   │   ├─ .organism/audit-log.jsonl ← action records
  │   │   └─ API usage → .organism/api-usage.json
  │   │
  │   ├─ DEFEND Phase (Immune System Review)
  │   │   ├─ runImmuneReview() for each built branch
  │   │   │   ├─ Run 7 checks in parallel:
  │   │   │   │   ├─ testCheck() → coverage floor, pass rate
  │   │   │   │   ├─ qualityCheck() → cyclomatic complexity, lint errors
  │   │   │   │   ├─ performanceCheck() → budget adherence
  │   │   │   │   ├─ boundaryCheck() → sacred boundaries (config, docs, package.json)
  │   │   │   │   ├─ regressionCheck() → history of fragile files
  │   │   │   │   ├─ dependencyCheck() → new dependency risk
  │   │   │   │   └─ secretScan() → credential exposure
  │   │   │   ├─ collectRisks() → ReviewRisk[]
  │   │   │   ├─ generateVerdict() → approve/conditional/reject
  │   │   │   └─ ReviewVerdict → .organism/reviews/{branch}.json
  │   │   │
  │   │   └─ approvedBranches[], rejectedCount
  │   │
  │   ├─ GOVERNANCE Phase (DashClaw)
  │   │   ├─ isGovernanceEnabled() → check DASHCLAW_URL env
  │   │   ├─ guardCodeChange() → ask dashboard for decision
  │   │   │   ├─ allowedAutomatically (low-risk pattern)
  │   │   │   ├─ requiresApproval (medium-risk)
  │   │   │   └─ blocked (high-risk)
  │   │   ├─ waitForApproval() → human decision callback
  │   │   └─ recordOutcome() → DashClaw audit trail
  │   │
  │   ├─ COMMIT Phase
  │   │   ├─ pushBranch() for each governedBranch
  │   │   ├─ GitHub PR creation (if client available)
  │   │   │   ├─ formatPRTitle() + formatPRBody()
  │   │   │   ├─ getPRLabels() from work item
  │   │   │   ├─ Merge (if GITI_AUTO_MERGE=true, non-supervised)
  │   │   │   └─ Record to memory: change-merged / merge-failed
  │   │   └─ Local merge fallback (if no GitHub client)
  │   │
  │   ├─ REFLECT Phase
  │   │   ├─ recordMemoryEvent() → persist all events
  │   │   │   └─ .organism/audit-log.jsonl (append-only)
  │   │   ├─ updateBaselines() → capture performance/quality
  │   │   ├─ Memory curator learns from cycle
  │   │   └─ CycleResult → .organism/cycle-history/{number}.json
  │   │
  │   └─ SAFETY CHECKS (throughout cycle)
  │       ├─ Kill switch check (presence of .organism/kill-switch file)
  │       ├─ Consecutive failures check (≥3 → pause)
  │       ├─ API budget check (token usage ≤ GITI_API_BUDGET)
  │       ├─ Cooldown enforcement (48h after regression)
  │       └─ Cycle lock (atomic counter increment)
  │
  └─ SCHEDULER (background daemon)
      └─ startScheduler() → runs cycle on interval (via Node.js setInterval)

STATE PERSISTENCE (.organism/ directory)
  ├─ Sensory Reports
  │   └─ state-reports/{timestamp}.json
  │       ├─ codebase (files, lines, distribution)
  │       ├─ git (commits, branches, changes)
  │       ├─ quality (lint errors, complexity, coverage)
  │       ├─ tests (count, pass rate, health)
  │       ├─ dependencies (count, vulnerabilities)
  │       ├─ performance (metric timeline)
  │       └─ anomalies (detected deviations)
  │
  ├─ Planning & Backlog
  │   └─ backlog/{work-item-id}.json
  │       ├─ id, title, description, tier, priority_score
  │       ├─ target_files[], success_criteria[]
  │       ├─ status (proposed/planned/in-progress/done)
  │       └─ memory_context[] (lesson IDs)
  │
  ├─ Immune Verdicts
  │   └─ reviews/{branch}.json
  │       ├─ verdict (approve/conditional/reject)
  │       ├─ risks[] (description, severity)
  │       ├─ checks_passed (test, quality, perf, boundary, regression, dependency, secret)
  │       └─ rationale
  │
  ├─ Growth Proposals
  │   └─ growth-proposals/{proposal-id}.json
  │       ├─ title, description, signal_type
  │       ├─ related_telemetry[] (event IDs)
  │       └─ status (proposed/approved/rejected)
  │
  ├─ Knowledge Base
  │   └─ knowledge-base.json
  │       ├─ lessons[] (id, lesson, evidence_event_ids)
  │       ├─ patterns (fragile_files, regression history)
  │       └─ hierarchical indexing (category → subcategory)
  │
  ├─ Baselines & Metrics
  │   └─ baselines.json
  │       ├─ quality (test_coverage, complexity, lint_error_count)
  │       ├─ performance (pulse_ms, hotspots_ms, ghosts_ms)
  │       └─ stability (regression_count, failing_branches)
  │
  ├─ Lifecycle State
  │   ├─ cycle-counter.json → { count: N }
  │   ├─ active-cycle.json → { cycle: N, acquired_at: ISO8601 }
  │   ├─ cooldown-until.json → { until: ISO8601 } (post-regression pause)
  │   ├─ kill-switch (file presence = organism halted)
  │   ├─ consecutive-failures.json → { count: N }
  │   ├─ api-usage.json → { total_tokens: N, budget: M }
  │   └─ scheduler.json → { started_at: ISO8601, interval_ms: N }
  │
  ├─ History
  │   └─ cycle-history/{cycle-num}.json
  │       ├─ cycle, status (success/stable/aborted/failed)
  │       ├─ changes_merged, changes_rejected
  │       ├─ duration_ms, tokens_used
  │       └─ timestamp
  │
  └─ Audit & Tracing
      ├─ audit-log.jsonl (append-only, one JSON object per line)
      │   └─ { cycle, timestamp, agent, action, status, details, tokens }
      └─ traces/ (OpenClaw fallback, env-gated)
```

**State Management:**
- Atomic operations via file locks (acquireCycleLock increments counter)
- JSON files for structured state (work items, verdicts, baselines)
- JSON-lines (JSONL) for append-only logs (audit trail, telemetry events)
- File system as source of truth; no external database required
- Observatory reads snapshots from `.organism/` and streams updates via SSE

## Key Abstractions

**StateReport:**
- Purpose: Comprehensive snapshot of codebase health
- Examples: `src/agents/sensory-cortex/types.ts`
- Pattern: Collectors gather metrics independently, report aggregates them, trend detector identifies patterns

**WorkItem:**
- Purpose: Atomic unit of work for organism to implement
- Examples: `src/agents/prefrontal-cortex/types.ts`, `.organism/backlog/*.json`
- Pattern: Created by prioritizer, consumed by motor-cortex, tracked through status lifecycle (proposed → planned → in-progress → done)

**ReviewVerdict:**
- Purpose: Immune system decision on code change safety
- Examples: `src/agents/immune-system/types.ts`, `.organism/reviews/{branch}.json`
- Pattern: 7 checks execute in parallel, risks aggregated, verdict synthesized by verdict generator

**ActionTemplate / ActionInstance:**
- Purpose: Declarative schema for complex decision flows
- Examples: `src/agents/actions/schema.ts`, `.planning/codebase/../plans/*.md`
- Pattern: Templates define predicates and steps; planner instantiates with context; runner executes with rollback

**ImplementationResult:**
- Purpose: Outcome of motor-cortex code generation
- Examples: `src/agents/motor-cortex/types.ts`
- Pattern: Captures patch content, branch name, files changed, test results, token usage, success/failure

**GrowthProposal:**
- Purpose: Evolution suggestion based on telemetry patterns
- Examples: `src/agents/growth-hormone/types.ts`, `.organism/growth-proposals/*.json`
- Pattern: Analyzer detects signal, generator creates proposal, prioritizer elevates to Tier 5 items

**OrganismEvent:**
- Purpose: Persistent lifecycle event for memory and audit trail
- Examples: `src/agents/types.ts`, `.organism/audit-log.jsonl`
- Pattern: Immutable events recorded by agents; curator learns patterns; memory provides context to motor-cortex

## Entry Points

**CLI Entry:**
- Location: `src/index.ts`
- Triggers: `giti <command> [options]`
- Responsibilities: Parse command, load .env, invoke CLI handler, handle unhandled rejections

**Lifecycle Cycle:**
- Location: `src/agents/orchestrator/cycle.ts` (runLifecycleCycle)
- Triggers: `giti cycle` command or scheduled via scheduler
- Responsibilities: Orchestrate sense→plan→build→defend→governance→commit→reflect phases

**Analysis Commands:**
- Location: `src/commands/{pulse,hotspots,ghosts}.ts`
- Triggers: `giti pulse`, `giti hotspots`, `giti ghosts`
- Responsibilities: Pure analysis without state modification, direct git operations

**Sensory Scan:**
- Location: `src/agents/sensory-cortex/index.ts` (runSensoryCortex)
- Triggers: `giti sense` command or Phase 1 of cycle
- Responsibilities: Collect 5 dimensions of health, detect anomalies, persist report

**Immune Review:**
- Location: `src/agents/immune-system/index.ts` (runImmuneReview)
- Triggers: `giti review <branch>` command or Phase 4 of cycle
- Responsibilities: Run 7 checks, synthesize verdict, persist to `.organism/reviews/`

**Motor Implementation:**
- Location: `src/agents/motor-cortex/index.ts` (runMotorCortex)
- Triggers: `giti build [id]` command or Phase 3 of cycle
- Responsibilities: Execute agent in cloud sandbox, apply patch, manage branch, record metrics

## Error Handling

**Strategy:** Fail-safe with partial progress preservation

**Patterns:**
- Unhandled promise rejections exit with status 1 (see `src/index.ts`)
- Collector failures in sensory-cortex report gracefully with partial data
- Check failures in immune-system mark as "warn" or "fail" without stopping review
- Build failure records to memory and continues to next item
- API errors during motor-cortex building trigger fallback behaviors
- Kill switch allows graceful organism halt
- Cooldown prevents cascading failures post-regression
- Consecutive failure counter pauses organism after 3 failures (auto-recovery possible)

## Cross-Cutting Concerns

**Logging:**
- Via `console.log()`, `console.error()` to stdout/stderr
- Spinners (ora) for CLI feedback during long operations
- All events persisted to `.organism/audit-log.jsonl` by agents
- Structured JSON output via `--json` flag on all commands

**Validation:**
- OrganismConfig validated via `packages/livingcode-core/src/schema/validator.ts`
- Work item shape enforced by TypeScript types
- WorkItem.status validated against allowed state transitions
- File path boundaries validated in boundary-check

**Authentication:**
- GitHub: GITHUB_TOKEN or GH_TOKEN env var (required for Managed Agents)
- DashClaw: DASHCLAW_API_KEY env var (optional, for governance)
- OpenClaw: OPENCLAW_API_KEY env var (optional, for tracing)
- Anthropic: ANTHROPIC_API_KEY env var (required for Claude Managed Agents)

**Telemetry & Observability:**
- Opt-in anonymous telemetry: `src/telemetry/` (command usage, error patterns, feature flags)
- Stored in `~/.giti/telemetry-events.jsonl`
- SHA-256 hashing for anonymization
- OpenClaw tracing for API calls (if OPENCLAW_API_KEY set)
- DashClaw integration for governance decisions
- Observatory real-time visualization of organism state

---

*Architecture analysis: 2026-04-11*
