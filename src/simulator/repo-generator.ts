import simpleGit, { type SimpleGit } from 'simple-git';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { RepoType } from './types.js';

export async function generateRepo(type: RepoType): Promise<{ repoPath: string; cleanup: () => Promise<void> }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `giti-sim-${type}-`));
  const git = simpleGit(tmpDir);
  await git.init();
  await git.addConfig('user.email', 'sim@giti.dev');
  await git.addConfig('user.name', 'giti-simulator');

  switch (type) {
    case 'small':
      await buildSmallRepo(tmpDir, git);
      break;
    case 'medium':
      await buildMediumRepo(tmpDir, git);
      break;
    case 'large':
      await buildLargeRepo(tmpDir, git);
      break;
    case 'monorepo':
      await buildMonorepo(tmpDir, git);
      break;
    case 'ancient':
      await buildAncientRepo(tmpDir, git);
      break;
    case 'fresh':
      await buildFreshRepo(tmpDir, git);
      break;
  }

  return {
    repoPath: tmpDir,
    cleanup: () => fs.rm(tmpDir, { recursive: true, force: true }),
  };
}

// ── helpers ──────────────────────────────────────────────────────────

async function createFileAndCommit(
  git: SimpleGit,
  dir: string,
  filename: string,
  content: string,
  message: string,
  author?: string,
): Promise<void> {
  const fullPath = path.join(dir, filename);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
  await git.add(filename);
  if (author) {
    await git.addConfig('user.name', author);
  }
  await git.commit(message);
}

function tsContent(name: string, index: number): string {
  return `// ${name} module\nexport function fn${index}(): string {\n  return '${name}-${index}';\n}\n`;
}

// ── builders ─────────────────────────────────────────────────────────

async function buildFreshRepo(dir: string, git: SimpleGit): Promise<void> {
  const files = ['index.ts', 'utils.ts', 'config.ts'];
  for (let i = 0; i < files.length; i++) {
    await createFileAndCommit(git, dir, files[i]!, tsContent(files[i]!, i), `add ${files[i]!}`);
  }
  // Two modification commits
  await createFileAndCommit(git, dir, 'index.ts', tsContent('index-v2', 3), 'update index');
  await createFileAndCommit(git, dir, 'utils.ts', tsContent('utils-v2', 4), 'update utils');
}

async function buildSmallRepo(dir: string, git: SimpleGit): Promise<void> {
  // 10 .ts files, 20 commits from 1 author
  for (let i = 0; i < 10; i++) {
    await createFileAndCommit(git, dir, `file${i}.ts`, tsContent(`file${i}`, i), `add file${i}.ts`);
  }
  // 10 more commits modifying existing files
  for (let i = 0; i < 10; i++) {
    const fileIdx = i % 10;
    await createFileAndCommit(
      git,
      dir,
      `file${fileIdx}.ts`,
      tsContent(`file${fileIdx}-v2`, i + 10),
      `update file${fileIdx}.ts`,
    );
  }
}

async function buildMediumRepo(dir: string, git: SimpleGit): Promise<void> {
  const authors = ['Alice', 'Bob', 'Charlie'];
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
  await fs.mkdir(path.join(dir, 'tests'), { recursive: true });

  // Create 30 files across src/ and tests/
  for (let i = 0; i < 20; i++) {
    const ext = i % 3 === 0 ? '.json' : i % 2 === 0 ? '.js' : '.ts';
    const content = ext === '.json' ? `{ "id": ${i} }` : tsContent(`module${i}`, i);
    const filename = `src/module${i}${ext}`;
    await createFileAndCommit(git, dir, filename, content, `add ${filename}`, authors[i % 3]);
  }
  for (let i = 0; i < 10; i++) {
    const filename = `tests/test${i}.ts`;
    await createFileAndCommit(git, dir, filename, tsContent(`test${i}`, i), `add ${filename}`, authors[i % 3]);
  }

  // 20 modification commits
  for (let i = 0; i < 20; i++) {
    const fileIdx = i % 20;
    const ext = fileIdx % 3 === 0 ? '.json' : fileIdx % 2 === 0 ? '.js' : '.ts';
    const content = ext === '.json' ? `{ "id": ${i}, "v": 2 }` : tsContent(`module${fileIdx}-v2`, i + 30);
    await createFileAndCommit(
      git,
      dir,
      `src/module${fileIdx}${ext}`,
      content,
      `update module${fileIdx}`,
      authors[i % 3],
    );
  }
}

async function buildLargeRepo(dir: string, git: SimpleGit): Promise<void> {
  const authors = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
  const dirs = ['src/core', 'src/api', 'src/utils', 'src/models', 'tests/unit', 'tests/integration'];

  for (const d of dirs) {
    await fs.mkdir(path.join(dir, d), { recursive: true });
  }

  // Create 80 files
  for (let i = 0; i < 80; i++) {
    const subdir = dirs[i % dirs.length]!;
    const filename = `${subdir}/file${i}.ts`;
    await createFileAndCommit(git, dir, filename, tsContent(`file${i}`, i), `add ${filename}`, authors[i % 5]);
  }

  // 20 more modification commits creating hotspot patterns (concentrate on first few files)
  for (let i = 0; i < 20; i++) {
    const hotIdx = i % 5; // concentrate changes in first 5 files
    const subdir = dirs[hotIdx % dirs.length]!;
    const filename = `${subdir}/file${hotIdx}.ts`;
    await createFileAndCommit(
      git,
      dir,
      filename,
      tsContent(`file${hotIdx}-v${i}`, i + 80),
      `hotfix ${filename} iteration ${i}`,
      authors[i % 5],
    );
  }
}

async function buildMonorepo(dir: string, git: SimpleGit): Promise<void> {
  const packages = ['packages/core', 'packages/cli', 'packages/shared'];

  for (const pkg of packages) {
    await fs.mkdir(path.join(dir, pkg, 'src'), { recursive: true });
    await fs.mkdir(path.join(dir, pkg, 'tests'), { recursive: true });
  }

  // Create files across packages
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i]!;
    for (let j = 0; j < 8; j++) {
      const filename = `${pkg}/src/module${j}.ts`;
      await createFileAndCommit(git, dir, filename, tsContent(`${pkg}-module${j}`, j), `add ${filename}`);
    }
    // Package.json for each package
    await createFileAndCommit(
      git,
      dir,
      `${pkg}/package.json`,
      JSON.stringify({ name: `@giti/${pkg.split('/')[1]}`, version: '1.0.0' }, null, 2),
      `add ${pkg}/package.json`,
    );
  }

  // 20 cross-package modification commits
  for (let i = 0; i < 20; i++) {
    const pkgIdx = i % packages.length;
    const fileIdx = i % 8;
    const filename = `${packages[pkgIdx]!}/src/module${fileIdx}.ts`;
    await createFileAndCommit(git, dir, filename, tsContent(`updated-${fileIdx}`, i + 50), `update ${filename}`);
  }
}

async function buildAncientRepo(dir: string, git: SimpleGit): Promise<void> {
  const now = Date.now();
  const threeYearsMs = 3 * 365 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < 50; i++) {
    const age = threeYearsMs - (threeYearsMs / 50) * i;
    const commitDate = new Date(now - age).toISOString();
    const filename = `file${i}.ts`;

    await fs.writeFile(path.join(dir, filename), tsContent(`file${i}`, i), 'utf-8');
    await git.add(filename);
    await git.raw([
      'commit',
      '-m',
      `add ${filename}`,
      `--date=${commitDate}`,
    ]);
  }
}
