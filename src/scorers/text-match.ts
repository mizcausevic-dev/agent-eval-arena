// Exact and fuzzy text-match scorers. The boring but essential evaluation
// foundation — when ground truth is a known string (extraction tasks, classification,
// short-form Q&A), exact and fuzzy match are the most reliable signals.

export interface MatchResult {
  score: number; // 0-1
  matched: boolean;
  rationale: string;
}

export interface MatchOptions {
  caseSensitive?: boolean;
  normalizeWhitespace?: boolean;
  trim?: boolean;
}

const DEFAULTS: Required<MatchOptions> = {
  caseSensitive: false,
  normalizeWhitespace: true,
  trim: true,
};

function normalize(text: string, opts: Required<MatchOptions>): string {
  let out = text;
  if (opts.trim) out = out.trim();
  if (opts.normalizeWhitespace) out = out.replace(/\s+/g, ' ');
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}

export function exactMatch(prediction: string, expected: string, options: MatchOptions = {}): MatchResult {
  const opts = { ...DEFAULTS, ...options };
  const p = normalize(prediction, opts);
  const e = normalize(expected, opts);
  const matched = p === e;
  return {
    score: matched ? 1 : 0,
    matched,
    rationale: matched ? 'Exact match after normalization.' : 'Strings differ after normalization.',
  };
}

// Levenshtein distance for fuzzy match score
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(prediction: string, expected: string, threshold = 0.85, options: MatchOptions = {}): MatchResult {
  const opts = { ...DEFAULTS, ...options };
  const p = normalize(prediction, opts);
  const e = normalize(expected, opts);
  if (p === e) {
    return { score: 1, matched: true, rationale: 'Exact match after normalization.' };
  }
  const maxLen = Math.max(p.length, e.length);
  if (maxLen === 0) {
    return { score: 1, matched: true, rationale: 'Both strings empty.' };
  }
  const distance = levenshtein(p, e);
  const score = Math.max(0, 1 - distance / maxLen);
  const matched = score >= threshold;
  return {
    score: Math.round(score * 1000) / 1000,
    matched,
    rationale: `Levenshtein similarity ${(score * 100).toFixed(1)}% vs threshold ${(threshold * 100).toFixed(0)}%.`,
  };
}

// Token-overlap (Jaccard) for short bag-of-words match
export function tokenOverlap(prediction: string, expected: string, threshold = 0.6, options: MatchOptions = {}): MatchResult {
  const opts = { ...DEFAULTS, ...options };
  const pTokens = new Set(normalize(prediction, opts).split(/\s+/).filter((t) => t.length > 0));
  const eTokens = new Set(normalize(expected, opts).split(/\s+/).filter((t) => t.length > 0));
  if (pTokens.size === 0 && eTokens.size === 0) {
    return { score: 1, matched: true, rationale: 'Both empty.' };
  }
  const intersection = [...pTokens].filter((t) => eTokens.has(t)).length;
  const union = new Set([...pTokens, ...eTokens]).size;
  const score = union === 0 ? 0 : intersection / union;
  const matched = score >= threshold;
  return {
    score: Math.round(score * 1000) / 1000,
    matched,
    rationale: `Jaccard overlap ${(score * 100).toFixed(1)}% (${intersection}/${union} tokens) vs threshold ${(threshold * 100).toFixed(0)}%.`,
  };
}
