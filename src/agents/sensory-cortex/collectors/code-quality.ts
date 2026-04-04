import fs from 'node:fs/promises';
import path from 'node:path';

interface CodeQualityResult {
  test_file_count: number;
  source_file_count: number;
  test_ratio: number;
  files_exceeding_length_limit: string[];
  functions_exceeding_complexity: string[];
}

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx']);

export async function collectCodeQuality(
  repoPath: string,
  maxFileLength: number,
  maxComplexity: number,
): Promise<CodeQualityResult> {
  const files = await walkSourceFiles(repoPath);

  let testFileCount = 0;
  let sourceFileCount = 0;
  const filesExceedingLength: string[] = [];
  const functionsExceedingComplexity: string[] = [];

  for (const filePath of files) {
    const relative = path.relative(repoPath, filePath);
    const isTest = isTestFile(relative);

    if (isTest) {
      testFileCount++;
    } else {
      sourceFileCount++;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount > maxFileLength) {
      filesExceedingLength.push(relative);
    }

    if (!isTest) {
      const complexities = calculateFunctionComplexities(content, relative);
      for (const fn of complexities) {
        if (fn.complexity > maxComplexity) {
          functionsExceedingComplexity.push(`${relative}:${fn.name}(${fn.complexity})`);
        }
      }
    }
  }

  const total = testFileCount + sourceFileCount;
  const testRatio = total > 0 ? testFileCount / total : 0;

  return {
    test_file_count: testFileCount,
    source_file_count: sourceFileCount,
    test_ratio: Math.round(testRatio * 1000) / 1000,
    files_exceeding_length_limit: filesExceedingLength,
    functions_exceeding_complexity: functionsExceedingComplexity,
  };
}

function isTestFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('__tests__/')
  );
}

async function walkSourceFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkSourceFiles(fullPath);
      results.push(...nested);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

export function calculateFunctionComplexities(
  source: string,
  _filePath: string,
): Array<{ name: string; complexity: number }> {
  const functions = extractFunctions(source);
  return functions.map((fn) => ({
    name: fn.name,
    complexity: computeComplexity(fn.body),
  }));
}

interface ExtractedFunction {
  name: string;
  body: string;
}

const JS_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch',
  'try', 'finally', 'return', 'throw', 'new', 'delete', 'typeof',
  'void', 'in', 'of', 'with', 'class', 'import', 'export',
]);

function extractFunctions(source: string): ExtractedFunction[] {
  const results: ExtractedFunction[] = [];
  // Pattern 1: function declarations (named)
  // Pattern 2: arrow function assigned to const/let/var
  // Pattern 3: class/object method declarations (name at line start, not a keyword)
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*\{/g,
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{/g,
    /(?:^|[\n;])\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
  ];

  const seen = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const name = match[1]!;
      if (JS_KEYWORDS.has(name)) continue;

      // Find the opening brace position
      const matchEnd = match.index + match[0].length;
      const braceIdx = source.lastIndexOf('{', matchEnd - 1);
      if (braceIdx < 0) continue;

      if (seen.has(name)) continue;

      const body = extractBracedBlock(source, braceIdx);
      if (body) {
        seen.add(name);
        results.push({ name, body });
      }
    }
  }

  return results;
}

function extractBracedBlock(source: string, openIndex: number): string | null {
  if (source[openIndex] !== '{') return null;

  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(openIndex, i + 1);
      }
    }
  }
  return null;
}

function computeComplexity(body: string): number {
  let complexity = 1;

  // Remove string literals and comments to avoid false positives
  const cleaned = body
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '""');

  // Count branching keywords
  // Note: 'else if' is counted separately; the 'if' pattern uses negative lookbehind
  // to avoid double-counting 'else if'.
  const branchPatterns: RegExp[] = [
    /(?<!\belse\s)\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bdo\s*\{/g,
    /\bcatch\s*\(/g,
    /\bcase\s+/g,
    /&&/g,
    /\|\|/g,
    /\?\?/g,
  ];

  for (const pattern of branchPatterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  // Ternary operator: match ? when followed by : (heuristic)
  const ternaryPattern = /\?\s*[^:?]+\s*:/g;
  const ternaryMatches = cleaned.match(ternaryPattern);
  if (ternaryMatches) {
    complexity += ternaryMatches.length;
  }

  return complexity;
}
