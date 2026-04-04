import { describe, it, expect } from 'vitest';
import { getRepoName, getMainBranch, parsePeriod } from '../../src/utils/git.js';

describe('getRepoName', () => {
  it('extracts repo name from unix path', () => {
    expect(getRepoName('/home/user/projects/my-app')).toBe('my-app');
  });

  it('extracts repo name from windows path', () => {
    expect(getRepoName('C:\\Projects\\git-intelligence')).toBe('git-intelligence');
  });
});

describe('getMainBranch', () => {
  it('prefers main', () => {
    expect(getMainBranch(['main', 'develop', 'feature/x'])).toBe('main');
  });

  it('falls back to master', () => {
    expect(getMainBranch(['master', 'develop'])).toBe('master');
  });

  it('falls back to first branch', () => {
    expect(getMainBranch(['develop', 'feature/x'])).toBe('develop');
  });

  it('returns main for empty array', () => {
    expect(getMainBranch([])).toBe('main');
  });
});

describe('parsePeriod', () => {
  it('parses days', () => {
    const result = parsePeriod('30d');
    const expected = new Date();
    expected.setDate(expected.getDate() - 30);
    expect(result.getDate()).toBe(expected.getDate());
  });

  it('parses weeks', () => {
    const result = parsePeriod('2w');
    const expected = new Date();
    expected.setDate(expected.getDate() - 14);
    expect(result.getDate()).toBe(expected.getDate());
  });

  it('parses months', () => {
    const result = parsePeriod('3m');
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 3);
    expect(result.getMonth()).toBe(expected.getMonth());
  });

  it('parses years', () => {
    const result = parsePeriod('1y');
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() - 1);
    expect(result.getFullYear()).toBe(expected.getFullYear());
  });

  it('throws on invalid format', () => {
    expect(() => parsePeriod('abc')).toThrow('Invalid period format');
    expect(() => parsePeriod('30x')).toThrow('Invalid period format');
  });
});
