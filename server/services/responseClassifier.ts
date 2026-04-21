/**
 * Response classifier — answers the single question:
 * "Is this assistant response a CLARIFYING QUESTION back to the user,
 *  or an ACTUAL ANSWER?"
 *
 * Used to set the correct in-flight status label ("Asking a clarifying
 * question…" vs "Answering…") and to drive the client-side clarify
 * latch in Chat.tsx. A small LLM call is cheap and vastly more robust
 * than the regex heuristics that drifted every time phrasing changed
 * (e.g. "I need one clarification before I summarise it." didn't match
 * any opener on our list).
 *
 * Cost: intentional trade-off — user explicitly said "we don't care
 * about token cost". Input is capped at 600 chars (head of the
 * response), output is a single word, model is the cheapest available.
 * Typical call: ~200 input tokens, 1–2 output tokens.
 */

import { aiProviderRegistry, AIProviderName } from './aiProviders';

export type ResponseKind = 'clarify' | 'answer';

interface ClassifyOptions {
  /** Soft deadline. If the LLM doesn't respond by then, we fall back to
   *  the heuristic so the user's stream isn't held up. Default 2500 ms. */
  timeoutMs?: number;
}

const SYSTEM_PROMPT = `You classify a single assistant response into exactly one of two labels:

- "clarify" — the assistant is asking the user a question back because it needs more information before answering (a clarifying question, request for specifics, options list to choose from, etc.). Even if the response promises to answer afterwards, if the immediate action is to ASK something, label it "clarify".

- "answer" — the assistant is actually answering, explaining, summarising, or producing a deliverable. Rhetorical questions inside an answer don't count.

Respond with ONE WORD only: either "clarify" or "answer". No punctuation. No explanation.`;

/**
 * Cheap fallback heuristic, used when the LLM call errors or times out.
 * Kept in one place so the two code paths don't drift.
 */
function heuristicClassify(response: string): ResponseKind {
  const head = (response || '').slice(0, 300);
  const headLower = head.toLowerCase();

  if (/\bclarif(y|ication|ying)\b/.test(headLower)) return 'clarify';
  if (
    /^(could you|can you|would you|what |which |when |where |who |how |do you |please (clarify|share|confirm|provide)|before (i|we) |just to (confirm|clarify)|i need (a bit|one|some|more)|to (answer|help) accurately)/i.test(
      head,
    )
  ) {
    return 'clarify';
  }

  const q = head.indexOf('?');
  if (q >= 0) {
    const firstSentence = head.split(/[.\n]/, 1)[0] || '';
    const preQ = head.slice(0, q);
    if (firstSentence.length < 180 && !/\n(##|###|\*\s|-\s|\d+\.\s)/.test(preQ)) {
      return 'clarify';
    }
  }
  return 'answer';
}

/**
 * Classify a response. Uses an LLM first; heuristic on failure.
 */
export async function classifyResponseKind(
  response: string,
  opts: ClassifyOptions = {},
): Promise<ResponseKind> {
  const timeoutMs = opts.timeoutMs ?? 2500;

  if (!response || response.trim().length === 0) return 'answer';

  // Only the opening matters for this call — no reason to pay for the
  // entire 8 KB deliverable to be tokenised.
  const head = response.slice(0, 600);

  try {
    const provider = aiProviderRegistry.getProvider(AIProviderName.AZURE_OPENAI);
    if (!provider) return heuristicClassify(response);

    const call = provider.generateCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: head },
      ],
      temperature: 0,
      maxTokens: 4,
    });

    // Race the LLM against a hard timeout so an unhealthy provider
    // can't block the user's stream. The stream gets the heuristic
    // result and keeps moving.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('classify timeout')), timeoutMs),
    );

    const res = await Promise.race([call, timeout]);
    const raw = (res.content || '').trim().toLowerCase();

    if (raw.startsWith('clarify')) return 'clarify';
    if (raw.startsWith('answer')) return 'answer';
    // Model hallucinated a different word — fall back.
    console.warn(
      `[responseClassifier] Unexpected LLM output "${raw}" — using heuristic`,
    );
    return heuristicClassify(response);
  } catch (err) {
    console.warn(
      '[responseClassifier] LLM call failed — using heuristic:',
      err instanceof Error ? err.message : err,
    );
    return heuristicClassify(response);
  }
}
