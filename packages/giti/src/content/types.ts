export interface EvolutionDispatch {
  cycle: number;
  timestamp: string;
  headline: string;
  narrative: string;
  key_moments: Array<{ moment: string; significance: string }>;
  stats: {
    changes_merged: number;
    changes_rejected: number;
    growth_proposals: number;
    fitness_delta: number;
    streak: number;
  };
  content_hooks: string[];
  milestone?: string;
  platform_versions: {
    twitter: string;
    linkedin: string;
    hn: string;
    blog: string;
  };
}

export type MilestoneType =
  | 'first-cycle'
  | 'first-merge'
  | 'first-growth-proposal'
  | 'first-growth-shipped'
  | 'changes-10'
  | 'changes-25'
  | 'changes-50'
  | 'changes-100'
  | 'first-self-fix'
  | 'first-self-rejection'
  | 'ship-of-theseus';
