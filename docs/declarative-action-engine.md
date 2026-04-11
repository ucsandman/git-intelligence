# Declarative Action Engine

`git-intelligence` now includes a declarative action engine inside [`packages/giti/src/agents/actions/`](../packages/giti/src/agents/actions/). It gives the organism a reusable workflow layer between planning and execution without allowing arbitrary generated code to run inside the lifecycle.

## Mental Model

The existing organism already had strong roles:

- `sensory-cortex` observes repository state
- `prefrontal-cortex` plans work items
- `motor-cortex` builds code changes
- `immune-system` reviews risk and quality
- `memory` stores events, lessons, and patterns

The action engine adds a new internal substrate:

- the planner can recommend reusable action templates
- the orchestrator can execute one guarded low-risk action before the normal build phase
- the runner executes only approved step types implemented in owned TypeScript code

Actions are data, not code. A template describes a workflow using structured step definitions and typed predicates. The actual execution logic lives in step executors you own.

## What Ships Today

The current release is intentionally narrow:

- built-in action templates only
- schema-validated templates and instances
- typed predicate evaluation for planning and gating
- file-backed action history under `.organism/actions/`
- immune-system policy review before side effects
- one end-to-end built-in action: `regression-cluster-draft-stabilization-plan`

That built-in action does the following:

1. reads current repo state
2. queries memory for fragile files and regression context
3. confirms regression pressure through a predicate
4. selects a bounded target set
5. generates a stabilization artifact
6. writes the artifact under `.organism/actions/artifacts/`
7. records a memory event
8. records a lesson back into organism memory

## Lifecycle Integration

The integration is additive. Normal work-item planning and build flow still exist.

During `giti plan`:

- the prefrontal cortex still produces `selected_items` and `deferred_items`
- it now also attaches `action_recommendations`

During `giti cycle`:

- the orchestrator inspects the ranked action recommendations
- if the top eligible action is `read_only` or `low` risk, it builds a concrete action instance
- the immune system reviews the action plan
- the action runs before the normal motor-cortex build phase
- if the action fails, the cycle records the failure and continues

This means the first release uses actions to augment the lifecycle, not replace it.

## Safety Boundaries

The action engine is ambitious, but it is not an unrestricted plugin system.

Current guardrails:

- templates are validated through a strict runtime schema
- only supported step types can execute
- `read_only` actions are rejected if they contain write-capable steps
- the immune system blocks action writes outside `.organism/`
- cooldown and kill-switch state can block action execution
- actions run through owned TypeScript executors, not arbitrary shell commands or generated modules

Explicitly not supported yet:

- arbitrary shell steps
- user-authored runtime code
- GitHub mutation steps through the action engine
- medium-risk or high-risk action execution in the lifecycle by default
- public CLI management commands for actions

## Runtime Files

The action engine writes its runtime state into `.organism/actions/`.

Current layout:

- `.organism/actions/index.json` — lightweight summary of recorded instances
- `.organism/actions/instances/<id>.json` — full action execution record
- `.organism/actions/artifacts/` — generated local artifacts from low-risk actions

The first built-in action also records related events and lessons through the existing memory system in `.organism/knowledge-base.json`.

## Key Modules

Core implementation lives in:

- [`packages/giti/src/agents/actions/types.ts`](../packages/giti/src/agents/actions/types.ts)
- [`packages/giti/src/agents/actions/schema.ts`](../packages/giti/src/agents/actions/schema.ts)
- [`packages/giti/src/agents/actions/planner.ts`](../packages/giti/src/agents/actions/planner.ts)
- [`packages/giti/src/agents/actions/runner.ts`](../packages/giti/src/agents/actions/runner.ts)
- [`packages/giti/src/agents/actions/history.ts`](../packages/giti/src/agents/actions/history.ts)
- [`packages/giti/src/agents/actions/builtins/regression-cluster-draft-stabilization-plan.ts`](../packages/giti/src/agents/actions/builtins/regression-cluster-draft-stabilization-plan.ts)
- [`packages/giti/src/agents/orchestrator/cycle.ts`](../packages/giti/src/agents/orchestrator/cycle.ts)
- [`packages/giti/src/agents/immune-system/index.ts`](../packages/giti/src/agents/immune-system/index.ts)

## Contributor Verification

If you change the action engine, start with the focused suite:

```bash
npm run test --workspace giti -- tests/agents/actions/schema.test.ts tests/agents/actions/history.test.ts tests/agents/actions/registry.test.ts tests/agents/actions/predicates.test.ts tests/agents/actions/planner.test.ts tests/agents/actions/runner.test.ts tests/agents/actions/builtins/regression-cluster.test.ts tests/agents/actions/integration/action-cycle.test.ts
```

Then run the broader package checks:

```bash
npm run test --workspace giti
npm run lint --workspace giti
```

## Next Likely Extensions

The current implementation is a foundation, not the final form.

Reasonable next steps:

- richer planner scoring from action outcome history
- more built-in actions
- medium-risk actions behind stronger approval policy
- public inspection/debugging commands for action instances
- curated human-authored templates once the internal model stabilizes
