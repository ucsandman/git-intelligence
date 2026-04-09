import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { buildSnapshot } from '@/data/snapshot-builder';

async function findRepoRoot(startDir: string): Promise<string> {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      await access(resolve(dir, '.organism'));
      return dir;
    } catch {
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }
  return startDir;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const explicit = url.searchParams.get('path') ?? process.env['GITI_REPO_PATH'];
  const repoPath = explicit ?? await findRepoRoot(process.cwd());

  try {
    const snapshot = await buildSnapshot(repoPath);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
