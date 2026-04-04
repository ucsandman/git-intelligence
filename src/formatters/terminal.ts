import chalk from 'chalk';
import type { PulseResult, HotspotsResult, GhostsResult } from '../types/index.js';
import { formatRelativeTime } from '../utils/time.js';

export function formatPulse(result: PulseResult): string {
  const separator = '─'.repeat(35);

  const truncatedMessage =
    result.lastCommit.message.length > 50
      ? result.lastCommit.message.slice(0, 50) + '...'
      : result.lastCommit.message;

  const hottestFileLine =
    result.hottestFile !== null
      ? `${result.hottestFile.path} (modified ${result.hottestFile.changeCount} times this week)`
      : 'No file changes this week';

  const lines = [
    chalk.bold(`📊 Repository Pulse: ${result.repoName}`),
    chalk.dim(separator),
    `${chalk.yellow('Last commit:')}        ${chalk.green(`${formatRelativeTime(result.lastCommit.date)} (${truncatedMessage})`)}`,
    `${chalk.yellow('Commits (7d):')}       ${chalk.green(`${result.weeklyCommits.count} commits by ${result.weeklyCommits.authorCount} authors`)}`,
    `${chalk.yellow('Active branches:')}    ${chalk.green(`${result.branches.active} (${result.branches.stale} stale > 30d)`)}`,
    `${chalk.yellow('Hottest file:')}       ${chalk.green(hottestFileLine)}`,
    `${chalk.yellow('Test ratio:')}         ${chalk.green(`${result.testRatio.testFiles}/${result.testRatio.sourceFiles} files (${result.testRatio.percentage}%)`)}`,
    `${chalk.yellow('Avg commit size:')}    ${chalk.green(`${result.avgCommitSize} lines changed`)}`,
    `${chalk.yellow('Bus factor:')}         ${chalk.green(`${result.busFactor.count} (${result.busFactor.topAuthorsPercentage}% of commits from top ${result.busFactor.topAuthorCount} authors)`)}`,
  ];

  return lines.join('\n');
}

export function formatHotspots(result: HotspotsResult): string {
  const separator = '─'.repeat(36);
  const maxNumWidth = String(result.hotspots.length).length;

  const lines: string[] = [
    chalk.bold(`🔥 Codebase Hotspots (last ${result.period})`),
    chalk.dim(separator),
  ];

  for (let i = 0; i < result.hotspots.length; i++) {
    const entry = result.hotspots[i]!;
    const num = String(i + 1).padStart(maxNumWidth, ' ');
    lines.push(
      ` ${chalk.red(`${num}.`)} ${entry.filepath}  — ${entry.changes} changes, ${entry.authors} authors, ${entry.bugFixes} bug fixes`,
    );
  }

  if (result.couplings.length > 0) {
    lines.push('');
    lines.push(`${chalk.yellow('⚠')} Coupling detected:`);
    for (const coupling of result.couplings) {
      lines.push(
        `  ${coupling.fileA} ↔ ${coupling.fileB} — change together ${coupling.percentage}% of the time (${coupling.coOccurrences} co-occurrences)`,
      );
    }
  }

  return lines.join('\n');
}

export function formatGhosts(result: GhostsResult, mainBranch: string = 'main'): string {
  const separator = '─'.repeat(17);

  const lines: string[] = [
    chalk.bold('👻 Abandoned Work'),
    chalk.dim(separator),
  ];

  if (result.staleBranches.length > 0) {
    lines.push(chalk.gray('Stale branches (no commits > 30d):'));
    for (const branch of result.staleBranches) {
      lines.push(
        chalk.gray(
          `  ${branch.name}    — last touched ${formatRelativeTime(branch.lastCommitDate)} by @${branch.author} (${branch.aheadOfMain} lines ahead of ${mainBranch})`,
        ),
      );
    }
    lines.push('');
  }

  if (result.deadCode.length > 0) {
    lines.push(chalk.gray('Dead code signals:'));
    for (const signal of result.deadCode) {
      lines.push(
        chalk.gray(
          `  ${signal.filepath}       — last modified ${formatRelativeTime(signal.lastModified)} ago, imported by ${signal.importedByCount} files`,
        ),
      );
    }
    lines.push('');
  }

  lines.push(
    `Summary: ${result.staleBranches.length} stale branches, ${result.deadCode.length} potential dead files`,
  );

  return lines.join('\n');
}
