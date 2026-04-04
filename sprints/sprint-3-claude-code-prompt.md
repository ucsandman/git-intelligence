# Claude Code Prompt: Sprint 3 — Enable Growth

## Context

You are building Sprint 3 of **The Living Codebase** project. The organism is now alive and functional: it can observe its state (Sensory Cortex), plan work (Prefrontal Cortex), implement changes (Motor Cortex), review them (Immune System), and learn from outcomes (Memory). It runs in daily lifecycle cycles.

But right now the organism only maintains itself. It fixes bugs, updates dependencies, improves test coverage, and optimizes performance. It cannot imagine new capabilities. Sprint 3 changes that by adding the Growth Hormone agent and a telemetry system that gives the organism real signal about how people use it.

After this sprint, the organism doesn't just survive. It evolves.

Read `living-codebase-architecture.md` for the full vision. Read Sprint 0, 1, and 2 prompts for context on what already exists.

## What You're Building

The Growth Hormone agent, opt-in anonymous telemetry, a synthetic usage simulator for bootstrapping growth signals before real users exist, and upgrades to the Prefrontal Cortex so it can incorporate growth proposals into its planning.

## Project Structure Additions

```
giti/
├── src/
│   ├── agents/
│   │   └── growth-hormone/
│   │       ├── index.ts              # Main growth hormone logic
│   │       ├── signal-analyzer.ts    # Analyze telemetry for growth opportunities
│   │       ├── proposal-generator.ts # Generate feature proposals
│   │       ├── prototype-builder.ts  # Build proof-of-concept implementations
│   │       └── types.ts
│   ├── telemetry/
│   │   ├── collector.ts              # Collect usage events
│   │   ├── store.ts                  # Local telemetry storage
│   │   ├── anonymizer.ts             # Strip identifying information
│   │   ├── reporter.ts               # Aggregate and report telemetry
│   │   └── types.ts
│   ├── simulator/
│   │   ├── index.ts                  # Synthetic usage simulator
│   │   ├── scenarios.ts              # Predefined usage scenarios
│   │   ├── repo-generator.ts         # Generate diverse test repos
│   │   └── types.ts
│   └── cli/
│       ├── grow.ts                   # CLI: run growth hormone manually
│       ├── telemetry.ts              # CLI: manage telemetry settings
│       └── simulate.ts               # CLI: run usage simulator
├── .organism/
│   ├── telemetry/                    # Local telemetry data
│   ├── growth-proposals/             # Growth Hormone proposals
│   └── simulations/                  # Simulation run results
└── tests/
    ├── agents/
    │   └── growth-hormone/
    │       ├── signal-analyzer.test.ts
    │       ├── proposal-generator.test.ts
    │       └── prototype-builder.test.ts
    ├── telemetry/
    │   ├── collector.test.ts
    │   ├── anonymizer.test.ts
    │   └── reporter.test.ts
    └── simulator/
        └── simulator.test.ts
```

---

## Telemetry System

### Philosophy

Telemetry is the organism's sensory input from the outside world. Without it, the Growth Hormone is blind. But telemetry must be opt-in, anonymous, and respectful. The organism earns trust by being transparent about what it collects and why.

### Opt-In Flow

On first run of any giti command, display a one-time prompt:

```
giti can collect anonymous usage data to help it evolve and improve.
No personal information, file contents, or repo names are ever collected.
See https://github.com/your-repo/TELEMETRY.md for details.

Enable anonymous telemetry? (y/n):
```

Store the preference in `~/.giti/config.json` (user's home directory, not the repo). Never ask again after the initial choice. Provide `giti telemetry on` and `giti telemetry off` to change the setting later.

### What Gets Collected

```typescript
interface TelemetryEvent {
  event_id: string;                    // UUID, generated fresh each time
  timestamp: string;                   // ISO 8601
  giti_version: string;
  node_version: string;
  os_platform: string;                 // 'darwin', 'linux', 'win32'

  command: string;                     // 'pulse', 'hotspots', 'ghosts'
  flags_used: string[];                // ['--json', '--since=30d']
  execution_time_ms: number;
  exit_code: number;                   // 0 = success, non-zero = error
  error_type?: string;                 // error class name, never the message

  repo_characteristics: {
    commit_count_bucket: string;       // '0-100', '100-1k', '1k-10k', '10k-100k', '100k+'
    branch_count_bucket: string;       // '0-5', '5-20', '20-50', '50+'
    author_count_bucket: string;       // '1', '2-5', '5-20', '20+'
    primary_language: string;          // detected from file extensions
    has_monorepo_structure: boolean;
    age_bucket: string;                // '<1mo', '1-6mo', '6mo-2y', '2y+'
  };
}
```

### What NEVER Gets Collected

- Repository names, URLs, or paths
- File names or file contents
- Commit messages or author names
- Branch names
- Any string that could identify the user or their project
- IP addresses (if remote reporting is added later)

### Storage

Telemetry events are stored locally first in `.organism/telemetry/events.jsonl` (one JSON object per line). The organism reads this file during its lifecycle cycle to feed the Growth Hormone.

For Sprint 3, telemetry is local only. There is no remote reporting. The organism analyzes its own telemetry data. If remote aggregation is added later, it must go through the anonymizer and the user must opt in separately.

### CLI Commands

```bash
# Check telemetry status
giti telemetry status

# Enable telemetry
giti telemetry on

# Disable telemetry
giti telemetry off

# Show what's been collected (transparency)
giti telemetry show [--last=10]

# Clear all collected telemetry
giti telemetry clear
```

### Instrumenting Existing Commands

Add telemetry hooks to all existing commands (`pulse`, `hotspots`, `ghosts`) and all future commands. The hook runs at the end of command execution:

```typescript
// Wrap at the command level, not deep in the analyzers
async function runPulse(options: PulseOptions) {
  const startTime = Date.now();
  try {
    const result = await pulse(options);
    await telemetry.record({
      command: 'pulse',
      flags_used: extractFlags(options),
      execution_time_ms: Date.now() - startTime,
      exit_code: 0,
      repo_characteristics: await getRepoCharacteristics()
    });
    return result;
  } catch (error) {
    await telemetry.record({
      command: 'pulse',
      flags_used: extractFlags(options),
      execution_time_ms: Date.now() - startTime,
      exit_code: 1,
      error_type: error.constructor.name,
      repo_characteristics: await getRepoCharacteristics()
    });
    throw error;
  }
}
```

Telemetry recording must NEVER cause the command to fail. Wrap all telemetry calls in try/catch and silently swallow errors.

---

## Usage Simulator

### Purpose

Before real users exist, the organism needs synthetic usage data to bootstrap the Growth Hormone. The simulator runs giti commands against diverse repositories and generates realistic telemetry.

### CLI Entrypoint

```bash
# Run a simulation
giti simulate [--scenarios=50] [--repos=diverse]

# Output: generates synthetic telemetry events in .organism/telemetry/
```

### How It Works

1. **Repo generation:** Create temporary git repositories with different characteristics:
   - Small project (50 commits, 1 author, 10 files)
   - Medium project (500 commits, 5 authors, 50 files)
   - Large project (5000 commits, 20 authors, 200 files)
   - Monorepo (multiple packages, complex structure)
   - Ancient project (10+ years of history)
   - Fresh project (just initialized, minimal history)

2. **Scenario execution:** Run realistic usage patterns against each repo:
   - "Quick check" — user runs `pulse` only
   - "Deep analysis" — user runs all three commands in sequence
   - "Hotspot focus" — user runs `hotspots` with different `--since` values
   - "Cleanup mode" — user runs `ghosts` with different thresholds
   - "JSON pipeline" — user runs commands with `--json` flag
   - "Error path" — run against non-git directory, empty repo, corrupted repo

3. **Pattern injection:** Simulate realistic usage patterns:
   - `pulse` is called 3x more frequently than other commands (most common entry point)
   - `--json` is used 20% of the time
   - 5% of runs encounter errors
   - Most repos are in the 100-1k commit bucket
   - Users typically run 1 command per session (70%) or all three (30%)

4. **Output:** Write synthetic telemetry events to `.organism/telemetry/` exactly as real telemetry would be stored. The Growth Hormone cannot distinguish synthetic from real telemetry (and doesn't need to).

---

## Agent 6: Growth Hormone

### Purpose

Analyze usage patterns and organism capabilities, then propose new features the organism should grow. This is the creative engine.

### CLI Entrypoint

```bash
# Run growth analysis and generate proposals
giti grow

# Show current proposals
giti grow --show

# Show a specific proposal
giti grow --show <proposal-id>
```

### Signal Analysis

The Growth Hormone reads telemetry data and identifies growth opportunities through pattern detection.

**Signal types it looks for:**

1. **Usage concentration:** Which commands get the most use? What flags are most popular? This tells the organism where to invest in depth.
   - "pulse accounts for 60% of all invocations → deepen pulse capabilities"

2. **Usage sequences:** What commands do users run together? This suggests combination or workflow features.
   - "45% of sessions run pulse immediately followed by hotspots → consider a combined health command"

3. **Error patterns:** What errors do users encounter? This reveals gaps.
   - "12% of runs fail with 'not a git repository' → improve error message and suggest recovery"
   - "8% of hotspots runs on repos >10k commits exceed performance budget → optimize for large repos"

4. **Flag patterns:** Which flags exist vs. which would be useful?
   - "0% of users use --json but all commands support it → json mode works but isn't discoverable"
   - "Users never change --since default → default is probably right, don't bother adding more options"

5. **Missing capabilities:** Based on the organism's purpose and the types of repos it encounters, what capabilities are notably absent?
   - "Organism encounters monorepos 15% of the time but has no monorepo awareness"
   - "No command addresses contributor/team dynamics despite having the data"

6. **Ecosystem signals:** What could the organism do that aligns with its purpose but doesn't exist yet?
   - "Organism could provide a pre-commit hook that runs pulse and warns on degradation"
   - "Organism could output markdown for inclusion in READMEs"

### Proposal Generation

The Growth Hormone uses the Claude API to generate detailed proposals. Unlike Motor Cortex which writes code, Growth Hormone writes proposals that describe WHAT should be built and WHY, including evidence from telemetry.

```typescript
interface GrowthProposal {
  id: string;
  timestamp: string;
  title: string;                       // e.g., "Add giti health command"
  description: string;                 // detailed description
  rationale: string;                   // WHY this should exist, with evidence
  evidence: Array<{
    signal_type: string;
    data_point: string;
    confidence: number;
  }>;

  proposed_interface: {
    command: string;                   // e.g., "giti health"
    flags: string[];                   // proposed flags
    output_description: string;        // what the output would look like
  };

  estimated_complexity: 'small' | 'medium' | 'large';
  target_files: string[];             // files likely to be created or modified
  dependencies_needed: string[];       // new npm packages (ideally none)

  alignment: {
    purpose_alignment: string;         // how this serves the organism's purpose
    growth_zone_category: string;      // which growth_zone it falls under
    principle_compliance: string[];    // which evolutionary principles it follows
  };

  risks: string[];
  success_metrics: string[];           // how to measure if this growth was valuable

  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  immune_system_notes?: string;        // feedback from Immune System review
}
```

### Proposal Quality Gates

Before submitting a proposal, the Growth Hormone self-checks:

1. **Boundary check:** Does this fall within the growth_zone? Does it violate any forbidden_zone rule?
2. **Evidence threshold:** Are there at least 2 independent signals supporting this proposal?
3. **Complexity check:** Is this appropriately scoped? Proposals should be implementable in 1 cycle.
4. **Redundancy check:** Query Memory — has a similar feature been proposed and rejected before? If so, what's different now?
5. **Dependency check:** Does this require new dependencies? Fewer is better. Zero is ideal.

### Integration with Prefrontal Cortex

Approved Growth Hormone proposals become Tier 5 work items in the Prefrontal Cortex's planning. Update the Prefrontal Cortex to:

1. Read approved proposals from `.organism/growth-proposals/`
2. Convert them into WorkItems with `tier: 5`
3. Include them in the prioritization alongside maintenance and quality items
4. The standard priority hierarchy ensures growth only happens when the organism is healthy

### Integration with Immune System

Growth proposals go through a lightweight Immune System review BEFORE they become work items. The Immune System evaluates:

- Does the proposal violate organism.json boundaries?
- Is the estimated complexity realistic?
- Are the proposed dependencies acceptable?
- Does Memory have relevant warnings?

This is a proposal review, not a code review. The full code review happens after the Motor Cortex implements the proposal.

### Prototype Builder

For complex proposals, the Growth Hormone can generate a rough prototype to validate feasibility before the proposal enters the backlog. The prototype:

- Lives on a branch: `organism/growth/prototype-{feature-name}`
- Is minimal — just enough to prove the concept works
- Gets reviewed by the Immune System at the proposal level (not full rigor)
- Gets deleted after the proposal is approved or rejected
- Uses the Claude API (count against the API budget)

### Human-Readable Output

```
🌱 Growth Hormone Analysis
───────────────────────────
Telemetry events analyzed: 847
Time period: last 30 days

Growth signals detected: 4

  1. [High confidence: 0.89] Users frequently run pulse + hotspots in sequence
     Evidence: 45% of multi-command sessions follow this pattern
     Proposal: Add "giti health" combining pulse + hotspots into one view

  2. [Medium confidence: 0.72] Error rate spikes on large repos (>10k commits)
     Evidence: 8.3% failure rate on large repos vs. 1.2% on small repos
     Proposal: Add pagination or streaming for large repo analysis

  3. [Medium confidence: 0.65] JSON output is available but rarely used
     Evidence: --json flag used in only 3% of runs
     Proposal: Improve JSON output discoverability (mention in help text)

  4. [Low confidence: 0.41] Some users run giti in CI pipelines
     Evidence: 12 runs from non-interactive terminals detected
     Proposal: Add CI-specific output mode (machine-readable, no color)

New proposals generated: 2 (signals 1 and 2 met evidence threshold)
Proposals saved to: .organism/growth-proposals/

Next: Proposals will be reviewed by Immune System, then scheduled by Prefrontal Cortex
```

---

## Updated Lifecycle Cycle

With Growth Hormone added, the cycle gains one new phase between PLAN and BUILD:

```
SENSE → PLAN → GROW → BUILD → DEFEND → COMMIT → REFLECT
```

The GROW phase:
1. Growth Hormone analyzes telemetry
2. Generates proposals if signals are strong enough
3. Immune System reviews proposals at the proposal level
4. Approved proposals join the backlog as Tier 5 items
5. Prefrontal Cortex may select them in the current or future cycle

Growth Hormone runs every cycle but only generates proposals when it has strong signals. Most cycles will produce zero proposals. This is correct — growth should be infrequent and deliberate.

Update the orchestrator (`cycle.ts`) to include the GROW phase.

---

## TELEMETRY.md

Create a `TELEMETRY.md` file in the project root that users can read to understand exactly what's collected. Be completely transparent:

```markdown
# giti Telemetry

## What We Collect

giti can optionally collect anonymous usage data to help the tool improve itself.

### Data Points
- Which command was run (pulse, hotspots, ghosts)
- Which flags were used
- How long the command took
- Whether it succeeded or failed (error class only, never the message)
- General repo characteristics (commit count bucket, not exact numbers)
- OS platform and Node.js version
- giti version

### What We NEVER Collect
- Repository names, URLs, or file paths
- Commit messages, branch names, or author information
- File contents or code
- Anything that could identify you or your project

## How to Control It

giti asks once on first run. You can change your preference anytime:

- `giti telemetry on` — enable collection
- `giti telemetry off` — disable collection
- `giti telemetry show` — see exactly what's been collected
- `giti telemetry clear` — delete all collected data

## How It's Used

The telemetry data stays on your machine. giti's Growth Hormone agent
reads it locally to understand usage patterns and propose improvements.
No data is transmitted anywhere.

## Why It Matters

giti is a living codebase — it evolves autonomously. Telemetry is how
it learns what you actually need versus what it thinks you need.
Without telemetry, it evolves blind. With it, every improvement is
grounded in real usage.
```

---

## Testing Strategy

### Growth Hormone Tests
- Test signal analysis with fixture telemetry data containing known patterns
- Test proposal generation produces valid proposals
- Test boundary checking catches forbidden zone violations
- Test redundancy detection against mock Memory with previous proposals
- Test evidence threshold enforcement (proposals without sufficient signals are rejected)

### Telemetry Tests
- Test event collection includes all required fields
- Test anonymizer strips all identifying information
- Test that repo characteristics are bucketed (never exact values)
- Test that telemetry is silently skipped when disabled
- Test that telemetry errors never crash the main command
- Test `giti telemetry show` and `giti telemetry clear`

### Simulator Tests
- Test repo generation creates repos with expected characteristics
- Test scenario execution produces valid telemetry events
- Test pattern injection produces expected distribution (pulse 3x more common, etc.)

### Integration
- Test the full GROW phase: telemetry → signal analysis → proposal → Immune review
- Test that approved proposals appear as Tier 5 work items in the next cycle plan
- Test that rejected proposals are recorded in Memory with reasons

---

## Definition of Done

Sprint 3 is complete when:

1. Telemetry system collects usage events on all commands (when opted in)
2. `giti telemetry` commands work (on/off/status/show/clear)
3. TELEMETRY.md is complete and accurate
4. Telemetry never crashes main commands (silent failure)
5. Simulator generates realistic synthetic telemetry across diverse repo types
6. Growth Hormone analyzes telemetry and detects growth signals
7. Growth Hormone generates evidence-based proposals via Claude API
8. Proposals pass through self-check (boundaries, evidence, redundancy)
9. Immune System reviews proposals at the proposal level
10. Approved proposals become Tier 5 work items in the Prefrontal Cortex
11. Lifecycle cycle includes the GROW phase
12. All tests pass with 80%+ coverage

## What NOT To Do

- Do not add remote telemetry reporting. Everything stays local for now.
- Do not let the Growth Hormone generate code directly. It generates proposals. The Motor Cortex writes the code.
- Do not bypass the Immune System for growth proposals. Everything gets reviewed.
- Do not generate more than 2 proposals per cycle. Quality over quantity.
- Do not use telemetry in non-anonymized form anywhere. Always go through the anonymizer.
- Do not make telemetry opt-out. It must be opt-in with an explicit prompt.
