import simpleGit from 'simple-git';

export async function createBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.checkoutLocalBranch(branchName);
}

export async function commitChanges(repoPath: string, message: string, files: string[]): Promise<string> {
  const git = simpleGit(repoPath);
  await git.add(files);
  const result = await git.commit(message);
  return result.commit;
}

export async function switchToMain(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const branches = await git.branch();
  const main = branches.all.includes('main') ? 'main' : 'master';
  await git.checkout(main);
}

export async function mergeBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.merge([branch, '--no-ff']);
}

export async function deleteBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.deleteLocalBranch(branch, true);
}

export async function pushBranch(repoPath: string, branchName: string, remote: string = 'origin'): Promise<void> {
  const git = simpleGit(repoPath);
  await git.push(remote, branchName);
}

export async function deleteRemoteBranch(repoPath: string, branchName: string, remote: string = 'origin'): Promise<void> {
  const git = simpleGit(repoPath);
  await git.push(remote, `:${branchName}`);
}

export function generateBranchName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/, '');
  return `organism/motor/${slug}`;
}

export function formatCommitMessage(
  title: string,
  workItemId: string,
  tier: number,
  cycleNumber: number,
  description: string,
  rationale: string,
): string {
  return [
    `organism(motor): ${title}`,
    '',
    `Work item: ${workItemId}`,
    `Tier: ${tier}`,
    `Cycle: ${cycleNumber}`,
    '',
    description,
    '',
    `Rationale: ${rationale}`,
  ].join('\n');
}
