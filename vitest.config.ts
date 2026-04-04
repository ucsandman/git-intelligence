import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/types/**',
        'src/cli/**',
        'src/agents/sensory-cortex/index.ts',
        'src/agents/sensory-cortex/formatter.ts',
        'src/agents/sensory-cortex/types.ts',
        'src/agents/immune-system/index.ts',
        'src/agents/immune-system/formatter.ts',
        'src/agents/immune-system/types.ts',
        'src/agents/memory/index.ts',
        'src/agents/memory/formatter.ts',
        'src/agents/memory/types.ts',
        'src/agents/prefrontal-cortex/types.ts',
        'src/agents/motor-cortex/types.ts',
        'src/agents/orchestrator/types.ts',
        'src/agents/types.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 30000,
  },
});
