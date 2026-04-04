# The Living Codebase: Architecture Document

## Project Vision

The Living Codebase is a software organism. It starts as a small Git Intelligence CLI tool, but unlike any other project, it maintains, improves, and grows itself autonomously through a coordinated team of AI agents. The human creates the seed. From that point forward, the codebase is alive.

This is not "agents that write code." This is a codebase with agency over its own evolution.

---

## The Seed: `giti` (Git Intelligence)

### What It Is

A CLI tool that transforms raw git repository data into actionable intelligence. Users point it at any repo and get insights no other tool surfaces.

### Name

`giti` (pronounced "git-eye") — short, memorable, available on npm.

### Tech Stack

- **Language:** TypeScript (Node.js)
- **Package Manager:** npm
- **Distribution:** npm global install (`npm i -g giti`)
- **Dependencies (seed):** `simple-git`, `chalk`, `commander`, `ora`
- **Test Framework:** Vitest
- **Build:** tsup

### Seed Commands (v0.1.0 — The Minimum Viable Organism)

The seed ships with exactly three commands. Small enough to build in a day. Rich enough to give the organism clear growth signals.

```bash
# 1. Pulse — quick health snapshot of the repo
giti pulse

# Output:
# 📊 Repository Pulse: dashclaw
# ─────────────────────────────
# Last commit:        2h ago (fix: resolve auth mismatch)
# Commits (7d):       23 commits by 3 authors
# Active branches:    7 (2 stale > 30d)
# Hottest file:       src/lib/auth.ts (modified 8 times this week)
# Test coverage:      ~73% (estimated from test file ratio)
# Avg commit size:    42 lines changed
# Bus factor:         2 (73% of commits from top 2 authors)
```

```bash
# 2. Hotspots — identify the most volatile parts of the codebase
giti hotspots [--since=30d] [--top=10]

# Output:
# 🔥 Codebase Hotspots (last 30 days)
# ────────────────────────────────────
# 1. src/lib/auth.ts           — 23 changes, 5 authors, 4 bug fixes
# 2. src/api/routes/agents.ts  — 18 changes, 3 authors, 2 reverts
# 3. src/db/queries.ts         — 15 changes, 2 authors, high churn
# ...
# ⚠ Coupling detected: auth.ts and routes/agents.ts change together 78% of the time
```

```bash
# 3. Ghosts — find abandoned and forgotten work
giti ghosts

# Output:
# 👻 Abandoned Work
# ─────────────────
# Stale branches (no commits > 30d):
#   feature/new-dashboard    — last touched 47d ago by @wes (312 lines ahead of main)
#   fix/memory-leak          — last touched 63d ago by @contributor (2 commits)
#
# Dead code signals:
#   src/utils/legacy.ts      — last modified 6 months ago, imported by 0 files
#   src/types/deprecated.ts  — last modified 4 months ago, imported by 1 file
#
# Zombie PRs (open > 30d):
#   #142 "Add webhook support" — opened 51d ago, 23 comments, conflicts with main
```

### Why These Three Commands

Each command gives the organism a different growth vector:

- **Pulse** grows toward: performance benchmarking, trend analysis over time, repo comparison, CI/CD integration, health scoring algorithms
- **Hotspots** grows toward: coupling detection, refactoring recommendations, risk prediction ("this file is likely to break next"), architectural boundary analysis
- **Ghosts** grows toward: dependency auditing, tech debt quantification, contributor analytics, project archaeology

The organism doesn't know these growth paths yet. It will discover them.

---

## The DNA Manifest: `organism.json`

This file lives in the repo root and defines what the organism is, what it's allowed to become, and what it must never do.

```json
{
  "identity": {
    "name": "giti",
    "purpose": "Transform raw git repository data into actionable intelligence for developers",
    "philosophy": "Surface insights humans miss. Never require configuration. Work on any repo."
  },

  "boundaries": {
    "growth_zone": [
      "git data analysis and visualization",
      "repository health assessment",
      "developer workflow intelligence",
      "codebase archaeology and forensics",
      "commit pattern recognition",
      "team dynamics and contributor analytics"
    ],
    "forbidden_zone": [
      "modifying the target repository in any way",
      "accessing external APIs or services without explicit user consent",
      "collecting or transmitting user data",
      "replacing existing git commands",
      "requiring authentication or accounts",
      "adding GUI or web interface (stay CLI-native)"
    ]
  },

  "quality_standards": {
    "test_coverage_floor": 80,
    "max_complexity_per_function": 15,
    "max_file_length": 300,
    "zero_tolerance": ["any:errors", "security:vulnerabilities"],
    "performance_budget": {
      "pulse_command": "< 2 seconds on repos up to 10k commits",
      "hotspots_command": "< 5 seconds on repos up to 10k commits",
      "any_new_command": "< 10 seconds on repos up to 10k commits"
    }
  },

  "evolutionary_principles": [
    "Every new feature must be discoverable without documentation",
    "Never break existing commands or change output formats without a migration path",
    "Prefer depth over breadth — master one analysis before adding another",
    "Performance matters more than features — a fast tool gets used, a slow tool gets uninstalled",
    "If a feature requires configuration, the organism hasn't understood the problem well enough"
  ],

  "telemetry": {
    "what_to_track": [
      "which commands are invoked and how often",
      "which flags and options are used",
      "repo sizes and characteristics encountered",
      "errors and failure modes",
      "execution time per command"
    ],
    "privacy": "opt-in only, anonymized, local-first with optional remote aggregation",
    "purpose": "feed the Sensory Cortex so the organism knows how it's being used"
  },

  "lifecycle": {
    "cycle_frequency": "daily",
    "max_changes_per_cycle": 3,
    "mandatory_cooldown_after_regression": "48 hours",
    "branch_naming": "organism/{cortex}/{description}",
    "requires_immune_approval": true
  }
}
```

---

## The Nervous System: Agent Architecture

### Agent Topology (orchestrated via OpenClaw)

```
                    ┌─────────────────┐
                    │  SENSORY CORTEX │
                    │  (Observer)     │
                    └────────┬────────┘
                             │ state report
                             ▼
                    ┌─────────────────┐
                    │ PREFRONTAL      │
                    │ CORTEX          │
                    │ (Strategic      │
                    │  Planner)       │
                    └────────┬────────┘
                             │ prioritized work items
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
          ┌──────────────┐  ┌──────────────────┐
          │ MOTOR CORTEX │  │ GROWTH HORMONE   │
          │ (Builder)    │  │ (Feature          │
          │              │  │  Discoverer)      │
          └──────┬───────┘  └────────┬──────────┘
                 │                   │
                 │ proposed changes  │ proposed features
                 ▼                   ▼
          ┌────────────────────────────┐
          │       IMMUNE SYSTEM       │
          │   (Adversarial Reviewer)  │
          └────────────┬──────────────┘
                       │ approve / reject
                       ▼
          ┌────────────────────────────┐
          │          MEMORY           │
          │  (Institutional Knowledge) │
          └────────────────────────────┘
```

### Agent Specifications

#### 1. Sensory Cortex

**Role:** Continuous observation and state reporting.

**Inputs:**
- Runtime telemetry (if opt-in telemetry is enabled)
- Error logs from CI/CD
- npm download stats and trends
- GitHub issues and discussions
- Test results and coverage reports
- Dependency vulnerability feeds (npm audit)
- Performance benchmarks (execution time across sample repos)
- Code complexity metrics (cyclomatic complexity, cognitive complexity)

**Outputs:**
- `state-report.json` — comprehensive snapshot of the organism's current health
- `anomaly-alerts.json` — anything unusual that needs attention
- `growth-signals.json` — patterns suggesting new features or improvements

**Cycle frequency:** Runs at the start of every lifecycle cycle.

**Key behaviors:**
- Maintains rolling history of state reports (last 30 cycles)
- Detects trends, not just point-in-time values ("complexity is increasing 5% per cycle")
- Flags when quality metrics are approaching the floors defined in organism.json
- Never takes action — only observes and reports

---

#### 2. Prefrontal Cortex

**Role:** Strategic planning and work prioritization.

**Inputs:**
- Sensory Cortex state report
- organism.json (purpose, boundaries, principles)
- Memory agent's knowledge base (past decisions and outcomes)
- Current backlog of proposed work items

**Outputs:**
- `cycle-plan.json` — ordered list of up to 3 work items for this cycle
- `rationale.md` — explanation of WHY these items were prioritized

**Decision framework (priority order):**
1. **Critical fixes** — anything in the zero_tolerance category (security vulns, lint errors)
2. **Regression repair** — undo or fix any recent change that degraded quality
3. **Quality improvement** — increase test coverage, reduce complexity, improve performance
4. **Feature enhancement** — deepen existing commands based on usage signals
5. **New growth** — implement new capabilities proposed by Growth Hormone

**Key behaviors:**
- Never schedules more work than the max_changes_per_cycle limit
- Enforces the mandatory_cooldown_after_regression rule
- Consults Memory before prioritizing ("last time we tried to optimize this area, it caused a regression")
- Balances exploitation (improving what exists) with exploration (growing new capabilities)

---

#### 3. Motor Cortex

**Role:** Implementation. Writes the actual code.

**Inputs:**
- Specific work item from the cycle plan
- Relevant source files
- Memory agent's knowledge about this area of the codebase
- organism.json quality standards

**Outputs:**
- Git branch with implemented changes (`organism/motor/{description}`)
- `change-summary.md` — what was changed and why
- Updated or new tests

**Key behaviors:**
- Always works on a branch, never on main
- Writes tests before or alongside implementation (never skips tests)
- Follows the evolutionary principles in organism.json
- References Memory before making architectural decisions
- Keeps changes small and focused (one concern per branch)
- Uses Claude Code as its execution engine

---

#### 4. Immune System

**Role:** Adversarial review and quality enforcement.

**Inputs:**
- Proposed branch from Motor Cortex or Growth Hormone
- organism.json quality standards and boundaries
- The full test suite
- Memory agent's history of past regressions

**Outputs:**
- `review-verdict.json` — approve, reject, or request-changes
- `review-details.md` — detailed explanation of findings

**Review checklist:**
- [ ] All existing tests pass
- [ ] New code has corresponding tests
- [ ] Test coverage remains above the floor (80%)
- [ ] No function exceeds complexity limit (15)
- [ ] No file exceeds length limit (300 lines)
- [ ] Performance benchmarks still pass
- [ ] No security vulnerabilities introduced (npm audit)
- [ ] Change aligns with organism.json purpose and boundaries
- [ ] Change does NOT violate any forbidden_zone rules
- [ ] Output formats for existing commands are not broken
- [ ] No unnecessary dependencies added

**Key behaviors:**
- Operates with zero trust — assumes every change could be harmful
- Runs the full test suite, not just affected tests
- Performs static analysis independently of Motor Cortex
- Can reject changes from any agent, including Growth Hormone
- Keeps a "rejection log" that feeds Memory

---

#### 5. Growth Hormone

**Role:** Discover and propose new capabilities.

**Inputs:**
- Sensory Cortex growth signals
- organism.json growth_zone and forbidden_zone
- Usage telemetry patterns
- Memory agent's record of past growth attempts

**Outputs:**
- `growth-proposal.md` — detailed proposal for a new feature/command
- Prototype implementation on a branch (`organism/growth/{feature-name}`)

**How it discovers growth opportunities:**
- **Usage patterns:** "Users run `pulse` 3x more than other commands → deepen pulse capabilities"
- **Error patterns:** "23% of runs fail on monorepos → add monorepo support"
- **Missing coverage:** "No command addresses branch management → propose a branch health command"
- **Ecosystem gaps:** "Users frequently pipe output to jq → add native JSON output mode"
- **Capability extension:** "Hotspots already detects file coupling → extend to module-level coupling"

**Key behaviors:**
- Proposes one growth item at a time (quality over quantity)
- Every proposal must include a rationale tied to evidence (not speculation)
- Proposals go through the Immune System just like any other change
- Respects the forbidden_zone absolutely — never proposes anything outside boundaries
- Gradually increases proposal ambition as the organism matures

---

#### 6. Memory

**Role:** Persistent institutional knowledge.

**Inputs:**
- Outcomes of every lifecycle cycle (what was attempted, what succeeded, what failed)
- Immune System rejection log
- Sensory Cortex historical state reports
- Growth Hormone proposal history

**Outputs:**
- `knowledge-base.json` — structured record of learned patterns
- Queryable interface for other agents ("what happened last time we modified the hotspots parser?")

**What it remembers:**
- **Architectural decisions:** what patterns the organism has adopted and why
- **Failure patterns:** what types of changes tend to cause regressions
- **Growth history:** what features were proposed, which survived, which were rejected
- **Performance baselines:** how execution times have evolved over time
- **Quality trajectory:** how test coverage, complexity, and other metrics have trended
- **Code ownership:** which agents created which parts of the codebase

**Key behaviors:**
- Curates actively — doesn't just append logs, synthesizes lessons
- Maintains a "confidence score" for each piece of knowledge (more evidence = higher confidence)
- Can recommend against repeating past mistakes
- Produces a periodic "self-knowledge report" that summarizes what the organism has learned about itself

---

## The Lifecycle Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE LIFECYCLE CYCLE                       │
│                                                             │
│  1. SENSE                                                   │
│     Sensory Cortex produces state report                    │
│     ↓                                                       │
│  2. PLAN                                                    │
│     Prefrontal Cortex reads state + memory                  │
│     Produces prioritized work items (max 3)                 │
│     ↓                                                       │
│  3. BUILD                                                   │
│     Motor Cortex implements changes on branches             │
│     Growth Hormone proposes new features (if scheduled)     │
│     ↓                                                       │
│  4. DEFEND                                                  │
│     Immune System reviews ALL proposed changes              │
│     Approves, rejects, or requests modifications            │
│     ↓                                                       │
│  5. COMMIT                                                  │
│     Approved changes merge to main                          │
│     Rejected changes are logged with reasons                │
│     ↓                                                       │
│  6. REFLECT                                                 │
│     Memory agent records outcomes                           │
│     Updates knowledge base with new learnings               │
│     Sensory Cortex captures post-cycle state                │
│     ↓                                                       │
│  7. REST                                                    │
│     Organism waits until next cycle                         │
│     (or enters cooldown if regression detected)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## DashClaw Integration: The Observation Layer

DashClaw becomes the window into the organism's mind. Every agent action, every decision, every piece of reasoning is instrumented through OpenClaw and visible in DashClaw.

### Dashboard Panels

#### Vital Signs (Real-time)
- **Commit velocity:** commits per cycle, trending up/down
- **Mutation success rate:** % of proposed changes that pass Immune System
- **Regression rate:** % of merged changes that later caused problems
- **Test coverage:** current and trend line
- **Complexity score:** weighted average across all files, trending
- **Performance budget:** execution times vs. budgets for each command
- **Organism fitness:** composite score combining all vital signs

#### Evolutionary Timeline (Historical)
- Visual git tree showing organism-generated branches
- Color-coded: green (merged), red (rejected), yellow (pending)
- Click any branch to see the full reasoning chain (why it was proposed, what the Immune System found, whether it was approved)
- Filterable by agent (show only Growth Hormone proposals, or only Immune System rejections)

#### Cognitive Map (Self-Knowledge)
- Visual representation of what the organism "understands" about itself
- Confidence heatmap across the codebase (green = well-understood, red = fragile/uncertain)
- Growth trajectory: what capabilities exist now vs. what the organism was born with
- Decision patterns: what types of changes the organism tends to make vs. avoid

#### Decision Log (Reasoning Transparency)
- Every decision the organism has ever made, with full reasoning chains
- Filterable, searchable, exportable
- Links decisions to outcomes ("this decision led to a regression 3 cycles later")
- Aggregate patterns: "the organism tends to prioritize performance over features"

---

## Growth Trajectory: How the Organism Evolves

### Phase 1: Maintenance (Weeks 1-2)
The organism only does maintenance: dependency updates, test improvements, performance optimizations, bug fixes. No new features. This phase builds the Immune System's understanding of what "healthy" looks like and gives Memory its baseline.

### Phase 2: Enhancement (Weeks 3-4)
The organism begins deepening existing commands. Pulse gets trend analysis. Hotspots gets coupling detection. Ghosts gets dead code identification. Growth Hormone is active but conservative, only proposing incremental improvements backed by strong usage signals.

### Phase 3: Growth (Weeks 5+)
The organism begins proposing and implementing entirely new commands. At this point, Memory has enough history to inform architectural decisions, the Immune System has a rich model of what regressions look like, and the Sensory Cortex has clear usage patterns to guide growth.

### Possible Growth Paths (NOT prescribed — the organism discovers these)
- `giti forensics` — deep dive into a specific file's history, who touched it, why, what patterns
- `giti team` — contributor analytics, bus factor, knowledge silos, review patterns
- `giti predict` — predict which files are likely to break based on change patterns
- `giti archaeology` — reconstruct the history of decisions that led to the current architecture
- `giti drift` — detect when the codebase is drifting from its original architecture
- `giti velocity` — development speed metrics, cycle time, merge frequency
- `giti review` — automated pre-review of a branch before you open a PR
- `giti compare` — compare two repos or two time periods in the same repo
- JSON output mode for all commands (for piping and automation)
- Quiet/verbose modes
- Config file support for per-repo customization
- Monorepo awareness
- Git submodule support

---

## Implementation Roadmap

### Sprint 0: Build the Seed (Human-driven, 1 day)
- [ ] Initialize TypeScript project with tsup + vitest
- [ ] Implement `giti pulse` command
- [ ] Implement `giti hotspots` command
- [ ] Implement `giti ghosts` command
- [ ] Write initial test suite (target 80% coverage)
- [ ] Create organism.json manifest
- [ ] Publish v0.1.0 to npm
- [ ] Set up GitHub repo with CI/CD

### Sprint 1: Build the Safety Layer (Human-driven, 2-3 days)
- [ ] Implement Sensory Cortex agent (state reporting)
- [ ] Implement Immune System agent (review and quality gates)
- [ ] Implement Memory agent (knowledge base foundation)
- [ ] Instrument all agents through OpenClaw
- [ ] Set up DashClaw vital signs dashboard
- [ ] Run first manual lifecycle cycle to validate the loop

### Sprint 2: Activate the Organism (Human + Agent, 2-3 days)
- [ ] Implement Prefrontal Cortex (strategic planning)
- [ ] Implement Motor Cortex (code generation via Claude Code)
- [ ] Connect the full lifecycle loop
- [ ] Run first autonomous cycle with human oversight
- [ ] Validate that Immune System catches intentionally bad changes
- [ ] Set up automated cycle scheduling (daily cron)

### Sprint 3: Enable Growth (Agent-driven with human oversight, ongoing)
- [ ] Implement Growth Hormone agent
- [ ] Add telemetry system (opt-in)
- [ ] Build DashClaw evolutionary timeline
- [ ] Build DashClaw cognitive map
- [ ] Let the organism run daily cycles
- [ ] Monitor and adjust organism.json as needed
- [ ] Document the organism's first autonomous feature

### Sprint 4: Release the Organism (Fully autonomous, ongoing)
- [ ] Remove human oversight requirement (Immune System is trusted)
- [ ] Build DashClaw decision log
- [ ] Begin publishing the organism's evolution as content
- [ ] Open source the organism framework so others can create living codebases
- [ ] Present at meetups / write about the journey

---

## Content and Marketing Angle

### The Narrative
Every lifecycle cycle produces a story. The organism's git history IS the content:

- "Day 14: The organism discovered that users pipe hotspots output to grep. Today it added native filtering. Nobody asked for this."
- "Day 23: The Immune System rejected a Growth Hormone proposal for the first time. The proposed 'team analytics' feature would have added 4 new dependencies. The organism's learned preference for minimal dependencies won."
- "Day 31: The organism refactored its own parser module. Memory flagged that this module had caused 3 of the last 5 regressions. The organism decided to decompose it into smaller, testable units."

### Where to Publish
- **Twitter/X thread series:** "My codebase is alive. Day [N] update."
- **HN Show HN:** "Show HN: A CLI tool that maintains and grows itself"
- **Blog posts on the philosophy:** "What happens when code has opinions?"
- **DashClaw showcase:** Live dashboard showing the organism's evolution in real time

### The Meta Showcase for Practical Systems
When a prospect asks "what can your AI agents actually do?", you point them at a live dashboard showing a codebase that has been autonomously evolving for months. That's a proof point no competitor can match.

---

## Open Questions

1. **How much autonomy from day one?** Should the organism need human PR approval in Phase 1, or should the Immune System be the sole gatekeeper from the start?

2. **Telemetry bootstrapping:** Before real users exist, how does the Growth Hormone get signals? Option: run giti against a diverse set of open source repos and use those runs as synthetic telemetry.

3. **Regression rollback:** Should the organism auto-revert merged changes that cause regressions, or just flag them for the next cycle?

4. **Identity persistence:** As the organism evolves, it will eventually replace most of its own seed code. At what point is it still "the same organism"? (Ship of Theseus problem — but also a great content angle.)

5. **Multi-organism interaction:** Could two living codebases interact? One depends on the other as a library. When organism A evolves its API, organism B needs to adapt. Emergent inter-organism dynamics.

---

## Success Metrics

### Technical
- Organism runs 30+ consecutive daily cycles without human intervention
- Test coverage maintained above 80% throughout evolution
- At least 3 new commands/features emerged that weren't in the seed
- Zero regressions survive more than 2 cycles before being caught and fixed

### Community
- 500+ GitHub stars within 3 months
- Featured on HN front page
- 3+ other developers create their own living codebases using the framework

### Business (Practical Systems)
- At least 2 qualified inbound leads attributed to the project
- DashClaw demo pipeline includes the living codebase dashboard
- Framework becomes a service offering ("we'll make your codebase alive")
