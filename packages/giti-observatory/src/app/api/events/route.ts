import { watch } from 'chokidar';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repoPath = url.searchParams.get('path') ?? process.env['GITI_REPO_PATH'] ?? process.cwd();
  const organismDir = join(repoPath, '.organism');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const watcher = watch(organismDir, {
        ignoreInitial: true,
        depth: 2,
      });

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      send('connected', { timestamp: new Date().toISOString() });

      watcher.on('change', async (filePath) => {
        const relative = filePath.replace(organismDir, '').replace(/\\/g, '/');
        try {
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          send('file-changed', { path: relative, data });
        } catch {
          send('file-changed', { path: relative, data: null });
        }
      });

      watcher.on('add', async (filePath) => {
        const relative = filePath.replace(organismDir, '').replace(/\\/g, '/');
        try {
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          send('file-added', { path: relative, data });
        } catch {
          send('file-added', { path: relative, data: null });
        }
      });

      request.signal.addEventListener('abort', () => {
        watcher.close();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
