import { describe, it, expect } from 'vitest';
import { formatBuildResult } from '../../../src/agents/motor-cortex/formatter.js';
import type { ImplementationResult } from '../../../src/agents/motor-cortex/types.js';

function makeResult(overrides: Partial<ImplementationResult> = {}): ImplementationResult {
  return {
    work_item_id: 'item-001',
    branch_name: 'organism/motor/fix-tests',
    status: 'success',
    files_modified: ['src/foo.ts'],
    files_created: [],
    files_deleted: [],
    lines_added: 10,
    lines_removed: 3,
    tests_added: 1,
    tests_modified: 0,
    pre_review_check: {
      lint_clean: true,
      tests_pass: true,
      builds: true,
    },
    claude_tokens_used: 500,
    ...overrides,
  };
}

describe('formatBuildResult', () => {
  it('formats a successful result', () => {
    const result = formatBuildResult(makeResult());
    expect(result).toContain('Motor Cortex');
    expect(result).toContain('success');
    expect(result).toContain('item-001');
    expect(result).toContain('organism/motor/fix-tests');
    expect(result).toContain('src/foo.ts');
    expect(result).toContain('+10/-3');
    expect(result).toContain('500 tokens');
  });

  it('formats a failed result with error', () => {
    const result = formatBuildResult(makeResult({
      status: 'failed',
      error: 'API timeout',
      files_modified: [],
    }));
    expect(result).toContain('failed');
    expect(result).toContain('API timeout');
  });

  it('formats a partial result', () => {
    const result = formatBuildResult(makeResult({
      status: 'partial',
      pre_review_check: { lint_clean: true, tests_pass: false, builds: true },
    }));
    expect(result).toContain('partial');
  });

  it('shows (none) when no files modified', () => {
    const result = formatBuildResult(makeResult({ files_modified: [] }));
    expect(result).toContain('Modified: (none)');
  });

  it('shows created files', () => {
    const result = formatBuildResult(makeResult({ files_created: ['src/new.ts'] }));
    expect(result).toContain('src/new.ts');
  });

  it('shows deleted files', () => {
    const result = formatBuildResult(makeResult({ files_deleted: ['src/old.ts'] }));
    expect(result).toContain('src/old.ts');
  });

  it('shows (none) when no created or deleted files', () => {
    const result = formatBuildResult(makeResult());
    expect(result).toContain('Created: (none)');
    expect(result).toContain('Deleted: (none)');
  });

  it('shows test counts', () => {
    const result = formatBuildResult(makeResult({ tests_added: 3, tests_modified: 2 }));
    expect(result).toContain('3 added');
    expect(result).toContain('2 modified');
  });
});
