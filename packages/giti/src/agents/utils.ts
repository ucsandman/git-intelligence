import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { OrganismConfig } from './types.js';

const ORGANISM_DIR = '.organism';

export async function ensureOrganismDir(repoPath: string, ...subdirs: string[]): Promise<string> {
  const dir = path.join(repoPath, ORGANISM_DIR, ...subdirs);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadOrganismConfig(repoPath: string): Promise<OrganismConfig> {
  const configPath = path.join(repoPath, 'organism.json');
  const config = await readJsonFile<Record<string, unknown>>(configPath);
  if (!config) {
    throw new Error(`organism.json not found at ${configPath}`);
  }
  return config as unknown as OrganismConfig;
}

export function getOrganismPath(repoPath: string, ...parts: string[]): string {
  return path.join(repoPath, ORGANISM_DIR, ...parts);
}

function resolveCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command;
  }

  const lower = command.toLowerCase();
  if (lower === 'npm' || lower === 'npx') {
    return `${command}.cmd`;
  }

  return command;
}

export function runCommand(command: string, args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const resolved = resolveCommand(command);
  // Node's CVE-2024-27980 mitigation rejects spawning `.cmd`/`.bat` via
  // execFile with shell: false (throws EINVAL). On Windows we must run
  // shims like npm.cmd / npx.cmd through a shell. All args here come from
  // internal code, not user input, so this is safe.
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved);
  try {
    const stdout = execFileSync(resolved, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
      shell: needsShell,
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      status: err.status ?? 1,
    };
  }
}
