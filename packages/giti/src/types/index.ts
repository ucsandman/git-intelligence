export interface PulseResult {
  repoName: string;
  lastCommit: {
    date: Date;
    message: string;
    author: string;
  };
  weeklyCommits: {
    count: number;
    authorCount: number;
  };
  branches: {
    active: number;
    stale: number;
  };
  hottestFile: {
    path: string;
    changeCount: number;
  } | null;
  testRatio: {
    testFiles: number;
    sourceFiles: number;
    percentage: number;
  };
  avgCommitSize: number;
  busFactor: {
    count: number;
    topAuthorsPercentage: number;
    topAuthorCount: number;
  };
}

export interface HotspotEntry {
  filepath: string;
  changes: number;
  authors: number;
  bugFixes: number;
}

export interface CouplingPair {
  fileA: string;
  fileB: string;
  percentage: number;
  coOccurrences: number;
}

export interface HotspotsResult {
  period: string;
  hotspots: HotspotEntry[];
  couplings: CouplingPair[];
}

export interface StaleBranch {
  name: string;
  lastCommitDate: Date;
  author: string;
  aheadOfMain: number;
  commitCount: number;
}

export interface DeadCodeSignal {
  filepath: string;
  lastModified: Date;
  importedByCount: number;
}

export interface GhostsResult {
  staleBranches: StaleBranch[];
  deadCode: DeadCodeSignal[];
}
