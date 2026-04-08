import { NextResponse } from 'next/server';
import { buildSnapshot } from '@/data/snapshot-builder';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repoPath = url.searchParams.get('path') ?? process.env['GITI_REPO_PATH'] ?? process.cwd();

  try {
    const snapshot = await buildSnapshot(repoPath);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
