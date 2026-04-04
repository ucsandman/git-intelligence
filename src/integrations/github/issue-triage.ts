import type { OrganismConfig } from '../../agents/types.js';

interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

interface TriageResult {
  number: number;
  addressable: boolean;
  reason: string;
}

export function triageIssues(issues: Issue[], config: OrganismConfig): TriageResult[] {
  return issues.map(issue => triageIssue(issue, config));
}

function triageIssue(issue: Issue, config: OrganismConfig): TriageResult {
  const text = `${issue.title} ${issue.body}`.toLowerCase();

  // Check forbidden zone first — never engage with these
  for (const forbidden of config.boundaries.forbidden_zone) {
    const keywords = forbidden.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = keywords.filter(k => text.includes(k)).length;
    if (matchCount >= 2) {
      return { number: issue.number, addressable: false, reason: `Touches forbidden zone: ${forbidden}` };
    }
  }

  // Check if issue matches growth zone topics
  for (const zone of config.boundaries.growth_zone) {
    const keywords = zone.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = keywords.filter(k => text.includes(k)).length;
    if (matchCount >= 2) {
      return { number: issue.number, addressable: true, reason: `Matches growth zone: ${zone}` };
    }
  }

  // Check for common giti-related keywords
  const gitiKeywords = ['pulse', 'hotspots', 'ghosts', 'giti', 'git intelligence', 'commit', 'branch', 'analysis', 'performance', 'coverage', 'test'];
  const matchCount = gitiKeywords.filter(k => text.includes(k)).length;
  if (matchCount >= 2) {
    return { number: issue.number, addressable: true, reason: 'Matches giti capabilities' };
  }

  return { number: issue.number, addressable: false, reason: 'Does not match organism capabilities' };
}

export function formatTriageComment(_issueTitle: string): string {
  return [
    'This looks like something I might be able to address in a future growth cycle. I\'ll analyze it when I next run.',
    '',
    '---',
    '*Comment by the Living Codebase organism.*',
  ].join('\n');
}
