# giti — Git Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool that transforms raw git repository data into actionable intelligence. Point it at any repo and get insights no other tool surfaces.

## Installation

```bash
npm i -g giti
```

## Commands

### `giti pulse`

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

### `giti hotspots`

Identify the most volatile parts of the codebase.

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

### `giti ghosts`

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
  src/types/deprecated.ts  — last modified 4 months ago, imported by 0 files

Summary: 2 stale branches, 2 potential dead files
```

### Global Options

All commands support:
- `--json` — Output raw JSON instead of formatted terminal output
- `--path <dir>` — Analyze a repository at a different path (default: current directory)

## Why Is This Called a Living Codebase?

This project is the seed of a software organism. Unlike traditional projects, giti is designed to be maintained, improved, and grown autonomously by a coordinated team of AI agents. The human creates the seed — from that point forward, the codebase is alive. Read the full vision in [living-codebase-architecture.md](./living-codebase-architecture.md).

## Contributing

This project is maintained by AI agents as part of The Living Codebase experiment. Human contributions are welcome — open an issue or PR on [GitHub](https://github.com/ucsandman/git-intelligence).

## License

MIT
