# Decision log


---

# Recovered decisions (claude-mem archive)

13 decisions recovered 2026-08-11 from the claude-mem store before it was pruned. Source window 2026-04-06 to 2026-06-11. Full archive with observations and session summaries: `C:\Projectsrchives\claude-mem-2026-08-11\`.

## 2026-04-07 — Git-Intelligence strategic direction with DashClaw and Practical Systems integration

Defined git-intelligence as sensing layer for DashClaw governance with multiple commercial service models for Practical Systems

- Git-intelligence positioned as repo intelligence tool providing drift, risk, hotspots, ownership, and change analysis from Git history
- Strategic approach is "lead with immediate developer value, hide the weird genius until it earns trust" - sell sharp Git insights first
- Three-layer architecture defined: Git-Intelligence as sensing layer, DashClaw as decision/memory/routing layer, Practical Systems as service/commercialization layer
- DashClaw can use git-intelligence signals for decision-to-code traceability, tracking which decisions improved or destabilized systems
- Agent quality scoring proposed using git-intelligence metrics: revert rate, churn after change, bug-adjacent patterns, follow-up work created
- Three product concepts identified: DashClaw for Engineering Reality (most ambitious), Practical Systems Drift Audit (fastest-to-money), Agent Change Reliability Engine (niche but strong)
- Practical Systems can offer Git Health Audits with before/after proof using quantified metrics like churn reduction in risky files

## 2026-04-07 — Comprehensive architecture exploration completed for livingcode module integration into pipeline-tracker monorepo

Analysis reveals well-structured agent-centric Python backend with gaps in quality tooling, providing natural integration points for livingcode observability.

- Pipeline-tracker monorepo contains 11 autonomous agents (prospector, hygiene, researcher, outreach, orchestrator, architect, qualifier, intent_tracker, meeting_intel, content, win_loss) inheriting from DashClaw-integrated BaseAgent abstract class
- No formal Python quality tooling configured despite 70+ SQLAlchemy models and 10,296-line WebSocket server (no pylintrc, flake8, mypy.ini, ruff.toml, or pyproject.toml)
- Testing infrastructure uses pytest with in-memory SQLite fixtures but lacks CI/CD automation (no GitHub Actions workflows)
- Minimal organism supervision exists with only cycle-counter.json and kill-switch files in .organism directory at repository root
- Production deployment uses Render with Neon Postgres for mission_control and demo_sandbox databases with role-based routing between admin and demo users
- Agent fleet coordinated by orchestrator meta-agent using HealthMonitor, HandoffManager, ConflictResolver, and Reporter components without modifying prospect/deal data directly
- Real-time observability powered by FastAPI WebSocket server broadcasting agent events to Mission Control Next.js dashboard with heartbeat caching (5s TTL) and error count caching (60s TTL)
- LLM provider abstraction via litellm supports anthropic, ollama, vllm, litellm_proxy, and lmstudio profiles with task-specific model routing (email_generation, linkedin_message, icp_scoring, constraint_detection, meeting_extraction)

## 2026-04-07 — DashClaw Living Organism Framework Design

Designed Python-based self-monitoring framework porting git-intelligence organism concept to DashClaw with supervised lifecycle and zero dependencies.

- livingcode/ module will be a zero-dependency Python framework using only stdlib (subprocess, json, dataclasses, pathlib, datetime)
- Five collectors planned: git_stats, test_health, code_quality, dependency_health, ci_health measuring 30+ metrics
- Immune system performs six checks (ci_gates, openapi_contract, file_length, test_regression, dependency_safety, sdk_parity) with hard-block vs soft-warning verdicts
- Lifecycle cycle runs SENSE → PLAN → REVIEW → REFLECT without BUILD phase (no autonomous code changes)
- organism.json defines DashClaw identity with quality standards (300-line max, 80% test coverage floor, 11 CI gates, performance budgets)
- Heartbeat modes: quick (post-commit, git_stats + code_quality only, &lt;5s), full (daily cron, complete cycle, 1-3min)
- Safety systems include kill switch, cycle lock, consecutive failure limit (3 failures → auto-pause), supervised mode default
- Planner produces 5-tier prioritized work items (Critical/Regression/Maintenance/Improvement/Growth) written to .organism/backlog/
- State stored in .organism/ directory with baselines.json, cycle-counter.json, state-reports/, heartbeats/, cycle-history/
- CLI entry points: sense, review, plan, cycle, heartbeat, status

Files: `C:\Projects\DashClaw\docs\superpowers\specs\2026-04-07-livingcode-organism-design.md`

## 2026-04-07 — Livingcode Framework Gitignore Policy Refined

Defined three-tier gitignore policy for .organism/ directory separating ephemeral state, persistent identity, and human-managed backlog items.

- Gitignored ephemeral files: state-reports/, heartbeats/, cycle-history/, active-cycle.json, kill-switch, paused
- Committed persistent identity files: baselines.json, cycle-counter.json
- Backlog items with status "accepted" are committed, "proposed" items are gitignored for human-managed curation

Files: `C:\Projects\DashClaw\docs\superpowers\specs\2026-04-07-livingcode-organism-design.md`

## 2026-04-07 — DashClaw Living Organism Framework Design Approved

Python-based self-monitoring framework ported from git-intelligence with zero dependencies and supervised-only operation

- livingcode/ Python module added to DashClaw for codebase health sensing (zero external dependencies, stdlib only)
- Five collectors implemented: git_stats, test_health, code_quality, dependency_health, ci_health
- Immune system runs six checks (ci_gates, openapi_contract, file_length, test_regression, dependency_safety, sdk_parity) and produces merge/fix/discuss verdicts
- Planner prioritizes work items across five tiers (Critical, Regression, Maintenance, Improvement, Growth)
- Lifecycle orchestrator runs SENSE → PLAN → REVIEW → REFLECT cycle with no BUILD phase (no autonomous code changes)
- Safety systems include kill switch, cycle lock, consecutive failure limit (3), and supervised mode default
- Heartbeat modes: quick (post-commit, git_stats + code_quality only), full (cron/CI, complete cycle)
- organism.json defines DashClaw's self-identity with quality standards (80% test coverage, 300-line max, 11 CI gates)
- .organism/ directory stores state reports, baselines, backlog, cycle history, with gitignore policy for ephemeral vs persistent data

## 2026-04-07 — Livingcode organism development plan established

Ten-task roadmap created for autonomous code health monitoring system with collectors, immune system, and orchestrator.

- Task 1 creates foundation with types.py, state.py, schema validator, and organism.json at repo root
- Tasks 2-6 implement five specialized collectors: git stats, test health, code quality, dependency health, and CI health
- Task 7 creates sensing orchestrator to run all collectors with error isolation and unified StateReport output
- Task 8 implements immune system with six checks and verdict logic for merge/fix_required/needs_discussion decisions
- Task 9 creates planner with five-tier work item prioritizer and backlog management in .organism/backlog/
- Task 10 implements orchestrator with safety controls (kill switch, lock, failure tracking) and SENSE→PLAN→REVIEW→REFLECT lifecycle
- All work targets new livingcode package structure within DashClaw repository

## 2026-04-11 — Mood naming and Anthropic API selection

Revised mood naming scheme and chose Anthropic API over narrative text implementation

- Mood names "alert" and "alarmed" identified as too similar and require differentiation
- Anthropic API selected as implementation approach instead of narrative text generation

## 2026-04-11 — Field Observer Design Specification

Comprehensive design for teaching giti to observe external repositories and publish field reports.

- Design spec created at docs/superpowers/specs/2026-04-11-field-observer-design.md for Field Observer feature
- Spec addresses three core problems: giti only observes itself, no public transparency, and broken planner cycle
- New field-observer subsystem at packages/giti/src/agents/field-observer/ runs existing analyzers against external repos read-only
- Observatory redesigned from terrarium creature to "observer at window" scene with four mood states: curious, attentive, alarmed, dozing
- Narrator module uses Claude Haiku with cached system prompts to generate markdown field reports (~300 tokens)
- New OBSERVE_EXTERNAL phase added as first cycle phase before SENSE, PLAN, BUILD, REVIEW, COMMIT, REFLECT, GROW
- Target repository is Practical Systems at C:\Projects\Practical Systems with field reports written to .organism/field-reports/practical-systems/
- Backlog seeder creates synthetic observe-field-targets work item to guarantee planner has something to select
- Success criteria include 80%+ test coverage, end-to-end cycle completion, and atomic md+json report writes
- Three alternatives considered: multi-repo refactor (too slow), dispatch-as-product (too shallow), chosen field observer (reuses analyzers, forces cycle fix)

Files: `docs/superpowers/specs/2026-04-11-field-observer-design.md`

## 2026-04-11 — Field-observer implementation plan defined with 7-task breakdown

Architecture decided: extend OrganismConfig, atomic report writes, analyzer composition, Claude Haiku narrator with fallback.

- Implementation broken into 7 tasks starting with investigation/decision gate
- OrganismConfig extended with field_targets and narrator configuration fields
- Core types defined: FieldTarget, ObserverMood, FieldObservation
- Reporter uses atomic writes with .md + .json + latest.json pointer pattern
- Runner composes existing commit/file/branch/code analyzers with per-analyzer timeouts
- Narrator implemented with Claude Haiku API, prompt caching, SDK mocking for tests, deterministic fallback

## 2026-04-11 — Field-observer cycle integration strategy finalized

New OBSERVE_EXTERNAL phase before SENSE, non-fatal errors, per-target isolation, E2E verification against Practical Systems.

- New cycle phase OBSERVE_EXTERNAL inserted before existing SENSE phase
- OBSERVE_EXTERNAL phase designed as non-fatal - errors logged but don't crash cycle
- Public API exposed through observe() function in field-observer/index.ts
- Per-target error isolation ensures one target failure doesn't affect other targets
- E2E verification includes real cycle run against Practical Systems repository
- Implementation concludes with holistic code review before branch completion

## 2026-04-11 — Task 1 investigation complete: planner validated, Plan A approved to proceed

Comprehensive investigation confirms prioritizer NOT broken; empty selection is correct for clean codebases.

- Investigation notes document created at docs/superpowers/plans/notes/2026-04-11-field-observer-investigation.md
- Decision: PROCEED with Plan A as written - prioritizer is structurally sound
- Key finding: planner's empty selection is correct behavior for clean codebases, not a bug
- Validation methodology: cycle probe (blocked by API key), plan probe (successful dry-run)
- Code analysis confirms generateWorkItems returns [] legitimately when no conditions trigger
- prioritizeItems never fails, returns empty only when input items array is empty
- Backlog fallback at cycle.ts:59-74 is manual-seed escape hatch, not primary mechanism
- Two non-blocking observations: CLI path typo in plan (dist/cli/giti.js vs dist/index.js), test_pass_rate quirk in worktree

Files: `docs/superpowers/plans/notes/2026-04-11-field-observer-investigation.md`

## 2026-04-11 — Task 2 spec compliance review passed: implementation verified correct and complete

Independent review confirms verbatim spec match, 803 tests passing, zero issues found.

- Spec compliance review completed in 73,031ms using 52,952 tokens across 10 tool invocations
- Verdict: ✅ Spec compliant with zero issues, no missing pieces, no gold-plating
- FieldTarget and NarratorConfig interfaces match specification exactly
- OrganismConfig optional fields added correctly without altering existing fields
- organism.json contains exact field_targets and narrator configuration per specification
- Test file matches required code verbatim with no extra tests added
- Independent verification: 803 tests pass (801 baseline + 2 new), TypeScript clean
- Duplicate organism.json concern resolved as non-issue - file doesn't exist in worktree

## 2026-04-11 — Task 2 code quality review complete: approved with minor suggestions for future tasks

Comprehensive review in 249s using 74,549 tokens finds zero critical/important issues, ships as-is.

- Code quality review completed in 248,983ms using 74,549 tokens across 30 tool invocations
- Verdict: Ship it as-is - textbook type-system extension with zero critical or important issues
- Strengths identified: minimal additive changes, consistent naming, logical placement, real behavior testing, no regressions
- Five minor suggestions for future tasks: __dirname ESM pattern, test coupling, Windows path portability, dual OrganismConfig reconciliation, JSDoc addition
- Zero existing callers impacted - all 13 loadOrganismConfig() call sites validated
- Cross-package validation: livingcode-core tests pass (15/15), no validator conflicts
- Test quality confirmed: exercises real disk I/O through loadOrganismConfig→readJsonFile→JSON.parse, no mocks

