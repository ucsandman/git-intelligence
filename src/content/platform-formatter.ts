import type { EvolutionDispatch } from './types.js';

export function formatForTwitter(headline: string, stats: EvolutionDispatch['stats'], milestone?: string): string {
  const base = milestone ? `\uD83C\uDFAF Milestone: ${milestone}\n\n` : '';
  const statLine = `${stats.changes_merged} changes merged | fitness ${stats.fitness_delta > 0 ? '+' : ''}${stats.fitness_delta}`;
  const tweet = `${base}\uD83E\uDDEC ${headline}\n\n${statLine}\n\n#LivingCodebase #AI`;
  return tweet.length > 280 ? tweet.slice(0, 277) + '...' : tweet;
}

export function formatForLinkedIn(headline: string, narrative: string, stats: EvolutionDispatch['stats']): string {
  return `\uD83E\uDDEC Living Codebase Update\n\n${headline}\n\n${narrative}\n\nStats: ${stats.changes_merged} changes merged, ${stats.growth_proposals} growth proposals\n\n#AI #DevTools #Autonomy`;
}

export function formatForHN(headline: string, stats: EvolutionDispatch['stats']): string {
  return `${headline} \u2014 ${stats.changes_merged} changes, ${stats.streak} cycle streak`;
}

export function formatForBlog(narrative: string, keyMoments: Array<{ moment: string; significance: string }>, stats: EvolutionDispatch['stats']): string {
  let blog = `# Evolution Update\n\n${narrative}\n\n`;
  if (keyMoments.length > 0) {
    blog += '## Key Moments\n\n';
    for (const km of keyMoments) {
      blog += `- **${km.moment}** \u2014 ${km.significance}\n`;
    }
    blog += '\n';
  }
  blog += `## Stats\n\n- Changes merged: ${stats.changes_merged}\n- Growth proposals: ${stats.growth_proposals}\n- Fitness delta: ${stats.fitness_delta}\n- Streak: ${stats.streak} productive cycles\n`;
  return blog;
}
