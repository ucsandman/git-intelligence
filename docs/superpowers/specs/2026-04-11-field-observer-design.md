# Field Observer — Design Spec

**Date:** 2026-04-11
**Status:** Draft (pending user review)
**Repo:** `git-intelligence` (giti)
**One-liner:** Teach `giti` to watch `Practical Systems`, publish a daily field report, and finally run the cycle end-to-end. The organism becomes an observer rather than a self-groomer.

---

## 1. Context and motivation

`giti` is a self-building codebase organism across 5 sprints. It has a sensory cortex, immune system, memory, planner, motor cortex, orchestrator, Growth Hormone, and a 3D Observatory terrarium. What it does not have is:

1. **A reason to do anything for anyone other than itself.** Every analyzer it runs points at its own code.
2. **Transparency to the outside.** It has an audit log but nothing is published.
3. **A working cycle.** The planner never selects items and backlog seeding is broken, so the loop is stuck.

This design fixes all three at once through a single narrow change: give `giti` *one* external target, teach it to observe that target, and publish what it sees. The target is `Practical Systems` — the user's most actively developed parallel project. The metric is "hours saved / unblocked" on that target.

This spec is also the initial `PROJECT.md` answer for the question *"what should the organism become?"*: **a running, publicly-auditable demonstration of a one-person automation loop whose target function is explicitly pointed at someone other than the owner.**

Out of scope for this spec (but in scope for the bigger arc):
- Multi-target observation
- Publishing reports externally (still stays under `.organism/`)
- Motor cortex writing to Practical Systems
- Full planner rebuild
- DashClaw-governed auto-merge for external repos

## 2. Goal and success criteria

**Goal:** Every `giti` cycle produces a fresh field report about Practical Systems, written to disk, surfaced in the Observatory, and narrated by Claude. The cycle runs end-to-end without getting stuck on an empty backlog.

**Success criteria:**

1. `giti cycle` runs to completion (all phases execute, no stuck states).
2. A fresh markdown + JSON field report appears at `.organism/field-reports/practical-systems/<timestamp>.{md,json}` after every cycle.
3. The Observatory renders a new "observer at the window" scene that visibly reflects the latest field observation and the current observer mood.
4. 80%+ test coverage on new code.
5. Running the cycle twice in a row does not crash, duplicate the seeded item, or produce malformed reports.

**Not success criteria (explicitly):**
- `giti` ships a single line of code to Practical Systems
- Any field report is published outside the repo
- The motor cortex does anything useful

## 3. Alternatives considered

| Approach | Why not |
|---|---|
| **Multi-repo organism refactor** | Proper long-term architecture, but a weeks-long refactor with state migrations. Violates the "first rung / ship this week" constraint. Good candidate for a v2 phase. |
| **Dispatch-as-product** (reuse the content/dispatch pipeline instead of building a new subsystem) | Fast to ship, but shallow — reads like a commit-message rewrite. Routes *around* the broken cycle instead of fixing it, which loses the forcing function that gets the loop running. |
| **Chosen: Field Observer extension** | Reuses every analyzer, forces the cycle fix on the critical path, ships quickly, and leaves the motor cortex and sandbox untouched. |

## 4. High-level architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         giti (observer)                          │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ field-       │    │ orchestrator │    │ prefrontal-      │   │
│  │ observer     │◄──►│ cycle.ts     │◄──►│ cortex (planner) │   │
│  │ (NEW)        │    │ + OBSERVE    │    │ + backlog seeder │   │
│  │              │    │   phase      │    │   fix            │   │
│  └──────┬───────┘    └──────────────┘    └──────────────────┘   │
│         │ reads                                                  │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ .organism/   │    writes field reports                        │
│  │ field-       │────────────────────────────┐                   │
│  │ reports/     │                             │                   │
│  │   practical- │                             ▼                   │
│  │   systems/   │                      ┌──────────────┐           │
│  └──────────────┘                      │ observatory  │           │
│                                         │ (re-themed)  │           │
└────────────────────────────────────────│              │───────────┘
                                          │ observer +   │
       ┌──────────────────────────┐       │ window scene │
       │ C:\Projects\Practical    │◄──────│              │
       │ Systems (target, read-   │  reads│              │
       │ only)                    │       └──────────────┘
       └──────────────────────────┘
```

Three things move together:

1. **`field-observer/` subsystem** — new, at `packages/giti/src/agents/field-observer/`. Runs existing analyzers against an external repo. Never writes to the target. Writes field reports to `.organism/field-reports/<target-slug>/`.
2. **Cycle integration** — `orchestrator/cycle.ts` gets a new `OBSERVE_EXTERNAL` phase at the top, plus the smallest possible fix to unstick the planner.
3. **Observatory re-theme** — `packages/giti-observatory/` swaps its subject from *terrarium creature* to *cute observer at a window watching Practical Systems*. Same R3F stack.

## 5. Field Observer component

**Location:** `packages/giti/src/agents/field-observer/`

**Module layout:**

```
field-observer/
├── index.ts              ← public observe() entry point
├── target-config.ts      ← reads field_targets from organism.json
├── runner.ts             ← invokes existing analyzers with { path } flag
├── narrator.ts           ← Claude API call to compose narrative + derive mood
├── reporter.ts           ← atomic writes to .organism/field-reports/
└── types.ts              ← FieldTarget, FieldObservation, ObserverMood
```

**Public interface:**

```ts
// packages/giti/src/agents/field-observer/index.ts
export interface FieldTarget {
  slug: string;           // e.g. "practical-systems"
  path: string;           // absolute filesystem path
  enabled: boolean;
}

export type ObserverMood = 'curious' | 'attentive' | 'alarmed' | 'dozing';

export interface FieldObservation {
  target: string;              // slug
  targetPath: string;          // absolute path
  observedAt: string;          // ISO timestamp
  cycle: number;               // giti's cycle number
  pulse: PulseReport;          // from src/analyzers/pulse
  hotspots: HotspotsReport;    // from src/analyzers/hotspots
  ghosts: GhostsReport;        // from src/analyzers/ghosts
  senseState: StateReport;     // from sensory-cortex
  narrative: string;           // markdown, from narrator.ts
  mood: ObserverMood;          // derived
}

export async function observe(
  target: FieldTarget,
  context: CycleContext,
): Promise<FieldObservation>;
```

**Module responsibilities:**

- `target-config.ts` — reads `field_targets` array from `organism.json`. Validates each entry: path exists and is a directory, `.git` subdirectory present, `enabled: true`. Returns zero or more `FieldTarget` objects.
- `runner.ts` — invokes existing analyzers (`pulse`, `hotspots`, `ghosts`, `sensory-cortex`) via their programmatic APIs, not CLI. Each analyzer already accepts a `path` parameter. Collects results with a 30s per-analyzer timeout. Partial failure is recorded but does not abort the whole observation.
- `narrator.ts` — makes a Claude Haiku call with a cached system prompt (see section 7). Input is the structured observation (pulse, hotspots, ghosts, sense state). Output is a short markdown field note (~300 tokens) in the observer's voice. Derives `mood` from diff-vs-previous-observation. Falls back to a deterministic template narrative on API error.
- `reporter.ts` — writes `<timestamp>.md` (human-readable) and `<timestamp>.json` (machine-readable) atomically to `.organism/field-reports/<slug>/`. Writes to `.tmp` first, then renames.

**Mood derivation:**

```
curious    ← new commits / PRs / file changes since last observation
attentive  ← no new activity but state is healthy
alarmed    ← test regressions, coverage drop, new secrets flagged, or pulse < previous - 10
dozing     ← no activity across 3+ consecutive cycles
```

The previous observation is read from `.organism/field-reports/<slug>/latest.json` (a symlink-or-copy updated by the reporter after each write).

**`organism.json` additions:**

```json
{
  "field_targets": [
    {
      "slug": "practical-systems",
      "path": "C:\\Projects\\Practical Systems",
      "enabled": true
    }
  ],
  "narrator": {
    "enabled": true,
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 600,
    "cache_system_prompt": true
  }
}
```

Single target is hardcoded. Array shape is used so we can add more targets later without a schema change.

## 6. Cycle integration + planner unstick

### 6.1 New cycle phase

`orchestrator/cycle.ts` gains `OBSERVE_EXTERNAL` at the top of the phase list:

```
OBSERVE_EXTERNAL  ← NEW
SENSE
PLAN
BUILD
REVIEW
COMMIT
REFLECT
GROW
```

Reasoning: observation is read-only and safe, so it runs first even if later phases fail. The observation is attached to the cycle context so `SENSE`, `REFLECT`, and `MEMORY` can reference it.

If `field_targets` is empty or all entries are disabled, the phase is a no-op with a log line and zero cost.

### 6.2 Planner unstick (scope-limited)

Known issue from memory: "planner never selects items, backlog seeding not working." Scope for *this* plan is **not** a planner rebuild. It is the minimum change that makes the existing planner pick *one* work item per cycle.

**Change 1 — Backlog seeder (new file):**

`packages/giti/src/agents/prefrontal-cortex/seeder.ts`

At cycle start, the seeder ensures the backlog contains an always-available synthetic work item:

```ts
{
  id: 'observe-field-targets',
  tier: 1,
  kind: 'built-in',
  always_available: true,
  description: 'Run field observation against configured targets',
}
```

This item is a no-op from the motor cortex's perspective — the `OBSERVE_EXTERNAL` phase is what actually fulfills it, before `PLAN` even runs. Its only purpose is to guarantee `prioritizer.ts` has something to pick, so the rest of the cycle doesn't dead-end.

The seeder is idempotent: if the item already exists it is not duplicated.

**Change 2 — Prioritizer bug hunt:**

Investigate `packages/giti/src/agents/prefrontal-cortex/prioritizer.ts` and find the specific reason it never picks items. Expected root causes (in decreasing likelihood based on known memory context):

1. A filter predicate that excludes all items
2. A tier comparison that always evaluates false
3. A backlog-file shape mismatch between writer and reader
4. An unhandled exception silently caught earlier in the planner chain

Fix the one thing that is actually broken. Do not rewrite.

**Known-unknown risk:** If the root cause turns out to be structural (the prioritizer needs a redesign), **this plan pauses**. A separate "planner-rebuild" phase is filed and this field-observer work blocks on it. The investigation is the first task in the plan so we learn cheap.

### 6.3 What does NOT change in the cycle

- Motor cortex (still sandboxed to `packages/giti/src/**`)
- Immune system logic
- Memory / knowledge base
- DashClaw governance hook (it already wraps Phase 4.5; the new phase sits earlier and does not need its own governance wiring)
- API budget tracking (narrator's Claude calls flow through the existing `.organism/api-usage.json` counter)

## 7. Narrator (Claude API)

`narrator.ts` calls the Anthropic API with prompt caching per the global `claude-api` skill conventions.

**Model:** `claude-haiku-4-5-20251001` by default. Overridable via `GITI_MODEL` env var (existing).

**System prompt (cached):**

Stable across cycles. Describes the observer character, establishes voice ("a patient, curious field researcher taking notes on a construction site across the street"), specifies output format (markdown, ~300 tokens, no code blocks, no preamble).

**User message (per call):**

Structured observation data (pulse/hotspots/ghosts/sense JSON) plus the previous field report's narrative so the observer can reference continuity ("yesterday's two hotspots are still there").

**Output:** markdown string placed directly into `FieldObservation.narrative`.

**Budget:** ~500 input tokens + ~300 output tokens per cycle = ~800 tokens × cycles/day. At Haiku rates this is effectively free. Counts against the existing `GITI_API_BUDGET` ceiling.

**Fallback:** on API error or network failure, `narrator.ts` produces a deterministic template narrative ("Observed PS at <time>. Pulse <n>. <hotspot count> hotspots. <ghost count> ghost branches."). The cycle never fails because the Claude API was unreachable.

## 8. Observatory re-theme: "The Observer at the Window"

Same R3F stack, new subject and staging. The terrarium creature becomes a cute scholar-character at a desk watching something happen through a window.

### 8.1 Scene layout

```
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │          ╭────────╮                             │
  │         │ window │    ← target site (PS)       │
  │         │ scene  │       - construction activity│
  │         │        │       - tiny workers = commits│
  │         │        │       - sirens = alarmed state│
  │          ╰────────╯                             │
  │   ╭───╮                                         │
  │   │ @ │← cute observer character (giti)         │
  │   ╰─┬─╯   mood = 4 states                       │
  │     │                                           │
  │  ┌──┴──────┐                                    │
  │  │notebook │ ← latest field report, "writing"   │
  │  │(pages)  │                                    │
  │  └─────────┘                                    │
  │     desk                                        │
  └─────────────────────────────────────────────────┘
```

### 8.2 Three layers

1. **Observer character (cute / storybook / whimsical).** Tiny round scholar figure at a desk. Inherits lighting and material work from the current creature. Four mood poses:
   - `curious` → leaning forward, pen to paper
   - `attentive` → seated upright, watching calmly
   - `alarmed` → hand on head, startled
   - `dozing` → slumped, eyes closed
2. **The window** — a scene-within-a-scene showing a stylized construction/workshop of Practical Systems. Activity inside the window is driven directly by `FieldObservation` data:
   - Each new commit → a small animated worker moving across the site
   - Hotspots → patches glowing red with rising smoke
   - Ghosts (abandoned branches) → faded silhouettes at the edges
   - Test health → overall window lighting (sunny = healthy, overcast = degrading)
   - Pulse score → number of active workers visible
3. **The notebook** — a persistent 3D book on the desk. When a new field report lands, pages flip and the narrator's markdown streams in line by line. Clicking zooms in and shows the full markdown report. This is the transparency artifact the observer *produces*.

### 8.3 Code changes

**Reused from current Observatory:**
- `packages/giti-observatory/src/components/terrarium/` → renamed `observer-scene/`; creature mesh, shaders, lighting, bloom, stars (now "outside the window")
- `src/data/` snapshot builder → extended to include `latestFieldReport` + `target` data
- `src/components/journal/GrowthJournal` → repurposed as the notebook view (same `CycleCard` pattern, different subject)
- `src/lib/scene-mapper.ts` → extended to map `FieldObservation.mood` → creature pose + window scene state
- SSE event stream, post-processing, day/night cycle

**New files:**
- `observer-scene/Desk.tsx` — desk + observer character staging
- `observer-scene/Window.tsx` — the window scene-within-a-scene
- `observer-scene/WindowActivity.tsx` — workers/hotspots/ghosts driven by field data
- `observer-scene/Notebook.tsx` — notebook with page-flip animation
- New pose animations on the existing rig (4 states)

**Removed from the main scene:**
- Terrarium flora, spores, weather effects, energy pool, fossil milestones (kept in git history, not destructively deleted)

## 9. Data flow — one cycle end-to-end

```
cycle #128 starts
  │
  ├── OBSERVE_EXTERNAL
  │    └── field-observer.observe({ practical-systems })
  │         ├── target-config: validate path, check .git, enabled
  │         ├── runner: pulse, hotspots, ghosts, sensory-cortex with 30s/ea timeout
  │         ├── narrator: Claude Haiku call with cached system prompt
  │         │     → "Two new hotspots surfaced in pipeline-tracker this morning.
  │         │        Both touch the dashclaw install path. Still no tests on the
  │         │        new requirements. Quiet otherwise."
  │         ├── mood derivation: curious (new hotspots vs yesterday)
  │         └── reporter: atomic write of 2026-04-11T0900.md + .json
  │                       + update latest.json symlink
  │
  ├── SENSE (FieldObservation now in cycle context)
  ├── PLAN (seeder guarantees non-empty backlog → prioritizer picks observe item)
  ├── BUILD (no-op for observation item)
  ├── REVIEW (no-op for observation item)
  ├── COMMIT (writes field report files only; no motor cortex work this cycle)
  ├── REFLECT (notes "observed PS, mood: curious")
  └── GROW (unchanged)

Observatory SSE stream fires → observer scene animates:
  - character leans forward, pen scratching on notebook (curious pose)
  - window shows new workers at two red-glowing patches (the hotspots)
  - notebook page flips, narrator text streams in line by line
```

## 10. Safety and error handling

**Safety rails:**
- Field observer is read-only by construction. `simple-git` usage is restricted to read-only operations (`log`, `status`, `diff`, `show`) — no `commit`, `push`, `checkout`, `reset`, etc.
- Target path existence is checked at cycle start. Missing path → phase logs a warning and is skipped. Never fails the cycle.
- Narrator API calls count against the existing `GITI_API_BUDGET` ceiling. Budget exhaustion triggers the deterministic-template fallback.
- DashClaw governance unchanged. The new phase sits before the existing Phase 4.5 hook and does not require new governance wiring.

**Error handling:**
- Each analyzer invocation has a 30s timeout (configurable). Timeout produces a partial observation with the missing analyzer noted. Not a cycle failure.
- Narrator failure (network error, HTTP error, timeout) falls back to a deterministic template narrative. Not a cycle failure.
- Reporter uses atomic write pattern (write `.tmp`, then rename). A crashed write cannot leave a half-report on disk.
- If the seeded observe item fails to execute, the failure is logged to `.organism/cycle-history/` but the cycle continues. Three consecutive seeded-item failures trigger the existing failure-counter safety system.

## 11. Testing

**Target:** 80%+ coverage on new code (matches organism.json standard).

**New tests:**

| Test file | Asserts |
|---|---|
| `field-observer/runner.test.ts` | Runs against fixture repo, produces expected pulse/hotspots/ghosts output, respects timeouts |
| `field-observer/narrator.test.ts` | Mocks Anthropic SDK; asserts prompt caching headers; asserts fallback narrative on API error |
| `field-observer/reporter.test.ts` | Atomic write; md+json pair; latest.json updated correctly |
| `field-observer/target-config.test.ts` | Missing path / disabled target / malformed config handled cleanly |
| `prefrontal-cortex/seeder.test.ts` | Seeded item appears in empty backlog; idempotent on re-run |
| `orchestrator/cycle.test.ts` (extended) | `OBSERVE_EXTERNAL` runs before `SENSE`; cycle completes end-to-end with seeded backlog |
| Observatory smoke test | `Window.tsx` and `Notebook.tsx` render without crashing given a mock `FieldObservation` |

**Fixtures:**
- `packages/giti/tests/fixtures/sample-practical-systems/` — small committed fixture repo with representative files, a handful of commits, at least one hotspot pattern, and one abandoned branch. Small enough to commit (a few hundred lines). Used by `runner.test.ts` and `reporter.test.ts`.

## 12. Open questions and risks

1. **Planner structural risk** — the prioritizer investigation is the first real task in the plan. If the root cause turns out to be structural, this plan pauses and a planner-rebuild phase blocks it. Cheap to discover early; expensive if discovered late.
2. **Fixture size vs. realism** — the `sample-practical-systems` fixture needs enough surface area for analyzers to produce meaningful output but small enough to commit without bloating the repo. Target: under 500 LOC across the fixture.
3. **Observatory aesthetic iteration** — the cute observer character will probably take multiple visual passes to land. First running version should prioritize "it moves and reflects real data" over "it is beautiful."
4. **Path handling on Windows** — `"C:\\Projects\\Practical Systems"` has a space in the path. Tests must cover path-with-space edge cases for the runner.
5. **Observation freshness** — if `giti` and the target are on the same filesystem, each cycle's observation is "live." If the target is ever behind on git fetch (e.g., user is mid-edit uncommitted), the observation reflects working-tree state. Document this behavior; don't try to solve it.

## 13. Evolution (what's next after this ships)

- **Rung 2: Advisor.** Growth Hormone proposes work items *for Practical Systems* (as reviewed backlog entries). Still read-only. Surfaces the "no clear direction" problem.
- **Rung 3: Contributor.** Motor cortex opens draft PRs against Practical Systems with doc / test / tiny-fix changes. Requires expanding motor cortex sandbox permissions. Several weeks of plumbing.
- **Rung 4: Autonomous maintainer.** Full loop with DashClaw-governed auto-merge for low-risk changes. End state, not first rung.
- **Multi-target refactor.** `.organism/<repo-name>/` state, multiple concurrent observations, Observatory shows multiple windows or multiple scenes.
- **Public ledger.** Field reports published externally (static site, feed, dispatch pipeline).

None of these are in scope for this plan. They are recorded here so the first running version is designed in a direction that does not block them.

---

*This spec was produced via `superpowers:brainstorming` on 2026-04-11.*
