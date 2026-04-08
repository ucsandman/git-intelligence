import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readFile, writeFile, access } from 'node:fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { getOrganismPath, readJsonFile, ensureOrganismDir } from '../agents/utils.js';

interface ObservatoryOptions {
  path: string;
  port?: string;
  json?: boolean;
}

export async function executeObservatory(
  subcommand: string | undefined,
  options: ObservatoryOptions,
): Promise<void> {
  const repoPath = resolve(options.path || '.');

  switch (subcommand) {
    case 'push':
      return executePush(repoPath, options);
    case 'status':
      return executeStatus(repoPath, options);
    default:
      return executeServe(repoPath, options);
  }
}

async function executeServe(
  repoPath: string,
  options: ObservatoryOptions,
): Promise<void> {
  const port = options.port ?? '3333';
  const spinner = ora('Starting observatory...').start();

  // Verify .organism/ exists
  try {
    await access(join(repoPath, '.organism'));
  } catch {
    spinner.fail('No .organism/ directory found. Run a lifecycle cycle first.');
    process.exit(1);
  }

  spinner.succeed(`Observatory starting on http://localhost:${port}`);

  // Start the Next.js dev server from the observatory package
  const observatoryPath = resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'giti-observatory',
  );

  const child = spawn('npx', ['next', 'dev', '--port', port], {
    cwd: observatoryPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      GITI_REPO_PATH: repoPath,
    },
    shell: true,
  });

  child.on('error', (err: Error) => {
    console.error(chalk.red(`Failed to start observatory: ${err.message}`));
    process.exit(1);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });
}

async function executePush(
  repoPath: string,
  options: ObservatoryOptions,
): Promise<void> {
  const spinner = ora('Building snapshot...').start();

  // Read key .organism/ files inline — no cross-package dependency
  const [cycleCounter, knowledgeBase, organismConfig] = await Promise.all([
    readJsonFile<{ cycle: number }>(getOrganismPath(repoPath, 'cycle-counter.json')),
    readJsonFile<{ lessons: unknown[]; patterns: unknown[] }>(
      getOrganismPath(repoPath, 'knowledge-base.json'),
    ),
    readJsonFile<{ name?: string; version?: string; quality?: Record<string, unknown> }>(
      join(repoPath, 'organism.json'),
    ),
  ]);

  const snapshot = {
    generated_at: new Date().toISOString(),
    organism: {
      name: organismConfig?.name ?? 'unknown',
      version: organismConfig?.version ?? '0.0.0',
      current_state: 'idle',
      total_cycles: cycleCounter?.cycle ?? 0,
      total_changes_merged: 0,
    },
    vitals: {
      fitness_score: 0,
      quality: organismConfig?.quality ?? {},
    },
    knowledge: {
      lesson_count: knowledgeBase?.lessons?.length ?? 0,
      pattern_count: knowledgeBase?.patterns?.length ?? 0,
    },
  };

  await ensureOrganismDir(repoPath);
  const snapshotPath = getOrganismPath(repoPath, 'observatory-snapshot.json');
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  spinner.succeed(`Snapshot saved to ${snapshotPath}`);

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(chalk.dim(`  Cycles: ${snapshot.organism.total_cycles}`));
    console.log(chalk.dim(`  Lessons: ${snapshot.knowledge.lesson_count}`));
    console.log(chalk.dim(`  Patterns: ${snapshot.knowledge.pattern_count}`));
    console.log(chalk.dim(`  Organism: ${snapshot.organism.name}`));
  }
}

async function executeStatus(
  repoPath: string,
  options: ObservatoryOptions,
): Promise<void> {
  const snapshotPath = getOrganismPath(repoPath, 'observatory-snapshot.json');

  try {
    const raw = await readFile(snapshotPath, 'utf-8');
    const snapshot = JSON.parse(raw) as {
      generated_at?: string;
      organism?: { name?: string; total_cycles?: number; current_state?: string };
    };

    if (options.json) {
      console.log(JSON.stringify({ last_push: snapshotPath, snapshot }, null, 2));
    } else {
      console.log(chalk.bold('Observatory Status'));
      console.log(chalk.dim(`  Last snapshot: ${snapshotPath}`));
      console.log(chalk.dim(`  Generated:     ${snapshot.generated_at ?? 'unknown'}`));
      console.log(chalk.dim(`  Organism:      ${snapshot.organism?.name ?? 'unknown'}`));
      console.log(chalk.dim(`  Cycles:        ${snapshot.organism?.total_cycles ?? 0}`));
      console.log(chalk.dim(`  State:         ${snapshot.organism?.current_state ?? 'unknown'}`));
    }
  } catch {
    console.log(chalk.yellow('No observatory snapshot found. Run `giti observatory push` first.'));
  }
}
