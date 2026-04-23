import type { Tool } from "./types";

export interface QuoteCostInput {
  /** Provider id matching PROVIDER_CAPABILITIES (claude / openai / azure-openai / gemini / perplexity). */
  provider: string;
  /** Model id matching PROVIDER_CAPABILITIES (e.g. "gpt-4o-mini"). */
  model: string;
  /** Estimated prompt tokens (system + user + context + tool descriptions). */
  prompt_tokens: number;
  /** Estimated output tokens (model reply + tool-call argument bytes). */
  expected_output_tokens: number;
  /** Optional: how many provider round-trips this query is expected to
   *  consume. Two-Agent Solver multiplies by Agent 1 + Agent 2 turns.
   *  Defaults to 1. */
  round_trips?: number;
}

export interface QuoteCostOutput {
  /** Total indicative cost in USD cents, rounded to nearest cent. This
   *  is the canonical storage unit per the cost-guardrail plan; UI
   *  layers convert to ₹/$/€/£/AED for display. */
  usd_cents: number;
  /** Per-round-trip breakdown so the caller can surface a detailed
   *  estimate in the Spreadsheet Mode confirmation modal. */
  breakdown: {
    input_cents: number;
    output_cents: number;
    round_trips: number;
    price_basis: string;
  };
  /** Short human-readable summary for logging. */
  note: string;
}

/**
 * Indicative pricing in USD cents per million tokens. Sourced from
 * published list prices as of April 2026. Kept intentionally on the
 * conservative (higher) side so the quoted cost is a ceiling, not a
 * floor — users should never be surprised by a larger bill than the
 * quote. Refresh periodically; do NOT treat as real-time rates.
 *
 * Values are cents-per-million-tokens. e.g. 250 = $0.0025 per 1K
 * tokens = $2.50 per 1M tokens.
 */
const PRICE_TABLE: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    "gpt-4o": { input: 250, output: 1000 },
    "gpt-4o-mini": { input: 15, output: 60 },
  },
  "azure-openai": {
    "gpt-4o": { input: 250, output: 1000 },
    "gpt-4o-mini": { input: 15, output: 60 },
  },
  claude: {
    "claude-3-5-sonnet-20241022": { input: 300, output: 1500 },
  },
  gemini: {
    "gemini-2.0-flash-exp": { input: 10, output: 40 },
  },
  perplexity: {
    "llama-3.1-sonar-large-128k-online": { input: 100, output: 100 },
  },
};

const FALLBACK = { input: 500, output: 1500 };

/**
 * Estimates indicative USD-cents cost for a planned LLM call. Used by
 * Spreadsheet Mode (mandatory pre-flight estimate) and the daily
 * budget check on ICAI-default keys. Returns cents so storage stays
 * integer-safe; display currency is a presentation concern.
 *
 * Deliberately stateless — no caching, no telemetry write. The caller
 * decides whether to log/bill/display the number.
 */
export const quoteCostTool: Tool<QuoteCostInput, QuoteCostOutput> = {
  name: "quote_cost",
  description:
    "Estimate the indicative USD-cents cost of a planned LLM call given provider, model, prompt tokens, and expected output tokens. Returns an integer cents value plus a breakdown. Use before Spreadsheet Mode dispatch and when the daily-budget guard is active on ICAI-default keys. The returned value is a ceiling based on list pricing; actual billed amount may be lower.",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: ["openai", "azure-openai", "claude", "gemini", "perplexity"],
      },
      model: { type: "string" },
      prompt_tokens: { type: "integer", minimum: 0 },
      expected_output_tokens: { type: "integer", minimum: 0 },
      round_trips: { type: "integer", minimum: 1, default: 1 },
    },
    required: ["provider", "model", "prompt_tokens", "expected_output_tokens"],
  },
  handler: async ({ provider, model, prompt_tokens, expected_output_tokens, round_trips }) => {
    const trips = Math.max(1, Math.floor(round_trips ?? 1));
    const providerTable = PRICE_TABLE[provider];
    const price = providerTable?.[model];
    const basis = price ? `${provider}/${model} list` : "fallback-conservative";
    const rates = price ?? FALLBACK;

    // cents = tokens * cents_per_million / 1_000_000
    const inputCentsPerTrip = (prompt_tokens * rates.input) / 1_000_000;
    const outputCentsPerTrip = (expected_output_tokens * rates.output) / 1_000_000;
    const inputCents = Math.round(inputCentsPerTrip * trips);
    const outputCents = Math.round(outputCentsPerTrip * trips);
    const total = inputCents + outputCents;

    return {
      usd_cents: total,
      breakdown: {
        input_cents: inputCents,
        output_cents: outputCents,
        round_trips: trips,
        price_basis: basis,
      },
      note: `~${total}¢ USD (${provider}/${model}, ${trips} round-trip${trips === 1 ? "" : "s"})`,
    };
  },
};
