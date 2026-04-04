import { generateVerdict } from '../../../src/agents/immune-system/verdict.js';
import type { CheckResult, ReviewRisk } from '../../../src/agents/immune-system/types.js';

// ── helpers ─────────────────────────────────────────────────────────

function makeCheck(name: string, status: 'pass' | 'fail' | 'warn', message = ''): CheckResult {
  return { name, status, message };
}

// ── tests ───────────────────────────────────────────────────────────

describe('generateVerdict', () => {
  it('approves when all checks pass and 0 warnings', () => {
    const checks: CheckResult[] = [
      makeCheck('Tests', 'pass'),
      makeCheck('Quality', 'pass'),
      makeCheck('Performance', 'pass'),
    ];

    const verdict = generateVerdict('feature/foo', checks);

    expect(verdict.verdict).toBe('approve');
    expect(verdict.confidence).toBe(1.0);
    expect(verdict.branch).toBe('feature/foo');
    expect(verdict.summary).toContain('All checks passed');
    expect(verdict.recommendation).toContain('Approve');
    expect(verdict.timestamp).toBeDefined();
  });

  it('rejects when any check fails', () => {
    const checks: CheckResult[] = [
      makeCheck('Tests', 'pass'),
      makeCheck('Quality', 'fail', '3 new lint errors'),
      makeCheck('Performance', 'pass'),
    ];

    const verdict = generateVerdict('feature/bar', checks);

    expect(verdict.verdict).toBe('reject');
    expect(verdict.summary).toContain('Quality');
    expect(verdict.summary).toContain('failed');
    expect(verdict.recommendation).toContain('Quality');
  });

  it('rejects mentioning all failed check names in summary', () => {
    const checks: CheckResult[] = [
      makeCheck('Tests', 'fail', '2 tests failed'),
      makeCheck('Quality', 'fail', '3 new lint errors'),
      makeCheck('Performance', 'pass'),
    ];

    const verdict = generateVerdict('feature/multi-fail', checks);

    expect(verdict.verdict).toBe('reject');
    expect(verdict.summary).toContain('Tests');
    expect(verdict.summary).toContain('Quality');
  });

  it('requests changes when no failures but 3+ warnings', () => {
    const checks: CheckResult[] = [
      makeCheck('Tests', 'warn', 'coverage decreased'),
      makeCheck('Quality', 'warn', 'files over limit'),
      makeCheck('Dependencies', 'warn', '1 new dep'),
      makeCheck('Boundary', 'pass'),
    ];

    const verdict = generateVerdict('feature/warns', checks);

    expect(verdict.verdict).toBe('request-changes');
    expect(verdict.summary).toContain('3 warnings');
  });

  it('approves when no failures and only 1-2 warnings', () => {
    const checks: CheckResult[] = [
      makeCheck('Tests', 'warn', 'coverage decreased'),
      makeCheck('Quality', 'pass'),
      makeCheck('Dependencies', 'warn', '1 new dep'),
      makeCheck('Boundary', 'pass'),
    ];

    const verdict = generateVerdict('feature/few-warns', checks);

    expect(verdict.verdict).toBe('approve');
  });

  it('calculates confidence as passCount / totalChecks', () => {
    // 4 pass + 1 warn + 1 fail = 6 total, 5 pass (non-fail)
    const checks: CheckResult[] = [
      makeCheck('A', 'pass'),
      makeCheck('B', 'pass'),
      makeCheck('C', 'pass'),
      makeCheck('D', 'pass'),
      makeCheck('E', 'warn'),
      makeCheck('F', 'fail'),
    ];

    const verdict = generateVerdict('branch', checks);

    // passCount = 5 (everything except fail), total = 6
    expect(verdict.confidence).toBe(Math.round((5 / 6) * 100) / 100);
  });

  it('returns confidence 0 for empty checks array', () => {
    const verdict = generateVerdict('empty-branch', []);

    expect(verdict.confidence).toBe(0);
    expect(verdict.verdict).toBe('approve');
  });

  it('passes risks through to the verdict', () => {
    const checks: CheckResult[] = [makeCheck('Tests', 'pass')];
    const risks: ReviewRisk[] = [
      { description: 'new dependency adds install size', severity: 'low' },
      { description: 'fragile file modified', severity: 'medium' },
    ];

    const verdict = generateVerdict('feature/risks', checks, risks);

    expect(verdict.risks).toEqual(risks);
    expect(verdict.risks).toHaveLength(2);
  });

  it('defaults risks to empty array when not provided', () => {
    const checks: CheckResult[] = [makeCheck('Tests', 'pass')];

    const verdict = generateVerdict('feature/no-risks', checks);

    expect(verdict.risks).toEqual([]);
  });

  it('includes recommendation to fix failed checks on reject', () => {
    const checks: CheckResult[] = [
      makeCheck('Tests', 'fail'),
      makeCheck('Quality', 'pass'),
    ];

    const verdict = generateVerdict('branch', checks);

    expect(verdict.recommendation).toContain('Fix');
    expect(verdict.recommendation).toContain('Tests');
  });

  it('includes recommendation to address warnings on request-changes', () => {
    const checks: CheckResult[] = [
      makeCheck('A', 'warn'),
      makeCheck('B', 'warn'),
      makeCheck('C', 'warn'),
    ];

    const verdict = generateVerdict('branch', checks);

    expect(verdict.verdict).toBe('request-changes');
    expect(verdict.recommendation).toContain('Address warnings');
  });
});
