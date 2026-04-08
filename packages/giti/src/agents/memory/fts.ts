/**
 * Full-Text Search engine — stemmer, tokenizer, inverted index, and TF-IDF search.
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

// ── Types ─────────────────────────────────────────────────────────

export interface FTSDocument {
  id: string;
  type: 'event' | 'lesson' | 'pattern' | 'preference';
  content: string;
  timestamp: string;
  fields: Record<string, string>;
}

export interface FTSResult {
  id: string;
  type: 'event' | 'lesson' | 'pattern' | 'preference';
  content: string;
  timestamp: string;
  score: number;
}

export interface FTSIndex {
  invertedIndex: Map<string, Map<string, number>>;
  documents: Map<string, FTSDocument>;
  documentCount: number;
  fieldWeights: Record<string, number>;
}

// ── Index ─────────────────────────────────────────────────────────

/**
 * Create an empty full-text search index with the given field weights.
 */
export function createIndex(fieldWeights: Record<string, number>): FTSIndex {
  return {
    invertedIndex: new Map(),
    documents: new Map(),
    documentCount: 0,
    fieldWeights,
  };
}

/**
 * Add a document to the index. Tokenizes and stems each field,
 * counts term frequency, and multiplies by field weight.
 */
export function addDocument(index: FTSIndex, doc: FTSDocument): void {
  index.documents.set(doc.id, doc);
  index.documentCount++;

  for (const [fieldName, text] of Object.entries(doc.fields)) {
    const weight = index.fieldWeights[fieldName] ?? 1.0;

    // Split into raw words (preserving duplicates for TF counting),
    // filter stopwords and short words, then stem each token.
    const rawWords = text
      .toLowerCase()
      .split(/[\s\-_.,:;!?()\[\]{}'"\\/]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
    const stemmed = rawWords.map((t) => stem(t));

    // Count raw term frequency per stemmed token
    const tfCounts = new Map<string, number>();
    for (const s of stemmed) {
      tfCounts.set(s, (tfCounts.get(s) ?? 0) + 1);
    }

    // Accumulate weighted TF into the inverted index
    for (const [term, count] of tfCounts) {
      let postings = index.invertedIndex.get(term);
      if (!postings) {
        postings = new Map();
        index.invertedIndex.set(term, postings);
      }
      postings.set(doc.id, (postings.get(doc.id) ?? 0) + count * weight);
    }
  }
}

// ── Search ────────────────────────────────────────────────────────

/**
 * Search the index using TF-IDF scoring.
 * IDF = log((N+1)/(df+1)) + 1
 * Score = sum of (TF × IDF) for each query term.
 */
export function search(
  index: FTSIndex,
  query: string,
  limit = 20,
): FTSResult[] {
  const queryTokens = tokenize(query).map((t) => stem(t));
  if (queryTokens.length === 0) return [];

  const scores = new Map<string, number>();
  const N = index.documentCount;

  for (const term of queryTokens) {
    const postings = index.invertedIndex.get(term);
    if (!postings) continue;

    const df = postings.size;
    const idf = Math.log((N + 1) / (df + 1)) + 1;

    for (const [docId, tf] of postings) {
      scores.set(docId, (scores.get(docId) ?? 0) + tf * idf);
    }
  }

  const results: FTSResult[] = [];
  for (const [docId, score] of scores) {
    const doc = index.documents.get(docId)!;
    results.push({
      id: doc.id,
      type: doc.type,
      content: doc.content,
      timestamp: doc.timestamp,
      score,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
