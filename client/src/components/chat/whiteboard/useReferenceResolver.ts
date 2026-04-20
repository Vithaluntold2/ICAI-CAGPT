import { useMemo } from "react";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import { useVisibleArtifactsStore } from "./useVisibleArtifacts";

export interface ResolvedReference {
  artifactId: string;
  title: string;
  /** Which signal produced this inference — used for UI hint copy. */
  reason: "viewport" | "recent" | "topic";
}

// Pronouns / reference words that suggest the user is pointing at something
// existing rather than asking a fresh question. Case-insensitive whole-word
// matches only — don't want to trip on "thistle" or substrings.
const PRONOUN_RE = /\b(this|that|these|those|it|them|they|here|above|below|it's|its)\b/i;

/**
 * Does the user's message look like it needs a resolved referent?
 * Conservative: we only auto-attach when the phrasing strongly implies one,
 * so random queries don't get rewritten.
 */
export function queryNeedsReferent(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return PRONOUN_RE.test(trimmed);
}

/**
 * Score how well the query's words overlap an artifact's title/summary.
 * Zero-dep keyword matching — good enough as a tie-breaker; cheap.
 * Returns a raw count of shared content words (stopwords removed).
 */
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","is","are","was","were","be","been","being",
  "of","in","on","at","to","for","with","by","from","about","as","into","over","under",
  "this","that","these","those","it","its","they","them","their","we","you","i","me","my",
  "do","does","did","done","can","could","should","would","will","may","might","shall",
  "what","which","who","whom","whose","where","when","why","how",
  "explain","mean","means","tell","show","please","tell","ask","question",
]);

function topicScore(query: string, a: WhiteboardArtifact): number {
  const hay = `${a.title} ${a.summary}`.toLowerCase();
  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  if (queryWords.length === 0) return 0;
  let hits = 0;
  const seen = new Set<string>();
  for (const w of queryWords) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (hay.includes(w)) hits++;
  }
  return hits;
}

/**
 * Resolve an ambiguous reference to an artifact using a three-tier fallback:
 *   1. Single visible artifact in viewport wins outright (strongest signal).
 *   2. Otherwise, if the query has a strong keyword match to one artifact,
 *      pick that (topic).
 *   3. Otherwise, fall back to the most recently created artifact (recency).
 *
 * Returns null when there are no artifacts at all or the query clearly
 * doesn't need a referent.
 */
export function useReferenceResolver(conversationId: string | undefined, queryText: string): ResolvedReference | null {
  const { data } = useConversationArtifacts(conversationId);
  const visibleIds = useVisibleArtifactsStore((s) => s.visibleIds);
  const artifacts = data?.artifacts ?? [];

  return useMemo(() => {
    if (artifacts.length === 0) return null;
    if (!queryNeedsReferent(queryText)) return null;

    // Tier 1: exactly one visible card → that's clearly what the user means.
    const visibleArtifacts = artifacts.filter(a => visibleIds.has(a.id));
    if (visibleArtifacts.length === 1) {
      const a = visibleArtifacts[0];
      return { artifactId: a.id, title: a.title, reason: "viewport" };
    }

    // Tier 1b: if 2–3 are visible, prefer the one with the best topic match
    // among the visible set — still a viewport-grounded inference.
    if (visibleArtifacts.length >= 2 && visibleArtifacts.length <= 3) {
      let best: WhiteboardArtifact | null = null;
      let bestScore = 0;
      for (const a of visibleArtifacts) {
        const s = topicScore(queryText, a);
        if (s > bestScore) { best = a; bestScore = s; }
      }
      if (best) return { artifactId: best.id, title: best.title, reason: "viewport" };
      // No keyword hints — pick the topmost/leftmost by sequence (most recent of visible)
      const recentVisible = [...visibleArtifacts].sort((a, b) => b.sequence - a.sequence)[0];
      return { artifactId: recentVisible.id, title: recentVisible.title, reason: "viewport" };
    }

    // Tier 2: topic keyword match across ALL artifacts.
    let topicBest: WhiteboardArtifact | null = null;
    let topicBestScore = 0;
    for (const a of artifacts) {
      const s = topicScore(queryText, a);
      if (s > topicBestScore) { topicBest = a; topicBestScore = s; }
    }
    // Require at least 2 shared content words to claim a topic match; otherwise
    // fall through to recency so we don't pick a random artifact on "what is this".
    if (topicBest && topicBestScore >= 2) {
      return { artifactId: topicBest.id, title: topicBest.title, reason: "topic" };
    }

    // Tier 3: most recent artifact wins.
    const recent = [...artifacts].sort((a, b) => b.sequence - a.sequence)[0];
    return { artifactId: recent.id, title: recent.title, reason: "recent" };
  }, [artifacts, visibleIds, queryText]);
}
