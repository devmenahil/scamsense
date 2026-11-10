/**
 * Development usage monitor for Gemini (Step 8 brief §21). In-memory, per server process: request counts, retries,
 * cache hits, token usage (from the SDK's usageMetadata), errors, rate-limit and fallback events, by category.
 *
 * It never records prompts, outputs, user ids, profile text, explanations, payment data, or keys: only counters and
 * the model identifier. Read it at GET /api/dev/gemini-usage (development only) or in tests.
 */

export const GEMINI_CATEGORIES = [
  "classification",
  "personalization",
  "evaluation",
  "recovery",
  "chat",
] as const;
export type GeminiCategory = (typeof GEMINI_CATEGORIES)[number];

export interface CategoryUsage {
  /** HTTP requests sent to Gemini (every attempt, including retries). */
  requests: number;
  /** Logical calls that ended with validated output. */
  successes: number;
  retries: number;
  /** Times stored/cached content was reused instead of calling Gemini. */
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
  rateLimitEvents: number;
  invalidOutputs: number;
  fallbacks: number;
}

export interface UsageSnapshot {
  model: string | null;
  since: string;
  categories: Record<GeminiCategory, CategoryUsage>;
}

const empty = (): CategoryUsage => ({
  requests: 0,
  successes: 0,
  retries: 0,
  cacheHits: 0,
  inputTokens: 0,
  outputTokens: 0,
  errors: 0,
  rateLimitEvents: 0,
  invalidOutputs: 0,
  fallbacks: 0,
});

let state: UsageSnapshot = fresh();

function fresh(): UsageSnapshot {
  return {
    model: null,
    since: new Date().toISOString(),
    categories: {
      classification: empty(),
      personalization: empty(),
      evaluation: empty(),
      recovery: empty(),
      chat: empty(),
    },
  };
}

export function recordUsage(category: GeminiCategory, delta: Partial<CategoryUsage>, model?: string): void {
  const c = state.categories[category];
  for (const [k, v] of Object.entries(delta) as [keyof CategoryUsage, number][]) c[k] += v;
  if (model) state.model = model;
  if (process.env.NODE_ENV === "development" && Object.keys(delta).length > 0) {
    // Counters only: no prompt, output, or personal data.
    console.info("[gemini-usage]", category, JSON.stringify(delta));
  }
}

export const recordCacheHit = (category: GeminiCategory) => recordUsage(category, { cacheHits: 1 });
export const recordFallback = (category: GeminiCategory) => recordUsage(category, { fallbacks: 1 });

export function getUsageSnapshot(): UsageSnapshot {
  return structuredClone(state);
}

export function resetUsage(): void {
  state = fresh();
}
