# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- vitest 4.1.2
- Config: `packages/giti/vitest.config.ts`
- Globals enabled: `describe`, `it`, `expect` available without imports (though imports shown explicitly)

**Assertion Library:**
- vitest built-in expect (similar to Jest)
- Matchers: `expect(...).toBe()`, `toEqual()`, `toHaveLength()`, `toHaveProperty()`, etc.
- Custom matchers: `toBeCloseTo()` for floating-point comparisons

**Run Commands:**
```bash
npm test                 # Run all tests once (vitest run)
npm run test:watch      # Watch mode (vitest)
npm run test:coverage   # Coverage report (vitest run --coverage)
```

**Coverage Requirements** (from `vitest.config.ts`):
- Statements: 80%
- Branches: 70%
- Functions: 80%
- Lines: 80%

**Excluded from Coverage:**
- Type files: `src/types/**`, all `src/agents/*/types.ts`
- Index/barrel files: `src/index.ts`, `src/agents/*/index.ts`
- Formatters: `src/agents/*/formatter.ts`
- Infrastructure: `src/cli/**`, `src/agents/orchestrator/scheduler.ts`

---

## Test File Organization

**Location:**
- Co-located parallel structure: `packages/giti/tests/` mirrors `packages/giti/src/`
- Test file path: `packages/giti/tests/agents/{agent}/index.test.ts` for `packages/giti/src/agents/{agent}/index.ts`
- Subdirectories preserved: `tests/analyzers/commit-analyzer.test.ts` for `src/analyzers/commit-analyzer.ts`

**Naming:**
- Convention: `{name}.test.ts` (not `.spec.ts`)
- Example: `baselines.test.ts`, `curator.test.ts`, `signal-analyzer.test.ts`

**Structure:**
```
packages/giti/
├── src/
│   ├── agents/
│   │   ├── memory/
│   │   │   ├── curator.ts
│   │   │   ├── types.ts
│   │   │   └── ...
│   │   └── ...
│   ├── analyzers/
│   │   ├── commit-analyzer.ts
│   │   └── ...
│   └── ...
└── tests/
    ├── agents/
    │   ├── memory/
    │   │   └── curator.test.ts
    │   ├── growth-hormone/
    │   │   ├── index.test.ts
    │   │   └── signal-analyzer.test.ts
    │   └── ...
    ├── analyzers/
    │   ├── commit-analyzer.test.ts
    │   └── ...
    └── ...
```

---

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('curateKnowledgeBase', () => {
  it('returns unchanged KB when no events exist', () => {
    const kb = initKnowledgeBase();
    const result = curateKnowledgeBase(kb);

    expect(result.lessons).toEqual([]);
    expect(result.patterns.fragile_files).toEqual([]);
    expect(result.patterns.rejection_reasons).toEqual({});
    expect(result.preferences).toEqual([]);
  });

  describe('regression lessons', () => {
    it('creates a lesson with confidence 0.5 for a single regression event', () => {
      let kb = initKnowledgeBase();
      kb = addRegressionEvent(kb, 'src/utils.ts');

      const result = curateKnowledgeBase(kb);

      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0]!.lesson).toContain('src/utils.ts');
      expect(result.lessons[0]!.confidence).toBe(0.5);
    });
  });
});
```

**Patterns:**

- **Setup:** Helper functions at top of file (e.g., `makeReport()`, `addRegressionEvent()`)
- **Teardown:** `afterEach()` cleanup for temporary resources (filesystem, mocks)
- **Grouping:** Nested `describe()` blocks for logical suites within one tested function
- **Assertions:** Multiple expects per test allowed; group by setup/action/verify

**Example with cleanup** (from `packages/giti/tests/agents/actions/runner.test.ts`):
```typescript
const tmpDirs: string[] = [];

async function makeTmpRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-actions-runner-'));
  tmpDirs.push(dir);
  await fs.writeFile(path.join(dir, 'organism.json'), JSON.stringify({...}), 'utf-8');
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tmpDirs.length = 0;
});

beforeEach(() => {
  delete process.env['ANTHROPIC_API_KEY'];
});

describe('reviewActionPlan', () => {
  it('auto-approves read_only plans', async () => {
    const repoPath = await makeTmpRepo();
    const verdict = await reviewActionPlan(repoPath, makeTemplate([...]));
    expect(verdict.approved).toBe(true);
  });
});
```

---

## Mocking

**Framework:** vitest `vi` API (compatible with Jest)

**Patterns:**

**Module mocking** (from `packages/giti/tests/agents/growth-hormone/index.test.ts`):
```typescript
vi.mock('../../../src/telemetry/store.js', () => ({
  readEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/agents/utils.js', () => ({
  loadOrganismConfig: vi.fn().mockResolvedValue({
    quality_standards: {...},
    boundaries: {...},
    lifecycle: {...},
  }),
  readJsonFile: vi.fn().mockResolvedValue(null),
  writeJsonFile: vi.fn().mockResolvedValue(undefined),
  ensureOrganismDir: vi.fn().mockResolvedValue(''),
  getOrganismPath: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
}));

// Later in test file:
const mockReadEvents = vi.mocked(readEvents);
mockReadEvents.mockResolvedValue([event1, event2]);
```

**Hoisted mock factory** (for variables needed during mock setup, from `packages/giti/tests/analyzers/commit-analyzer.test.ts`):
```typescript
const { mockReaddir } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: { readdir: mockReaddir },
  readdir: mockReaddir,
}));

describe('getLastCommit', () => {
  beforeEach(() => {
    mockReaddir.mockClear();
  });
});
```

**Mock SimpleGit objects:**
```typescript
function createMockGit(overrides: Record<string, unknown> = {}): SimpleGit {
  return {
    log: vi.fn().mockResolvedValue({
      all: [
        {
          hash: 'abc123',
          date: '2026-04-03T10:00:00Z',
          message: 'fix: resolve auth bug',
          author_name: 'Alice',
          diff: { changed: 3, insertions: 20, deletions: 5, files: [] },
        },
      ],
      total: 1,
    }),
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  } as unknown as SimpleGit;
}
```

**What to Mock:**
- External APIs (Anthropic SDK, GitHub API)
- File system operations (`fs/promises`)
- Child process execution (`execFileSync`)
- Telemetry collectors
- Date/time (via explicit test data, not with `vi.useFakeTimers()`)

**What NOT to Mock:**
- Pure functions (helper functions like `extractFilesFromEvent`)
- Data transformations (curator, analyzers)
- Data structures (use real objects with test fixtures)
- Date.toISOString() (real, consistent results)

---

## Fixtures and Factories

**Test Data:**
```typescript
function makeAggregate(overrides: Partial<TelemetryAggregate> = {}): TelemetryAggregate {
  return {
    total_events: 100,
    period_days: 30,
    command_frequency: { pulse: 40, hotspots: 35, ghosts: 25 },
    flag_frequency: { '--json': 3, '--since': 10 },
    error_rate_by_command: { pulse: 0.01, hotspots: 0.02, ghosts: 0.01 },
    avg_execution_ms_by_command: { pulse: 300, hotspots: 1200, ghosts: 800 },
    repo_size_distribution: { '0-100': 30, '100-1k': 50, '1k-10k': 20 },
    usage_sequences: [],
    json_usage_percent: 3,
    ...overrides,
  };
}

// Usage in tests:
const agg = makeAggregate({
  total_events: 100,
  command_frequency: { pulse: 60, hotspots: 25, ghosts: 15 },
});
```

**Location:**
- Helper functions defined in test file (co-located with tests)
- No separate fixtures directory
- Reusable factories at top of each test file, before describe blocks

---

## Coverage

**Requirements:** 80%+ test coverage (enforced via vitest thresholds)

**View Coverage:**
```bash
npm run test:coverage
# Generates: coverage/ directory with HTML report
```

**Type files excluded** from coverage to focus on logic:
- All `src/**/types.ts` files
- Index/barrel exports
- Formatters (output generation, not core logic)

---

## Test Types

**Unit Tests:**
- Scope: Single function or pure transformation
- Approach: Test inputs, outputs, edge cases
- Example: `curateKnowledgeBase` test checks lesson creation, fragile file ranking, rejection pattern tallying
- Location: Majority of tests (747 in giti package)

**Integration Tests:**
- Scope: Multiple functions working together
- Approach: Create real temp repositories, invoke agent workflows, verify state
- Example: `packages/giti/tests/agents/actions/integration/action-cycle.test.ts`
- Pattern: Use `fs.mkdtemp()` to create isolated test repos, cleanup with `afterEach()`

**E2E Tests:**
- Framework: Not used
- CLI testing: Done via individual command handler tests (not a full E2E suite)
- Real repo testing: Manual; organism tests on actual codebases during development

---

## Common Patterns

**Async Testing:**
```typescript
it('round-trips correctly', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-baselines-'));
  try {
    await writeBaselines(tmpDir, baselines);
    const loaded = await readBaselines(tmpDir);

    expect(loaded).toEqual(baselines);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
```

**Error Testing:**
```typescript
it('throws on missing organism.json', async () => {
  const repoPath = await makeTmpRepo(); // Creates dir without organism.json
  
  // Test throws:
  expect(() => loadOrganismConfig(repoPath)).rejects.toThrow('organism.json not found');
});

// Or:
it('returns null for missing file', async () => {
  const tmpDir = await fs.mkdtemp(...);
  const result = await readBaselines(tmpDir);
  expect(result).toBeNull();
});
```

**Confidence/Probability Testing** (from immune-system baselines):
```typescript
it('caps confidence at 1.0', () => {
  let kb = initKnowledgeBase();
  for (let i = 0; i < 7; i++) {
    kb = addRegressionEvent(kb, 'src/fragile.ts');
  }

  const result = curateKnowledgeBase(kb);
  const lessons = result.lessons.filter((l) => l.lesson.includes('src/fragile.ts'));
  
  expect(lessons[0]!.confidence).toBe(1.0);
});

it('uses approximate equality for floating point', () => {
  const result = analyzeSignals(agg, mockConfig);
  expect(result[0]!.confidence).toBeCloseTo(0.6, 1);
});
```

**Sorting and Ordering** (from signal analyzer tests):
```typescript
it('signals are sorted by confidence descending', () => {
  const signals = analyzeSignals(agg, mockConfig);
  
  for (let i = 1; i < signals.length; i++) {
    expect(signals[i]!.confidence).toBeLessThanOrEqual(
      signals[i - 1]!.confidence,
    );
  }
});
```

**Baselines in Immune System:**
- Baselines stored as JSON in `.organism/baselines.json`
- Tests use `readBaselines()`, `writeBaselines()`, `createBaselinesFromReport()`
- Baseline update on first cycle establishes metrics (test_coverage, performance_ms, complexity metrics)
- Subsequent cycles compare against baseline to detect regressions
- Example: `packages/giti/tests/agents/immune-system/baselines.test.ts` tests round-trip consistency and field mapping

---

## Performance Testing

**Targets** (from organism.json):
- `pulse` command: < 2 seconds on repos up to 10k commits
- `hotspots` command: < 5 seconds on repos up to 10k commits
- `ghosts` command: < 10 seconds on repos up to 10k commits

**Approach:**
- No automated perf tests in suite
- Manual benchmarking during development
- CLI handlers may log execution time via telemetry

---

*Testing analysis: 2026-04-11*
