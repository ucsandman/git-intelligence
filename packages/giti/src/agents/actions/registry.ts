import { builtInActionTemplates } from './builtins/index.js';
import { assertActionTemplate } from './schema.js';
import type { ActionTemplate } from './types.js';

export function registerActionTemplates(templates: unknown[]): ActionTemplate[] {
  return templates
    .map((template) => assertActionTemplate(template))
    .filter((template) => template.status !== 'disabled');
}

export function getBuiltInActionTemplates(): ActionTemplate[] {
  return registerActionTemplates(builtInActionTemplates);
}

export function listActionTemplates(templates: unknown[] = builtInActionTemplates): ActionTemplate[] {
  return registerActionTemplates(templates);
}

export function getActionTemplate(
  id: string,
  templates: unknown[] = builtInActionTemplates,
): ActionTemplate | null {
  return listActionTemplates(templates).find((template) => template.id === id) ?? null;
}
