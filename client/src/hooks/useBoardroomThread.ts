/**
 * useBoardroomThread — client hook for the live boardroom runtime.
 *
 * Holds the thread state, the ordered turn list (with in-flight stream
 * accumulation), the open question cards, and a websocket-equivalent
 * EventSource subscription for live updates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const BASE = '/api/roundtable/boardroom';

export interface BoardroomThreadDTO {
  id: string;
  panelId: string;
  conversationId: string | null;
  title: string;
  phase: string;
  currentTurnId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface BoardroomTurnDTO {
  id: string;
  threadId: string;
  panelId: string;
  speakerKind: 'agent' | 'user' | 'system' | 'moderator';
  agentId: string | null;
  parentTurnId: string | null;
  content: string;
  status: 'queued' | 'streaming' | 'completed' | 'cancelled' | 'failed';
  cancelReason: string | null;
  citations: Array<{ docId: string; chunkIndex: number }>;
  position: number;
  startedAt: string;
  completedAt: string | null;
}

export interface BoardroomQuestionCardDTO {
  id: string;
  threadId: string;
  parentTurnId: string | null;
  fromAgentId: string | null;
  toAgentId: string | null;
  toUser: boolean;
  text: string;
  status: 'open' | 'answered' | 'redirected' | 'skipped';
  answer: string | null;
  answeredByAgentId: string | null;
  answeredByUser: boolean;
  answeredAt: string | null;
  createdAt: string;
}

export type ParticipantState = 'speaking' | 'thinking' | 'listening';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

interface ThreadState {
  thread: BoardroomThreadDTO | null;
  turns: BoardroomTurnDTO[];
  questionCards: BoardroomQuestionCardDTO[];
  participantStates: Record<string, ParticipantState>;
}

const EMPTY: ThreadState = {
  thread: null,
  turns: [],
  questionCards: [],
  participantStates: {},
};

export function useBoardroomThread(panelId: string | null) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [state, setState] = useState<ThreadState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True when the runtime has paused (user clicked Pause, or all
   *  agents idle). Driven by SSE `paused` / `resumed` events. */
  const [paused, setPaused] = useState(false);
  /** When non-null, the loop is waiting on the chair to answer the
   *  referenced open question card. Cleared by `resumed` / answer. */
  const [awaitingChairCardId, setAwaitingChairCardId] = useState<string | null>(null);
  /** Server-supplied reason when the runtime auto-paused (e.g.,
   *  "providers-degraded" when the circuit breaker tripped on
   *  consecutive infra failures). Lets the UI render a precise
   *  message instead of a generic "paused". */
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  /**
   * Set when the runtime emits `convergence-detected`: all agents ceded
   * simultaneously and there are no open peer-directed questions. The
   * chair sees a banner offering to advance to the proposed next phase
   * (or dismiss to let the session keep running).
   */
  const [convergenceProposal, setConvergenceProposal] = useState<{
    currentPhase: string;
    proposedNextPhase: string;
  } | null>(null);
  /**
   * Set to true when `session-complete` is emitted (the panel converged
   * while in the resolution phase). The boardroom loop stops entirely;
   * the UI shows a "session complete" banner.
   */
  const [sessionComplete, setSessionComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Resolve or list threads for this panel.
  const refreshThreadList = useCallback(async (): Promise<BoardroomThreadDTO[]> => {
    if (!panelId) return [];
    const data = await jsonFetch<{ threads: BoardroomThreadDTO[] }>(
      `${BASE}/threads?panelId=${encodeURIComponent(panelId)}`,
    );
    return data.threads;
  }, [panelId]);

  // Load full thread state.
  const loadThread = useCallback(async (threadId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<{
        thread: BoardroomThreadDTO;
        turns: BoardroomTurnDTO[];
        questionCards: BoardroomQuestionCardDTO[];
      }>(`${BASE}/threads/${threadId}`);
      setState((prev) => ({
        thread: data.thread,
        turns: data.turns,
        questionCards: data.questionCards,
        participantStates: prev.participantStates,
      }));
      setActiveThreadId(threadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // On panel change, pick the most recent thread (or none).
  useEffect(() => {
    let cancelled = false;
    if (!panelId) {
      setActiveThreadId(null);
      setState(EMPTY);
      return;
    }
    refreshThreadList().then((threads) => {
      if (cancelled) return;
      if (threads.length > 0) {
        loadThread(threads[0].id);
      } else {
        setActiveThreadId(null);
        setState(EMPTY);
      }
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });
    return () => { cancelled = true; };
  }, [panelId, refreshThreadList, loadThread]);

  // SSE subscription for the active thread.
  useEffect(() => {
    if (!activeThreadId) return;
    const es = new EventSource(`${BASE}/threads/${activeThreadId}/stream`, {
      withCredentials: true,
    } as EventSourceInit);
    eventSourceRef.current = es;

    const onTurnStarted = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => {
        // Insert placeholder streaming turn if not yet present.
        if (prev.turns.find((t) => t.id === d.turnId)) return prev;
        const placeholder: BoardroomTurnDTO = {
          id: d.turnId,
          threadId: activeThreadId,
          panelId: prev.thread?.panelId ?? '',
          speakerKind: 'agent',
          agentId: d.agentId,
          parentTurnId: null,
          content: '',
          status: 'streaming',
          cancelReason: null,
          citations: [],
          position: d.position ?? prev.turns.length,
          startedAt: new Date().toISOString(),
          completedAt: null,
        };
        return { ...prev, turns: [...prev.turns, placeholder] };
      });
    };
    const onTurnToken = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        turns: prev.turns.map((t) =>
          t.id === d.turnId ? { ...t, content: t.content + d.token } : t,
        ),
      }));
    };
    const onTurnCompleted = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => {
        const exists = prev.turns.find((t) => t.id === d.turnId);
        const next: BoardroomTurnDTO = exists
          ? { ...exists, content: d.content ?? exists.content, status: 'completed', citations: d.citations ?? [], completedAt: new Date().toISOString() }
          : {
              id: d.turnId,
              threadId: activeThreadId,
              panelId: prev.thread?.panelId ?? '',
              speakerKind: d.speakerKind ?? 'agent',
              agentId: d.agentId ?? null,
              parentTurnId: null,
              content: d.content ?? '',
              status: 'completed',
              cancelReason: null,
              citations: d.citations ?? [],
              position: d.position ?? prev.turns.length,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            };
        const turns = exists
          ? prev.turns.map((t) => (t.id === d.turnId ? next : t))
          : [...prev.turns, next];
        return { ...prev, turns };
      });
    };
    const onTurnCancelled = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        turns: prev.turns.map((t) =>
          t.id === d.turnId ? { ...t, status: 'cancelled', cancelReason: d.reason } : t,
        ),
      }));
    };
    const onTurnFailed = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        turns: prev.turns.map((t) =>
          t.id === d.turnId ? { ...t, status: 'failed', cancelReason: d.error } : t,
        ),
      }));
    };
    const onParticipant = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        participantStates: { ...prev.participantStates, [d.agentId]: d.state },
      }));
    };
    const onPhase = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => prev.thread ? { ...prev, thread: { ...prev.thread, phase: d.phase } } : prev);
    };
    const onQuestion = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => {
        if (prev.questionCards.find((c) => c.id === d.qid)) return prev;
        const card: BoardroomQuestionCardDTO = {
          id: d.qid,
          threadId: activeThreadId,
          parentTurnId: d.parentTurnId ?? null,
          fromAgentId: d.fromAgentId,
          toAgentId: d.toAgentId,
          toUser: d.toUser ?? false,
          text: d.text,
          status: 'open',
          answer: null,
          answeredByAgentId: null,
          answeredByUser: false,
          answeredAt: null,
          createdAt: new Date().toISOString(),
        };
        return { ...prev, questionCards: [...prev.questionCards, card] };
      });
    };
    const onQuestionAnswered = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        questionCards: prev.questionCards.map((c) =>
          c.id === d.qid ? { ...c, status: 'answered', answer: d.answer, answeredByUser: !!d.byUser } : c,
        ),
      }));
    };
    const onQuestionRedirected = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        questionCards: prev.questionCards.map((c) =>
          c.id === d.qid ? { ...c, toAgentId: d.newToAgentId, toUser: false, status: 'open' } : c,
        ),
      }));
    };
    const onQuestionSkipped = (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        questionCards: prev.questionCards.map((c) =>
          c.id === d.qid ? { ...c, status: 'skipped' } : c,
        ),
      }));
    };

    const onPaused = (e: MessageEvent) => {
      setPaused(true);
      let d: { reason?: string } = {};
      try { d = JSON.parse(e.data); } catch { /* ignore */ }
      setPauseReason(d.reason ?? 'user');
    };
    const onResumed = () => {
      setPaused(false);
      setPauseReason(null);
      setAwaitingChairCardId(null);
    };
    const onLoopIdle = (e: MessageEvent) => {
      let d: { reason?: string; cardId?: string } = {};
      try { d = JSON.parse(e.data); } catch { /* ignore */ }
      if (d.reason === 'awaiting-chair' && d.cardId) {
        setAwaitingChairCardId(d.cardId);
      } else {
        setAwaitingChairCardId(null);
      }
    };

    const onConvergenceDetected = (e: MessageEvent) => {
      let d: { currentPhase?: string; proposedNextPhase?: string } = {};
      try { d = JSON.parse(e.data); } catch { /* ignore */ }
      if (d.currentPhase && d.proposedNextPhase) {
        setConvergenceProposal({
          currentPhase: d.currentPhase,
          proposedNextPhase: d.proposedNextPhase,
        });
      }
    };

    const onSessionComplete = () => {
      setSessionComplete(true);
    };

    es.addEventListener('turn-started', onTurnStarted);
    es.addEventListener('turn-token', onTurnToken);
    es.addEventListener('turn-completed', onTurnCompleted);
    es.addEventListener('turn-cancelled', onTurnCancelled);
    es.addEventListener('turn-failed', onTurnFailed);
    es.addEventListener('participant-state', onParticipant);
    es.addEventListener('phase-changed', onPhase);
    es.addEventListener('question-card', onQuestion);
    es.addEventListener('question-answered', onQuestionAnswered);
    es.addEventListener('question-redirected', onQuestionRedirected);
    es.addEventListener('question-skipped', onQuestionSkipped);
    es.addEventListener('paused', onPaused);
    es.addEventListener('resumed', onResumed);
    es.addEventListener('loop-idle', onLoopIdle);
    es.addEventListener('convergence-detected', onConvergenceDetected);
    es.addEventListener('session-complete', onSessionComplete);

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [activeThreadId]);

  // ----- mutations -----
  const createThread = useCallback(
    async (input: { title?: string; conversationId?: string | null }) => {
      if (!panelId) throw new Error('No panel');
      const data = await jsonFetch<{ thread: BoardroomThreadDTO }>(`${BASE}/threads`, {
        method: 'POST',
        body: JSON.stringify({ panelId, ...input }),
      });
      await loadThread(data.thread.id);
      return data.thread;
    },
    [panelId, loadThread],
  );

  // Optimistically merge a server-returned turn so it shows even if the SSE
  // stream for a freshly-created thread hasn't connected yet (race: server
  // emits `turn-completed` for the user turn synchronously, but the new
  // EventSource needs a round-trip to subscribe).
  const mergeTurn = useCallback((turn: BoardroomTurnDTO) => {
    setState((prev) => {
      if (prev.turns.find((t) => t.id === turn.id)) return prev;
      return { ...prev, turns: [...prev.turns, turn] };
    });
  }, []);

  // Thread-id-explicit variant — safe to call right after createThread
  // without waiting for activeThreadId state to flush.
  const interjectInThread = useCallback(
    async (threadId: string, text: string): Promise<BoardroomTurnDTO> => {
      const data = await jsonFetch<{ turn: BoardroomTurnDTO }>(
        `${BASE}/threads/${threadId}/interject`,
        { method: 'POST', body: JSON.stringify({ text }) },
      );
      mergeTurn(data.turn);
      return data.turn;
    },
    [mergeTurn],
  );

  const interject = useCallback(
    async (text: string) => {
      if (!activeThreadId) throw new Error('No active thread');
      return interjectInThread(activeThreadId, text);
    },
    [activeThreadId, interjectInThread],
  );

  const tagAgentInThread = useCallback(
    async (
      threadId: string,
      agentId: string,
      text: string,
    ): Promise<BoardroomTurnDTO> => {
      const data = await jsonFetch<{ turn: BoardroomTurnDTO }>(
        `${BASE}/threads/${threadId}/tag`,
        { method: 'POST', body: JSON.stringify({ agentId, text }) },
      );
      mergeTurn(data.turn);
      return data.turn;
    },
    [mergeTurn],
  );

  const tagAgent = useCallback(
    async (agentId: string, text: string) => {
      if (!activeThreadId) throw new Error('No active thread');
      return tagAgentInThread(activeThreadId, agentId, text);
    },
    [activeThreadId, tagAgentInThread],
  );

  const cancelTurn = useCallback(async (turnId: string) => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/cancel-turn`, {
      method: 'POST',
      body: JSON.stringify({ turnId }),
    });
  }, [activeThreadId]);

  const setPhase = useCallback(async (phase: string) => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/phase`, {
      method: 'POST',
      body: JSON.stringify({ phase }),
    });
  }, [activeThreadId]);

  const answerQuestion = useCallback(async (qid: string, answer: string) => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/answer-question`, {
      method: 'POST',
      body: JSON.stringify({ qid, answer }),
    });
  }, [activeThreadId]);

  const redirectQuestion = useCallback(async (qid: string, toAgentId: string) => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/redirect-question`, {
      method: 'POST',
      body: JSON.stringify({ qid, toAgentId }),
    });
  }, [activeThreadId]);

  const skipQuestion = useCallback(async (qid: string) => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/skip-question`, {
      method: 'POST',
      body: JSON.stringify({ qid }),
    });
  }, [activeThreadId]);

  const kickoffThread = useCallback(async (threadId: string) => {
    await jsonFetch(`${BASE}/threads/${threadId}/kickoff`, { method: 'POST' });
  }, []);

  const kickoff = useCallback(async () => {
    if (!activeThreadId) throw new Error('No active thread');
    await kickoffThread(activeThreadId);
  }, [activeThreadId, kickoffThread]);

  const pause = useCallback(async () => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/pause`, { method: 'POST' });
    setPaused(true);
    setPauseReason('user');
  }, [activeThreadId]);

  const resume = useCallback(async () => {
    if (!activeThreadId) throw new Error('No active thread');
    await jsonFetch(`${BASE}/threads/${activeThreadId}/resume`, { method: 'POST' });
    setPaused(false);
    setPauseReason(null);
    setAwaitingChairCardId(null);
  }, [activeThreadId]);

  /** Dismiss the convergence proposal banner without advancing the phase. */
  const dismissConvergenceProposal = useCallback(() => {
    setConvergenceProposal(null);
  }, []);

  return {
    activeThreadId,
    setActiveThreadId,
    thread: state.thread,
    turns: state.turns,
    questionCards: state.questionCards,
    participantStates: state.participantStates,
    loading,
    error,
    paused,
    pauseReason,
    awaitingChairCardId,
    convergenceProposal,
    sessionComplete,
    createThread,
    interject,
    interjectInThread,
    tagAgent,
    tagAgentInThread,
    cancelTurn,
    setPhase,
    answerQuestion,
    redirectQuestion,
    skipQuestion,
    kickoff,
    kickoffThread,
    pause,
    resume,
    dismissConvergenceProposal,
    refreshThreadList,
    loadThread,
  };
}
