export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  auto_merge: boolean;
  auto_merge_delay_ms: number;
}

export interface PRParams {
  branch: string;
  title: string;
  body: string;
  labels: string[];
  base?: string;
}

export interface PRResult {
  number: number;
  url: string;
}
