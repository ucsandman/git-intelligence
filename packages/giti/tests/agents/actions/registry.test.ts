import { describe, expect, it } from 'vitest';
import {
  getActionTemplate,
  listActionTemplates,
  registerActionTemplates,
} from '../../../src/agents/actions/registry.js';

function makeTemplate(id: string, status: 'active' | 'deprecated' | 'disabled' = 'active') {
  return {
    id,
    name: `Action ${id}`,
    version: 1,
    status,
    intent: `Intent for ${id}`,
    description: `Description for ${id}`,
    triggers: [],
    inputs: [],
    constraints: [],
    risk: 'low',
    effects: ['records_memory'],
    steps: [
      {
        id: `${id}-step`,
        title: 'Record an event',
        type: 'record_event',
        event_type: 'plan-created',
        summary: 'Recorded from test template',
      },
    ],
    success_criteria: [
      {
        type: 'event_recorded',
        event_type: 'plan-created',
      },
    ],
    learning_hooks: [
      {
        type: 'record_event',
      },
    ],
    provenance: {
      source: 'built_in',
      created_at: '2026-04-10T00:00:00.000Z',
      updated_at: '2026-04-10T00:00:00.000Z',
    },
  };
}

describe('action registry', () => {
  it('returns valid active and deprecated templates but excludes disabled ones', () => {
    const templates = listActionTemplates([
      makeTemplate('active-action', 'active'),
      makeTemplate('deprecated-action', 'deprecated'),
      makeTemplate('disabled-action', 'disabled'),
    ]);

    expect(templates.map((template) => template.id)).toEqual([
      'active-action',
      'deprecated-action',
    ]);
  });

  it('returns a template by id', () => {
    const template = getActionTemplate('find-me', [
      makeTemplate('find-me'),
      makeTemplate('ignore-me'),
    ]);

    expect(template?.id).toBe('find-me');
  });

  it('returns null when a template is missing', () => {
    const template = getActionTemplate('missing', [makeTemplate('other-action')]);

    expect(template).toBeNull();
  });

  it('rejects invalid templates during registration', () => {
    expect(() =>
      registerActionTemplates([
        {
          ...makeTemplate('invalid-template'),
          risk: 'danger',
        },
      ]),
    ).toThrow(/risk/i);
  });
});
