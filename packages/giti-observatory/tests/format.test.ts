import { describe, it, expect } from 'vitest';
import { friendlyLabel, friendlyOutcome, relativeTime } from '../src/lib/format';

describe('friendlyLabel', () => {
  it('converts technical metric names to human labels', () => {
    expect(friendlyLabel('fitness_score')).toBe('Health');
    expect(friendlyLabel('test_coverage')).toBe('Test Coverage');
    expect(friendlyLabel('mutation_success_rate')).toBe('Success Rate');
    expect(friendlyLabel('regression_rate')).toBe('Regression Rate');
    expect(friendlyLabel('commit_velocity_7d')).toBe('Weekly Activity');
    expect(friendlyLabel('dependency_health')).toBe('Dependency Health');
    expect(friendlyLabel('complexity_avg')).toBe('Complexity');
  });
});

describe('friendlyOutcome', () => {
  it('converts outcome codes to human phrases', () => {
    expect(friendlyOutcome('productive')).toBe('Productive');
    expect(friendlyOutcome('stable')).toBe('Stable');
    expect(friendlyOutcome('no-changes')).toBe('No Changes');
    expect(friendlyOutcome('regression')).toBe('Regression');
    expect(friendlyOutcome('human-declined')).toBe('Human Declined');
    expect(friendlyOutcome('aborted')).toBe('Aborted');
  });
});

describe('relativeTime', () => {
  it('formats recent timestamps as relative', () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(relativeTime(fiveMinAgo)).toBe('5 minutes ago');
  });

  it('formats hours ago', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    expect(relativeTime(twoHoursAgo)).toBe('2 hours ago');
  });

  it('formats days ago', () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400 * 1000).toISOString();
    expect(relativeTime(threeDaysAgo)).toBe('3 days ago');
  });
});
