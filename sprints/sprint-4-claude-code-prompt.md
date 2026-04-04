# Claude Code Prompt: Sprint 4 — Release the Organism

## Context

You are building Sprint 4 of **The Living Codebase** project. The organism is fully functional: it observes (Sensory Cortex), plans (Prefrontal Cortex), grows (Growth Hormone), builds (Motor Cortex), defends (Immune System), and learns (Memory). It runs in daily lifecycle cycles and generates its own feature proposals based on real usage patterns.

Sprint 4 is about releasing the organism into the world. You're building the public-facing observation layer (DashClaw dashboards), the automated content pipeline (the organism narrates its own evolution), the GitHub integration (the organism participates in its own repo like a contributor), and the framework extraction that lets other projects become living codebases.

After this sprint, the organism operates fully autonomously with public visibility into its evolution.

Read `living-codebase-architecture.md` for the full vision. Read Sprints 0 through 3 for context.

## What You're Building

Four major deliverables:
1. **DashClaw Dashboard Configuration** for observing the organism
2. **GitHub Integration** so the organism creates real PRs, writes descriptions, and responds to issues
3. **Content Pipeline** that automatically generates evolution narratives
4. **Framework Extraction** that packages the organism infrastructure for reuse

---

## Deliverable 1: DashClaw Dashboard Configuration

### Purpose

Transform the organism's internal state into a live, public dashboard powered by DashClaw. Anyone can visit the dashboard and see the organism's vital signs, evolutionary history, decision log, and cognitive map.

### Data Pipeline

Create a DashClaw reporter that runs at the end of every lifecycle cycle and pushes structured data to DashClaw.

```typescript
// src/integrations/dashclaw/reporter.ts

interface DashClawCycleReport {
  cycle_number: number;
  timestamp: string;
  organism_version: string;

  vital_signs: {
    fitness_score: number;             // 0-100 composite
    test_coverage: number;
    lint_errors: number;
    complexity_avg: number;
    performance: Record<string, number>;  // command → ms
    dependency_health: number;         // 0-100
    commit_velocity_7d: number;
    mutation_success_rate: number;     // % of changes that pass Immune System
    regression_rate: number;           // % of merged changes that caused issues
  };

  cycle_summary: {
    outcome: string;
    items_planned: number;
    items_implemented: number;
    items_approved: number;
    items_merged: number;
    growth_proposals: number;
    api_tokens_used: number;
  };

  decisions: Array<{
    agent: string;
    action: string;
    reasoning: string;
    outcome: string;
  }>;

  evolutionary_state: {
    total_commands: number;
    commands_list: string[];
    total_files: number;
    total_lines: number;
    organism_born: string;             // first cycle timestamp
    total_cycles: number;
    total_changes_merged: number;
    total_changes_rejected: number;
    growth_features_shipped: number;
    current_cooldown: boolean;
    emerged_preferences: string[];
    top_lessons: string[];
  };
}
```

### Dashboard Panels to Configure

Provide a DashClaw configuration file or setup script that creates the following panels. If DashClaw uses a declarative config format, write the config. If it uses an API, write the setup script. Reference the dashclaw-platform-intelligence skill for the correct approach.

**Panel 1: Vital Signs (real-time gauges)**
- Fitness score (0-100, color coded: green > 80, yellow > 60, red < 60)
- Test coverage gauge
- Performance budget utilization per command
- Mutation success rate
- API token budget utilization

**Panel 2: Evolutionary Timeline (interactive timeline)**
- X-axis: time (cycles)
- Y-axis: stacked events (changes merged, changes rejected, growth proposals)
- Click any point to see the cycle's full decision log
- Color coding: green = productive, yellow = stable (no changes), red = regression

**Panel 3: Cognitive Map (treemap or heatmap)**
- Visualize the codebase as a treemap where each file is a rectangle
- Color by confidence: green (well-tested, stable), yellow (moderate), red (fragile)
- Size by lines of code
- Overlay: mark files created by the organism vs. original seed files

**Panel 4: Decision Log (searchable table)**
- Columns: cycle, agent, action, reasoning, outcome, timestamp
- Filterable by agent, outcome, time range
- Expandable rows to see full reasoning chains

**Panel 5: Growth Tracker (feature timeline)**
- Show each growth proposal as a card on a timeline
- States: proposed → reviewed → approved/rejected → implemented → shipped
- Include the evidence that triggered each proposal

**Panel 6: Personality Profile (text panel, updated weekly)**
- Summarize the organism's emerged preferences
- Show decision pattern statistics
- Compare current personality to the organism's initial principles

### Public Access

Configure the dashboard for public read-only access. Anyone with the URL can view the organism's evolution. Only the organism (via API key) can write data.

---

## Deliverable 2: GitHub Integration

### Purpose

The organism should participate in its own GitHub repository like a real contributor. Instead of silently merging branches locally, it creates pull requests with detailed descriptions, responds to issues that match its capabilities, and publishes release notes when it ships new features.

### GitHub Bot Setup

Create a GitHub integration module that authenticates via a GitHub Personal Access Token (PAT) or GitHub App.

```typescript
// src/integrations/github/client.ts

interface GitHubClient {
  createPullRequest(params: {
    branch: string;
    title: string;
    body: string;
    labels: string[];
  }): Promise<{ number: number; url: string }>;

  mergePullRequest(params: {
    number: number;
    merge_method: 'merge' | 'squash' | 'rebase';
  }): Promise<void>;

  closePullRequest(params: {
    number: number;
    comment: string;
  }): Promise<void>;

  createComment(params: {
    issue_number: number;
    body: string;
  }): Promise<void>;

  createRelease(params: {
    tag: string;
    name: string;
    body: string;
  }): Promise<void>;

  getOpenIssues(): Promise<Array<{
    number: number;
    title: string;
    body: string;
    labels: string[];
  }>>;
}
```

### Pull Request Behavior

When the Motor Cortex completes a change and the Immune System approves it, instead of merging locally, the orchestrator:

1. Pushes the branch to the remote
2. Creates a PR with a structured description:

```markdown
## 🧬 Organism Change: {title}

**Agent:** Motor Cortex
**Cycle:** #{cycle_number}
**Work Item Tier:** {tier}

### What Changed
{description of changes}

### Why
{rationale from the work item, including evidence}

### Immune System Review
- Tests: ✅ {pass_count}/{total_count} passing (coverage: {coverage}%)
- Quality: ✅ 0 lint errors, no files over limit
- Performance: ✅ All commands within budget
- Boundaries: ✅ Change within growth zone
- Verdict: **APPROVED** (confidence: {confidence})

### Memory Context
{relevant lessons or history that informed this change}

### Metrics Impact
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Test Coverage | {before}% | {after}% | {delta} |
| Complexity Avg | {before} | {after} | {delta} |
| {command} perf | {before}ms | {after}ms | {delta} |

---
*This PR was created autonomously by the Living Codebase organism.*
*[View the organism's dashboard]({dashclaw_url})*
```

3. Add labels: `organism`, `auto-generated`, and the tier (`tier-1`, `tier-2`, etc.)
4. If in supervised mode, wait for human approval on the PR
5. If in autonomous mode, auto-merge after a configurable delay (default: 1 hour)
6. After merge, delete the remote branch

### Issue Triage

Add an optional issue responder that checks open issues and determines if the organism can address them:

1. On each lifecycle cycle, fetch open issues
2. For each issue, check if it describes something within the organism's growth zone
3. If yes, add a comment: "This looks like something I might be able to address. I'll analyze it in my next growth cycle."
4. Feed the issue into the Growth Hormone as an external growth signal
5. If the organism ships a change that addresses the issue, comment with a link to the PR and close the issue

This should be conservative. Only engage with issues that clearly match the organism's capabilities. Never promise timelines. Never engage with issues outside the growth zone.

### Release Notes

When the organism ships a growth feature (a Tier 5 change from a Growth Hormone proposal), automatically create a GitHub release:

```markdown
## v{version} — {feature name}

🌱 This feature was autonomously discovered and implemented by the Living Codebase organism.

### What's New
{description}

### How It Was Discovered
{growth signal evidence that triggered the proposal}

### The Journey
- **Cycle #{proposed}:** Growth Hormone detected signal and generated proposal
- **Cycle #{reviewed}:** Immune System reviewed and approved the proposal
- **Cycle #{implemented}:** Motor Cortex implemented the feature
- **Cycle #{shipped}:** Feature passed review and merged

### Organism Stats at Time of Release
- Total autonomous cycles: {count}
- Total changes merged: {count}
- Growth features shipped: {count}
- Current fitness score: {score}/100
```

Bump the version in package.json (patch for maintenance, minor for growth features) and publish to npm.

### Environment Variables

```bash
GITHUB_TOKEN=ghp_...                  # GitHub PAT with repo permissions
GITHUB_OWNER=...                      # Repository owner
GITHUB_REPO=giti                      # Repository name
GITI_AUTO_MERGE=true                  # Auto-merge approved PRs (default: false)
GITI_AUTO_MERGE_DELAY=3600000         # Delay before auto-merge in ms (default: 1h)
```

---

## Deliverable 3: Content Pipeline

### Purpose

The organism's evolution is inherently interesting content. Automate the generation of evolution narratives that can be published to Twitter/X, LinkedIn, Hacker News, and the project blog.

### Dispatch Generator

After every lifecycle cycle, generate a structured dispatch summarizing what happened:

```typescript
// src/content/dispatch-generator.ts

interface EvolutionDispatch {
  cycle: number;
  timestamp: string;
  headline: string;                    // one-line summary
  narrative: string;                   // 2-3 paragraph story of the cycle
  key_moments: Array<{
    moment: string;
    significance: string;
  }>;
  stats: {
    changes_merged: number;
    changes_rejected: number;
    growth_proposals: number;
    fitness_delta: number;
    streak: number;                    // consecutive productive cycles
  };
  content_hooks: string[];             // interesting angles for social posts
  milestone?: string;                  // if a milestone was hit (100th change, first growth feature, etc.)
}
```

### Narrative Generation

Use the Claude API to generate the narrative. Provide it with:
- The cycle's full decision log
- The Immune System's review verdicts
- Any Growth Hormone proposals
- Memory's latest lessons
- The organism's personality profile

Prompt Claude to write in a nature-documentary style. The organism is a subject being observed, not a tool being described. The narrative should be engaging, specific, and grounded in what actually happened.

Example output:
> "On its 23rd day of life, the organism made its first creative decision. The Growth Hormone had detected that 45% of users run pulse immediately followed by hotspots, spending time waiting for two separate analyses when one combined view would serve them better. It proposed a new `health` command. The Immune System approved the proposal but flagged a risk: the combined output might exceed terminal width on smaller screens. The Motor Cortex implemented the feature with a responsive layout that adapts to terminal size, something it learned to consider after Memory surfaced a lesson from Cycle 14 about a formatting regression on narrow terminals. The Immune System approved the implementation on the first pass. The organism now has four commands instead of three. It decided this on its own."

### Milestone Detection

Track and flag milestones:
- First successful autonomous cycle
- First change merged with zero human involvement
- First growth proposal generated
- First growth feature shipped
- 10th, 25th, 50th, 100th change merged
- First time the organism fixes its own regression
- First time the organism rejects its own Growth Hormone's proposal
- Organism replaces more than 50% of its original seed code (Ship of Theseus moment)

### Content Queue

Write dispatches to `.organism/content/dispatches/` as JSON files. Include:
- The raw dispatch data
- Pre-formatted versions for different platforms:
  - `twitter`: 280 char version + thread version (if the story is rich enough)
  - `linkedin`: professional narrative version
  - `hn`: Show HN style (factual, technical, concise)
  - `blog`: long-form version with technical details

These are drafts for human review, not auto-posted. Write them in a format that's easy to copy-paste or feed into the social content engine skill.

### CLI Commands

```bash
# Generate dispatch for the most recent cycle
giti dispatch

# Generate dispatch for a specific cycle
giti dispatch --cycle=23

# List all dispatches
giti dispatch --list

# Show a specific dispatch formatted for a platform
giti dispatch --cycle=23 --platform=twitter
```

---

## Deliverable 4: Framework Extraction

### Purpose

Package the organism infrastructure so any project can become a living codebase. This is the long-term product play.

### Framework Package: `@livingcode/core`

Extract the agent infrastructure into a standalone npm package. The package provides:

1. **Agent base classes** with lifecycle hooks
2. **The orchestrator** with the full lifecycle loop
3. **The organism.json schema** and validator
4. **The `.organism/` directory manager**
5. **DashClaw integration helpers**
6. **GitHub integration helpers**
7. **Content pipeline helpers**

### Framework Structure

```
packages/
└── livingcode-core/
    ├── src/
    │   ├── agents/
    │   │   ├── base-agent.ts          # Abstract base class for all agents
    │   │   ├── sensory-cortex.ts      # Configurable sensory cortex
    │   │   ├── prefrontal-cortex.ts   # Configurable planner
    │   │   ├── motor-cortex.ts        # Configurable builder
    │   │   ├── immune-system.ts       # Configurable reviewer
    │   │   ├── memory.ts              # Configurable memory
    │   │   └── growth-hormone.ts      # Configurable growth engine
    │   ├── orchestrator/
    │   │   ├── lifecycle.ts           # Lifecycle loop
    │   │   ├── scheduler.ts           # Cron scheduling
    │   │   └── safety.ts              # Kill switch, cooldown, limits
    │   ├── schema/
    │   │   ├── organism.schema.json   # JSON schema for organism.json
    │   │   └── validator.ts           # Validate organism.json
    │   ├── integrations/
    │   │   ├── dashclaw.ts
    │   │   ├── github.ts
    │   │   └── openclaw.ts
    │   ├── content/
    │   │   └── dispatch.ts            # Narrative generation
    │   └── index.ts                   # Public API
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    └── README.md
```

### Public API

```typescript
// Usage example for someone making their own living codebase

import { LivingCodebase, OrganismConfig } from '@livingcode/core';

const organism = new LivingCodebase({
  manifestPath: './organism.json',
  workingDir: process.cwd(),

  // Customize agent behavior
  sensoryCortex: {
    collectors: ['git-stats', 'test-health', 'code-quality', 'dependencies', 'performance'],
    customCollectors: [myCustomCollector],  // extend with your own
  },

  motorCortex: {
    model: 'claude-sonnet-4-20250514',
    maxTokensPerItem: 4096,
    maxRetriesPerItem: 2,
  },

  immuneSystem: {
    checks: ['tests', 'quality', 'performance', 'boundaries', 'regressions', 'dependencies'],
    customChecks: [mySecurityCheck],       // extend with your own
  },

  integrations: {
    dashclaw: { apiKey: process.env.DASHCLAW_API_KEY },
    github: { token: process.env.GITHUB_TOKEN, owner: 'me', repo: 'my-project' },
    openclaw: { apiKey: process.env.OPENCLAW_API_KEY },
  },

  schedule: '0 0 * * *',               // cron expression, daily at midnight
});

// Start the organism
await organism.start();

// Or run a single cycle
await organism.runCycle({ supervised: true });

// Or run specific agents
const report = await organism.sense();
const plan = await organism.plan();
const result = await organism.build(plan.selectedItems[0]);
const verdict = await organism.review(result.branchName);
```

### organism.json JSON Schema

Create a formal JSON schema (`organism.schema.json`) that validates organism.json files. This ensures anyone using the framework gets helpful error messages if their manifest is malformed.

The schema should validate:
- Required fields: identity.name, identity.purpose, boundaries.growth_zone, boundaries.forbidden_zone
- Quality standards have valid numeric ranges
- Lifecycle settings are within reasonable bounds
- Evolutionary principles are non-empty strings
- Performance budgets have valid format

### Framework README

Write a README for the framework package that covers:
- What a Living Codebase is (with link to the giti showcase)
- Quick start (5 steps to make any project alive)
- organism.json reference
- Agent customization (adding custom collectors, checks, etc.)
- Integration setup (DashClaw, GitHub, OpenClaw)
- Safety features (kill switch, cooldown, budget limits)
- FAQ: "Is this safe?", "How much does it cost to run?", "Can it break my project?"

---

## Monorepo Migration

Sprint 4 introduces a second package (`@livingcode/core`). Restructure the project as a monorepo:

```
living-codebase/
├── packages/
│   ├── giti/                          # The original CLI tool (the showcase organism)
│   │   ├── src/
│   │   ├── tests/
│   │   ├── organism.json
│   │   └── package.json
│   └── livingcode-core/               # The reusable framework
│       ├── src/
│       ├── tests/
│       └── package.json
├── package.json                       # Workspace root
├── tsconfig.base.json
├── living-codebase-architecture.md
└── README.md                          # Root README covering the whole project
```

Use npm workspaces. The `giti` package depends on `@livingcode/core`. Refactor `giti` to import its agent infrastructure from the framework package rather than having it inline. This validates that the framework actually works by having its first consumer be the showcase project.

---

## Testing Strategy

### DashClaw Reporter Tests
- Test report generation produces valid DashClawCycleReport objects
- Test that all vital signs are calculated correctly
- Test that decisions are properly formatted
- Mock DashClaw API and verify payloads

### GitHub Integration Tests
- Mock GitHub API (use nock or similar)
- Test PR creation with correct title, body, labels
- Test auto-merge with delay
- Test issue triage (correctly identifies addressable issues, ignores others)
- Test release note generation
- Test version bumping logic

### Content Pipeline Tests
- Test dispatch generation with fixture cycle data
- Test milestone detection (each milestone triggers correctly)
- Test platform-specific formatting (twitter length, linkedin tone, etc.)
- Mock Claude API for narrative generation

### Framework Tests
- Test organism.json schema validation (valid configs pass, invalid configs fail with clear errors)
- Test LivingCodebase class initialization with various configurations
- Test custom collector and custom check registration
- Test that giti successfully runs using the extracted framework (integration test)

---

## Definition of Done

Sprint 4 is complete when:

1. DashClaw reporter pushes cycle data after every lifecycle cycle
2. Dashboard configuration creates all 6 panels (or setup script does)
3. Organism creates GitHub PRs instead of merging locally
4. PR descriptions include full context (rationale, review, metrics)
5. Auto-merge works with configurable delay
6. Issue triage identifies and responds to addressable issues
7. Release notes are auto-generated for growth features
8. Content dispatches are generated after every cycle
9. Dispatches include platform-specific formatting (twitter, linkedin, hn, blog)
10. Milestone detection works for all defined milestones
11. `@livingcode/core` package extracted and published
12. `giti` refactored to use the framework package
13. Monorepo structure works with npm workspaces
14. organism.json schema validation works
15. Framework README and documentation complete
16. All tests pass with 80%+ coverage across both packages

## What NOT To Do

- Do not auto-post content to social media. Dispatches are drafts for human review.
- Do not auto-merge PRs without the configurable delay. Safety first.
- Do not let the GitHub integration modify issues it didn't create.
- Do not over-abstract the framework. It should be easy to use for the simple case and extensible for the complex case. If someone needs to read 500 lines of docs before they can start, it's too complex.
- Do not break the giti CLI during the monorepo migration. Everything that worked in Sprint 3 must continue to work.
- Do not attempt to make the framework work with non-TypeScript projects yet. TypeScript/Node.js first. Other ecosystems can come later as growth features proposed by the organism itself (wouldn't that be something).
