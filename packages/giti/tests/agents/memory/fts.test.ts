import { describe, it, expect } from 'vitest';
import { stem, tokenize } from '../../../src/agents/memory/fts.js';

// ── stem() ─────────────────────────────────────────────────────────

describe('stem', () => {
  it('removes plural -s suffix', () => {
    expect(stem('regressions')).toBe('regress');
  });

  it('removes -ing suffix', () => {
    expect(stem('testing')).toBe('test');
  });

  it('removes -ed suffix', () => {
    expect(stem('analyzed')).toBe('analyz');
  });

  it('removes -ance suffix', () => {
    expect(stem('performance')).toBe('perform');
  });

  it('handles short words that should not change', () => {
    expect(stem('bug')).toBe('bug');
    expect(stem('fix')).toBe('fix');
    expect(stem('api')).toBe('api');
  });

  it('lowercases input', () => {
    expect(stem('REGRESSION')).toBe('regress');
  });

  it('removes -sses → -ss', () => {
    expect(stem('addresses')).toBe('address');
  });

  it('removes -ies → -i', () => {
    expect(stem('dependencies')).toBe('dependenci');
  });

  it('keeps -ss unchanged', () => {
    expect(stem('loss')).toBe('loss');
  });

  it('removes -ational → -ate', () => {
    expect(stem('relational')).toBe('relate');
  });

  it('removes -tional → -tion', () => {
    expect(stem('conditional')).toBe('condition');
  });

  it('removes -iveness → -ive', () => {
    expect(stem('effectiveness')).toBe('effective');
  });

  it('removes -fulness → -ful', () => {
    expect(stem('usefulness')).toBe('useful');
  });

  it('removes -ousness → -ous', () => {
    expect(stem('nervousness')).toBe('nervous');
  });

  it('removes -ence suffix', () => {
    expect(stem('dependence')).toBe('depend');
  });

  it('removes -ment suffix', () => {
    expect(stem('deployment')).toBe('deploy');
  });

  it('removes -able suffix', () => {
    expect(stem('testable')).toBe('test');
  });

  it('removes -ible suffix', () => {
    expect(stem('accessible')).toBe('access');
  });

  it('produces same stem for related words', () => {
    const stems = [stem('test'), stem('testing'), stem('tested'), stem('tests')];
    expect(new Set(stems).size).toBe(1);
  });
});

// ── tokenize() ─────────────────────────────────────────────────────

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world']);
  });

  it('splits on punctuation and special characters', () => {
    expect(tokenize('commit-analyzer.ts')).toEqual(['commit', 'analyzer']);
  });

  it('filters stopwords and short words', () => {
    expect(tokenize('the a in of to is')).toEqual([]);
  });

  it('filters stopwords from mixed input', () => {
    expect(tokenize('regression in the analyzer')).toEqual(['regression', 'analyzer']);
  });

  it('lowercases tokens', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('deduplicates tokens', () => {
    expect(tokenize('test test test')).toEqual(['test']);
  });

  it('filters words shorter than 3 characters', () => {
    expect(tokenize('I am a ok it')).toEqual([]);
  });
});
