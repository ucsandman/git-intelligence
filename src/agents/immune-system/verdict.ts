import type { CheckResult, ReviewVerdict, ReviewRisk } from './types.js';

export function generateVerdict(branch: string, checks: CheckResult[], risks: ReviewRisk[] = []): ReviewVerdict {
  const hasFailure = checks.some(c => c.status === 'fail');
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const passCount = checks.filter(c => c.status !== 'fail').length;

  let verdict: 'approve' | 'reject' | 'request-changes';
  if (hasFailure) verdict = 'reject';
  else if (warnCount >= 3) verdict = 'request-changes';
  else verdict = 'approve';

  const confidence = checks.length > 0 ? Math.round((passCount / checks.length) * 100) / 100 : 0;

  const failedChecks = checks.filter(c => c.status === 'fail').map(c => c.name);
  const warnedChecks = checks.filter(c => c.status === 'warn').map(c => c.name);

  let summary: string;
  if (verdict === 'reject') summary = `Rejected: ${failedChecks.join(', ')} failed.`;
  else if (verdict === 'request-changes') summary = `Changes requested: ${warnCount} warnings need attention.`;
  else summary = 'All checks passed. Change is clean and within boundaries.';

  let recommendation: string;
  if (verdict === 'reject') recommendation = `Fix the following before resubmitting: ${failedChecks.join(', ')}.`;
  else if (verdict === 'request-changes') recommendation = `Address warnings in: ${warnedChecks.join(', ')}.`;
  else recommendation = 'Approve. Change is clean, tested, and within boundaries.';

  return {
    branch,
    timestamp: new Date().toISOString(),
    verdict,
    confidence,
    summary,
    checks,
    risks,
    recommendation,
  };
}
