# @livingcode/core

Make any codebase alive — autonomous AI-agent lifecycle framework.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What Is a Living Codebase?

A living codebase is one that maintains, improves, and grows itself through coordinated AI agents. The key distinction: this is not "agents that write code on demand" — it is "code with agency over its own evolution." The codebase senses its environment, plans improvements within declared boundaries, executes changes, defends quality through review, and learns from outcomes. Each cycle is autonomous, bounded, and auditable.

The reference implementation is [giti](https://github.com/ucsandman/git-intelligence) — a git intelligence CLI that uses this framework to evolve itself. Giti runs daily lifecycle cycles, proposes its own improvements, reviews them through an immune system, and applies only changes that meet its own quality standards.

---

## Quick Start

**1. Install**
```bash
npm install @livingcode/core
```

**2. Create `organism.json`**
```json
{
  "identity": {
    "name": "my-app",
    "purpose": "What your codebase does and why it exists"
  },
  "boundaries": {
    "growth_zone": ["performance improvements", "test coverage"],
    "forbidden_zone": ["breaking API changes", "adding external dependencies without review"]
  },
  "quality_standards": {
    "test_coverage_floor": 80,
    "max_complexity_per_function": 15,
    "max_file_length": 300
  }
}
```

**3. Create an entry script**
```js
import { LivingCodebase } from '@livingcode/core'

const organism = new LivingCodebase({ configPath: './organism.json' })
await organism.runCycle()
```

**4. Run first cycle**
```bash
node start.js
```

**5. Observe**

Check the `.organism/` directory for cycle logs, memory, and state. Each cycle writes a structured record of what was sensed, planned, built, and learned.

> **Note:** The framework is currently a scaffold. The working implementation lives in the root `src/` directory of [git-intelligence](https://github.com/ucsandman/git-intelligence). Full framework extraction into this package is ongoing.

---

## organism.json Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `identity.name` | string | yes | — | Organism name |
| `identity.purpose` | string | yes | — | What the organism does |
| `boundaries.growth_zone` | string[] | yes | — | What the organism can evolve toward |
| `boundaries.forbidden_zone` | string[] | yes | — | What the organism must never do |
| `quality_standards.test_coverage_floor` | number | yes | 80 | Minimum test coverage % |
| `quality_standards.max_complexity_per_function` | number | yes | 15 | Max cyclomatic complexity |
| `quality_standards.max_file_length` | number | yes | 300 | Max lines per file |
| `lifecycle.max_changes_per_cycle` | number | no | 3 | Max work items per cycle |
| `lifecycle.requires_immune_approval` | boolean | no | true | Gate changes through review |
| `evolutionary_principles` | string[] | no | [] | Guiding principles for the organism |

---

## The Six Agents

**Sensory Cortex** observes the codebase state — test results, coverage metrics, error rates, usage telemetry, and open issues — and produces a structured signal for the planner.

**Prefrontal Cortex** receives the sensory signal and produces a prioritized work plan bounded by `growth_zone` and `forbidden_zone`. It decides what to attempt this cycle and in what order.

**Motor Cortex** executes the plan by writing code via the Claude API. Each change is scoped, targeted, and written to a dedicated branch following the `organism/{cortex}/{description}` naming convention.

**Immune System** reviews every change produced by the Motor Cortex before it can be committed. It checks correctness, adherence to quality standards, and boundary compliance. Changes that fail review are rejected and trigger a learning event.

**Memory** records outcomes from each cycle — what was attempted, what passed, what failed, and what was learned — so future cycles benefit from accumulated knowledge rather than repeating mistakes.

**Growth Hormone** monitors the organism's trajectory over time and proposes new capability directions. When the organism has mastered its current scope, Growth Hormone identifies adjacent opportunities consistent with the organism's purpose.

---

## The Lifecycle Cycle

```
SENSE → PLAN → GROW → BUILD → DEFEND → COMMIT → REFLECT
```

- **SENSE** — Collect codebase health signals and usage data
- **PLAN** — Prioritize work items within declared boundaries
- **GROW** — Generate candidate changes via Motor Cortex
- **BUILD** — Run tests and lint to verify candidates are not broken
- **DEFEND** — Immune System reviews every change before acceptance
- **COMMIT** — Apply approved changes to the repository
- **REFLECT** — Memory records outcomes; lessons inform the next cycle

---

## Safety Features

- **Kill switch** — `giti organism stop` halts the cycle immediately and prevents the next scheduled run
- **48-hour cooldown** — Any regression automatically suspends cycles for 48 hours
- **Concurrent execution lock** — Only one cycle can run at a time; overlapping runs are blocked
- **3-failure auto-pause** — Three consecutive failed cycles trigger automatic suspension pending human review
- **API budget ceiling** — Configurable hard cap on Claude API spend per cycle and per month
- **Supervised mode** — Human approval required before any change is committed; nothing lands without explicit sign-off

---

## FAQ

**Is this safe?**
Multiple safety layers operate independently: the boundary system prevents out-of-scope changes, the Immune System reviews every diff, regressions trigger automatic rollback and cooldown, and supervised mode gives you a human approval gate on every commit. Start in supervised mode.

**How much does it cost?**
The Motor Cortex uses the Claude API. A typical cycle costs $0.01–$0.10 depending on the number and size of changes. The configurable budget ceiling prevents runaway costs — once the ceiling is hit, cycles pause until the next billing period or until you raise the limit.

**Can it break my project?**
The Immune System rejects changes that fail tests or violate quality standards. Regressions that slip through trigger automatic rollback and a 48-hour cooldown. No change is committed without passing `BUILD` and `DEFEND` phases. Starting in supervised mode adds a human review gate on top of all automated checks.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | yes | Claude API key for the Motor Cortex |
| `GITHUB_TOKEN` | no | Required if the organism opens PRs or reads GitHub issues |
| `ORGANISM_BUDGET_CENTS` | no | Monthly API spend ceiling in USD cents (default: no limit) |
| `ORGANISM_SUPERVISED` | no | Set to `true` to require human approval before every commit |

---

## License

MIT
