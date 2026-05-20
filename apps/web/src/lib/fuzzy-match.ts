export type FuzzyMatchType = 'normalized' | 'similar';

export interface FuzzyPair {
  sfRecord: Record<string, unknown>;
  nsRecord: Record<string, unknown>;
  sfValue: string;
  nsValue: string;
  score: number;
  matchType: FuzzyMatchType;
}

export interface FuzzyResult {
  fuzzyCount: number;
  fuzzyPairs: FuzzyPair[];
  threshold: number;
}

// Lowercase + strip non-alphanumeric — catches ABC-123 vs ABC123, spaces, dots, etc.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Space-optimised Levenshtein on two normalised strings
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = new Array<number>(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

function similarity(normA: string, normB: string): number {
  if (normA === normB) return 1;
  if (!normA || !normB) return 0;
  const dist = levenshtein(normA, normB);
  return 1 - dist / Math.max(normA.length, normB.length);
}

const MAX_SF_CANDIDATES = 500;

export function computeFuzzy(
  unmatchedSfRecords: Record<string, unknown>[],
  unmatchedNsRecords: Record<string, unknown>[],
  sfField: string,
  nsField: string,
  threshold = 0.7
): FuzzyResult {
  const sfRows = unmatchedSfRecords.slice(0, MAX_SF_CANDIDATES);

  // Pre-compute normalised NS values once
  const nsEntries = unmatchedNsRecords
    .map((record) => {
      const raw = String(record[nsField] ?? '').trim();
      return { record, raw, norm: normalize(raw) };
    })
    .filter((e) => e.norm.length > 0);

  // Fast normalised-exact lookup
  const normNsMap = new Map<string, (typeof nsEntries)[number]>();
  for (const e of nsEntries) {
    if (!normNsMap.has(e.norm)) normNsMap.set(e.norm, e);
  }

  const fuzzyPairs: FuzzyPair[] = [];

  for (const sfRecord of sfRows) {
    const sfRaw = String(sfRecord[sfField] ?? '').trim();
    const sfNorm = normalize(sfRaw);
    if (!sfNorm) continue;

    // Pass 1: normalised exact
    const normHit = normNsMap.get(sfNorm);
    if (normHit) {
      fuzzyPairs.push({
        sfRecord,
        nsRecord: normHit.record,
        sfValue: sfRaw,
        nsValue: normHit.raw,
        score: 1,
        matchType: 'normalized',
      });
      continue;
    }

    // Pass 2: Levenshtein similarity
    let bestScore = threshold;
    let bestEntry: (typeof nsEntries)[number] | null = null;

    for (const e of nsEntries) {
      const s = similarity(sfNorm, e.norm);
      if (s > bestScore) {
        bestScore = s;
        bestEntry = e;
      }
    }

    if (bestEntry) {
      fuzzyPairs.push({
        sfRecord,
        nsRecord: bestEntry.record,
        sfValue: sfRaw,
        nsValue: bestEntry.raw,
        score: bestScore,
        matchType: 'similar',
      });
    }
  }

  fuzzyPairs.sort((a, b) => b.score - a.score);

  return {
    fuzzyCount: fuzzyPairs.length,
    fuzzyPairs: fuzzyPairs.slice(0, 200),
    threshold,
  };
}
