import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function (this: { messages: { create: typeof mockCreate } }) {
      this.messages = { create: mockCreate };
    }),
  };
});

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue('original content');

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}));

const mockRunCommand = vi.fn();
vi.mock('../../../src/agents/utils.js', () => ({
  runCommand: (...args: unknown[]) => mockRunCommand(...args),
}));

import {
  buildPrompt,
  parseResponse,
  applyChanges,
  revertChanges,
  implementWorkItem,
} from '../../../src/agents/motor-cortex/implementer.js';
import type { ImplementationContext, FileChange } from '../../../src/agents/motor-cortex/types.js';

function makeContext(overrides: Partial<ImplementationContext> = {}): ImplementationContext {
  return {
    work_item_id: 'WI-001',
    title: 'Fix memory leak',
    description: 'There is a memory leak in the cache module',
    target_files: ['src/cache.ts'],
    success_criteria: ['No memory leak after 1000 iterations', 'Tests pass'],
    quality_standards: {
      max_file_length: 300,
      max_complexity: 10,
      test_coverage_floor: 80,
    },
    evolutionary_principles: ['Small incremental changes', 'Always add tests'],
    memory_lessons: ['Cache module is sensitive to circular refs'],
    current_file_contents: {
      'src/cache.ts': 'export class Cache { /* old code */ }',
    },
    ...overrides,
  };
}

describe('implementer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildPrompt', () => {
    it('includes work item title and description', () => {
      const prompt = buildPrompt(makeContext());
      expect(prompt).toContain('Fix memory leak');
      expect(prompt).toContain('There is a memory leak in the cache module');
    });

    it('includes file contents', () => {
      const prompt = buildPrompt(makeContext());
      expect(prompt).toContain('src/cache.ts');
      expect(prompt).toContain('export class Cache { /* old code */ }');
    });

    it('includes quality standards', () => {
      const prompt = buildPrompt(makeContext());
      expect(prompt).toContain('300');
      expect(prompt).toContain('10');
      expect(prompt).toContain('80');
    });

    it('includes success criteria', () => {
      const prompt = buildPrompt(makeContext());
      expect(prompt).toContain('No memory leak after 1000 iterations');
      expect(prompt).toContain('Tests pass');
    });

    it('includes evolutionary principles', () => {
      const prompt = buildPrompt(makeContext());
      expect(prompt).toContain('Small incremental changes');
      expect(prompt).toContain('Always add tests');
    });

    it('includes memory lessons', () => {
      const prompt = buildPrompt(makeContext());
      expect(prompt).toContain('Cache module is sensitive to circular refs');
    });
  });

  describe('parseResponse', () => {
    it('extracts JSON from markdown code block', () => {
      const text = 'Here are the changes:\n```json\n[{"path":"src/a.ts","action":"modify","content":"new code"}]\n```';
      const result = parseResponse(text);
      expect(result).toEqual([{ path: 'src/a.ts', action: 'modify', content: 'new code' }]);
    });

    it('handles plain JSON without code blocks', () => {
      const text = '[{"path":"src/a.ts","action":"create","content":"new file"}]';
      const result = parseResponse(text);
      expect(result).toEqual([{ path: 'src/a.ts', action: 'create', content: 'new file' }]);
    });

    it('rejects changes to organism.json', () => {
      const text = '```json\n[{"path":"organism.json","action":"modify","content":"bad"}]\n```';
      expect(() => parseResponse(text)).toThrow('Cannot modify forbidden path: organism.json');
    });

    it('rejects changes to .organism directory', () => {
      const text = '```json\n[{"path":".organism/config.json","action":"modify","content":"bad"}]\n```';
      expect(() => parseResponse(text)).toThrow('Cannot modify forbidden path: .organism/config.json');
    });

    it('rejects test file deletion', () => {
      const text = '```json\n[{"path":"tests/a.test.ts","action":"delete"}]\n```';
      expect(() => parseResponse(text)).toThrow('Cannot delete test file: tests/a.test.ts');
    });

    it('rejects spec file deletion', () => {
      const text = '```json\n[{"path":"tests/a.spec.ts","action":"delete"}]\n```';
      expect(() => parseResponse(text)).toThrow('Cannot delete test file: tests/a.spec.ts');
    });

    it('returns empty array for unparseable response', () => {
      const text = 'Sorry, I cannot help with that.';
      const result = parseResponse(text);
      expect(result).toEqual([]);
    });
  });

  describe('applyChanges', () => {
    it('writes files for modify/create actions', async () => {
      const changes: FileChange[] = [
        { path: 'src/a.ts', action: 'modify', content: 'modified' },
        { path: 'src/b.ts', action: 'create', content: 'created' },
      ];
      await applyChanges('/repo', changes);

      expect(mockMkdir).toHaveBeenCalledTimes(2);
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });

    it('deletes files for delete action', async () => {
      const changes: FileChange[] = [
        { path: 'src/old.ts', action: 'delete' },
      ];
      await applyChanges('/repo', changes);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it('validates each change and rejects forbidden paths', async () => {
      const changes: FileChange[] = [
        { path: 'organism.json', action: 'modify', content: 'bad' },
      ];
      await expect(applyChanges('/repo', changes)).rejects.toThrow(
        'Cannot modify forbidden path: organism.json',
      );
    });
  });

  describe('revertChanges', () => {
    it('restores original content for modified files', async () => {
      const changes: FileChange[] = [
        { path: 'src/a.ts', action: 'modify', content: 'new' },
      ];
      const originals = { 'src/a.ts': 'original' };

      await revertChanges('/repo', changes, originals);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('deletes created files', async () => {
      const changes: FileChange[] = [
        { path: 'src/new.ts', action: 'create', content: 'new file' },
      ];

      await revertChanges('/repo', changes, {});

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it('restores deleted files from originals', async () => {
      const changes: FileChange[] = [
        { path: 'src/removed.ts', action: 'delete' },
      ];
      const originals = { 'src/removed.ts': 'was here' };

      await revertChanges('/repo', changes, originals);

      expect(mockMkdir).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('implementWorkItem', () => {
    const apiResponse = {
      content: [
        {
          type: 'text' as const,
          text: '```json\n[{"path":"src/test.ts","action":"modify","content":"fixed code"}]\n```',
        },
      ],
      usage: { input_tokens: 500, output_tokens: 200 },
    };

    it('calls API, applies changes, verifies — happy path', async () => {
      mockCreate.mockResolvedValue(apiResponse);
      mockRunCommand.mockReturnValue({ stdout: '', stderr: '', status: 0 });

      const result = await implementWorkItem(makeContext(), '/repo');

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.changes).toEqual([
        { path: 'src/test.ts', action: 'modify', content: 'fixed code' },
      ]);
      expect(result.tokensUsed).toBe(700);
    });

    it('retries on tsc failure with error context', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text' as const,
              text: '```json\n[{"path":"src/test.ts","action":"modify","content":"bad code"}]\n```',
            },
          ],
          usage: { input_tokens: 500, output_tokens: 200 },
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text' as const,
              text: '```json\n[{"path":"src/test.ts","action":"modify","content":"fixed code"}]\n```',
            },
          ],
          usage: { input_tokens: 600, output_tokens: 250 },
        });

      mockRunCommand
        .mockReturnValueOnce({ stdout: '', stderr: 'Type error in src/test.ts', status: 1 }) // tsc fail attempt 1
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 }) // tsc pass attempt 2
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 }); // vitest pass attempt 2

      const result = await implementWorkItem(makeContext(), '/repo');

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.tokensUsed).toBe(1550); // 500+200+600+250
    });

    it('throws after MAX_API_CALLS failures', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text' as const,
            text: '```json\n[{"path":"src/test.ts","action":"modify","content":"bad"}]\n```',
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      mockRunCommand.mockReturnValue({ stdout: '', stderr: 'error', status: 1 });

      await expect(implementWorkItem(makeContext(), '/repo')).rejects.toThrow(
        'Implementation failed after 2 attempts',
      );

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('tracks token usage from response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text' as const,
            text: '```json\n[{"path":"src/test.ts","action":"modify","content":"ok"}]\n```',
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 500 },
      });
      mockRunCommand.mockReturnValue({ stdout: '', stderr: '', status: 0 });

      const result = await implementWorkItem(makeContext(), '/repo');
      expect(result.tokensUsed).toBe(1500);
    });
  });
});
