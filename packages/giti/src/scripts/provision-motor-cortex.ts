#!/usr/bin/env node
/**
 * One-shot provisioner for the giti motor cortex managed agent.
 *
 * Run this once (or any time you want to deliberately rebuild the store)
 * to create the agent + environment on Anthropic's Managed Agents API and
 * persist their IDs to .organism/managed-agents.json.
 *
 * After that, every `giti build` / `giti cycle` will reuse them instead of
 * spawning a fresh giti-motor-cortex agent per invocation.
 *
 * Usage:
 *   tsx src/scripts/provision-motor-cortex.ts [repoPath]
 *
 * Env:
 *   ANTHROPIC_API_KEY  (required)
 *   GITI_MODEL         (optional, default claude-sonnet-4-6)
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { provisionManagedAgent } from '../agents/motor-cortex/implementer.js';
import { storeFilePath } from '../agents/motor-cortex/managed-agent-store.js';

async function main() {
  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error('ANTHROPIC_API_KEY is required');
    process.exit(1);
  }

  const repoPath = path.resolve(process.argv[2] ?? process.cwd());
  const client = new Anthropic();

  console.log(`Provisioning giti motor cortex for repo: ${repoPath}`);
  const result = await provisionManagedAgent(client, repoPath);

  const action = result.reused ? 'reused' : result.updated ? 'updated' : 'created';
  console.log('');
  console.log(`Agent:       ${result.agentId} (v${result.agentVersion}) [${action}]`);
  console.log(`Environment: ${result.environmentId}`);
  console.log(`Store:       ${storeFilePath(repoPath)}`);
}

main();
