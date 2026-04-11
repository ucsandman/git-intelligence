# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
git-intelligence/
├── packages/
│   ├── giti/                           # Main CLI organism (125 .ts files, ~2,700 lines)
│   │   ├── src/
│   │   │   ├── agents/                 # 6 cortex subsystems + orchestrator
│   │   │   ├── cli/                    # CLI command handlers (12 subcommands)
│   │   │   ├── commands/               # Analysis commands (pulse, hotspots, ghosts)
│   │   │   ├── analyzers/              # Pure analysis functions
│   │   │   ├── formatters/             # Terminal output formatting
│   │   │   ├── integrations/           # GitHub, DashClaw, audit, OpenClaw
│   │   │   ├── telemetry/              # Anonymous usage tracking
│   │   │   ├── simulator/              # Synthetic test data generation
│   │   │   ├── content/                # Content pipeline & narratives
│   │   │   ├── utils/                  # Git wrapper, filesystem helpers
│   │   │   ├── types/                  # Shared TypeScript interfaces
│   │   │   └── index.ts                # CLI entry point (commander setup)
│   │   ├── tests/                      # 747+ tests (mirrors src/ structure)
│   │   ├── package.json                # Dependencies, scripts, bin
│   │   └── tsup.config.ts              # Build config
│   │
│   ├── giti-observatory/               # Next.js 15 visualization app
│   │   ├── src/
│   │   │   ├── app/                    # Next.js app directory (page routes)
│   │   │   │   ├── api/                # REST endpoints (snapshot, events stream)
│   │   │   │   ├── page.tsx            # Main terrarium page
│   │   │   │   ├── history/            # Cycle history view
│   │   │   │   └── moment/[id]/        # Single moment permalink
│   │   │   ├── components/
│   │   │   │   ├── vitals/             # VitalsStrip (top info bar)
│   │   │   │   ├── journal/            # GrowthJournal (cycle events sidebar)
│   │   │   │   ├── terrarium/          # R3F 3D scene (creature, flora, weather)
│   │   │   │   │   ├── creature/       # Bioluminescent organism
│   │   │   │   │   ├── environment/    # Flora, particles, lighting
│   │   │   │   │   ├── interaction/    # Cursor tracking, mood states
│   │   │   │   │   └── lighting/       # Day/night cycles, bloom
│   │   │   │   └── IntroOverlay.tsx    # First-time guide
│   │   │   ├── data/                   # Snapshot builders, data providers
│   │   │   ├── lib/                    # Utilities (scene mapping, formatting)
│   │   │   └── types/                  # TypeScript types (ObservatorySnapshot, etc)
│   │   ├── package.json                # Next.js dependencies
│   │   └── next.config.js              # Next.js configuration
│   │
│   └── livingcode-core/                # Extracted reusable framework
│       ├── src/
│       │   ├── schema/                 # OrganismConfig validator
│       │   ├── index.ts                # Framework entry point (LivingCodebase class)
│       │   └── types.ts                # Framework types
│       ├── tests/                      # Framework tests
│       ├── package.json                # Package metadata & exports
│       └── tsup.config.ts              # Build config
│
├── .organism/                          # Persistent organism state (git-ignored)
│   ├── state-reports/                  # Sensory cortex outputs (timestamped JSON)
│   ├── reviews/                        # Immune system verdicts (per-branch JSON)
│   ├── backlog/                        # Work items (JSON)
│   ├── growth-proposals/               # Growth Hormone proposals (JSON)
│   ├── cycle-history/                  # Completed cycle results (JSON)
│   ├── content/                        # Dispatch narratives (JSON)
│   ├── knowledge-base.json             # Memory agent curated knowledge
│   ├── baselines.json                  # Quality/performance baselines
│   ├── cycle-counter.json              # Monotonic cycle number
│   ├── api-usage.json                  # Token budget tracking
│   ├── cooldown-until.json             # Regression cooldown expiry
│   ├── consecutive-failures.json       # Failure counter
│   ├── active-cycle.json               # Execution lock
│   ├── kill-switch                     # Halt signal (file presence)
│   ├── scheduler.json                  # Running scheduler config
│   ├── audit-log.jsonl                 # Append-only event log
│   └── traces/                         # OpenClaw fallback traces
│
├── .planning/                          # GSD planning outputs
│   └── codebase/                       # Architecture & structure documents
│
├── .claude/                            # Agent context & memory
│
├── docs/                               # Documentation
│   ├── superpowers/
│   │   ├── specs/                      # Feature specifications
│   │   └── plans/                      # Implementation phase plans
│   └── ...
│
├── tasks/                              # Session tracking
│   ├── todo.md                         # Work items & progress
│   └── lessons.md                      # Lessons learned
│
├── sprints/                            # Historical sprint documentation
│
├── CLAUDE.md                           # Project instructions (checked in)
├── README.md                           # User guide & CLI docs
├── organism.json                       # Organism manifest & config
├── package.json                        # Root workspace config
└── .env.example                        # Environment variable template
```

## Directory Purposes

**packages/giti/src/agents/:**
- Purpose: Six specialized agent subsystems + orchestrator
- Subdirectories:
  - `sensory-cortex/` — 5 collectors (git-stats, test-health, code-quality, dependency-health, performance) + trend detector
  - `immune-system/` — 7 checks (test, quality, performance, boundary, regression, dependency, secret) + verdict logic
  - `memory/` — Knowledge store, curator (lesson extraction), FTS query, hierarchical indexing
  - `prefrontal-cortex/` — Strategic planner (5-tier prioritization), backlog manager
  - `motor-cortex/` — Code implementer (cloud sandbox + local patch apply), branch manager
  - `orchestrator/` — Lifecycle coordinator (cycle.ts), safety (kill switch, cooldown, lock), scheduler, heartbeat
  - `actions/` — Action planning engine (schema, predicates, runner for declarative workflows)
  - `growth-hormone/` — Signal analyzer (6 types), proposal generator
  - `types.ts` — AgentRole, OrganismEvent, EventType
  - `utils.ts` — Filesystem helpers, runCommand

**packages/giti/src/cli/:**
- Purpose: CLI command entry points
- Files:
  - `sense.ts`, `review.ts`, `remember.ts`, `plan.ts` — Agent invocation handlers
  - `build.ts`, `cycle.ts` — Build and lifecycle cycle runners
  - `organism.ts` — Organism management (start, stop, status)
  - `telemetry-cmd.ts` — Telemetry settings
  - `simulate.ts` — Synthetic data generation
  - `grow.ts` — Growth Hormone runner
  - `dispatch.ts` — Content pipeline viewer
  - `observatory.ts` — Observatory visualization server

**packages/giti/src/commands/:**
- Purpose: Synchronous analysis operations
- Files: `pulse.ts`, `hotspots.ts`, `ghosts.ts`
- Pattern: Pure functions (no state modification), use analyzers

**packages/giti/src/analyzers/:**
- Purpose: Git and code analysis primitives
- Files: `commit-analyzer.ts`, `branch-analyzer.ts`, `file-analyzer.ts`, `code-analyzer.ts`
- Pattern: Pure functions using simple-git wrapper

**packages/giti/src/integrations/:**
- Purpose: External service clients
- Subdirectories:
  - `github/` — @octokit/rest wrapper, PR formatter, issue triage
  - `dashclaw/` — DashClaw governance client, fitness score calculator
  - `audit/` — Append-only agent action logger
  - `openclaw/` — Optional API tracing via OpenClaw

**packages/giti/src/telemetry/:**
- Purpose: Anonymous usage data collection
- Files:
  - `types.ts` — TelemetryEvent, signal types
  - `store.ts` — JSON-lines persistence to `~/.giti/`
  - `anonymizer.ts` — SHA-256 hashing, path stripping
  - `collector.ts` — Command instrumentation
  - `reporter.ts` — Aggregation and reporting

**packages/giti/src/simulator/:**
- Purpose: Synthetic test data generation
- Files:
  - `types.ts` — Scenario definitions
  - `repo-generator.ts` — 6 repo types (fresh, small, medium, large, monorepo, ancient)
  - `scenarios.ts` — Event patterns
  - `index.ts` — Simulation runner

**packages/giti/src/content/:**
- Purpose: Content pipeline for organism evolution narratives
- Files:
  - `dispatch-generator.ts` — Create narrative dispatches
  - `narrative.ts` — Story engine
  - `milestone.ts` — Milestone detection
  - `platform-formatter.ts` — Format for Twitter, LinkedIn, HN, blog
  - `types.ts` — Dispatch, narrative types

**packages/giti/tests/:**
- Purpose: Test suite (747+ tests)
- Structure: Mirrors `src/` layout (e.g., `tests/agents/sensory-cortex/` for `src/agents/sensory-cortex/`)
- Pattern: `.test.ts` or `.spec.ts` files co-located with source

**packages/giti-observatory/src/components/terrarium/:**
- Purpose: React Three Fiber 3D scene
- Subdirectories:
  - `creature/` — Bioluminescent organism with visible organs, mood states
  - `environment/` — Flora (instanced), particles, weather effects
  - `interaction/` — Cursor tracking, gesture detection
  - `lighting/` — Day/night cycle, bloom post-processing

**packages/livingcode-core/src/schema/:**
- Purpose: OrganismConfig validation and schema
- Files: `validator.ts` — JSON schema validation for organism.json

## Key File Locations

**Entry Points:**
- `packages/giti/src/index.ts` — CLI program definition, commander setup, all 15 commands registered
- `packages/giti-observatory/src/app/page.tsx` — Main terrarium visualization
- `packages/livingcode-core/src/index.ts` — Framework export (LivingCodebase class)

**Configuration:**
- `organism.json` — Organism manifest, quality standards, lifecycle config
- `packages/giti/package.json` — CLI dependencies (commander, chalk, ora, simple-git, @anthropic-ai/sdk)
- `packages/giti-observatory/next.config.js` — Next.js config, custom environment
- `packages/livingcode-core/src/schema/validator.ts` — Config validation rules

**Core Logic:**
- `packages/giti/src/agents/sensory-cortex/index.ts` — Observation pipeline (collectGitStats, trend detection)
- `packages/giti/src/agents/prefrontal-cortex/prioritizer.ts` — Work item generation + 5-tier prioritization
- `packages/giti/src/agents/immune-system/index.ts` — 7-check review engine
- `packages/giti/src/agents/motor-cortex/index.ts` — Build orchestrator (agent invocation, patch apply)
- `packages/giti/src/agents/orchestrator/cycle.ts` — Full lifecycle runner (sense→plan→build→defend→commit)
- `packages/giti/src/agents/actions/planner.ts` — Action planning (predicate evaluation, step sequencing)

**Testing:**
- `packages/giti/tests/agents/sensory-cortex/` — Sensory cortex tests
- `packages/giti/tests/agents/prefrontal-cortex/` — Planner tests
- `packages/giti/tests/agents/motor-cortex/` — Build tests
- `packages/giti/tests/fixtures/` — Test data (mock git repos, fixture snapshots)

## Naming Conventions

**Files:**
- kebab-case: `sensory-cortex.ts`, `git-stats.ts`, `branch-manager.ts`
- Suffixes: `.test.ts`, `.spec.ts` for tests
- Config files: `tsup.config.ts`, `next.config.js`, `vitest.config.ts`

**Directories:**
- kebab-case: `sensory-cortex/`, `immune-system/`, `prefrontal-cortex/`, `growth-hormone/`, `motor-cortex/`
- Plural for collections: `agents/`, `collectors/`, `checks/`, `analyzers/`, `commands/`, `integrations/`
- Singular for modules: `memory/`, `content/`, `telemetry/`, `simulator/`

**Types & Interfaces:**
- PascalCase: `AgentRole`, `StateReport`, `WorkItem`, `ReviewVerdict`, `ImplementationResult`
- Suffixes: `Type`, `Config`, `Result`, `Options`, `Props`
- Examples: `CycleOptions`, `ImplementationContext`, `ReviewRisk`, `TrendAnalysis`

**Functions:**
- camelCase: `runSensoryCortex()`, `generateWorkItems()`, `recordMemoryEvent()`
- Action prefixes: `run*`, `get*`, `create*`, `record*`, `format*`, `load*`, `apply*`
- Async functions return `Promise<T>`: `async function runMotorCortex(): Promise<ImplementationResult>`

**Constants:**
- UPPER_SNAKE_CASE: `EXCLUDED_DIRS`, `PERF_FIELD_TO_BUDGET`, `REPORTS_SUBDIR`

**Exported Symbols:**
- Prefer named exports: `export function runMotorCortex()`, `export interface WorkItem`
- Re-export from index files: `src/agents/sensory-cortex/index.ts` exports public API

## Where to Add New Code

**New Feature (e.g., third analysis command like "pulse"):**
- Implementation: `packages/giti/src/commands/new-command.ts`
- Tests: `packages/giti/tests/commands/new-command.test.ts`
- CLI handler: `packages/giti/src/cli/new-command.ts` (if requires options)
- Register in: `packages/giti/src/index.ts` (program.command())

**New Component/Module:**
- Implementation: `packages/giti/src/[layer]/[name]/index.ts` (e.g., `src/agents/new-cortex/index.ts`)
- Types: `packages/giti/src/[layer]/[name]/types.ts`
- Tests: `packages/giti/tests/[layer]/[name]/` (mirror structure)
- Export public API from: `index.ts` in module directory

**New Check (for Immune System):**
- Implementation: `packages/giti/src/agents/immune-system/checks/[check-name]-check.ts`
- Type: `CheckResult` interface in `src/agents/immune-system/types.ts`
- Register in: `src/agents/immune-system/index.ts` (add to Promise.all() array)
- Tests: `packages/giti/tests/agents/immune-system/checks/[check-name]-check.test.ts`

**New Collector (for Sensory Cortex):**
- Implementation: `packages/giti/src/agents/sensory-cortex/collectors/[collector-name].ts`
- Returns: Partial StateReport data (typed section)
- Register in: `src/agents/sensory-cortex/index.ts` (add to collectors array)
- Tests: `packages/giti/tests/agents/sensory-cortex/[collector-name].test.ts`

**New Integration (e.g., Slack, Linear, Jira):**
- Client: `packages/giti/src/integrations/[service]/client.ts` or `index.ts`
- Types: `packages/giti/src/integrations/[service]/types.ts`
- Usage: Import in orchestrator (`src/agents/orchestrator/cycle.ts`) or relevant agent
- Tests: `packages/giti/tests/integrations/[service]/`

**Utilities & Helpers:**
- Shared helpers: `packages/giti/src/utils/[category].ts` (e.g., `git.ts`, `time.ts`)
- Agent-specific: `packages/giti/src/agents/utils.ts`
- Framework-level: `packages/livingcode-core/src/schema/[validator].ts`

**Observatory Component:**
- Component: `packages/giti-observatory/src/components/[category]/[ComponentName].tsx`
- API endpoint: `packages/giti-observatory/src/app/api/[route]/route.ts`
- Data provider: `packages/giti-observatory/src/data/[provider-name].ts`

## Special Directories

**`.organism/`:**
- Purpose: Persistent organism state and artifacts
- Generated: Yes (created on first run)
- Committed: No (listed in `.gitignore`)
- Permissions: Read/write by giti process
- Cleanup: Manual deletion resets organism state; run `giti cycle` to reinitialize

**`.claude/`:**
- Purpose: Agent context, memory, and planning artifacts
- Generated: Yes (by agents during planning phases)
- Committed: No (listed in `.gitignore`)
- Contains: Subagent context, memory snapshots, planning docs

**`~/.giti/` (in user home):**
- Purpose: Global telemetry configuration and events
- Generated: Yes (on first telemetry command)
- Contains: `telemetry-config.json` (opt-in/opt-out), `telemetry-events.jsonl` (usage log)
- User-controlled: Via `giti telemetry on/off`

**`packages/giti/dist/`:**
- Purpose: Built CLI output (from tsup)
- Generated: Yes (via `npm run build`)
- Committed: No (listed in `.gitignore`)
- Entry point: `dist/index.js` (defined as `bin.giti` in package.json)

**`packages/giti/coverage/`:**
- Purpose: Test coverage reports
- Generated: Yes (via `npm run test:coverage`)
- Committed: No

**`packages/giti-observatory/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (via `npm run build` or dev server)
- Committed: No

**`node_modules/`:**
- Purpose: Installed dependencies (npm workspaces)
- Generated: Yes (via `npm install`)
- Committed: No
- Note: Root `package.json` uses `"workspaces": ["packages/*"]` for monorepo

---

*Structure analysis: 2026-04-11*
