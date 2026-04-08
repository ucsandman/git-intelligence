import { describe, it, expect } from 'vitest';
import { stem, tokenize, createIndex, addDocument, search } from '../../../src/agents/memory/fts.js';
import type { FTSDocument } from '../../../src/agents/memory/fts.js';

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

// ── createIndex() ─────────────────────────────────────────────────

describe('createIndex', () => {
  it('creates an empty index with given field weights', () => {
    const index = createIndex({ content: 1.0, tags: 0.8 });
    expect(index.documentCount).toBe(0);
    expect(index.fieldWeights).toEqual({ content: 1.0, tags: 0.8 });
    expect(index.invertedIndex.size).toBe(0);
    expect(index.documents.size).toBe(0);
  });
});

// ── addDocument + search ──────────────────────────────────────────

describe('addDocument + search', () => {
  function makeDoc(
    id: string,
    fields: Record<string, string>,
    type: FTSDocument['type'] = 'event',
  ): FTSDocument {
    return {
      id,
      type,
      content: fields['content'] ?? fields['title'] ?? '',
      timestamp: new Date().toISOString(),
      fields,
    };
  }

  it('finds a document by matching terms', () => {
    const index = createIndex({ content: 1.0 });
    addDocument(index, makeDoc('d1', { content: 'regression detected in analyzer' }));
    const results = search(index, 'regression');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('d1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns empty results for no match', () => {
    const index = createIndex({ content: 1.0 });
    addDocument(index, makeDoc('d1', { content: 'regression detected in analyzer' }));
    const results = search(index, 'kubernetes');
    expect(results).toEqual([]);
  });

  it('ranks documents by TF-IDF score', () => {
    const index = createIndex({ content: 1.0 });
    addDocument(index, makeDoc('d1', { content: 'test passes quickly' }));
    addDocument(index, makeDoc('d2', { content: 'test test test multiple mentions' }));
    addDocument(index, makeDoc('d3', { content: 'unrelated document here' }));
    const results = search(index, 'test');
    expect(results.length).toBe(2);
    // d2 has higher TF for "test", should rank first
    expect(results[0].id).toBe('d2');
    expect(results[1].id).toBe('d1');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('applies field weights', () => {
    const index = createIndex({ title: 2.0, body: 0.5 });
    // "regression" in high-weight title field
    addDocument(index, makeDoc('d1', { title: 'regression found', body: 'details here' }));
    // "regression" in low-weight body field
    addDocument(index, makeDoc('d2', { title: 'some title', body: 'regression found' }));
    const results = search(index, 'regression');
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('d1');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('respects limit parameter', () => {
    const index = createIndex({ content: 1.0 });
    for (let i = 0; i < 10; i++) {
      addDocument(index, makeDoc(`d${i}`, { content: `test document number ${i}` }));
    }
    const results = search(index, 'test', 3);
    expect(results.length).toBe(3);
  });

  it('matches stemmed forms (regression matches regressions)', () => {
    const index = createIndex({ content: 1.0 });
    addDocument(index, makeDoc('d1', { content: 'multiple regressions detected' }));
    const results = search(index, 'regression');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('d1');
  });

  it('returns empty for empty query', () => {
    const index = createIndex({ content: 1.0 });
    addDocument(index, makeDoc('d1', { content: 'some content here' }));
    expect(search(index, '')).toEqual([]);
    // Stopword-only query should also return empty
    expect(search(index, 'the a in')).toEqual([]);
  });
});
