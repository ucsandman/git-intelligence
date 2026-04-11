# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Anthropic Claude (Multiple entry points):**

- **Motor Cortex (Managed Agents)** - Code implementation engine
  - SDK: `@anthropic-ai/sdk` 0.86.1
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Entry point: `packages/giti/src/agents/motor-cortex/implementer.ts`
  - Model: Configurable via `GITI_MODEL` env var (default: `claude-sonnet-4-6`)
  - Capabilities: Creates sandboxed agents, provisions environments, runs with file access toolset
  - Return format: Git patches (captured as stdout, applied locally by orchestrator)
  - Safety: Max $0.50 per work item, max 15 agent turns, 48h cooldown after regressions

- **Growth Hormone (Messages API)**
  - SDK: `@anthropic-ai/sdk`
  - Auth: `ANTHROPIC_API_KEY`
  - Entry point: `packages/giti/src/agents/growth-hormone/proposal-generator.ts`
  - Use case: Generate feature proposals based on telemetry signals
  - Budget: Counted toward `GITI_API_BUDGET` (default 100,000 tokens/month)

- **Content Narrative Engine (Messages API)**
  - SDK: `@anthropic-ai/sdk`
  - Auth: `ANTHROPIC_API_KEY`
  - Entry point: `packages/giti/src/content/narrative.ts`
  - Use case: Generate release notes, dispatch narratives, platform content

**GitHub API (Optional):**

- **Pull Request Management** - Alternative to local merge workflow
  - SDK: `@octokit/rest` 22.0.1
  - Auth: `GITHUB_TOKEN` or `GH_TOKEN` environment variable (required for Managed Agents)
  - Entry point: `packages/giti/src/integrations/github/client.ts`
  - Operations:
    - Create PRs (`pulls.create`) - title, body, labels, base branch
    - Merge PRs (`pulls.merge`) - supports squash/rebase/merge strategies
    - Close PRs (`pulls.update`)
    - Add comments (`issues.createComment`)
    - Create releases (`repos.createRelease`)
  - Required env vars: `GITHUB_TOKEN` or `GH_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
  - Activation: Set `GITI_AUTO_MERGE=true` to merge after review approval
  - Auto-merge delay: `GITI_AUTO_MERGE_DELAY` (default 3600000ms = 1h, capped at 10s in code)

## Data Storage

**Databases:**
- Not applicable - this is a CLI tool analyzing git repos, not a database-driven application

**File Storage:**

**Local filesystem only:**
- `.organism/` directory - Persistent organism state
  - `state-reports/` - Timestamped sensory cortex outputs (JSON)
  - `reviews/` - Immune system branch verdicts (JSON)
  - `backlog/` - Work items and cycle plans (JSON)
  - `growth-proposals/` - Growth Hormone proposals (JSON)
  - `knowledge-base.json` - Memory agent curated knowledge
  - `baselines.json` - Quality/performance baselines
  - `cycle-counter.json` - Monotonic cycle number
  - `api-usage.json` - Token budget tracking
  - `active-cycle.json` - Concurrent execution lock
  - `cooldown-until.json` - Post-regression cooldown expiry
  - `kill-switch` - Organism halt signal (file presence = stopped)
  - `scheduler.json` - Running scheduler config
  - `cycle-history/` - Completed cycle results
  - `traces/` - OpenClaw trace files (local fallback)
  - `audit-log.jsonl` - Agent action audit trail (JSON-lines, append-only)

**User home directory:**
- `~/.giti/` - User-level telemetry and preferences
  - `telemetry-config.json` - Opt-in preference
  - `telemetry-events.jsonl` - Anonymized usage events (JSON-lines)

**Caching:**
- No external caching service; Motor Cortex agent/environment IDs cached in process memory (implementer.ts: `cachedAgentId`, `cachedEnvironmentId`)

## Authentication & Identity

**Auth Provider:**
- Custom (API keys via environment variables)

**Implementation approach:**
- `ANTHROPIC_API_KEY` - Claude API authentication (bearer token)
- `GITHUB_TOKEN` or `GH_TOKEN` - GitHub API auth (bearer token, fine-grained PAT required for Managed Agents)
- `OPENCLAW_API_KEY` - OpenClaw observability token
- `DASHCLAW_API_KEY` - DashClaw governance approval API token
- Auth headers: Added via SDK clients or explicit `x-api-key` headers

## Monitoring & Observability

**Error Tracking:**

- **OpenClaw (Optional)** - Agent execution tracing
  - SDK: Custom HTTP (using fetch)
  - Auth: `OPENCLAW_API_KEY` environment variable
  - Entry point: `packages/giti/src/integrations/openclaw/instrument.ts`
  - Implementation: Wraps agent functions with `traceAgent()` to capture inputs/outputs/duration
  - Persistence: Posts to OpenClaw API if key is set; falls back to local `.organism/traces/` directory
  - Never blocks errors (tracing failures are caught and suppressed)

**Logs:**

- Console output (via chalk for colors, ora for spinners)
- No centralized logging service
- CLI commands support `--json` flag for structured output
- All commands also support `--path <dir>` for cross-repo analysis

## CI/CD & Deployment

**Hosting:**

- CLI: npm package, run locally or via scripts
- Observatory: Next.js app, runs on port 3333
  - Dev: `npm run dev` starts dev server
  - Build: `next build` for SSR
  - Static export: Set `OBSERVATORY_PUBLIC=true` env var, runs `next build` with `output: 'export'`

**CI Pipeline:**

- No built-in CI/CD integration
- GitHub Actions can invoke via: `giti build`, `giti cycle`, `giti organism` commands
- Orchestrator (`src/agents/orchestrator/cycle.ts`) manages lifecycle scheduling and safety controls

## Environment Configuration

**Required env vars:**

- `ANTHROPIC_API_KEY` - For Motor Cortex, Growth Hormone, narrative generation
  - Must be set to run: `giti build`, `giti cycle`, `giti organism`

**Optional env vars:**

- `GITHUB_TOKEN` or `GH_TOKEN` - Fine-grained PAT with Contents: Read+Write for Managed Agents
  - Required if using GitHub PR workflow (`GITI_AUTO_MERGE=true`)
  - Used by: Motor Cortex agent environment provisioning, PR management

- `GITI_MODEL` - Motor Cortex model selection (default: `claude-sonnet-4-6`)
  - Overrides: `process.env['GITI_MODEL']` in `src/agents/motor-cortex/implementer.ts`
  - Used by: `ensureAgent()` function to set model on Managed Agent creation

- `GITI_API_BUDGET` - Monthly token limit (default: 100,000)
  - Parsed in: `src/agents/orchestrator/cycle.ts`
  - Tracked in: `.organism/api-usage.json`
  - Enforced: Cycle blocks if budget exceeded

- `GITI_CYCLE_INTERVAL` - Milliseconds between automatic cycles (optional scheduler)
  - Parsed in: `src/agents/orchestrator/scheduler.ts`

- `GITI_SUPERVISED` - Require human approval for merges (default: true)
  - Blocks auto-merge if set to `true`

- `GITI_AUTO_MERGE` - Auto-merge approved PRs to main (default: false)
  - Requires: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
  - Delay: `GITI_AUTO_MERGE_DELAY` (default 3600000ms, capped at 10s in code)

- `DASHCLAW_URL` - DashClaw governance dashboard URL
  - Used with: `DASHCLAW_API_KEY` for guard/approval/action lifecycle
  - Entry point: `packages/giti/src/integrations/dashclaw/governance.ts`
  - Phase: "Phase 4.5" in cycle (`src/agents/orchestrator/cycle.ts`)
  - Queries guard endpoint before code merge

- `DASHCLAW_API_KEY` - DashClaw API key (x-api-key header)
  - Paired with: `DASHCLAW_URL` to enable governance integration

- `OPENCLAW_API_KEY` - OpenClaw observability API key
  - Optional; if set, agent traces are posted to OpenClaw
  - Fallback: Traces saved to `.organism/traces/` locally

- `GITI_REPO_PATH` - Explicit repo path for Observatory snapshot API (optional)
  - Used in: `packages/giti-observatory/src/app/api/snapshot/route.ts`

- `OBSERVATORY_PUBLIC` - Enable static export mode for Observatory (optional, default: false)
  - Triggers: Next.js `output: 'export'` in config

**Secrets location:**

- `.env` file (in repo root, loaded by dotenv at startup)
- Git-ignored (ensure `.gitignore` includes `.env`)
- `.env.example` provides template with all variable names

## Webhooks & Callbacks

**Incoming:**

- Observatory snapshot endpoint: `GET /api/snapshot`
  - Query param: `path` - Optional explicit repo path
  - Response: JSON `ObservatorySnapshot` (agent state, cycle digest, events)
  - Used by: Frontend to display real-time terrarium visualization

**Outgoing:**

- Motor Cortex → GitHub: Creates PRs, merges, comments (if configured)
- Orchestrator → DashClaw: Posts guard requests, queries approval status
- Orchestrator → OpenClaw: Posts agent traces (if configured)
- Growth Hormone → Anthropic: Messages API calls for proposal generation
- Narrative Engine → Anthropic: Messages API calls for content generation

---

*Integration audit: 2026-04-11*
