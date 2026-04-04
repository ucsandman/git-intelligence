import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getUserConfig,
  setUserConfig,
  appendEvent,
  readEvents,
  getRecentEvents,
  clearEvents,
} from '../../src/telemetry/store.js';
import type { TelemetryEvent } from '../../src/telemetry/types.js';

// ── helpers ─────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-telemetry-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    giti_version: '0.1.0',
    node_version: 'v18.0.0',
    os_platform: 'linux',
    command: 'pulse',
    flags_used: [],
    execution_time_ms: 300,
    exit_code: 0,
    repo_characteristics: {
      commit_count_bucket: '100-1k',
      branch_count_bucket: '0-5',
      author_count_bucket: '2-5',
      primary_language: 'TypeScript',
      has_monorepo_structure: false,
      age_bucket: '1-6mo',
    },
    ...overrides,
  };
}

// ── getUserConfig ───────────────────────────────────────────────────

describe('getUserConfig', () => {
  it('returns default config when no config file exists', async () => {
    const tmp = await makeTmpDir();
    const configDir = path.join(tmp, 'nonexistent');
    const config = await getUserConfig(configDir);

    expect(config).toEqual({ enabled: false, first_prompt_shown: false });
  });

  it('reads config from file when it exists', async () => {
    const tmp = await makeTmpDir();
    const configDir = path.join(tmp, '.giti');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify({ enabled: true, first_prompt_shown: true }),
      'utf-8',
    );

    const config = await getUserConfig(configDir);
    expect(config).toEqual({ enabled: true, first_prompt_shown: true });
  });
});

// ── setUserConfig ───────────────────────────────────────────────────

describe('setUserConfig', () => {
  it('round-trips correctly with getUserConfig', async () => {
    const tmp = await makeTmpDir();
    const configDir = path.join(tmp, '.giti');

    await setUserConfig({ enabled: true, first_prompt_shown: true }, configDir);
    const config = await getUserConfig(configDir);

    expect(config).toEqual({ enabled: true, first_prompt_shown: true });
  });

  it('creates the config directory if it does not exist', async () => {
    const tmp = await makeTmpDir();
    const configDir = path.join(tmp, 'deep', 'nested', '.giti');

    await setUserConfig({ enabled: false, first_prompt_shown: true }, configDir);

    const stat = await fs.stat(configDir);
    expect(stat.isDirectory()).toBe(true);

    const config = await getUserConfig(configDir);
    expect(config).toEqual({ enabled: false, first_prompt_shown: true });
  });
});

// ── appendEvent ─────────────────────────────────────────────────────

describe('appendEvent', () => {
  it('creates file and appends a JSONL line', async () => {
    const tmp = await makeTmpDir();
    const event = makeEvent({ command: 'pulse' });

    await appendEvent(tmp, event);

    const content = await fs.readFile(
      path.join(tmp, '.organism', 'telemetry', 'events.jsonl'),
      'utf-8',
    );
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!) as TelemetryEvent;
    expect(parsed.event_id).toBe(event.event_id);
    expect(parsed.command).toBe('pulse');
  });

  it('appends multiple events on separate lines', async () => {
    const tmp = await makeTmpDir();
    const event1 = makeEvent({ command: 'pulse' });
    const event2 = makeEvent({ command: 'hotspots' });
    const event3 = makeEvent({ command: 'ghosts' });

    await appendEvent(tmp, event1);
    await appendEvent(tmp, event2);
    await appendEvent(tmp, event3);

    const content = await fs.readFile(
      path.join(tmp, '.organism', 'telemetry', 'events.jsonl'),
      'utf-8',
    );
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);

    const commands = lines.map((line) => (JSON.parse(line) as TelemetryEvent).command);
    expect(commands).toEqual(['pulse', 'hotspots', 'ghosts']);
  });
});

// ── readEvents ──────────────────────────────────────────────────────

describe('readEvents', () => {
  it('returns all events from JSONL file', async () => {
    const tmp = await makeTmpDir();
    const event1 = makeEvent({ command: 'pulse' });
    const event2 = makeEvent({ command: 'hotspots' });

    await appendEvent(tmp, event1);
    await appendEvent(tmp, event2);

    const events = await readEvents(tmp);
    expect(events).toHaveLength(2);
    expect(events[0]!.command).toBe('pulse');
    expect(events[1]!.command).toBe('hotspots');
  });

  it('returns empty array when file does not exist', async () => {
    const tmp = await makeTmpDir();
    const events = await readEvents(tmp);
    expect(events).toEqual([]);
  });
});

// ── getRecentEvents ─────────────────────────────────────────────────

describe('getRecentEvents', () => {
  it('returns the last N events', async () => {
    const tmp = await makeTmpDir();
    for (let i = 0; i < 10; i++) {
      await appendEvent(tmp, makeEvent({ command: `cmd-${i}` }));
    }

    const recent = await getRecentEvents(tmp, 3);
    expect(recent).toHaveLength(3);
    expect(recent[0]!.command).toBe('cmd-7');
    expect(recent[1]!.command).toBe('cmd-8');
    expect(recent[2]!.command).toBe('cmd-9');
  });

  it('returns all events if count exceeds total', async () => {
    const tmp = await makeTmpDir();
    await appendEvent(tmp, makeEvent({ command: 'only-one' }));

    const recent = await getRecentEvents(tmp, 100);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.command).toBe('only-one');
  });
});

// ── clearEvents ─────────────────────────────────────────────────────

describe('clearEvents', () => {
  it('deletes the events file', async () => {
    const tmp = await makeTmpDir();
    await appendEvent(tmp, makeEvent());

    const filePath = path.join(tmp, '.organism', 'telemetry', 'events.jsonl');
    const existsBefore = await fs.stat(filePath).then(() => true).catch(() => false);
    expect(existsBefore).toBe(true);

    await clearEvents(tmp);

    const existsAfter = await fs.stat(filePath).then(() => true).catch(() => false);
    expect(existsAfter).toBe(false);
  });

  it('is safe when file does not exist', async () => {
    const tmp = await makeTmpDir();
    // Should not throw
    await expect(clearEvents(tmp)).resolves.toBeUndefined();
  });
});
