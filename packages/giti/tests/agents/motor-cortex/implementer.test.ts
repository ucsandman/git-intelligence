import { describe, it, expect } from 'vitest';
import type { AgentImplementationResult } from '../../../src/agents/motor-cortex/implementer.js';

describe('implementer', () => {
  describe('AgentImplementationResult', () => {
    it('has the expected shape for a successful result', () => {
      const result: AgentImplementationResult = {
        success: true,
        filesChanged: ['src/utils/git.ts', 'src/simulator/repo-generator.ts'],
        tokensUsed: 3042,
        turns: 19,
        durationMs: 45000,
        summary: 'Fixed Windows path handling and disabled GPG signing',
        sessionId: 'sesn_test123',
        patchContent: 'diff --git a/src/utils/git.ts b/src/utils/git.ts\n...',
      };

      expect(result.success).toBe(true);
      expect(result.filesChanged).toHaveLength(2);
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.turns).toBeGreaterThan(0);
      expect(result.patchContent).toContain('diff --git');
      expect(result.error).toBeUndefined();
    });

    it('has the expected shape for a failed result', () => {
      const result: AgentImplementationResult = {
        success: false,
        filesChanged: [],
        tokensUsed: 0,
        turns: 1,
        durationMs: 5000,
        summary: '',
        error: 'GITHUB_TOKEN required',
      };

      expect(result.success).toBe(false);
      expect(result.filesChanged).toHaveLength(0);
      expect(result.error).toBe('GITHUB_TOKEN required');
      expect(result.patchContent).toBeUndefined();
    });

    it('can represent a partial result with no patch', () => {
      const result: AgentImplementationResult = {
        success: false,
        filesChanged: ['src/utils/git.ts'],
        tokensUsed: 6596,
        turns: 40,
        durationMs: 120000,
        summary: 'Made changes but could not generate patch',
        sessionId: 'sesn_test456',
        error: 'Agent completed but made no valid source file changes',
      };

      expect(result.success).toBe(false);
      expect(result.filesChanged).toHaveLength(1);
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.patchContent).toBeUndefined();
    });
  });
});
