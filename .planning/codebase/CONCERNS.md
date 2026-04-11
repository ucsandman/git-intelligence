# Codebase Concerns

**Analysis Date:** 2026-04-11

## Critical Issues

### DashClaw Governance Dead Code

**Issue:** Governance integration wired but never executes

**Files:** `packages/giti/src/agents/orchestrator/cycle.ts` (lines 135–170)

**Problem:** Phase 4.5 (DashClaw governance) initializes an empty `governedBranches` array, then checks `if (isGovernanceEnabled() && governedBranches.length > 0)` on line 137. Since the array is always empty at that point, the entire governance check loop never runs, even when DashClaw is configured. The branches that should be routed through DashClaw never are.

**Impact:** BLOCKING
- DashClaw configuration is silently ignored
- All code changes bypass governance guardrails when DashClaw is configured
- Approved/supervised merges proceed without DashClaw's guard/approval logic
- Loses human-in-the-loop control that DashClaw governance provides

**Fix approach:**
1. Change line 137 from `if (isGovernanceEnabled() && governedBranches.length > 0)` to check `approvedBranches` instead: `if (isGovernanceEnabled() && approvedBranches.length > 0)`
2. Populate `governedBranches` from DashClaw results in the loop (currently done, but loop never runs)
3. Add integration test to ensure governance is called when configured

---

### Motor Cortex Patch Validation Gap

**Issue:** Unsafe patch content handling from managed agents

**Files:** `packages/giti/src/agents/motor-cortex/implementer.ts` (lines 173–206), `packages/giti/src/agents/motor-cortex/index.ts` (lines 60–107)

**Problem:** Patch content is captured from agent tool output by looking for `diff --git` or `From ` prefix, but there is no validation that:
- The patch only modifies allowed file paths (should respect `packages/giti/src/` and `packages/giti/tests/` boundaries)
- The patch doesn't contain malicious hunks (e.g., credential exfiltration in commit messages)
- The patch applies cleanly with `git am --3way` before switching to main branch

The fallback to `git apply --3way` after `git am` failure has its own risk: it doesn't create a commit, requiring manual commit logic that could diverge from agent intent.

**Impact:** HIGH
- Agent could craft patch that modifies forbidden files (organism.json, .env, etc.)
- Patch content is trusted without validation
- If patch partially fails, working directory could be left in inconsistent state
- No audit trail of what patch was actually applied vs. what agent claimed

**Fix approach:**
1. Parse the patch content as unified diff format before applying
2. Validate each hunk targets only allowed paths using boundary validation
3. Reject patches that modify forbidden files
4. Use explicit `--index` and `--check` flags with `git apply` to validate before applying
5. Write captured patch to `.organism/audit-log.jsonl` for forensics

---

### Secret Handling in Console Logs

**Issue:** Potential credential leakage in error messages

**Files:** `packages/giti/src/agents/motor-cortex/implementer.ts` (lines 78, 95, 120, 149, 170, 186, 194–195, 215, 238)

**Problem:** When motor cortex encounters errors (e.g., `git am` fails, session creation fails), error messages are logged via `console.log()`. If these errors contain:
- GitHub token in HTTP headers
- DashClaw API key in request payloads
- Anthropic API key in error context

...they will be visible in CI logs and `.organism/` audit trails.

The `implementWithAgent` function specifically logs:
- Line 144: "GITHUB_TOKEN or GH_TOKEN environment variable required" (exposes var name but not value)
- Line 215: Session errors from Anthropic API (could contain auth context)
- Line 278: Generic error catch logs full error (may include request details)

**Impact:** MEDIUM
- Secrets may appear in build logs if exceptions occur
- `.organism/` audit logs are not .gitignored and could be committed
- Error messages from external APIs may contain sensitive request details

**Fix approach:**
1. Add secret sanitizer utility that strips known env var patterns from error messages
2. Never log raw error objects; extract safe message text only
3. Use structured error logging with separate `error.context` field excluded from console
4. Ensure `.organism/audit-log.jsonl` is in `.gitignore` alongside `.env`
5. Add pre-commit hook to detect secrets in audit logs

---

### Patch File Cleanup Race Condition

**Issue:** Orphaned patch files if process crashes

**Files:** `packages/giti/src/agents/motor-cortex/index.ts` (lines 68, 82, 107)

**Problem:** Temporary patch file is created at `.organism/temp-patch.patch` but cleanup is wrapped in `.catch(() => {})` handlers. If the process crashes or OOM killer terminates it between patch creation and cleanup:
1. Temp patch file is left on disk
2. Contains raw git format-patch output with commit messages
3. Gets included in `.organism/` directory (which may be backed up)
4. No mechanism to clean up stale patch files

**Impact:** MEDIUM
- Disk space leak over many cycles
- Temp patches accumulate in `.organism/`
- Patch files contain code diffs and commit history unencrypted on disk

**Fix approach:**
1. Use a cleanup handler in `finally` block, not just catch
2. Use randomized temp directory (`/tmp` or `${process.tmpdir()}`) instead of `.organism/`
3. Add .gitignore rule to exclude any `.patch` files from being committed
4. Add periodic cleanup task to cycle orchestrator for stale temp files

---

## Known Bugs

### Planner Never Selects Items (Confirmed from Project Memory)

**Issue:** Prefrontal cortex generates work items but planner never marks them as 'planned'

**Files:** `packages/giti/src/agents/prefrontal-cortex/index.ts` (lines 77–79), `packages/giti/src/agents/prefrontal-cortex/prioritizer.ts` (lines 307–342)

**Symptoms:** 
- `plan.selected_items.length === 0` even when work items exist
- Organism cycles complete with `stable` outcome instead of `productive`
- Backlog fallback on line 59–74 of `cycle.ts` sometimes picks up items, but not reliably

**Root cause:** Likely one of:
1. Priority scoring algorithm produces scores below threshold
2. Cooldown filtering removes all Tier 3+ items unexpectedly
3. Duplicate detection (`isTitleSimilar`) is too aggressive and deduplicates legitimate items
4. Max items per cycle is set to 0 in config

**Trigger:** Run `giti cycle` on clean repo with quality issues that should generate Tier 1 items

**Workaround:** Manually seed backlog items with `status: 'planned'` (lines 59–74 demonstrate this works)

**Priority:** CRITICAL — blocks organism from making progress

---

### Motor Cortex Post-Patch Validation Optimistic

**Issue:** Returns `success: true` without verifying patch actually applied

**Files:** `packages/giti/src/agents/motor-cortex/index.ts` (lines 120–133)

**Problem:** After `git am` or `git apply` succeeds, code immediately returns success status and sets:
- `pre_review_check: { lint_clean: true, tests_pass: true, builds: true }` (hardcoded to true!)
- No re-run of lint, tests, or build to validate post-patch state

This means if the patch applies but breaks tests or introduces lint errors, the immune system review gets false-positive test results.

**Impact:** MEDIUM
- Immune system may approve changes that actually break the build
- Test pass rate reported as true but tests may fail
- Motor cortex claims success when changes are actually broken

**Fix approach:**
1. After patch applies, run `npm run lint` and capture exit code (in managed agent session, if available)
2. Run `npm test` in managed agent to get real test results
3. Update `pre_review_check` with actual results
4. Return failure if any check fails, don't force success

---

## Security Considerations

### GitHub Token Scope Validation Missing

**Issue:** Motor cortex requires GitHub token but doesn't validate scope

**Files:** `packages/giti/src/agents/motor-cortex/implementer.ts` (lines 135–145)

**Risk:** If GitHub token is missing, code returns error (correct). But it doesn't check:
- Token actually has `contents:write` permission (needed for patch application)
- Token isn't over-scoped (should use fine-grained PAT, not personal access token)
- Token isn't expired or revoked

If token is under-scoped, motor cortex will fail silently during session creation or patch application.

**Recommendation:**
1. Validate token scope on startup (check `octokit.users.getAuthenticated()` and inspect `role`)
2. Document required scope in error message and README
3. Add health check command to validate GitHub token before running cycles

---

### DashClaw API Key Not Validated

**Issue:** `DASHCLAW_API_KEY` is used but never validated

**Files:** `packages/giti/src/integrations/dashclaw/governance.ts` (lines 45–49, 64–66)

**Risk:** If API key is invalid, malformed, or missing:
- Code silently returns `null` from `getDashClawConfig()`
- Governance is disabled without warning
- No indication to user that DashClaw is not protecting the organism

**Recommendation:**
1. Test DashClaw connectivity on `giti organism start` with a heartbeat call
2. Raise error if DashClaw is configured but unreachable
3. Add `--no-governance` flag to explicitly opt out of DashClaw

---

### Managed Agent System Prompt Not Sandboxed Enough

**Issue:** System prompt allows agent to modify `package.json` for "security fixes"

**Files:** `packages/giti/src/agents/motor-cortex/implementer.ts` (lines 22–27)

**Problem:** Line 25 says "For security fixes: you MAY modify package.json files". This is over-broad:
- Agent could modify monorepo `package.json` (not just giti)
- Agent could remove security-sensitive packages as "fix"
- No verification that change is actually a security fix vs. intentional weakness introduction

**Recommendation:**
1. Restrict to `packages/giti/package.json` only, with explicit paths
2. Require `npm audit` to show actual vulnerabilities fixed before approving
3. Use immune system to verify vulnerabilities are actually resolved post-patch

---

## Performance Bottlenecks

### Schema.ts File Exceeds Quality Limit

**Issue:** Monolithic action schema validator file is too large

**Files:** `packages/giti/src/agents/actions/schema.ts` (478 lines)

**Problem:** Single file handles validation for:
- Action templates (lines 99–200+)
- Action instances (lines 200+–300+)
- Predicates, constraints, triggers (lines 300+–400+)
- Effects, rollbacks, steps (lines 400+–478)

Exceeds organization.json limit of 300 lines per file. Makes testing harder, increases cyclomatic complexity, harder to reason about validation logic.

**Recommendation:**
1. Split into separate validator files:
   - `action-template-validator.ts`
   - `action-instance-validator.ts`
   - `predicate-validator.ts`
2. Each should be <250 lines
3. Keep schema.ts as re-export barrel file

---

### Cycle.ts is Large and Complex

**Issue:** Orchestrator cycle function is doing too much

**Files:** `packages/giti/src/agents/orchestrator/cycle.ts` (344 lines)

**Problem:** Single function handles:
- Phase 1: Sensory cortex (lines 48–51)
- Phase 2: Prefrontal cortex (lines 53–81)
- Phase 2.5: Growth hormone (lines 83–94)
- Phase 3: Motor cortex (lines 96–112)
- Phase 4: Immune review (lines 114–133)
- Phase 4.5: DashClaw governance (lines 135–170)
- Phase 5: GitHub/local merge (lines 172–230)
- Phase 6: Reflect/regression (lines 232–252)

High cyclomatic complexity makes it hard to test phases in isolation. Any change to one phase risks others.

**Recommendation:**
1. Extract each phase into separate function: `runSensePhase()`, `runPlanPhase()`, etc.
2. Keep orchestration in `runLifecycleCycle()` but delegate to phase functions
3. Each phase function <100 lines, testable independently
4. Use explicit `CyclePhaseResult` type to pass state between phases

---

## Fragile Areas

### Memory-Based Lessons System Under-Tested

**Issue:** Knowledge base curator and lesson extraction not well validated

**Files:** `packages/giti/src/agents/memory/curator.ts` (195 lines), `packages/giti/src/agents/memory/fts.ts` (200 lines)

**Why fragile:**
- Lessons are extracted from cycle events using pattern matching (curator.ts)
- Memory queries use TF-IDF scoring (fts.ts) which can produce unexpected ranking
- No integration tests validating lesson extraction quality
- No validation that fragile file detection actually prevents regression

**Safe modification:**
- Always add integration tests before changing lesson extraction logic
- Test curator against real cycle events from actual runs (in test fixtures)
- Verify FTS search results match expected ranking for known queries

**Test coverage:**
- Unit tests for isolated functions exist
- Missing: end-to-end tests with seeded knowledge base and cycle history
- Missing: regression tests validating lessons actually prevent repeated bugs

---

### Patch Application Relies on Bash Tool Availability

**Issue:** Motor cortex assumes bash tool works; no fallback if tool fails

**Files:** `packages/giti/src/agents/motor-cortex/index.ts` (lines 70–75)

**Why fragile:**
- If `git am --3way` fails and `git apply --3way` fails, code force-cleans working directory
- Force clean could lose staged changes if branch creation partially succeeded
- No dry-run validation of patch before committing

**Safe modification:**
- Always test patch on throw-away branch first
- Use `git apply --check` to validate before `git apply` (idempotent)
- Test motor cortex against repo with merge conflicts in test suite

---

### Observable Snapshots Depend on .organism/ State Files

**Issue:** Observatory visualization reads from `.organism/` directory which is mutable during cycles

**Files:** `packages/giti-observatory/src/data/snapshot-builder.ts`, `packages/giti/src/cli/observatory.ts`

**Why fragile:**
- If snapshot is read while cycle is writing files, state may be partial
- No locking mechanism prevents reads during writes
- Snapshot path is configurable but validation isn't clear

**Safe modification:**
- Use atomic file operations with `.organism/` writes (write to temp, rename)
- Add snapshot versioning to detect stale reads
- Lock `.organism/active-cycle.json` during all writes

---

## Scaling Limits

### Knowledge Base Events Array Unbounded Growth

**Issue:** KB events array grows indefinitely, never pruned

**Files:** `packages/giti/src/agents/memory/store.ts` (line 21), `packages/giti/src/agents/memory/index.ts`

**Current capacity:** No limit. After 100 cycles with 10 events each = 1000 events in memory.

**Limit:** Once KB JSON file exceeds ~1MB, in-memory array operations (slicing, filtering) start to slow. FTS queries scan entire array.

**Scaling path:**
1. Add `max_events` config to organism.json (default 1000)
2. Implement ring buffer or pagination for old events
3. Archive events older than 30 days to separate JSON-lines file
4. Update FTS to index paginated events, not entire history

---

### Cycle History Could Consume Disk

**Issue:** Cycle history directory accumulates JSON files without cleanup

**Files:** `.organism/cycle-history/` (created by cycle orchestrator), `packages/giti/src/agents/orchestrator/cycle.ts` (line 258)

**Current capacity:** After 1000 cycles with 5KB result each = 5MB on disk. No cleanup configured.

**Limit:** File system limits, but more practically: listing 10,000+ files in `.organism/cycle-history/` becomes slow.

**Scaling path:**
1. Add cleanup policy: keep last 100 cycles, archive older ones
2. Use date-bucketed structure: `.organism/cycle-history/2026-04/cycle-42.json`
3. Implement `giti observatory prune` command to remove stale cycles

---

## Dependencies at Risk

### Simple-Git Version Pinned But May Have Issues

**Issue:** simple-git is used for all git operations but major version constraints are unclear

**Files:** `packages/giti/package.json` (dependency list)

**Risk:** If simple-git version is old, may not support:
- `--3way` flag on `git apply` (depends on git binary version)
- Managed agent filesystem cleanup with newer git

**Recommendation:**
1. Verify `simple-git` version supports all git flags used in motor-cortex
2. Add integration test with each supported git version
3. Document minimum git version requirement in README

---

### Anthropic SDK Managed Agents API is Beta

**Issue:** Motor cortex uses `client.beta.agents.*` API which is not stable

**Files:** `packages/giti/src/agents/motor-cortex/implementer.ts` (lines 80–93, 103, 150–159)

**Risk:** If Anthropic graduates or changes Managed Agents API:
- Code could break without warning
- Session creation, event streaming, resource mounting could change
- GitHub authorization mechanism could change

**Recommendation:**
1. Pin `@anthropic-ai/sdk` to specific version (not `^`)
2. Add changelog entry whenever SDK version is updated
3. Monitor Anthropic announcements for Managed Agents API changes
4. Have fallback implementation using regular Claude API (without managed agent)

---

## Missing Critical Features

### No Audit Trail for DashClaw Approvals

**Issue:** When DashClaw approves/blocks changes, decision is recorded to memory but not auditable

**Files:** `packages/giti/src/agents/orchestrator/cycle.ts` (lines 151, 157, 163), `packages/giti/src/integrations/dashclaw/governance.ts`

**Problem:** If DashClaw decision is later questioned (e.g., "why did you approve XYZ?"), there is:
- No persistent record of decision criteria
- No record of what signals DashClaw evaluated
- No timestamp of approval in audit log

**Recommendation:**
1. Write full DashClaw decision (request, response, signals) to append-only audit log
2. Include action ID, timestamp, work item ID, decision outcome
3. Store in `.organism/audit-log.jsonl` as JSON-line entry

---

### No Cooldown Validation Against API Budget

**Issue:** Cooldown can be set independently of API budget exhaustion

**Files:** `packages/giti/src/agents/orchestrator/safety.ts` (lines 29–50, 110–142)

**Problem:** Two independent stop mechanisms:
1. Cooldown (48h after regression)
2. API budget exceeded

If API budget is exhausted, organism can't run motor cortex but could still try. No indication that budget is the blocker.

**Recommendation:**
1. Add `budget_exhausted_until` separate from cooldown
2. Display budget status in `giti organism status`
3. Emit memory event when budget resets monthly
4. Warn if cycles are running while budget is near limit (80%)

---

### No Regression Cluster Detection

**Issue:** Multiple regressions in sequence are treated independently

**Files:** `packages/giti/src/agents/orchestrator/cycle.ts` (lines 277–282), `packages/giti/src/agents/actions/builtins/regression-cluster-draft-stabilization-plan.ts`

**Problem:** If a work item causes 3 consecutive regressions, each triggers 48h cooldown. Organism pauses for 48h, then tries same item again and regresses again.

No mechanism to:
- Detect regression cluster (same item failing repeatedly)
- Blacklist specific work items after N regressions
- Create stabilization action to debug root cause

**Recommendation:**
1. Track regression causes in memory (file modified, error pattern)
2. If same cause regresses 2x, add work item to blacklist
3. Generate stabilization plan action (documented in schema) to investigate

---

## Test Coverage Gaps

### Motor Cortex Patch Application Not Integration Tested

**Issue:** Patch application (git am / git apply) is tested with mocks, not real patches

**Files:** `packages/giti/tests/agents/motor-cortex/` (test directory)

**What's not tested:**
- Actual `git am` with real patch format
- Merge conflict handling (does --3way actually work?)
- Fallback from `git am` to `git apply` behavior
- Cleanup of temp patch files in failure scenarios
- Working directory state after failed patch

**Risk:** Motor cortex could fail silently in production with real patches

**Priority:** HIGH — motor cortex is critical path for organism self-modification

---

### Governance Integration Tests Missing

**Issue:** DashClaw governance code has no tests validating it's called correctly

**Files:** `packages/giti/src/integrations/dashclaw/governance.ts` (entire file), `packages/giti/tests/integrations/dashclaw/` (likely empty or minimal)

**What's not tested:**
- Guard decision routing (allow vs. block vs. approval)
- Approval wait loop with timeout
- Action outcome recording
- Error handling when DashClaw is unreachable

**Risk:** Dead governance code (as found in this analysis) would not be caught by tests

**Priority:** HIGH — governance is security-critical

---

### No End-to-End Cycle Test with Real Repo

**Issue:** Cycle tests use mock state reports and hand-rolled work items

**Files:** `packages/giti/tests/agents/orchestrator/` (test directory)

**Missing:** Single test that:
1. Creates real git repo with files
2. Runs full cycle (sense→plan→build→review→commit)
3. Verifies changes are applied to repo
4. Validates memory events are recorded
5. Checks `.organism/` state is consistent

**Risk:** Cycle orchestration bugs only found in production (like planner never selecting items)

**Priority:** MEDIUM — would have caught planner bug early

---

## Summary by Severity

**CRITICAL (Fix immediately):**
1. DashClaw governance dead code (security)
2. Planner never selects items (blocks organism)

**HIGH (Fix within sprint):**
1. Motor cortex patch validation gap (self-modification safety)
2. Motor cortex post-patch validation optimistic (false positives)
3. Governance integration tests missing (security)

**MEDIUM (Fix soon):**
1. Secret handling in console logs (accidental leakage)
2. Patch file cleanup race condition (disk leak)
3. Schema.ts file size (maintainability)
4. Motor cortex patch relies on bash tool (fragility)
5. End-to-end cycle test missing (validation)

**LOW (Fix when refactoring):**
1. Cycle.ts is large (maintainability)
2. GitHub token scope not validated (operational safety)
3. DashClaw API key not validated (operational safety)
4. Knowledge base events unbounded growth (scaling)
5. Cycle history disk consumption (scaling)

---

*Concerns audit: 2026-04-11*
