import { describe, it, expect } from 'vitest';
import type { EvolutionDispatch } from '../../src/content/types.js';
import {
  formatForTwitter,
  formatForLinkedIn,
  formatForHN,
  formatForBlog,
} from '../../src/content/platform-formatter.js';

function makeStats(overrides: Partial<EvolutionDispatch['stats']> = {}): EvolutionDispatch['stats'] {
  return {
    changes_merged: 3,
    changes_rejected: 1,
    growth_proposals: 2,
    fitness_delta: 5,
    streak: 4,
    ...overrides,
  };
}

describe('formatForTwitter', () => {
  it('returns a string <= 280 chars', () => {
    const result = formatForTwitter('Cycle #10: steady progress', makeStats());
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('includes the headline and stats', () => {
    const stats = makeStats({ changes_merged: 7, fitness_delta: 3 });
    const result = formatForTwitter('Organism evolved', stats);
    expect(result).toContain('Organism evolved');
    expect(result).toContain('7 changes merged');
    expect(result).toContain('+3');
  });

  it('truncates long content to 280 chars', () => {
    const longHeadline = 'A'.repeat(300);
    const result = formatForTwitter(longHeadline, makeStats());
    expect(result.length).toBeLessThanOrEqual(280);
    expect(result).toMatch(/\.\.\.$/);
  });

  it('includes milestone when present', () => {
    const result = formatForTwitter('Headline', makeStats(), 'first-merge');
    expect(result).toContain('Milestone: first-merge');
  });

  it('shows negative fitness delta without plus sign', () => {
    const stats = makeStats({ fitness_delta: -2 });
    const result = formatForTwitter('Headline', stats);
    expect(result).toContain('fitness -2');
    expect(result).not.toContain('fitness +-2');
  });
});

describe('formatForLinkedIn', () => {
  it('includes headline, narrative, and stats', () => {
    const stats = makeStats({ changes_merged: 5, growth_proposals: 3 });
    const result = formatForLinkedIn('Big update', 'The organism grew significantly.', stats);
    expect(result).toContain('Big update');
    expect(result).toContain('The organism grew significantly.');
    expect(result).toContain('5 changes merged');
    expect(result).toContain('3 growth proposals');
    expect(result).toContain('#AI');
  });
});

describe('formatForHN', () => {
  it('includes headline and streak', () => {
    const stats = makeStats({ changes_merged: 12, streak: 7 });
    const result = formatForHN('Self-evolving codebase update', stats);
    expect(result).toContain('Self-evolving codebase update');
    expect(result).toContain('12 changes');
    expect(result).toContain('7 cycle streak');
  });
});

describe('formatForBlog', () => {
  it('includes narrative, key moments, and stats sections', () => {
    const stats = makeStats({ changes_merged: 4, growth_proposals: 1, fitness_delta: 2, streak: 3 });
    const keyMoments = [
      { moment: 'First merge', significance: 'A historic event' },
      { moment: 'Immune active', significance: 'Rejected bad code' },
    ];
    const result = formatForBlog('The organism made progress this cycle.', keyMoments, stats);

    // Narrative
    expect(result).toContain('The organism made progress this cycle.');

    // Key moments
    expect(result).toContain('## Key Moments');
    expect(result).toContain('**First merge**');
    expect(result).toContain('A historic event');
    expect(result).toContain('**Immune active**');

    // Stats
    expect(result).toContain('## Stats');
    expect(result).toContain('Changes merged: 4');
    expect(result).toContain('Growth proposals: 1');
    expect(result).toContain('Fitness delta: 2');
    expect(result).toContain('Streak: 3 productive cycles');
  });

  it('omits key moments section when empty', () => {
    const result = formatForBlog('Narrative text.', [], makeStats());
    expect(result).not.toContain('## Key Moments');
  });
});
