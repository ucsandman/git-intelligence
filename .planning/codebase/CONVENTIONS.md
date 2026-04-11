# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` (e.g., `commit-analyzer.ts`, `file-analyzer.ts`, `curator.ts`)
- Files with hyphens for multi-word names (e.g., `regression-cluster.test.ts`, `branch-analyzer.test.ts`)
- Index files: `index.ts` for barrel exports
- Test files: `{name}.test.ts` (co-located with source or in parallel `tests/` directory)
- Type files: `types.ts` (one per agent or module)

**Functions:**
- camelCase for all functions and methods
- Prefix helper functions with underscore convention (rare; most are private via placement)
- Export full function names, no abbreviations (e.g., `extractRegressionLessons` not `extractRegLessons`)

**Variables:**
- camelCase for constants and variables
- snake_case ONLY for JSON object keys that persist to disk (e.g., `test_coverage`, `last_updated`, `fragile_files`)
- Avoid single-letter variables except loop counters (`i`, `j`) and well-known math variables
- Meaningful names over brevity (e.g., `regressionCount` not `rc`)

**Types:**
- PascalCase for all TypeScript types and interfaces (e.g., `StateReport`, `KnowledgeBase`, `OrganismEvent`)
- Event type unions: lowercase with hyphens (e.g., `'change-merged'`, `'regression-detected'`)
- Property discriminators: snake_case matching JSON keys (e.g., `type: 'usage-concentration'`)

## Code Style

**Formatting:**
- No explicit linter/formatter configured (eslint/prettier not in deps)
- Manual adherence to style: 2-space indentation (TypeScript standard)
- Line length: no hard limit, but max 300 lines per file (organism.json standard)
- JSON output: `JSON.stringify(data, null, 2)` with 2-space indentation (see `writeJsonFile` in `src/agents/utils.ts`)

**Linting:**
- Tool: `tsc --noEmit` (TypeScript strict mode compiler check)
- Run: `npm run lint`
- Strict mode enabled in `tsconfig.json`: all of `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- Zero tolerance for `any` types (organism.json: `"zero_tolerance": ["any:errors", "security:vulnerabilities"]`)
- Unused variables and parameters will fail `tsc` checks

## Import Organization

**Order:**
1. Node.js built-ins (`import fs from 'node:fs/promises'`)
2. External dependencies (`import type { SimpleGit } from 'simple-git'`)
3. Internal absolute imports with `.js` extension (`import { runSensoryCortex } from '../agents/sensory-cortex/index.js'`)
4. Type imports grouped separately (`import type { KnowledgeBase } from './types.js'`)

**Path Aliases:**
- No path aliases configured (monorepo uses relative imports with `../` and explicit `.js` extensions)
- ESM module style: all imports end with `.js` extension (required for Node.js ESM compatibility)

**Example import block** (from `src/agents/memory/curator.ts`):
```typescript
import crypto from 'node:crypto';
import type { KnowledgeBase, Lesson, FragileFile, Preference } from './types.js';
import type { OrganismEvent } from '../types.js';
```

## Error Handling

**Patterns:**
- Throw `new Error(message)` with descriptive messages for validation and precondition failures
- Include context in error messages: `throw new Error(\`action instance not found: ${id}\`)`
- Catch errors in CLI handlers only (see `src/cli/sense.ts`): wrap agent calls in try-catch, fail gracefully with `process.exit(1)`
- Silent nullability: use `readJsonFile` which returns `null` on file not found (no throw)
- Type narrowing in catch: `error instanceof Error ? error.message : 'Unknown error'`

**Example** (from `src/cli/sense.ts`):
```typescript
try {
  const { report, reportPath } = await runSensoryCortex(repoPath);
  spinner?.stop();
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatSenseReport(report, reportPath));
  }
} catch (error) {
  spinner?.fail('Sensory scan failed');
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
```

## Logging

**Framework:** console (no external logger)

**Patterns:**
- Informational output: `console.log(...)` for formatted results
- Errors: `console.error(...)` before `process.exit(1)` in CLI handlers
- Spinners for long operations: `ora('message').start()` / `.stop()` / `.fail()` from `ora` package
- JSON output: conditional on `options.json` flag, always use `JSON.stringify(data, null, 2)`
- No debug logging in production code (stdout reserved for results)

## Comments

**When to Comment:**
- Section dividers in long functions: `// ── extractRegressionLessons ───────────────────────────────────`
- Complex algorithms or non-obvious logic
- Intent of helper functions above the function definition
- Disable linter rules with justification: `// eslint-disable-next-line reason`
- Avoid obvious comments; code should be self-documenting

**JSDoc/TSDoc:**
- Rarely used (not enforced)
- Functions have explicit TypeScript signatures; docs not required
- Public API functions may document with JSDoc if complex

**Example comment style** (from `src/agents/memory/curator.ts`):
```typescript
// ── helpers ─────────────────────────────────────────────────────────

function extractFilesFromEvent(event: OrganismEvent): string[] {
  const files: string[] = [];
  const file = event.data['file'];
  const fileArray = event.data['files'];

  if (typeof file === 'string') {
    files.push(file);
  }
  // ... rest of function
}
```

## Function Design

**Size:** Max 300 lines per file (organism.json standard); individual functions typically 20–50 lines
- Helper functions broken out for readability, not performance
- Async functions preferred over callback chains

**Parameters:**
- Destructured objects for multiple related params (e.g., `options: { path?: string; json?: boolean }` in CLI handlers)
- Required params first, optional (with `?`) after
- No rest parameters in CLI handlers; explicit options object

**Return Values:**
- Async functions return Promises with explicit types (e.g., `Promise<StateReport>`)
- Functions that read state return `T | null` on failure (e.g., `readJsonFile<T>(...)`)
- No implicit undefined returns; explicit `void` for side-effect functions

**Example** (from `src/agents/utils.ts`):
```typescript
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
```

## Module Design

**Exports:**
- Explicit named exports for functions and types
- Barrel files (`index.ts`) re-export public API
- Private functions not exported; keep in module scope
- Types exported separately: `export type { TypeName }`

**Barrel Files:**
- Used for agent modules: `src/agents/{cortex}/index.ts` exports main run function and types
- Example: `src/agents/memory/index.ts` exports `loadKnowledgeBase`, `recordMemoryEvent`, and related types

**Agent Structure:**
- Each agent in `src/agents/{name}/`:
  - `index.ts` — main entry point, run function, orchestration
  - `types.ts` — TypeScript interfaces and unions
  - `formatter.ts` — output formatting (if CLI-facing)
  - Sub-modules: `store.ts`, `curator.ts`, `validator.ts`, etc. (helper functions)

**Shared Types:**
- Global types: `src/agents/types.ts` (AgentRole, OrganismEvent, EventType, OrganismConfig)
- Module types: each module has its own `types.ts` (e.g., `src/agents/memory/types.ts`, `src/agents/sensory-cortex/types.ts`)
- CLI types imported from agents (no separate CLI type file)

## CLI Conventions

**Command Handlers:**
- Location: `src/cli/{command}.ts`
- Export function: `execute{CommandName}(options: { path?: string; json?: boolean }): Promise<void>`
- Always support `--path` and `--json` flags (organism.json requirement)
- Fail with `process.exit(1)` on error; success exits implicitly with code 0
- Use spinners for operations >1s (ora library)

**Example** (from `src/cli/sense.ts`):
```typescript
export async function executeSense(options: { path?: string; json?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const spinner = options.json ? null : ora('Running sensory scan...').start();

  try {
    const { report, reportPath } = await runSensoryCortex(repoPath);
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatSenseReport(report, reportPath));
    }
  } catch (error) {
    spinner?.fail('Sensory scan failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
```

## Cyclomatic Complexity

**Target:** Max 15 per function (organism.json standard)
- Lint target not enforced, but code is written with branching control in mind
- Guard clauses preferred over deep nesting
- Long switch statements acceptable if each branch is simple

---

*Convention analysis: 2026-04-11*
