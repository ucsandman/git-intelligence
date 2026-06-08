export const IGNORED_SOURCE_DIRECTORIES = [
  '.cache',
  '.git',
  '.next',
  '.nuxt',
  '.organism',
  '.parcel-cache',
  '.svelte-kit',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
] as const;

const IGNORED_SOURCE_DIRECTORY_SET = new Set<string>(IGNORED_SOURCE_DIRECTORIES);

export function isIgnoredSourceDirectory(name: string): boolean {
  return IGNORED_SOURCE_DIRECTORY_SET.has(name);
}

export function pathContainsIgnoredSourceDirectory(filePath: string): boolean {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .some((part) => isIgnoredSourceDirectory(part));
}
