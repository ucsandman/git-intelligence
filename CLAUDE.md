# giti — Git Intelligence CLI

## What This Is
A CLI tool that transforms raw git repository data into actionable intelligence. Part of The Living Codebase project — a codebase that maintains and evolves itself through AI agents.

## Tech Stack
- TypeScript (strict mode, ESM)
- Node.js >= 18
- tsup (build), vitest (test), commander (CLI), simple-git (git ops), chalk (colors), ora (spinners)

## Commands
- `npm run build` — build with tsup
- `npm test` — run tests with vitest
- `npm run test:coverage` — run tests with coverage (80% threshold)
- `npm run lint` — type-check with tsc --noEmit
- `npm run dev` — watch mode build

## Architecture
- `src/commands/` — thin CLI command handlers
- `src/analyzers/` — pure analysis functions (testable, no side effects)
- `src/formatters/` — terminal output formatting
- `src/utils/` — git wrapper, time formatting
- `src/types/` — shared TypeScript interfaces

## Quality Standards
- 80%+ test coverage
- Max 15 cyclomatic complexity per function
- Max 300 lines per file
- Zero `any` types without justification
- All commands must support `--json` and `--path` flags
