# giti — Git Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool that transforms raw git repository data into actionable intelligence — and a living codebase that maintains and evolves itself through AI agents.

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

#### `giti build [item-id]`

Run the Motor Cortex — implements a work item by calling Claude to generate code changes, applies them on a branch, and verifies with tests.

```bash
giti build abc-123    # Build a specific work item
giti build --all      # Build all planned items
```

Requires `ANTHROPIC_API_KEY` environment variable. Includes self-correction: if the first attempt fails compilation or tests, it retries once with error context.

#### `giti cycle`

Run a complete lifecycle cycle: sense → plan → build → review → commit → reflect.

```bash
giti cycle                # Autonomous cycle
giti cycle --supervised   # Pause for human approval before merging
```

Requires `ANTHROPIC_API_KEY`. In supervised mode, approved branches are left for human merge.

#### `giti organism <subcommand>`

Manage the organism's lifecycle.

```bash
giti organism start                # Start recurring cycles (default: every 24h)
giti organism start --interval=12h # Custom interval
giti organism stop                 # Activate kill switch
giti organism status               # View organism state
```

### Global Options

All commands support:
- `--json` — Output raw JSON instead of formatted terminal output
- `--path <dir>` — Analyze a repository at a different path (default: current directory)

## Environment Variables

```bash
# Required for giti build / giti cycle / giti organism start
ANTHROPIC_API_KEY=sk-...

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
- **Immune System** — every change must pass 6 independent quality checks before merging
- **Supervised mode** — optional human approval gate before any merge

## Architecture

```
src/
├── commands/           # Sprint 0: pulse, hotspots, ghosts command handlers
├── analyzers/          # Sprint 0: commit, branch, file, code analysis
├── formatters/         # Sprint 0: chalk terminal output formatting
├── utils/              # Shared: git wrapper, time formatting
├── types/              # Shared: TypeScript interfaces
├── cli/                # CLI entrypoints for all commands
├── agents/
│   ├── sensory-cortex/ # Sprint 1: state observation and trend detection
│   ├── immune-system/  # Sprint 1: adversarial review with 6 quality checks
│   ├── memory/         # Sprint 1: persistent knowledge base and curator
│   ├── prefrontal-cortex/ # Sprint 2: strategic planning and prioritization
│   ├── motor-cortex/   # Sprint 2: Claude API code generation with self-correction
│   └── orchestrator/   # Sprint 2: lifecycle cycle, safety, scheduling
└── integrations/
    └── openclaw/       # Sprint 2: optional observability instrumentation
```

## The Living Codebase

This project is a software organism. It starts as a CLI tool, but unlike any other project, it maintains, improves, and grows itself autonomously through a coordinated team of AI agents:

- **Sensory Cortex** observes the organism's health
- **Prefrontal Cortex** decides what to work on
- **Motor Cortex** writes the code (using Claude)
- **Immune System** reviews every change adversarially
- **Memory** learns from every decision and outcome

The human creates the seed. From that point forward, the codebase is alive. Read the full vision in [living-codebase-architecture.md](./living-codebase-architecture.md).

## Development

```bash
npm install          # Install dependencies
npm run build        # Build with tsup
npm test             # Run tests
npm run test:coverage # Run with coverage (80% threshold)
npm run lint         # Type-check with tsc
npm run dev          # Watch mode build
```

## Contributing

This project is maintained by AI agents as part of The Living Codebase experiment. Human contributions are welcome — open an issue or PR on [GitHub](https://github.com/ucsandman/git-intelligence).

## License

MIT
