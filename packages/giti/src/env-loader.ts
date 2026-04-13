import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

/**
 * Load .env by walking up from process.cwd() until one is found or the
 * filesystem root is reached. Runs only once per process; subsequent calls
 * are no-ops. Callers can safely invoke it from any CLI entry or script
 * without worrying about which directory the user launched from.
 */
export function loadEnv(): { path: string | null } {
  if (loaded) return { path: null };
  loaded = true;

  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      config({ path: candidate });
      return { path: candidate };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return { path: null };
    dir = parent;
  }
}
