import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../src/utils/time.js';

describe('formatRelativeTime', () => {
  it('formats seconds ago', () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const date = new Date(Date.now() - 45 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('45m ago');
  });

  it('formats hours ago', () => {
    const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2h ago');
  });

  it('formats days ago', () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('3d ago');
  });

  it('formats weeks ago', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2 weeks ago');
  });

  it('formats months ago', () => {
    const date = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('4 months ago');
  });

  it('formats years ago', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('1 year ago');
  });
});
