/**
 * useSearch — React hook for CA GPT Search
 *
 * Manages search state: executing streaming queries with research plan,
 * loading history, handling suggestions, and pin/delete operations.
 */

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ResearchStep } from '@/components/search/ResearchPlan';

// ---------------------------------------------------------------------------
// Types (mirror backend SearchResult / SearchCitation)
// ---------------------------------------------------------------------------

export interface SearchCitation {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  favicon: string;
}

export type SearchDomain =
  | 'tax'
  | 'audit'
  | 'gaap_ifrs'
  | 'compliance'
  | 'advisory'
  | 'general';

export interface SearchResult {
  answer: string;
  citations: SearchCitation[];
  relatedQuestions: string[];
  domain: SearchDomain;
  jurisdiction: string | null;
  modelUsed: string;
  providerUsed: string;
  tokensUsed: number;
  processingTimeMs: number;
  searchId: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  domain: string;
  answer: string;
  citations: SearchCitation[];
  pinned: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SSE event types (mirror backend SearchSSEEvent)
// ---------------------------------------------------------------------------

type SearchSSEEvent =
  | { type: 'plan'; title: string; steps: { id: number; label: string }[] }
  | { type: 'step-start'; stepId: number }
  | { type: 'step-progress'; stepId: number; detail: string }
  | { type: 'step-complete'; stepId: number }
  | { type: 'chunk'; content: string }
  | { type: 'citations'; citations: SearchCitation[] }
  | { type: 'related'; questions: string[] }
  | { type: 'end'; searchId: string; domain: SearchDomain; jurisdiction: string | null; modelUsed: string; providerUsed: string; tokensUsed: number; processingTimeMs: number }
  | { type: 'error'; error: string };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch() {
  const queryClient = useQueryClient();
  const [currentResult, setCurrentResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Streaming state
  const [researchPlanTitle, setResearchPlanTitle] = useState('');
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>([]);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<SearchCitation[]>([]);
  const [streamingRelated, setStreamingRelated] = useState<string[]>([]);
  const [currentStepDetail, setCurrentStepDetail] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // ── Search history ──────────────────────────────────────────────────────
  const {
    data: historyData,
    isLoading: isLoadingHistory,
  } = useQuery<{ history: SearchHistoryItem[] }>({
    queryKey: ['/api/search/history'],
    staleTime: 30_000,
  });

  const history = historyData?.history ?? [];

  // ── Suggestions ─────────────────────────────────────────────────────────
  const {
    data: suggestionsData,
  } = useQuery<{ suggestions: string[] }>({
    queryKey: ['/api/search/suggestions'],
    staleTime: 300_000,
  });

  const suggestions = suggestionsData?.suggestions ?? [];

  // ── Reset streaming state ───────────────────────────────────────────────
  const resetStreamState = useCallback(() => {
    setResearchPlanTitle('');
    setResearchSteps([]);
    setStreamingAnswer('');
    setStreamingCitations([]);
    setStreamingRelated([]);
    setCurrentStepDetail('');
  }, []);

  // ── Execute streaming search ────────────────────────────────────────────
  const executeSearch = useCallback(
    async (query: string, domain?: SearchDomain, jurisdiction?: string) => {
      // Cancel any previous search
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const abortController = new AbortController();
      abortRef.current = abortController;

      setIsSearching(true);
      setSearchError(null);
      setCurrentResult(null);
      resetStreamState();

      try {
        const response = await fetch('/api/search/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, domain, jurisdiction }),
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Search failed' }));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedAnswer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const msg of messages) {
            if (!msg.startsWith('data: ')) continue;
            const data = msg.slice(6);

            try {
              const event: SearchSSEEvent = JSON.parse(data);

              switch (event.type) {
                case 'plan':
                  setResearchPlanTitle(event.title);
                  setResearchSteps(
                    event.steps.map((s) => ({ ...s, status: 'not-started' as const })),
                  );
                  break;

                case 'step-start':
                  setResearchSteps((prev) =>
                    prev.map((s) =>
                      s.id === event.stepId ? { ...s, status: 'in-progress' as const } : s,
                    ),
                  );
                  break;

                case 'step-progress':
                  setCurrentStepDetail(event.detail);
                  setResearchSteps((prev) =>
                    prev.map((s) =>
                      s.id === event.stepId
                        ? { ...s, detail: event.detail }
                        : s,
                    ),
                  );
                  break;

                case 'step-complete':
                  setResearchSteps((prev) =>
                    prev.map((s) =>
                      s.id === event.stepId
                        ? { ...s, status: 'completed' as const, detail: undefined }
                        : s,
                    ),
                  );
                  break;

                case 'chunk':
                  accumulatedAnswer += event.content;
                  setStreamingAnswer(accumulatedAnswer);
                  break;

                case 'citations':
                  setStreamingCitations(event.citations);
                  break;

                case 'related':
                  setStreamingRelated(event.questions);
                  break;

                case 'end':
                  setCurrentResult({
                    answer: accumulatedAnswer,
                    citations: [],  // will be overwritten below from streaming state
                    relatedQuestions: [],
                    domain: event.domain,
                    jurisdiction: event.jurisdiction,
                    modelUsed: event.modelUsed,
                    providerUsed: event.providerUsed,
                    tokensUsed: event.tokensUsed,
                    processingTimeMs: event.processingTimeMs,
                    searchId: event.searchId,
                  });
                  setIsSearching(false);
                  queryClient.invalidateQueries({ queryKey: ['/api/search/history'] });
                  break;

                case 'error':
                  setSearchError(event.error);
                  setIsSearching(false);
                  break;
              }
            } catch {
              // ignore parse errors on individual events
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled — not an error
        } else {
          const message =
            error instanceof Error ? error.message : 'Search failed. Please try again.';
          setSearchError(message);
        }
      } finally {
        setIsSearching(false);
        abortRef.current = null;
      }
    },
    [queryClient, resetStreamState],
  );

  // ── Cancel search ───────────────────────────────────────────────────────
  const cancelSearch = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsSearching(false);
  }, []);

  // ── Pin/unpin ───────────────────────────────────────────────────────────
  const pinMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await apiRequest('POST', `/api/search/${searchId}/pin`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search/history'] });
    },
  });

  // ── Delete ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (searchId: string) => {
      await apiRequest('DELETE', `/api/search/${searchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search/history'] });
    },
  });

  // ── Load a previous search ─────────────────────────────────────────────
  const loadFromHistory = useCallback((item: SearchHistoryItem) => {
    resetStreamState();
    setCurrentResult({
      answer: item.answer,
      citations: item.citations,
      relatedQuestions: [],
      domain: item.domain as SearchDomain,
      jurisdiction: null,
      modelUsed: '',
      providerUsed: '',
      tokensUsed: 0,
      processingTimeMs: 0,
      searchId: item.id,
    });
    setSearchError(null);
  }, [resetStreamState]);

  // ── Clear current result ───────────────────────────────────────────────
  const clearResult = useCallback(() => {
    setCurrentResult(null);
    setSearchError(null);
    resetStreamState();
  }, [resetStreamState]);

  return {
    // State
    currentResult,
    isSearching,
    searchError,
    history,
    isLoadingHistory,
    suggestions,

    // Streaming state
    researchPlanTitle,
    researchSteps,
    streamingAnswer,
    streamingCitations,
    streamingRelated,
    currentStepDetail,

    // Actions
    executeSearch,
    cancelSearch,
    loadFromHistory,
    clearResult,
    pinSearch: pinMutation.mutate,
    deleteSearch: deleteMutation.mutate,
  };
}
