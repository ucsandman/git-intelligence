import { runGrowthHormone, loadAllProposals } from '../agents/growth-hormone/index.js';
import { formatGrowthReport, formatProposalDetail } from '../agents/growth-hormone/formatter.js';
import ora from 'ora';

export async function executeGrow(options: { path?: string; json?: boolean; show?: boolean | string }): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  // Show mode: display existing proposals
  if (options.show !== undefined && options.show !== false) {
    const proposals = await loadAllProposals(repoPath);
    if (typeof options.show === 'string') {
      // Show specific proposal
      const proposal = proposals.find(p => p.id === options.show || p.id.startsWith(options.show as string));
      if (!proposal) {
        console.error(`Proposal not found: ${options.show}`);
        process.exit(1);
      }
      if (options.json) {
        console.log(JSON.stringify(proposal, null, 2));
      } else {
        console.log(formatProposalDetail(proposal));
      }
    } else {
      // Show all proposals
      if (options.json) {
        console.log(JSON.stringify(proposals, null, 2));
      } else {
        if (proposals.length === 0) {
          console.log('No growth proposals found.');
        } else {
          console.log(`${proposals.length} proposal(s):\n`);
          for (const p of proposals) {
            console.log(`  [${p.status}] ${p.id.slice(0, 8)} — ${p.title}`);
          }
        }
      }
    }
    return;
  }

  // Default: run growth analysis
  const spinner = options.json ? null : ora('Analyzing growth signals...').start();

  try {
    const { signals, proposals } = await runGrowthHormone(repoPath);
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify({ signals, proposals }, null, 2));
    } else {
      console.log(formatGrowthReport(signals, proposals));
    }
  } catch (error) {
    spinner?.fail('Growth analysis failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
