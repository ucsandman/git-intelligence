# giti — Git Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool that transforms raw git repository data into actionable intelligence — and a living codebase that maintains and evolves itself through AI agents.

This is a **monorepo** with three packages:

| Package | Description |
|---------|-------------|
| [`packages/giti/`](./packages/giti/) | The CLI organism — analysis, lifecycle orchestration, and 800+ tests |
| [`packages/giti-observatory/`](./packages/giti-observatory/) | Living terrarium visualization — watch the organism evolve in real-time |
| [`packages/livingcode-core/`](./packages/livingcode-core/) | The Living Codebase framework — organism schema, validator, types |

## What Changed

### Field Observer — `giti` watches the repos it cares about

The organism now has a **Field Observer** subsystem that watches one or more *external* repositories read-only and publishes a field report every cycle. It's what the organism does for someone other than itself — a small, running demonstration of a one-person automation loop pointed outward.

- Configure targets in `organism.json` under `field_targets` (slug + absolute path + enabled flag)
- Every cycle runs a new `OBSERVE_EXTERNAL` phase *before* `SENSE` that calls the existing analyzers (pulse, hotspots, ghosts) against each target
- A Claude Haiku call composes a short field-note narrative with prompt caching (deterministic template fallback on any failure)
- Observations land in `.organism/field-reports/<slug>/` as an atomic markdown + JSON pair plus a `latest.json` pointer
- Four-state mood — `curious`, `attentive`, `alarmed`, `dozing` — derived from the diff vs. the previous observation

Run it directly with `giti observe` (see commands below) — no full cycle required.

### Declarative Action Engine

The organism also includes a declarative action engine. During planning, `giti` can produce ranked action recommendations, and during `giti cycle` it can execute one guarded low-risk action before the normal build phase.

The first built-in action drafts a regression stabilization artifact, records the action instance under `.organism/actions/`, and writes a lesson back into organism memory. Read the public feature doc in [docs/declarative-action-engine.md](./docs/declarative-action-engine.md).

## Installation

```bash
npm i -g giti
```

## Quick Start

```bash
# Health snapshot of any repo
giti pulse

# Find volatile files
giti hotspots --since 30d

# Detect abandoned work
giti ghosts
```

## Commands

### Analysis Commands

#### `giti pulse`

Quick health snapshot of the repository.

```bash
giti pulse
```

```
📊 Repository Pulse: my-project
─────────────────────────────────
Last commit:        2h ago (fix: resolve auth mismatch)
Commits (7d):       23 commits by 3 authors
Active branches:    7 (2 stale > 30d)
Hottest file:       src/lib/auth.ts (modified 8 times this week)
Test ratio:         12/18 files (67%)
Avg commit size:    42 lines changed
Bus factor:         2 (73% of commits from top 2 authors)
```

#### `giti hotspots`

Identify the most volatile parts of the codebase with coupling detection.

```bash
giti hotspots --since 30d --top 5
```

```
🔥 Codebase Hotspots (last 30d)
────────────────────────────────────
 1. src/lib/auth.ts           — 23 changes, 5 authors, 4 bug fixes
 2. src/api/routes/agents.ts  — 18 changes, 3 authors, 2 bug fixes
 3. src/db/queries.ts         — 15 changes, 2 authors, 1 bug fixes

⚠ Coupling detected:
  src/lib/auth.ts ↔ src/api/routes/agents.ts — change together 78% of the time (14 co-occurrences)
```

**Options:** `--since <period>` (default: 30d), `--top <n>` (default: 10)

#### `giti ghosts`

Find abandoned and forgotten work.

```bash
giti ghosts
```

```
👻 Abandoned Work
─────────────────
Stale branches (no commits > 30d):
  feature/new-dashboard    — last touched 47d ago by @wes (12 lines ahead of main)
  fix/memory-leak          — last touched 63d ago by @contributor (2 lines ahead of main)

Dead code signals:
  src/utils/legacy.ts      — last modified 6 months ago, imported by 0 files

Summary: 2 stale branches, 1 potential dead files
```

**Options:** `--stale-days <n>` (default: 30), `--dead-months <n>` (default: 6)

### Organism Commands

These commands power the living codebase — the AI agent system that observes, plans, builds, reviews, and learns.

#### `giti sense`

Run the Sensory Cortex — a comprehensive scan of the organism's state including git stats, test health, code quality, dependency security, and performance benchmarks.

```bash
giti sense
```

```
🧠 Sensory Scan Complete
────────────────────────
Quality:      ✅ 85% coverage | 0 lint errors | 0 files over limit
Performance:  ✅ pulse: 340ms | hotspots: 1.2s | ghosts: 890ms
Dependencies: ⚠️  2 outdated (minor) | 0 vulnerabilities
Anomalies:    none
Growth:       none detected
```

State reports accumulate in `.organism/state-reports/` for trend analysis.

#### `giti review <branch>`

Run the Immune System — an adversarial review of a branch against main. Checks tests, quality, performance, boundaries, regressions, and dependencies.

```bash
giti review organism/motor/fix-hotspots-perf
```

Produces a verdict: **APPROVED**, **REJECTED**, or **CHANGES REQUESTED**.

#### `giti remember <subcommand>`

Interact with the organism's Memory — persistent knowledge about past decisions, regressions, and learned patterns.

```bash
giti remember summary              # View accumulated knowledge
giti remember query "auth module"  # Search memory
giti remember record --type=regression-detected --data='{"file":"src/auth.ts"}'
```

#### `giti plan`

Run the Prefrontal Cortex — analyzes the current state and produces a prioritized plan of up to 3 work items for the next lifecycle cycle.

```bash
giti plan
giti plan --dry-run   # Preview without saving
```

Work items are prioritized in tiers:
1. **Critical fixes** — security vulnerabilities, lint errors, test failures
2. **Regression repair** — performance degradation, coverage drops
3. **Quality improvement** — outdated deps, complexity reduction
4. **Feature enhancement** — growth signals, error handling
5. **New growth** — new capabilities

Planning now also attaches additive `action_recommendations` for declarative workflows that are eligible in the current organism state. These recommendations do not replace normal work-item planning.

#### `giti build [item-id]`

Run the Motor Cortex — implements a work item by calling Claude to generate code changes, applies them on a branch, and verifies with tests.

```bash
giti build abc-123    # Build a specific work item
giti build --all      # Build all planned items
```

Requires `ANTHROPIC_API_KEY` environment variable. Includes self-correction: if the first attempt fails compilation or tests, it retries once with error context.

#### `giti observe`

Run the Field Observer — analyze every configured external target and publish a field report without running the full cycle. This is the easiest way to see the new subsystem in action.

```bash
giti observe                     # Observe every enabled target in organism.json
giti observe --json              # Raw JSON output for scripting
```

```
◉ practical-systems  C:\Projects\Practical Systems
  Mood: curious  Cycle: 42  Observed: 2026-04-11T13:57:00.000Z

  Two new hotspots surfaced in pipeline-tracker this morning. Both touch
  the dashclaw install path. Still no tests on the new requirements.
  Quiet otherwise.

  Pulse: 5 commits this week · 3 active branches · 42% test ratio
  Hotspots: 2 · Ghosts: 1 stale branches, 0 dead-code signals
  Report: .organism/field-reports/practical-systems/
```

Requires `ANTHROPIC_API_KEY` for the narrative. Without it, the observer still produces reports, just with a deterministic template narrative instead of the Claude-generated one.

Configure targets in `organism.json`:

```json
{
  "field_targets": [
    { "slug": "practical-systems", "path": "C:\\Projects\\Practical Systems", "enabled": true }
  ],
  "narrator": {
    "enabled": true,
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 600,
    "cache_system_prompt": true
  }
}
```

Reports are written atomically to `.organism/field-reports/<slug>/`:
- `<timestamp>.md` — human-readable field note with narrative and raw signals
- `<timestamp>.json` — machine-readable observation
- `latest.json` — pointer to the most recent observation (used by the mood-diff on the next run)

**Never writes to the target repo.** The observer calls analyzer functions directly — no state reports, no git operations, no writes of any kind against the target.

#### `giti cycle`

Run a complete lifecycle cycle: observe external targets → sense → plan → guarded action → build → review → commit → reflect.

```bash
giti cycle                # Autonomous cycle
giti cycle --supervised   # Pause for human approval before merging
```

Requires `ANTHROPIC_API_KEY`. In supervised mode, approved branches are left for human merge.

If the plan includes an eligible low-risk declarative action, the orchestrator executes it before the normal build phase. In the current release this is limited to built-in, schema-validated actions with approved step types and `.organism/`-scoped writes.

#### `giti organism <subcommand>`

Manage the organism's lifecycle.

```bash
giti organism start                # Start recurring cycles (default: every 24h)
giti organism start --interval=12h # Custom interval
giti organism stop                 # Activate kill switch
giti organism status               # View organism state
```

### Growth & Telemetry Commands

#### `giti telemetry <subcommand>`

Manage anonymous, opt-in usage telemetry. All data is anonymized before storage — no paths, hostnames, or identifying information is retained.

```bash
giti telemetry status   # Check if telemetry is enabled and event count
giti telemetry on       # Opt in to telemetry collection
giti telemetry off      # Opt out and stop collecting
giti telemetry show     # Display aggregated telemetry report
giti telemetry clear    # Delete all collected telemetry data
```

See [TELEMETRY.md](./TELEMETRY.md) for full details on what is collected and how data is anonymized.

#### `giti simulate`

Generate synthetic telemetry data from diverse simulated repositories. Useful for testing the Growth Hormone agent without real usage data.

```bash
giti simulate                     # Run simulation with all repo types
giti simulate --scenario small    # Simulate a small project
giti simulate --runs 50           # Generate 50 simulated command runs
```

Scenarios: `small`, `medium`, `large`, `monorepo`, `ancient`, `fresh`

#### `giti dispatch`

View evolution dispatches from the content pipeline — narratives about what the organism has built, learned, and proposed.

```bash
giti dispatch                      # Show latest dispatch
giti dispatch --list               # List all dispatches
giti dispatch --cycle 5            # Show dispatch for cycle 5
giti dispatch --platform twitter   # Format for Twitter
```

Platforms: `twitter`, `linkedin`, `hn`, `blog`

#### `giti grow`

Run the Growth Hormone agent — analyzes telemetry data to detect usage patterns and proposes new features or improvements.

```bash
giti grow                # Analyze telemetry and propose features
giti grow --dry-run      # Preview signals without generating proposals
```

```
🌱 Growth Hormone Analysis
───────────────────────────
Telemetry signals detected: 2

  1. [85%] pulse dominates usage
     Evidence: 60% of all command runs

  2. [72%] JSON output rarely used
     Evidence: Only 3% of runs use --json

New proposals generated: 1

  1. Add timeline command
     Complexity: medium
     Command: giti timeline

Next: Proposals will be reviewed by Immune System, then scheduled by Prefrontal Cortex
```

Proposals require `ANTHROPIC_API_KEY` for generation. Without it, the command still detects signals but skips proposal generation.

### Observatory

#### `giti observatory`

Start the living terrarium visualization — a 3D interactive scene where you can watch the organism evolve in real-time.

```bash
cd packages/giti-observatory && npm run dev   # Start on localhost:3333
giti observatory push                         # Push snapshot for public deploy
giti observatory status                       # Show observatory config
```

The terrarium features:
- **A living creature** — translucent bioluminescent organism with visible internal organs (one per agent), cursor tracking, mood states driven by real data
- **An ecosystem** — flora grows from merged changes, spores drift for growth proposals, weather reflects trajectory, energy pool shows token budget
- **A growth journal** — expandable cycle cards showing agent activity (what each agent did and why), filter by outcome type
- **Real-time updates** — SSE connection to `.organism/` watches for live cycle activity

### Global Options

All commands support:
- `--json` — Output raw JSON instead of formatted terminal output
- `--path <dir>` — Analyze a repository at a different path (default: current directory)

## Environment Variables

```bash
# Required for giti build / giti cycle / giti organism start
ANTHROPIC_API_KEY=sk-...

# Required for Managed Agents (motor cortex cloud execution)
GITHUB_TOKEN=github_pat_...    # Fine-grained PAT with Contents: Read+Write on the repo

# Optional: model selection
GITI_MODEL=claude-sonnet-4-6   # Default model for motor cortex (claude-sonnet-4-6, claude-opus-4-6, etc.)

# Optional: OpenClaw observability
OPENCLAW_API_KEY=...
OPENCLAW_ENDPOINT=...

# Optional: safety controls
GITI_API_BUDGET=100000         # Max API tokens per month
GITI_CYCLE_INTERVAL=86400000   # Default cycle interval (ms)
GITI_SUPERVISED=true           # Require human approval for merges
```

## Safety Systems

The organism has multiple safety mechanisms:

- **Kill switch** — `giti organism stop` immediately halts all activity
- **Cooldown** — 48-hour pause after any regression is detected
- **Concurrent lock** — prevents multiple cycles from running simultaneously
- **Failure limit** — pauses after 3 consecutive cycles with zero successful merges
- **API budget** — configurable monthly token ceiling
- **Immune System** — every change must pass 7 independent quality checks before merging (including secret scanning)
- **Supervised mode** — optional human approval gate before any merge
- **Action policy review** — declarative actions are schema-validated, reviewed by the immune system, and blocked from writing outside `.organism/`

## Project Structure

```
git-intelligence/                   # Monorepo root (npm workspaces)
├── packages/
│   ├── giti/                       # CLI organism package
│   │   └── src/
│   │       ├── commands/           # Sprint 0: pulse, hotspots, ghosts handlers
│   │       ├── analyzers/          # Sprint 0: commit, branch, file, code analysis
│   │       ├── formatters/         # Sprint 0: chalk terminal output formatting
│   │       ├── utils/              # Shared: git wrapper, time formatting
│   │       ├── types/              # Shared: TypeScript interfaces
│   │       ├── cli/                # CLI entrypoints for all 16 commands
│   │       ├── agents/
│   │       │   ├── sensory-cortex/ # Sprint 1: state observation and trend detection
│   │       │   ├── immune-system/  # Sprint 1: adversarial review with 7 quality checks (incl. secret scanning)
│   │       │   ├── memory/         # Sprint 1: persistent knowledge base, FTS search, hierarchical indexing
│   │       │   ├── prefrontal-cortex/ # Sprint 2: strategic planning and prioritization
│   │       │   ├── actions/        # Declarative action engine: templates, predicates, runner, history
│   │       │   ├── motor-cortex/   # Sprint 2: Claude API code generation with self-correction
│   │       │   ├── orchestrator/   # Sprint 2: lifecycle cycle, safety, scheduling, heartbeat monitor
│   │       │   ├── field-observer/ # Field Observer: read-only watching of external repos (runner, narrator, reporter)
│   │       │   └── growth-hormone/ # Sprint 3: telemetry signal analysis and feature proposals
│   │       ├── telemetry/          # Sprint 3: opt-in anonymous usage data collection
│   │       ├── simulator/          # Sprint 3: synthetic repo generation for testing
│   │       ├── content/            # Sprint 4: dispatch generation, narratives, milestones
│   │       └── integrations/
│   │           ├── openclaw/       # Sprint 2: optional observability instrumentation
│   │           ├── audit/          # Agent action audit trail (JSON-lines)
│   │           ├── dashclaw/       # Sprint 4: DashClaw dashboard (fitness score, reporting)
│   │           └── github/         # Sprint 4: GitHub integration (PRs, issues, releases)
│   └── livingcode-core/            # Sprint 4: extracted framework package
│       └── src/
│           ├── types.ts            # Framework types (OrganismConfig, OrganismManifest)
│           └── schema/             # organism.json schema and validator
├── organism.json                   # Organism manifest
├── .organism/                      # Runtime state (reports, backlog, knowledge, traces)
└── tasks/                          # Session tracking (todo.md, lessons.md)
```

## The Living Codebase

This project is a software organism. It starts as a CLI tool, but unlike any other project, it maintains, improves, and grows itself autonomously through a coordinated team of AI agents:

- **Sensory Cortex** observes the organism's health
- **Field Observer** watches external repos read-only and publishes field reports (new)
- **Prefrontal Cortex** decides what to work on
- **Declarative Actions** execute reusable guarded workflows between planning and building
- **Motor Cortex** writes the code (using Claude)
- **Immune System** reviews every change adversarially
- **Memory** learns from every decision and outcome
- **Growth Hormone** detects usage patterns and proposes new features

The human creates the seed. From that point forward, the codebase is alive. Read the full vision in [living-codebase-architecture.md](./living-codebase-architecture.md).

## Development

This project uses npm workspaces. All commands run from the repo root:

```bash
npm install          # Install dependencies for all packages
npm run build        # Build all packages with tsup
npm test             # Run all tests across the monorepo
npm run lint         # Type-check all packages with tsc
```

For individual packages:

```bash
cd packages/giti && npm test              # Run giti tests only
cd packages/livingcode-core && npm test   # Run framework tests only
```

## Contributing

This project is maintained by AI agents as part of The Living Codebase experiment. Human contributions are welcome — open an issue or PR on [GitHub](https://github.com/ucsandman/git-intelligence).

## License

MIT
