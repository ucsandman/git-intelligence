# Lessons Learned

## Sprint 0
- Windows filenames cannot contain colons — ISO timestamps need sanitization (`replace(/:/g, '-')`)
- TypeScript 6.x deprecates `baseUrl` in tsup's DTS generation — fixed with `"ignoreDeprecations": "6.0"` in tsconfig
- `vi.hoisted()` is required for mock values used in `vi.mock()` factories due to vitest hoisting behavior
- Use `.js` extensions in all relative imports for ESM compatibility

## Sprint 1
- `execFileSync` (not `execSync`) prevents shell injection — pass arguments as arrays
- `npm outdated` exits with code 1 when outdated packages exist — parse stdout regardless of status code
- Cyclomatic complexity regex must exclude JS keywords (`if`, `for`, `while`) from function name detection
- `else if` double-counting fixed with negative lookbehind `(?<!\belse\s)` in complexity calculator
- Coverage exclusions needed for type-only files and integration-level modules (orchestrators, formatters, CLI entrypoints)

## Sprint 2
- Anthropic SDK mock requires `function` expression (not arrow function) to work as constructor with `new`
- `spinner?.text = 'msg'` (optional chaining assignment) not supported by esbuild — use `if (spinner) spinner.text = 'msg'`
- `OrganismConfig` type doesn't include `evolutionary_principles` (root-level organism.json field) — read full JSON separately
- Safety lock files should handle stale state (>2h timeout) to recover from crashed cycles

## Sprint 3
- Vitest `vi.mock` with `* as` namespace imports: define mock functions at module scope before `vi.mock()`, then reference them via proxy functions inside the mock factory. Avoids hoisting issues where mocks are not properly wired.
- Coverage exclusions must be updated when new Sprint adds type-only files, formatters, and orchestrator index modules — follow the established pattern in `vitest.config.ts`
- Telemetry anonymizer: use `crypto.createHash('sha256')` for consistent hashing — avoid `crypto.randomUUID()` which produces different values each call
- JSON-lines (`.jsonl`) format is simpler than SQLite for append-only telemetry stores — one JSON object per line, easy to read/write without dependencies
- Growth Hormone proposals use structured Claude API output — `buildProposalPrompt` creates the system+user messages, `parseProposalResponse` validates the JSON response against the GrowthProposal schema
- Simulator repo-generator creates real git repos in temp directories — tests that use it are slow (~2-5s per repo type), so mock for unit tests and only use real repos in integration tests
