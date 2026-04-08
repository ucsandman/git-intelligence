/**
 * Full-Text Search primitives — simplified Porter stemmer and tokenizer.
 * Used by the memory agent's inverted index (built in Task 2).
 */

// ── Stopwords ──────────────────────────────────────────────────────

export const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was',
  'are', 'been', 'has', 'had', 'not', 'this', 'that', 'which', 'who',
  'will',
]);

// ── Stemmer ────────────────────────────────────────────────────────

/**
 * Simplified Porter stemmer. Reduces English words to a root form
 * so that related words (test, testing, tested) map to the same stem.
 */
export function stem(word: string): string {
  let w = word.toLowerCase();

  if (w.length <= 3) return w;

  // Step 1: Compound suffixes (longest match wins, early return)
  if (w.endsWith('ational')) return w.slice(0, -7) + 'ate';
  if (w.endsWith('tional'))  return w.slice(0, -6) + 'tion';
  if (w.endsWith('iveness')) return w.slice(0, -4);   // -ness → keep -ive
  if (w.endsWith('fulness')) return w.slice(0, -4);   // -ness → keep -ful
  if (w.endsWith('ousness')) return w.slice(0, -4);   // -ness → keep -ous

  // Step 2: Plurals (mutate w, continue to later steps)
  if (w.endsWith('sses')) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ies') && w.length > 4) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ss')) {
    // keep as-is (loss, address)
  } else if (w.endsWith('s') && w.length > 4) {
    w = w.slice(0, -1);
  }

  // Step 3: -ed, -ing, -er
  if (w.endsWith('ed') && w.length > 4) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ing') && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith('er') && w.length > 4) {
    w = w.slice(0, -2);
  }

  // Step 4: Single suffixes (applied after plural/verb stripping)
  if (w.endsWith('ance') && w.length > 5) return w.slice(0, -4);
  if (w.endsWith('ence') && w.length > 5) return w.slice(0, -4);
  if (w.endsWith('ment') && w.length > 5) return w.slice(0, -4);
  if (w.endsWith('able') && w.length > 5) return w.slice(0, -4);
  if (w.endsWith('ible') && w.length > 5) return w.slice(0, -4);
  if (w.endsWith('ion') && w.length > 5)  return w.slice(0, -3);

  return w;
}

// ── Tokenizer ──────────────────────────────────────────────────────

/**
 * Tokenize text into lowercase, deduplicated, stopword-free tokens.
 * Does NOT stem — stemming is applied separately by the search index layer.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .split(/[\s\-_.,:;!?()\[\]{}'"\\/]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  return [...new Set(words)];
}
