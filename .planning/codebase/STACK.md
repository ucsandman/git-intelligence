# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.8–6.0.2 - Strict mode, ESNext modules across all packages
- JavaScript (Node.js runtime)

**Secondary:**
- GLSL - WebGL shaders for Observatory 3D scene effects (`*.glsl`, handled by Next.js webpack config)

## Runtime

**Environment:**
- Node.js >= 18.0.0 (declared in all package.json files)

**Package Manager:**
- npm (workspaces)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core CLI (packages/giti/):**
- commander 14.0.3 - Command-line interface builder
- chalk 5.6.2 - Terminal color formatting
- ora 9.3.0 - Terminal spinners and progress

**Framework Library (packages/livingcode-core/):**
- @anthropic-ai/sdk 0.82.0 - Claude API for autonomous lifecycle agents

**Web UI (packages/giti-observatory/):**
- Next.js 15.3.0 - React SSR framework (dev server on port 3333)
- React 19.1.0 - UI component library
- react-dom 19.1.0 - DOM rendering
- @react-three/fiber 9.1.0 - React renderer for Three.js
- @react-three/drei 10.0.0 - Three.js helpers and utilities
- @react-three/postprocessing 3.0.0 - Post-processing effects (bloom)
- @react-spring/three 9.7.0 - Animation library for 3D
- three 0.175.0 - 3D graphics engine
- framer-motion 12.6.0 - UI animation library
- Tailwind CSS 4.1.0 - Utility CSS framework
- @tailwindcss/postcss 4.1.0 - PostCSS integration

**Testing:**
- vitest 4.1.2 (giti), 3.1.0 (observatory) - Test runner (globals mode)
- @vitest/coverage-v8 4.1.2 (giti) - Code coverage (v8 provider, 80% threshold)

**Build/Dev:**
- tsup 8.5.1 (giti, livingcode-core) - Bundler for TypeScript → ESM
- tsc - TypeScript type checking (--noEmit flag)

## Key Dependencies

**Critical:**

- @anthropic-ai/sdk 0.86.1 (giti) / 0.82.0 (livingcode-core) - Claude API client
  - Used for Motor Cortex (Claude Managed Agents model): `agent.ts`, `implementer.ts`
  - Used for Growth Hormone proposals: `proposal-generator.ts`
  - Used for content narrative generation: `narrative.ts`
  - Why it matters: Powers autonomous code generation and AI agent lifecycle

- simple-git 3.33.0 - Git repository abstraction
  - Location: `src/utils/git.ts` (main wrapper), used across all agents
  - Why it matters: Core git operations for commit, branch, diff, log analysis

- @octokit/rest 22.0.1 (giti only) - GitHub REST API client
  - Location: `src/integrations/github/client.ts`
  - Why it matters: PR creation, merging, issue management when GITHUB_TOKEN is set

**Infrastructure:**

- dotenv 17.4.1 - Environment variable loader (loaded from `.env` in process startup)
  - Entry point: `packages/giti/src/index.ts` calls `config({ path: resolve(process.cwd(), '.env') })`

- chokidar 4.0.0 (observatory) - File system watcher
  - Used for live-reload of snapshot data during development

## Configuration

**Environment:**

- Loaded via `dotenv` (17.4.1) at runtime from `.env` file in repo root
- See `.env.example` for all configurable variables
- Required: `ANTHROPIC_API_KEY` for build/cycle/organism commands
- Optional: `GITHUB_TOKEN`, `GH_TOKEN`, `OPENCLAW_API_KEY`, `DASHCLAW_URL`, `DASHCLAW_API_KEY`

**Build:**

- `packages/giti/tsup.config.ts` - CLI build (ESM, target node18, shebang banner)
- `packages/giti/vitest.config.ts` - Test runner (globals, v8 coverage, 80% threshold)
- `packages/giti-observatory/next.config.ts` - Observatory app (OBSERVATORY_PUBLIC export mode, three.js transpile, GLSL webpack loader)
- All packages use `tsconfig.json` with strict mode enabled

**TypeScript:**

- Strict mode enabled globally across all packages
- Target: ES2022
- Module: ESNext
- Key settings: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`
- Path aliases in Observatory: `@/*` → `./src/*`

## Platform Requirements

**Development:**

- Node.js >= 18.0.0
- npm (or compatible package manager supporting workspaces)
- Git (for simple-git operations)

**Production:**

**CLI (giti):**
- Node.js >= 18.0.0
- Git repository (validates with `git.checkIsRepo()`)
- Deployment: npm binary entry point at `dist/index.js` (generated from tsup)

**Observatory Web UI:**
- Next.js application (SSR or static export via `OBSERVATORY_PUBLIC=true`)
- Runs on port 3333 by default (`npm run dev` in `packages/giti-observatory/`)
- Browser with WebGL support (for Three.js 3D rendering)

## Dependency Overrides

Root `package.json` overrides:
- `vite: ^8.0.5` - Ensures consistent vite version across all dev dependencies

---

*Stack analysis: 2026-04-11*
