/**
 * Model Configuration & Selection Resolver
 * Ensures high-throughput, quota-stable models are selected as primary and fallback,
 * while proactively sanitizing and excluding problematic or quota-exhausted models (such as gemini-3.8-flash).
 */

export interface ModelConfig {
  primaryModel: string;
  fallbackModel: string;
  candidates: string[];
}

export function isExcludedModel(modelName?: string): boolean {
  if (!modelName) return true;
  const name = modelName.trim().toLowerCase();
  // Exclude gemini-3.8-flash due to daily quota exhaustion (429) and extreme high demand (503)
  return name === 'gemini-3.8-flash' || name.includes('3.8-flash');
}

export function resolveModelConfig(
  envPrimary: string | undefined = process.env.GEMINI_PRIMARY_MODEL,
  envFallback: string | undefined = process.env.GEMINI_FALLBACK_MODEL
): ModelConfig {
  const rawPrimary = envPrimary?.trim();
  const rawFallback = envFallback?.trim();

  // If primary model is missing or is gemini-3.8-flash, override to gemini-3.1-flash-lite
  const primaryModel = (!rawPrimary || isExcludedModel(rawPrimary))
    ? 'gemini-3.1-flash-lite'
    : rawPrimary;

  // If fallback model is missing, excluded, or identical to primary, fallback to gemini-flash-latest
  let fallbackModel = (!rawFallback || isExcludedModel(rawFallback) || rawFallback === primaryModel)
    ? 'gemini-flash-latest'
    : rawFallback;

  if (fallbackModel === primaryModel) {
    fallbackModel = primaryModel === 'gemini-3.1-flash-lite' ? 'gemini-flash-latest' : 'gemini-3.1-flash-lite';
  }

  // Construct candidates list in strict order: primary first, fallback second, ensuring no duplicates or excluded models
  const rawCandidates = [primaryModel, fallbackModel, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  const candidates: string[] = [];

  for (const m of rawCandidates) {
    if (m && !isExcludedModel(m) && !candidates.includes(m)) {
      candidates.push(m);
    }
  }

  return {
    primaryModel,
    fallbackModel,
    candidates,
  };
}
