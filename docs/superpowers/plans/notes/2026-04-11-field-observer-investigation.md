# Field Observer Plan — Investigation Notes (2026-04-11)

Task 1 of `docs/superpowers/plans/2026-04-11-field-observer-backend.md`. Purpose:
verify the plan's hypothesis that the prioritizer is **not** structurally broken
before any code gets written. If the hypothesis holds, Plan A proceeds as written;
if not, Plan A pauses and a planner-rebuild plan is filed first.

## Cycle probe results

- **Command run (primary, per plan step 2):**
  `node packages/giti/dist/index.js cycle 2>&1 | tee /tmp/giti-cycle-probe.log`
  (The plan referenced `dist/cli/giti.js` and `--dry-run`; the actual CLI entry is
  `dist/index.js` per `packages/giti/package.json` `bin.giti`, and `cycle` has no
  `--dry-run` flag — only `--json`, `--path`, `--supervised`. Ran without `--dry-run`
  as the plan instructed.)

- **Outcome:** The `cycle` command exited immediately at the API-key guard in
  `packages/giti/src/cli/cycle.ts:8-11`:

  ```
  ANTHROPIC_API_KEY environment variable is required for giti cycle
  ```

  No cycle was actually run, so `plan.selected_items.length` and the backlog
  fallback at `cycle.ts:59-74` are **not observable** from the `cycle` command
  alone. This is the "key not set" branch the plan explicitly said to record as
  a finding.

- **Secondary probe (to get real planner output without needing the key):** the
  `plan` command exercises `runPrefrontalCortex` directly and supports `--dry-run`
  and does NOT require `ANTHROPIC_API_KEY`. This is the same function the cycle
  calls at `cycle.ts:55`, so its output is a faithful observation of what the
  planner would hand to the cycle:

  `node packages/giti/dist/index.js plan --dry-run --json 2>&1 | tee /tmp/giti-plan-probe.log`

  Result:
  - `selected_items.length`: **1**
  - `deferred_items.length`: **35**
  - selected item: `[T1 s=90] Fix failing tests (status=planned)`
  - deferred tier distribution: `{ '2': 1, '3': 34 }`
  - `estimated_risk`: `medium`
  - `rationale`: `"Standard prioritization based on tier and priority score"`
  - `action_recommendations[0]`: template `regression-cluster-draft-stabilization-plan`,
    risk `low`, score 45.99

  This means: when the cycle *would* run, it would receive a plan with exactly one
  planned Tier-1 item ("Fix failing tests") and would hit the BUILD phase, not the
  `selected_items.length === 0` stable-exit branch. **The backlog fallback at
  `cycle.ts:59-74` would not even be reached on this worktree**, because the
  planner returned non-empty.

- **plan.selected_items.length (observed via `plan --dry-run`):** 1 (non-empty).
- **Backlog fallback:** Not reached in this probe, because the planner's direct
  output was already non-empty. Not observable from the `cycle` run because of
  the API-key gate.

- **Raw tail of output log (`/tmp/giti-plan-probe.log`, last ~20 lines):**

  ```json
          "packages\\livingcode-core\\src\\schema\\validator.ts:validateOrganismConfig(33) complexity is under 15"
        ]
      }
    ],
    "rationale": "Standard prioritization based on tier and priority score",
    "estimated_risk": "medium",
    "memory_consulted": false,
    "action_recommendations": [
      {
        "template_id": "regression-cluster-draft-stabilization-plan",
        "template_version": 1,
        "score": 45.99,
        "rationale": [
          "triggered:1",
          "metric_lt"
        ],
        "risk": "low"
      }
    ]
  }
  ```

  And from `/tmp/giti-cycle-probe.log`:

  ```
  ◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
  ANTHROPIC_API_KEY environment variable is required for giti cycle
  ```

## Backlog dir state

- **Exists (before probe):** no. `.organism/` did not exist in the worktree at all.
- **Exists (after probe):** `.organism/state-reports/` was created by the sensory
  cortex during the `plan --dry-run` invocation; `.organism/backlog/` was **not**
  created, which is expected behavior for `--dry-run` (see
  `packages/giti/src/agents/prefrontal-cortex/index.ts:123-129` — `saveCyclePlan`
  and `saveWorkItem` are gated on `!dryRun`).
- **Files in `.organism/backlog/`:** none (directory does not exist).
- **Sample content:** N/A — no items to sample.

Implication: there is no pre-existing, manually-seeded backlog in this worktree,
so the fallback at `cycle.ts:59-74` has nothing to find here either way. The
planner's direct output is what would drive the cycle.

## Planner code reading

**`generateWorkItems(stateReport, config, kb)`** in
`packages/giti/src/agents/prefrontal-cortex/prioritizer.ts:71-284`: a pure function
that walks the state report and emits zero-or-more `WorkItem`s across tiers 1-3.
Each tier check is guarded by a specific condition from the state report
(`vulnerable_count > 0`, `lint_error_count > 0`, `test_pass_rate < 1`, performance
budgets, coverage floor, critical anomalies, outdated non-major packages, files
over length limit, functions over complexity limit). If none of those conditions
trigger, it legitimately returns `[]` — this is exactly the "clean codebase returns
empty" behavior the plan's hypothesis assumes.

**`prioritizeItems(items, maxItems, inCooldown)`** in `prioritizer.ts:307-342`:
filters to Tier 1-2 when in cooldown, sorts ascending by tier and descending by
`priority_score` within tier, slices the top `maxItems`, mutates selected items'
`status` to `'planned'`, and returns `{ selected, deferred }`. It does not fail
and does not return `undefined` for non-empty input; it will return
`{ selected: [], deferred: [] }` if and only if `items` is empty.

**`runPrefrontalCortex(repoPath, stateReport, dryRun=false)`** in
`packages/giti/src/agents/prefrontal-cortex/index.ts:32-133`: orchestrates the
whole planner flow — loads `organism.json`, knowledge base, existing backlog
(`status === 'proposed'` only), cooldown state; calls `generateWorkItems`;
optionally appends approved growth proposals as Tier-5 items via
`generateGrowthItems`; de-dupes by title similarity; calls `prioritizeItems`;
computes `estimated_risk`; calls `planActions`; assembles the `CyclePlan`; and
(unless `dryRun`) persists the plan and any newly-deduped items to
`.organism/backlog/` via `saveCyclePlan` / `saveWorkItem`. Returns the plan to
the caller.

**`cycle.ts:59-74` backlog fallback**: after the planner is called, if
`plan.selected_items.length === 0`, the cycle reads every `*.json` file in
`.organism/backlog/`, parses each as a `WorkItem`, and pushes any with
`status === 'planned'` into `plan.selected_items`. This is a manual-seed escape
hatch — someone can hand-write or pre-set items to `planned` status on disk and
the cycle will pick them up even if the planner didn't generate anything this
cycle. It is wrapped in a try/catch that silently ignores a missing directory
or read errors. If it finds nothing (or the dir is missing), the cycle then
records `cycle-complete` with outcome `stable` and returns.

## Verdict

**Prioritizer is NOT structurally broken — it returns empty correctly when the
state report has nothing to flag, and it returns non-empty correctly when the
state report has something to flag.**

Evidence:

1. On this worktree, the sensory cortex reported a degraded state
   (`test_pass_rate: 0.0` — likely the worktree has not been warmed up to run
   tests, so the collector's measurement returned zero). The prioritizer
   responded by creating a Tier-1 "Fix failing tests" work item, selecting it,
   flipping its status to `'planned'`, deferring 35 other Tier-2/3 items, and
   returning a well-formed `CyclePlan`. That end-to-end path through
   `generateWorkItems` → `prioritizeItems` → `runPrefrontalCortex` completed
   successfully and produced exactly the structure the cycle expects.
2. The code in `prioritizer.ts:71-284` is straightforward and has no
   short-circuit that would silently drop items — every branch that detects a
   condition calls `items.push(createItem(...))` and returns the accumulated
   list. There is no mutation that would leak across calls, no unresolved
   promise, no async bug.
3. The "stable exit" branch at `cycle.ts:78-81` is reached only when both the
   planner AND the backlog fallback return empty. On a genuinely clean codebase
   (zero vulnerabilities, zero lint errors, 100% test pass rate, coverage above
   floor, no critical anomalies, no performance budget breaches, no outdated
   non-major packages, no oversized files, no overcomplex functions, no approved
   growth proposals, no manually-seeded backlog with `status: 'planned'`), this
   outcome is the correct and intended behavior — the organism has nothing to
   do this cycle. That is what the user's background feedback described as
   "the planner never selects items, backlog seeding not working", but that
   feedback describes a clean-codebase ambient state, not a structural bug. If
   and when the codebase drifts (new test failure, new vulnerability, new
   outdated package), the planner will start selecting items again with no code
   changes required.

Two adjacent observations worth recording but not blockers:

- The Field Observer plan references a CLI entry path `dist/cli/giti.js` that
  does not exist — the real entry is `dist/index.js` per `package.json:6-8`. This
  is just a documentation typo in the plan's task text; the probe still worked.
  Flag for future tasks that reference the CLI path.
- The worktree's state report shows `test_pass_rate: 0.0`, even though the
  caller told us baseline tests pass 801/801 in `packages/giti`. This is almost
  certainly a sensory-cortex-in-a-worktree quirk (the collector probably runs
  `npm test` from the worktree and something about the worktree state yields 0),
  not a planner bug. It is outside Task 1's scope but is relevant context for
  anyone reading the worktree's `.organism/state-reports/` dump. Not a reason
  to pause the plan.

## Decision

- [x] **PROCEED with Plan A as written**
- [ ] PAUSE — file separate planner-rebuild plan first

The hypothesis holds. The prioritizer is not structurally broken, and the "planner
selects nothing" case is a content problem (state report has nothing to flag),
not a structural bug. Plan A's architectural choice to run the Field Observer as
a pre-phase completely decoupled from the work-item/backlog system is still the
right call for the stated goal (observe an external repo without polluting the
planner's work queue), but it is no longer a workaround for a broken planner —
it is simply a clean separation of concerns. Proceed to Task 2.
