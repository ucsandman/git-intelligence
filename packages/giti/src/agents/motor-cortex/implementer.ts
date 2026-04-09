import Anthropic from '@anthropic-ai/sdk';
import type { ImplementationContext } from './types.js';

export interface AgentImplementationResult {
  success: boolean;
  filesChanged: string[];
  tokensUsed: number;
  turns: number;
  durationMs: number;
  summary: string;
  sessionId?: string;
  error?: string;
}

// Cache agent and environment IDs across work items in a cycle
let cachedAgentId: string | undefined;
let cachedEnvironmentId: string | undefined;

const SYSTEM_PROMPT = `You are the Motor Cortex of a living codebase organism called giti. You implement focused code changes autonomously.

## Safety Rules — NEVER violate
- ONLY modify files under packages/giti/src/ and packages/giti/tests/
- NEVER modify organism.json, .organism/, .claude/, docs/, .gitignore, package.json, package-lock.json
- NEVER modify anything under .next/, node_modules/, dist/
- NEVER modify files in packages/giti-observatory/ or packages/livingcode-core/
- NEVER delete test files (.test. or .spec.)

## Workflow
1. Read the relevant source files to understand the current code
2. Make the minimal changes needed to satisfy the success criteria
3. Write or update tests if the change affects behavior
4. Run \`cd packages/giti && npx vitest run\` to verify tests pass
5. If tests fail, read the error output and fix the issues
6. When done, commit your changes with a descriptive message
7. Push the branch to origin

Keep changes minimal and focused. If you cannot complete the task, explain why and stop.`;

function buildPrompt(context: ImplementationContext): string {
  const successCriteria = context.success_criteria.map((c) => `- ${c}`).join('\n');
  const principles = context.evolutionary_principles.map((p) => `- ${p}`).join('\n');
  const lessons = context.memory_lessons.length > 0
    ? context.memory_lessons.map((l) => `- ${l}`).join('\n')
    : '(none yet)';

  return `Implement this work item:

## ${context.title}

${context.description}

## Success Criteria
${successCriteria}

## Quality Standards
- Max file length: ${context.quality_standards.max_file_length} lines
- Max complexity per function: ${context.quality_standards.max_complexity}
- Test coverage floor: ${context.quality_standards.test_coverage_floor}%

## Evolutionary Principles
${principles}

## Lessons from Memory
${lessons}

${context.target_files.length > 0 ? `## Target Files (start here)\n${context.target_files.join('\n')}` : '## No specific target files — explore the codebase to find the right files.'}

Create a new git branch named "organism/motor/${context.work_item_id.slice(0, 8)}" from main, make your changes there, run tests, commit, and push.`;
}

async function ensureAgent(client: Anthropic): Promise<string> {
  if (cachedAgentId) return cachedAgentId;

  const model = process.env['GITI_MODEL'] ?? 'claude-sonnet-4-6';
  console.log(`[motor-cortex] Creating managed agent with model: ${model}`);

  const agent = await client.beta.agents.create({
    name: 'giti-motor-cortex',
    description: 'Motor cortex of the giti living codebase organism. Implements focused code changes.',
    model: { id: model },
    system: SYSTEM_PROMPT,
    tools: [{
      type: 'agent_toolset_20260401' as const,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' as const },
      },
    }],
  });

  cachedAgentId = agent.id;
  console.log(`[motor-cortex] Agent created: ${agent.id}`);
  return agent.id;
}

async function ensureEnvironment(client: Anthropic): Promise<string> {
  if (cachedEnvironmentId) return cachedEnvironmentId;

  console.log('[motor-cortex] Creating managed environment...');
  const env = await client.beta.environments.create({
    name: 'giti-workspace',
  });

  cachedEnvironmentId = env.id;
  console.log(`[motor-cortex] Environment created: ${env.id}`);
  return env.id;
}

export async function implementWithAgent(
  context: ImplementationContext,
  _repoPath: string,
): Promise<AgentImplementationResult> {
  const prompt = buildPrompt(context);
  const client = new Anthropic();
  const startTime = Date.now();

  console.log(`[motor-cortex] Launching managed agent for: ${context.title}`);

  let summary = '';
  let tokensUsed = 0;
  let turns = 0;
  let success = false;
  let sessionId: string | undefined;
  let error: string | undefined;
  const filesChanged: string[] = [];

  try {
    const agentId = await ensureAgent(client);
    const environmentId = await ensureEnvironment(client);

    // GitHub token for repo access
    const githubToken = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
    if (!githubToken) {
      return {
        success: false,
        filesChanged: [],
        tokensUsed: 0,
        turns: 0,
        durationMs: Date.now() - startTime,
        summary: '',
        error: 'GITHUB_TOKEN or GH_TOKEN environment variable required for Managed Agents',
      };
    }

    // Create session with GitHub repo mounted
    console.log('[motor-cortex] Creating session with GitHub repo...');
    const session = await client.beta.sessions.create({
      agent: agentId,
      environment_id: environmentId,
      title: `Motor Cortex: ${context.title}`,
      resources: [{
        type: 'github_repository' as const,
        url: 'https://github.com/ucsandman/git-intelligence',
        authorization_token: githubToken,
      }],
    });
    sessionId = session.id;
    console.log(`[motor-cortex] Session created: ${session.id}`);

    // Send the work item as a user message
    await client.beta.sessions.events.send(session.id, {
      events: [{
        type: 'user.message' as const,
        content: [{ type: 'text' as const, text: prompt }],
      }],
    });
    console.log('[motor-cortex] Work item sent, streaming events...');

    // Stream events and log activity
    const stream = await client.beta.sessions.events.stream(session.id);
    for await (const event of stream) {
      const eventType = (event as unknown as Record<string, unknown>)['type'] as string;

      if (eventType === 'agent.message') {
        const content = (event as unknown as Record<string, unknown>)['content'] as Array<Record<string, unknown>>;
        if (content) {
          for (const block of content) {
            if (block['type'] === 'text') {
              const text = String(block['text']).substring(0, 120);
              console.log(`[motor-cortex]   ${text}`);
            }
          }
        }
      } else if (eventType === 'agent.tool_use') {
        const name = (event as unknown as Record<string, unknown>)['name'] as string;
        const input = JSON.stringify((event as unknown as Record<string, unknown>)['input']).substring(0, 80);
        console.log(`[motor-cortex]   -> ${name}(${input}...)`);
        turns++;
      } else if (eventType === 'session.error') {
        const err = (event as unknown as Record<string, unknown>)['error'] as Record<string, unknown>;
        const msg = err?.['message'] as string ?? 'Unknown error';
        const retryStatus = (err?.['retry_status'] as Record<string, unknown>)?.['type'] as string;
        console.log(`[motor-cortex]   ERROR: ${msg} (${retryStatus})`);
        if (retryStatus === 'terminal' || retryStatus === 'exhausted') {
          error = msg;
        }
      } else if (eventType === 'session.status_idle') {
        const stopReason = (event as unknown as Record<string, unknown>)['stop_reason'] as Record<string, unknown>;
        const stopType = stopReason?.['type'] as string;
        console.log(`[motor-cortex] Session idle: ${stopType}`);
        if (stopType === 'end_turn') {
          success = true;
        }
        break;
      } else if (eventType === 'session.status_terminated') {
        console.log('[motor-cortex] Session terminated');
        break;
      }
    }

    // Get final session stats
    const finalSession = await client.beta.sessions.retrieve(session.id);
    const usage = finalSession.usage;
    tokensUsed = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0);

    console.log(`[motor-cortex] Agent finished: ${success ? 'success' : 'failed'}, ${turns} tool calls, ${tokensUsed} tokens`);

    // Check session events for what files were modified (look for edit/write tool calls)
    const events = await client.beta.sessions.events.list(session.id, { limit: 200 });
    if (events.data) {
      for (const ev of events.data) {
        const evType = (ev as unknown as Record<string, unknown>)['type'] as string;
        if (evType === 'agent.tool_use') {
          const name = (ev as unknown as Record<string, unknown>)['name'] as string;
          const input = (ev as unknown as Record<string, unknown>)['input'] as Record<string, unknown>;
          if ((name === 'edit' || name === 'write') && input?.['file_path']) {
            const filePath = String(input['file_path']);
            if (filePath.includes('packages/giti/src/') || filePath.includes('packages/giti/tests/')) {
              filesChanged.push(filePath);
            }
          }
        }
      }
    }

    // Deduplicate
    const uniqueFiles = [...new Set(filesChanged)];
    console.log(`[motor-cortex] Files changed: ${uniqueFiles.length}`);

    return {
      success: success && uniqueFiles.length > 0,
      filesChanged: uniqueFiles,
      tokensUsed,
      turns,
      durationMs: Date.now() - startTime,
      summary,
      sessionId,
      error: uniqueFiles.length === 0 && !error ? 'Agent completed but made no valid source file changes' : error,
    };
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
    console.log(`[motor-cortex] Agent error: ${error}`);
    return {
      success: false,
      filesChanged: [],
      tokensUsed,
      turns,
      durationMs: Date.now() - startTime,
      summary: '',
      sessionId,
      error,
    };
  }
}

// Reset cached IDs (call between cycles if needed)
export function resetManagedAgentCache(): void {
  cachedAgentId = undefined;
  cachedEnvironmentId = undefined;
}
