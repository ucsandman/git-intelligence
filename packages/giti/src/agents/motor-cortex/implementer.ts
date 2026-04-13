import Anthropic from '@anthropic-ai/sdk';
import type { ImplementationContext } from './types.js';
import {
  clearStore,
  computeConfigHash,
  loadStore,
  saveStore,
  type ManagedAgentConfigFingerprint,
  type StoredManagedAgent,
} from './managed-agent-store.js';

export interface AgentImplementationResult {
  success: boolean;
  filesChanged: string[];
  tokensUsed: number;
  turns: number;
  durationMs: number;
  summary: string;
  sessionId?: string;
  patchContent?: string;
  error?: string;
}

const AGENT_NAME = 'giti-motor-cortex';
const AGENT_DESCRIPTION =
  'Motor cortex of the giti living codebase organism. Implements focused code changes.';
const ENVIRONMENT_NAME = 'giti-workspace';

const SYSTEM_PROMPT = `You are the Motor Cortex of a living codebase organism called giti. You implement focused code changes autonomously.

## Safety Rules — NEVER violate
- PRIMARILY modify files under packages/giti/src/ and packages/giti/tests/
- For security fixes: you MAY modify package.json files to update vulnerable dependencies
- NEVER modify organism.json, .organism/, .claude/, docs/, .gitignore
- NEVER modify anything under .next/, node_modules/, dist/
- NEVER delete test files (.test. or .spec.)

## Workflow
1. Read the relevant source files to understand the current code
2. Make the minimal changes needed to satisfy the success criteria
3. Write or update tests if the change affects behavior
4. Run \`cd packages/giti && npx vitest run\` to verify tests pass
5. If tests fail, read the error output and fix the issues
6. When done, commit your changes with a descriptive message
7. Do NOT push. Instead, run: git format-patch main --stdout > /tmp/organism-patch.txt
8. Then run: cat /tmp/organism-patch.txt
   This outputs the patch so the organism can apply it locally.

Keep changes minimal and focused. Do NOT attempt git push — it will fail. If you cannot complete the task, explain why and stop.`;

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

Create a new git branch from main, make your changes there, run tests, and commit. Do NOT push — output the patch instead as instructed.`;
}

function buildAgentConfig(): ManagedAgentConfigFingerprint {
  const model = process.env['GITI_MODEL'] ?? 'claude-sonnet-4-6';
  return {
    name: AGENT_NAME,
    description: AGENT_DESCRIPTION,
    model,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: 'agent_toolset_20260401',
        default_config: {
          enabled: true,
          permission_policy: { type: 'always_allow' },
        },
      },
    ],
  };
}

function isNotFound(err: unknown): boolean {
  return err instanceof Anthropic.NotFoundError;
}

interface LiveAgent {
  version: number;
}

async function fetchLiveAgent(client: Anthropic, agentId: string): Promise<LiveAgent | null> {
  try {
    const existing = await client.beta.agents.retrieve(agentId);
    const raw = existing as unknown as Record<string, unknown>;
    if (raw['archived_at']) return null;
    const version = Number(raw['version']);
    if (!Number.isFinite(version)) return null;
    return { version };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function environmentStillLive(client: Anthropic, environmentId: string): Promise<boolean> {
  try {
    await client.beta.environments.retrieve(environmentId);
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

async function createAgentFromConfig(
  client: Anthropic,
  cfg: ManagedAgentConfigFingerprint,
): Promise<{ id: string; version: number }> {
  console.log(`[motor-cortex] Creating managed agent (${cfg.model})...`);
  const created = await client.beta.agents.create({
    name: cfg.name,
    description: cfg.description,
    model: { id: cfg.model },
    system: cfg.system,
    tools: cfg.tools as never,
  });
  const version = Number((created as unknown as Record<string, unknown>)['version']);
  console.log(`[motor-cortex] Agent created: ${created.id} (v${version})`);
  return { id: created.id, version };
}

async function updateAgentFromConfig(
  client: Anthropic,
  agentId: string,
  currentVersion: number,
  cfg: ManagedAgentConfigFingerprint,
): Promise<{ id: string; version: number }> {
  console.log(`[motor-cortex] Config changed — updating agent ${agentId} from v${currentVersion}...`);
  const updated = await client.beta.agents.update(agentId, {
    version: currentVersion,
    name: cfg.name,
    description: cfg.description,
    model: { id: cfg.model },
    system: cfg.system,
    tools: cfg.tools as never,
  });
  const version = Number((updated as unknown as Record<string, unknown>)['version']);
  console.log(`[motor-cortex] Agent updated: ${agentId} (v${version})`);
  return { id: agentId, version };
}

async function findEnvironmentByName(client: Anthropic, name: string): Promise<string | null> {
  const page = await client.beta.environments.list();
  const items = (page as unknown as { data?: unknown[] }).data ?? [];
  for (const item of items) {
    const raw = item as Record<string, unknown>;
    if (raw['name'] === name && !raw['archived_at']) {
      return raw['id'] as string;
    }
  }
  return null;
}

async function createEnvironment(client: Anthropic): Promise<string> {
  console.log('[motor-cortex] Creating managed environment...');
  try {
    const env = await client.beta.environments.create({ name: ENVIRONMENT_NAME });
    console.log(`[motor-cortex] Environment created: ${env.id}`);
    return env.id;
  } catch (err) {
    // Name collision with an existing (non-archived) env — find and reuse it.
    if (err instanceof Anthropic.APIError && err.status === 409) {
      console.log(`[motor-cortex] Environment name "${ENVIRONMENT_NAME}" exists — looking up existing...`);
      const existingId = await findEnvironmentByName(client, ENVIRONMENT_NAME);
      if (existingId) {
        console.log(`[motor-cortex] Reusing existing environment: ${existingId}`);
        return existingId;
      }
    }
    throw err;
  }
}

export interface ProvisionResult {
  agentId: string;
  agentVersion: number;
  environmentId: string;
  reused: boolean;
  updated: boolean;
}

export async function provisionManagedAgent(
  client: Anthropic,
  repoPath: string,
): Promise<ProvisionResult> {
  const cfg = buildAgentConfig();
  const configHash = computeConfigHash(cfg);
  const stored = await loadStore(repoPath);
  const nowIso = new Date().toISOString();

  let agentId: string;
  let agentVersion: number;
  let environmentId: string;
  let reused = false;
  let updated = false;

  // Agent: reuse, update, or create
  const liveAgent = stored?.agentId ? await fetchLiveAgent(client, stored.agentId) : null;
  if (stored?.agentId && liveAgent) {
    if (stored.configHash === configHash) {
      agentId = stored.agentId;
      agentVersion = liveAgent.version;
      reused = true;
      console.log(`[motor-cortex] Reusing agent ${agentId} (v${agentVersion})`);
    } else {
      const result = await updateAgentFromConfig(client, stored.agentId, liveAgent.version, cfg);
      agentId = result.id;
      agentVersion = result.version;
      updated = true;
    }
  } else {
    if (stored?.agentId) {
      console.log(`[motor-cortex] Stored agent ${stored.agentId} no longer exists — provisioning fresh`);
    }
    const result = await createAgentFromConfig(client, cfg);
    agentId = result.id;
    agentVersion = result.version;
  }

  // Environment: reuse or create
  if (stored?.environmentId && (await environmentStillLive(client, stored.environmentId))) {
    environmentId = stored.environmentId;
    console.log(`[motor-cortex] Reusing environment ${environmentId}`);
  } else {
    if (stored?.environmentId) {
      console.log(`[motor-cortex] Stored environment ${stored.environmentId} no longer exists — provisioning fresh`);
    }
    environmentId = await createEnvironment(client);
  }

  const next: StoredManagedAgent = {
    agentId,
    agentName: cfg.name,
    agentVersion,
    environmentId,
    environmentName: ENVIRONMENT_NAME,
    configHash,
    model: cfg.model,
    createdAt: stored?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  await saveStore(repoPath, next);

  return { agentId, agentVersion, environmentId, reused, updated };
}

export async function implementWithAgent(
  context: ImplementationContext,
  repoPath: string,
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
    const { agentId, environmentId } = await provisionManagedAgent(client, repoPath);

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

    // Stream events, log activity, and capture patch output
    let patchContent = '';
    let lastToolName = '';
    const stream = await client.beta.sessions.events.stream(session.id);
    for await (const event of stream) {
      const ev = event as unknown as Record<string, unknown>;
      const eventType = ev['type'] as string;

      if (eventType === 'agent.message') {
        const content = ev['content'] as Array<Record<string, unknown>>;
        if (content) {
          for (const block of content) {
            if (block['type'] === 'text') {
              const text = String(block['text']).substring(0, 120);
              console.log(`[motor-cortex]   ${text}`);
            }
          }
        }
      } else if (eventType === 'agent.tool_use') {
        const name = ev['name'] as string;
        lastToolName = name;
        const input = JSON.stringify(ev['input']).substring(0, 80);
        console.log(`[motor-cortex]   -> ${name}(${input}...)`);
        turns++;
      } else if (eventType === 'agent.tool_result') {
        // Capture patch from bash tool results containing git format-patch output
        const content = ev['content'] as Array<Record<string, unknown>> | undefined;
        if (content && lastToolName === 'bash') {
          for (const block of content) {
            if (block['type'] === 'text') {
              const text = String(block['text']);
              // Detect git format-patch output (starts with "From " or contains "diff --git")
              if (text.includes('diff --git') || text.startsWith('From ')) {
                patchContent = text;
                console.log(`[motor-cortex]   Captured patch (${patchContent.length} bytes)`);
              }
            }
          }
        }
      } else if (eventType === 'session.error') {
        const err = ev['error'] as Record<string, unknown>;
        const msg = err?.['message'] as string ?? 'Unknown error';
        const retryStatus = (err?.['retry_status'] as Record<string, unknown>)?.['type'] as string;
        console.log(`[motor-cortex]   ERROR: ${msg} (${retryStatus})`);
        if (retryStatus === 'terminal' || retryStatus === 'exhausted') {
          error = msg;
        }
      } else if (eventType === 'session.status_idle') {
        const stopReason = ev['stop_reason'] as Record<string, unknown>;
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

    if (patchContent) {
      console.log(`[motor-cortex] Patch captured: ${patchContent.length} bytes`);
    }

    return {
      success: success && (uniqueFiles.length > 0 || patchContent.length > 0),
      filesChanged: uniqueFiles,
      tokensUsed,
      turns,
      durationMs: Date.now() - startTime,
      summary,
      sessionId,
      patchContent: patchContent || undefined,
      error: uniqueFiles.length === 0 && !patchContent && !error ? 'Agent completed but made no valid source file changes' : error,
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

// Force re-provisioning on next run by discarding the persisted store.
export async function resetManagedAgentCache(repoPath: string): Promise<void> {
  await clearStore(repoPath);
}
