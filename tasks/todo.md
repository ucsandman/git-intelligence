# Project Progress

## Sprint 0 — Build the Seed (COMPLETE)
- [x] Initialize TypeScript project with tsup + vitest
- [x] Implement `giti pulse` command
- [x] Implement `giti hotspots` command
- [x] Implement `giti ghosts` command
- [x] Write test suite (126 tests, 97%+ coverage)
- [x] Create organism.json manifest
- [x] Publish to GitHub

See `docs/superpowers/plans/2026-04-04-sprint0-giti-seed.md` for full plan.

## Sprint 1 — Build the Safety Layer (COMPLETE)
- [x] Shared agent types and filesystem utilities
- [x] Sensory Cortex: 5 collectors + trend detector + orchestrator
- [x] Immune System: 6 checks + verdict logic + baselines + orchestrator
- [x] Memory Agent: store + curator + query engine + orchestrator
- [x] CLI entrypoints: `giti sense`, `giti review`, `giti remember`
- [x] Integration testing (275 tests)

See `docs/superpowers/plans/2026-04-04-sprint1-safety-layer.md` for full plan.

## Sprint 2 — Activate the Organism (COMPLETE)
- [x] Prefrontal Cortex: tiered prioritizer + backlog management
- [x] Motor Cortex: Claude API integration + branch manager + self-correction
- [x] Lifecycle Orchestrator: full cycle logic + safety systems
- [x] Safety: kill switch, cooldown, lock, failure counter, API budget
- [x] OpenClaw instrumentation (env-gated)
- [x] CLI entrypoints: `giti plan`, `giti build`, `giti cycle`, `giti organism`
- [x] Integration testing (376 tests, 10 CLI commands)

See `docs/superpowers/plans/2026-04-04-sprint2-activate-organism.md` for full plan.

## Sprint 3 — Enable Growth (COMPLETE)
- [x] Telemetry types and store (JSON-lines, user config)
- [x] Telemetry anonymizer (SHA-256 hashing, path/hostname stripping)
- [x] Telemetry collector and reporter (command instrumentation, aggregation)
- [x] Usage simulator (6 repo types, scenario-based synthetic data)
- [x] Growth Hormone signal analyzer (6 signal types from telemetry)
- [x] Growth Hormone proposal generator (Claude API structured prompts)
- [x] Growth Hormone orchestrator and formatter (pipeline, CLI output)
- [x] Prefrontal Cortex Tier 5 integration (approved proposals become work items)
- [x] Lifecycle GROW phase (runs after standard cycle)
- [x] CLI entrypoints: `giti telemetry`, `giti simulate`, `giti grow`
- [x] TELEMETRY.md privacy documentation
- [x] Integration testing (569 tests, 13 CLI commands, 90%+ coverage)

See `docs/superpowers/plans/2026-04-04-sprint3-enable-growth.md` for full plan.

## Sprint 4 — Release the Organism (FUTURE)
- [ ] Remove human oversight requirement
- [ ] Build DashClaw decision log
- [ ] Open source the organism framework
