import chalk from 'chalk';
import type { KnowledgeBase, QueryResult } from './types.js';

export function formatMemorySummary(kb: KnowledgeBase): string {
  const lines: string[] = [];

  lines.push(chalk.bold('🧠 Organism Memory Summary'));
  lines.push(chalk.dim('───────────────────────────'));
  lines.push(`Lifecycle cycles completed: ${kb.cycle_count}`);
  lines.push(`Total events recorded:      ${kb.events.length}`);
  lines.push(`Lessons learned:            ${kb.lessons.length}`);
  lines.push(`Preferences emerged:        ${kb.preferences.length}`);
  lines.push('');

  // Top lessons by confidence (top 5)
  lines.push('Top lessons (by confidence):');
  if (kb.lessons.length === 0) {
    lines.push('  none');
  } else {
    const sorted = [...kb.lessons].sort((a, b) => b.confidence - a.confidence);
    const top = sorted.slice(0, 5);
    top.forEach((lesson, i) => {
      lines.push(`  ${i + 1}. [${lesson.confidence.toFixed(2)}] ${lesson.lesson}`);
    });
  }
  lines.push('');

  // Emerged preferences (all)
  lines.push('Emerged preferences:');
  if (kb.preferences.length === 0) {
    lines.push('  none');
  } else {
    kb.preferences.forEach((pref, i) => {
      lines.push(`  ${i + 1}. ${pref.preference} (observed ${pref.evidence_count} times)`);
    });
  }
  lines.push('');

  // Fragile files (all)
  lines.push('Fragile files:');
  if (kb.patterns.fragile_files.length === 0) {
    lines.push('  none');
  } else {
    for (const file of kb.patterns.fragile_files) {
      lines.push(`  ${file.path} — ${file.regression_count} regressions, last: ${file.last_regression}`);
    }
  }

  return lines.join('\n');
}

export function formatQueryResults(result: QueryResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`🔍 Query: "${result.query}"`));
  lines.push(chalk.dim('────────────────────────────'));

  if (result.results.length === 0) {
    lines.push('  No results found.');
  } else {
    for (const item of result.results) {
      const date = item.timestamp.split('T')[0] ?? item.timestamp;
      lines.push(`  [${item.relevance.toFixed(2)}] (${item.type}) ${item.content} — ${date}`);
    }
  }

  lines.push('');
  lines.push(`${result.total_results} results found.`);

  return lines.join('\n');
}
