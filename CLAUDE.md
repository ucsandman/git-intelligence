# giti — Git Intelligence CLI

## What This Is
A CLI tool that transforms raw git repository data into actionable intelligence, and a living codebase that maintains and evolves itself through AI agents. Built across 5 sprints: analysis CLI, safety layer, autonomous lifecycle, release infrastructure, and observatory visualization. This is an npm workspaces monorepo with three packages: `packages/giti/` (the CLI organism), `packages/livingcode-core/` (the extracted framework), and `packages/giti-observatory/` (the living terrarium visualization).

## Tech Stack
- TypeScript (strict mode, ESM), Node.js >= 18
- tsup (build), vitest (test), commander (CLI), simple-git (git ops)
- chalk (colors), ora (spinners), @anthropic-ai/sdk (Claude Managed Agents for Motor Cortex)
- npm workspaces (monorepo), @octokit/rest (GitHub integration)
- Next.js 15, react-three-fiber, Tailwind CSS 4 (Observatory visualization)
- @react-three/drei, @react-three/postprocessing, @react-spring/three, Framer Motion

## Dev Commands
All commands run from the repo root via npm workspaces:
- `npm run build` — build all packages with tsup
- `npm test` — run all tests (836+ giti + 18 observatory + 15 framework)
- `npm run lint` — type-check all packages with tsc --noEmit
- `cd packages/giti-observatory && npm run dev` — start observatory on port 3333

## CLI Commands (16 total)
- `giti pulse` — repo health snapshot
- `giti hotspots` — volatile file detection with coupling
- `giti ghosts` — abandoned work detection
- `giti sense` — sensory cortex state scan
- `giti review <branch>` — immune system branch review
- `giti remember <sub>` — memory (record, query, summary)
- `giti plan` — prefrontal cortex cycle planning
- `giti build [id]` — motor cortex code implementation (requires ANTHROPIC_API_KEY)
- `giti cycle` — full lifecycle cycle (requires ANTHROPIC_API_KEY)
- `giti observe` — Field Observer: run a read-only observation pass against configured external targets (optional ANTHROPIC_API_KEY for narrative)
- `giti organism <sub>` — organism management (start, stop, status)
- `giti telemetry <sub>` — telemetry management (on, off, status, show, clear)
- `giti simulate` — generate synthetic telemetry from diverse repo types
- `giti grow` — Growth Hormone agent (analyze telemetry, propose features)
- `giti dispatch` — view evolution dispatches (content pipeline narratives)
- `giti observatory` — start living terrarium visualization (serve, push, status)

## Architecture

### Sprint 0: Analysis CLI
- `src/commands/` — thin CLI handlers for pulse, hotspots, ghosts
- `src/analyzers/` — pure analysis functions (commit, branch, file, code)
- `src/formatters/` — chalk-based terminal output
- `src/utils/` — git wrapper (`simple-git`), time formatting
- `src/types/` — shared TypeScript interfaces

### Sprint 1: Safety Layer (agents)
- `src/agents/sensory-cortex/` — state observation: 5 collectors (git-stats, test-health, code-quality, dependency-health, performance) + trend detector
- `src/agents/immune-system/` — adversarial review: 7 checks (test, quality, performance, boundary, regression, dependency, secrets) + verdict logic + baselines
- `src/agents/memory/` — persistent knowledge: store, curator (lesson extraction, pattern detection), FTS query (Porter stemmer, TF-IDF scoring), hierarchical indexing

### Sprint 2: Autonomous Lifecycle
- `src/agents/prefrontal-cortex/` — strategic planner: tiered prioritization (5 tiers), backlog management, cooldown awareness
- `src/agents/motor-cortex/` — builder: Claude Managed Agents (cloud-hosted sandboxed execution), patch capture and local apply, configurable model via GITI_MODEL env var
- `src/agents/orchestrator/` — lifecycle: full cycle (sense→plan→build→review→commit→reflect), safety systems (kill switch, cooldown, lock, failures, API budget), scheduler, heartbeat monitor (inter-cycle health checks)

### Sprint 3: Enable Growth
- `src/telemetry/` — opt-in anonymous usage data: types, store (JSON-lines), anonymizer (SHA-256 hashing, path stripping), collector (command instrumentation), reporter (aggregation)
- `src/simulator/` — synthetic telemetry: repo-generator (6 repo types: fresh, small, medium, large, monorepo, ancient), scenarios, simulation runner
- `src/agents/growth-hormone/` — feature proposal agent: signal-analyzer (6 signal types: usage-concentration, usage-sequence, error-pattern, flag-pattern, missing-capability, ecosystem-signal), proposal-generator (Claude API), orchestrator, formatter
- Lifecycle GROW phase added to `src/agents/orchestrator/cycle.ts` — runs Growth Hormone after the standard sense→plan→build→review cycle
- Prefrontal Cortex Tier 5 integration — approved growth proposals become work items in `src/agents/prefrontal-cortex/prioritizer.ts`

### Sprint 4: Release the Organism
- `src/integrations/dashclaw/` — DashClaw decision dashboard: fitness score calculator, cycle reporter, push config
- `src/integrations/github/` — GitHub integration: @octokit/rest client, PR formatter, issue triage, release notes generator
- `src/content/` — Content pipeline: dispatch generator, narrative engine, milestone detection, platform formatter (twitter/linkedin/hn/blog)
- `packages/livingcode-core/` — Extracted framework: organism.json schema, validator, and shared types (OrganismConfig, OrganismManifest)
- Monorepo migration: npm workspaces with `packages/giti/` and `packages/livingcode-core/`

### Field Observer — Watching External Repos Read-Only
- `src/agents/field-observer/` — new subsystem that observes external repositories (not giti itself). Pipeline: `target-config` → `runner` → `narrator` → `reporter`
- `target-config.ts` — loads `field_targets` from organism.json, filters to enabled entries whose path exists and contains `.git` (file or directory — worktree-safe). Logs a breadcrumb on malformed config via `fs.access` + local re-parse
- `runner.ts` — composes a raw observation by calling `src/analyzers/*` functions directly (NOT `runSensoryCortex`, which would write into the target's `.organism/`). Each analyzer wrapped in `withTimeout` (default 30s); failures collected into `errors[]` and `partial: true` instead of aborting
- `narrator.ts` — Claude Haiku call with prompt-cached system block (`cache_control: { type: 'ephemeral' }`), delimited `<previous_entry>` tags for injection hardening, deterministic template fallback on any failure or when disabled. `deriveMood()` priority order: `alarmed > curious > dozing > attentive`, first-run default `curious`
- `reporter.ts` — atomic stage-all-then-rename-all of `<timestamp>.md`, `<timestamp>.json`, and `latest.json` (pointer) under `.organism/field-reports/<slug>/`. Partial-failure window shrunk to three sequential renames
- `index.ts` — public `observe(gitiPath, cycle)` wires the pipeline, per-target try/catch, narrator-fallback error logging to stderr
- Cycle integration: new Phase 0 `OBSERVE_EXTERNAL` in `orchestrator/cycle.ts` runs before `SENSE`, wrapped in its own try/catch (non-fatal), with kill-switch re-check at the top
- Config: `organism.json` has `field_targets: FieldTarget[]` (slug/path/enabled) and `narrator: NarratorConfig` (enabled/model/max_tokens/cache_system_prompt), both optional on `OrganismConfig`
- Plan and design docs: `docs/superpowers/plans/2026-04-11-field-observer-backend.md`, `docs/superpowers/specs/2026-04-11-field-observer-design.md`, investigation notes at `docs/superpowers/plans/notes/2026-04-11-field-observer-investigation.md`

### Sprint 5: Observatory — Living Terrarium Visualization
- `packages/giti-observatory/` — Next.js 15 app with react-three-fiber 3D terrarium
- `src/types/` — ObservatorySnapshot, SceneState, CycleDigest types
- `src/data/` — snapshot builder (reads .organism/ → ObservatorySnapshot), local/remote data providers, React context
- `src/components/vitals/` — VitalsStrip with state indicator, spark charts, phase indicator
- `src/components/journal/` — GrowthJournal with expandable CycleCards showing agent activity events, LiveCycleCard, milestone badges, filter chips
- `src/components/terrarium/` — R3F 3D scene: translucent bioluminescent creature with visible organs, cursor tracking, mood states (content/alert/excited/recoiling/resting/dormant), instanced flora, particle spores, weather effects, energy pool, fossil milestones, day/night lighting cycle, bloom post-processing, stars
- `src/app/api/` — REST snapshot endpoint + SSE event stream for live updates
- `src/app/` — Main page (3 layers: vitals + terrarium + journal), history page, moment permalink page, intro overlay
- `src/lib/` — scene mapper (snapshot → SceneState), human-friendly label formatting

### Shared Infrastructure
- `src/agents/types.ts` — AgentRole, OrganismEvent, EventType, OrganismConfig
- `src/agents/utils.ts` — filesystem ops (readJsonFile, writeJsonFile, ensureOrganismDir), runCommand (execFileSync)
- `src/cli/` — CLI entrypoints for all 16 commands
- `src/integrations/openclaw/` — optional tracing (env-gated via OPENCLAW_API_KEY)
- `src/integrations/audit/` — append-only agent action audit logger (JSON-lines)

## Data Flow
```
.organism/
├── state-reports/        # Sensory cortex outputs (JSON, timestamped)
├── field-reports/        # Field Observer outputs per target: <slug>/<timestamp>.{md,json} + latest.json
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
├── traces/               # OpenClaw trace files (local fallback)
└── audit-log.jsonl       # Agent action audit trail (JSON-lines, append-only)

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
- Motor Cortex runs in cloud sandbox (Claude Managed Agents) — cannot affect local filesystem directly
- Motor Cortex can ONLY modify files under `packages/giti/src/` and `packages/giti/tests/`
- Motor Cortex cannot modify organism.json, .organism/, .claude/, docs/, package.json, package-lock.json
- Motor Cortex cannot delete test files
- Changes captured as git patches and applied locally — organism controls its own git workflow
- Max $0.50 budget per work item, max 15 agent turns
- 48h cooldown after any regression
- 3 consecutive failures → organism pauses
- Kill switch halts all activity immediately
- API budget ceiling (configurable via GITI_API_BUDGET)

## Environment Variables
- `ANTHROPIC_API_KEY` — required for build/cycle/organism commands
- `GITHUB_TOKEN` or `GH_TOKEN` — required for Managed Agents (fine-grained PAT with Contents: Read+Write on the repo)
- `GITI_MODEL` — model for motor cortex (default: claude-sonnet-4-6)
- `DASHCLAW_URL` — DashClaw instance URL for governance (guard/approval/audit)
- `DASHCLAW_API_KEY` — DashClaw API key for governance integration
- `OPENCLAW_API_KEY` — optional observability
- `GITI_API_BUDGET` — monthly token limit (default: 100000)
- `GITI_SUPERVISED` — require human approval for merges
