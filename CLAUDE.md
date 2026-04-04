# giti — Git Intelligence CLI

## What This Is
A CLI tool that transforms raw git repository data into actionable intelligence, and a living codebase that maintains and evolves itself through AI agents. Built across 3 sprints: analysis CLI, safety layer, autonomous lifecycle.

## Tech Stack
- TypeScript (strict mode, ESM), Node.js >= 18
- tsup (build), vitest (test), commander (CLI), simple-git (git ops)
- chalk (colors), ora (spinners), @anthropic-ai/sdk (Motor Cortex code generation)

## Dev Commands
- `npm run build` — build with tsup
- `npm test` — run tests with vitest
- `npm run test:coverage` — run with coverage (80% threshold)
- `npm run lint` — type-check with tsc --noEmit
- `npm run dev` — watch mode build

## CLI Commands (13 total)
- `giti pulse` — repo health snapshot
- `giti hotspots` — volatile file detection with coupling
- `giti ghosts` — abandoned work detection
- `giti sense` — sensory cortex state scan
- `giti review <branch>` — immune system branch review
- `giti remember <sub>` — memory (record, query, summary)
- `giti plan` — prefrontal cortex cycle planning
- `giti build [id]` — motor cortex code implementation (requires ANTHROPIC_API_KEY)
- `giti cycle` — full lifecycle cycle (requires ANTHROPIC_API_KEY)
- `giti organism <sub>` — organism management (start, stop, status)
- `giti telemetry <sub>` — telemetry management (on, off, status, show, clear)
- `giti simulate` — generate synthetic telemetry from diverse repo types
- `giti grow` — Growth Hormone agent (analyze telemetry, propose features)

## Architecture

### Sprint 0: Analysis CLI
- `src/commands/` — thin CLI handlers for pulse, hotspots, ghosts
- `src/analyzers/` — pure analysis functions (commit, branch, file, code)
- `src/formatters/` — chalk-based terminal output
- `src/utils/` — git wrapper (`simple-git`), time formatting
- `src/types/` — shared TypeScript interfaces

### Sprint 1: Safety Layer (agents)
- `src/agents/sensory-cortex/` — state observation: 5 collectors (git-stats, test-health, code-quality, dependency-health, performance) + trend detector
- `src/agents/immune-system/` — adversarial review: 6 checks (test, quality, performance, boundary, regression, dependency) + verdict logic + baselines
- `src/agents/memory/` — persistent knowledge: store, curator (lesson extraction, pattern detection), keyword query

### Sprint 2: Autonomous Lifecycle
- `src/agents/prefrontal-cortex/` — strategic planner: tiered prioritization (5 tiers), backlog management, cooldown awareness
- `src/agents/motor-cortex/` — builder: Claude API integration, structured prompt→response, self-correction loop (max 2 attempts), branch management
- `src/agents/orchestrator/` — lifecycle: full cycle (sense→plan→build→review→commit→reflect), safety systems (kill switch, cooldown, lock, failures, API budget), scheduler

### Sprint 3: Enable Growth
- `src/telemetry/` — opt-in anonymous usage data: types, store (JSON-lines), anonymizer (SHA-256 hashing, path stripping), collector (command instrumentation), reporter (aggregation)
- `src/simulator/` — synthetic telemetry: repo-generator (6 repo types: fresh, small, medium, large, monorepo, ancient), scenarios, simulation runner
- `src/agents/growth-hormone/` — feature proposal agent: signal-analyzer (6 signal types: usage-concentration, usage-sequence, error-pattern, flag-pattern, missing-capability, ecosystem-signal), proposal-generator (Claude API), orchestrator, formatter
- Lifecycle GROW phase added to `src/agents/orchestrator/cycle.ts` — runs Growth Hormone after the standard sense→plan→build→review cycle
- Prefrontal Cortex Tier 5 integration — approved growth proposals become work items in `src/agents/prefrontal-cortex/prioritizer.ts`

### Shared Infrastructure
- `src/agents/types.ts` — AgentRole, OrganismEvent, EventType, OrganismConfig
- `src/agents/utils.ts` — filesystem ops (readJsonFile, writeJsonFile, ensureOrganismDir), runCommand (execFileSync)
- `src/cli/` — CLI entrypoints for all 13 commands
- `src/integrations/openclaw/` — optional tracing (env-gated via OPENCLAW_API_KEY)

## Data Flow
```
.organism/
├── state-reports/        # Sensory cortex outputs (JSON, timestamped)
├── reviews/              # Immune system verdicts (JSON, per-branch)
├── backlog/              # Work items and cycle plans (JSON)
├── growth-proposals/     # Growth Hormone proposals (JSON, per-proposal)
├── knowledge-base.json   # Memory agent curated knowledge
├── baselines.json        # Quality/performance baselines
├── cycle-counter.json    # Monotonic cycle number
├── api-usage.json        # Token budget tracking
├── cooldown-until.json   # Post-regression cooldown expiry
├── active-cycle.json     # Concurrent execution lock
├── kill-switch           # Organism halt signal (presence = stopped)
├── scheduler.json        # Running scheduler config
├── cycle-history/        # Completed cycle results
└── traces/               # OpenClaw trace files (local fallback)

~/.giti/
├── telemetry-config.json # User opt-in preference
└── telemetry-events.jsonl # Anonymized usage events (JSON-lines)
```

## Quality Standards (from organism.json)
- 80%+ test coverage
- Max 15 cyclomatic complexity per function
- Max 300 lines per file
- Zero `any` types without justification
- All commands support `--json` and `--path` flags
- Performance budgets: pulse <2s, hotspots <5s, ghosts <10s

## Safety Rails
- Motor Cortex cannot modify `organism.json` or `.organism/`
- Motor Cortex cannot delete test files
- Max 2 Claude API calls per work item
- 48h cooldown after any regression
- 3 consecutive failures → organism pauses
- Kill switch halts all activity immediately
- API budget ceiling (configurable via GITI_API_BUDGET)

## Environment Variables
- `ANTHROPIC_API_KEY` — required for build/cycle/organism commands
- `OPENCLAW_API_KEY` — optional observability
- `GITI_API_BUDGET` — monthly token limit (default: 100000)
- `GITI_SUPERVISED` — require human approval for merges
