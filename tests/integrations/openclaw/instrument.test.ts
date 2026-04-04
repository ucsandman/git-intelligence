import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { traceAgent } from '../../../src/integrations/openclaw/instrument.js';
import fs from 'node:fs/promises';

const mockMkdir = vi.mocked(fs.mkdir);
const mockWriteFile = vi.mocked(fs.writeFile);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env['OPENCLAW_API_KEY'];
});

afterEach(() => {
  delete process.env['OPENCLAW_API_KEY'];
});

describe('traceAgent', () => {
  it('traces a successful function execution', async () => {
    const result = await traceAgent('test-agent', 'test-action', 1, { foo: 'bar' }, async () => 42);
    expect(result).toBe(42);
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();

    const writtenData = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
    expect(writtenData.agent).toBe('test-agent');
    expect(writtenData.action).toBe('test-action');
    expect(writtenData.cycle).toBe(1);
    expect(writtenData.status).toBe('success');
    expect(writtenData.inputs).toEqual({ foo: 'bar' });
  });

  it('traces a failed function execution and re-throws', async () => {
    await expect(
      traceAgent('test-agent', 'test-action', 1, {}, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const writtenData = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
    expect(writtenData.status).toBe('failure');
    expect(writtenData.outputs.error).toContain('boom');
  });

  it('handles null return value', async () => {
    const result = await traceAgent('agent', 'action', 1, {}, async () => null);
    expect(result).toBeNull();
    const writtenData = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
    expect(writtenData.outputs).toEqual({});
  });

  it('handles primitive return value', async () => {
    const result = await traceAgent('agent', 'action', 1, {}, async () => 'hello');
    expect(result).toBe('hello');
    const writtenData = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
    expect(writtenData.outputs).toEqual({ value: 'hello' });
  });

  it('handles object return value with shallow summary', async () => {
    const obj = { a: 1, b: 'two', c: { nested: true } };
    const result = await traceAgent('agent', 'action', 1, {}, async () => obj);
    expect(result).toBe(obj);
    const writtenData = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
    expect(writtenData.outputs.a).toBe(1);
    expect(writtenData.outputs.b).toBe('two');
    expect(writtenData.outputs.c).toBe('[object]');
  });

  it('works with OPENCLAW_API_KEY set', async () => {
    process.env['OPENCLAW_API_KEY'] = 'test-key';
    const result = await traceAgent('agent', 'action', 1, {}, async () => 'ok');
    expect(result).toBe('ok');
    // Still writes to local file since remote POST is not yet implemented
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('does not let trace persistence failure prevent error propagation', async () => {
    mockMkdir.mockRejectedValueOnce(new Error('fs error'));
    // The traceAgent for failure case catches persistTrace errors
    await expect(
      traceAgent('agent', 'action', 1, {}, async () => {
        throw new Error('original error');
      }),
    ).rejects.toThrow('original error');
  });
});
