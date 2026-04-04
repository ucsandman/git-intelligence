import { recordMemoryEvent, queryMemory, getMemorySummary } from '../agents/memory/index.js';
import { formatMemorySummary, formatQueryResults } from '../agents/memory/formatter.js';
import type { EventType } from '../agents/types.js';

export async function executeRemember(
  subcommand: string,
  args: string[],
  options: { path?: string; json?: boolean; type?: string; data?: string; category?: string },
): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  switch (subcommand) {
    case 'record': {
      if (!options.type) {
        console.error('--type is required for record subcommand');
        process.exit(1);
      }
      const type = options.type as EventType;
      const data = options.data ? (JSON.parse(options.data) as Record<string, unknown>) : {};
      const tags = [type];
      await recordMemoryEvent(repoPath, type, `Manual event: ${type}`, data, tags);
      console.log(`Event recorded: ${type}`);
      break;
    }
    case 'query': {
      const query = args.join(' ');
      if (!query) {
        console.error('Query string is required');
        process.exit(1);
      }
      const result = await queryMemory(repoPath, query);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatQueryResults(result));
      }
      break;
    }
    case 'summary': {
      const kb = await getMemorySummary(repoPath);
      if (options.json) {
        console.log(JSON.stringify(kb, null, 2));
      } else {
        console.log(formatMemorySummary(kb));
      }
      break;
    }
    default: {
      console.error(`Unknown subcommand: ${subcommand}. Use: record, query, summary`);
      process.exit(1);
    }
  }
}
