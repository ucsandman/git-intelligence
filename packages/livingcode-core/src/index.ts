import type { LivingCodebaseConfig } from './types.js';

export type { OrganismConfig, LivingCodebaseConfig } from './types.js';

export class LivingCodebase {
  constructor(public readonly config: LivingCodebaseConfig) {}

  async start(): Promise<void> {
    throw new Error('Not yet implemented — framework extraction in progress. See packages/giti/ for the working reference implementation.');
  }

  async stop(): Promise<void> {
    throw new Error('Not yet implemented');
  }

  async runCycle(options?: { supervised?: boolean }): Promise<unknown> {
    void options;
    throw new Error('Not yet implemented — framework extraction in progress');
  }

  async sense(): Promise<unknown> {
    throw new Error('Not yet implemented');
  }

  async plan(): Promise<unknown> {
    throw new Error('Not yet implemented');
  }

  async build(_workItemId: string): Promise<unknown> {
    throw new Error('Not yet implemented');
  }

  async review(_branchName: string): Promise<unknown> {
    throw new Error('Not yet implemented');
  }
}
