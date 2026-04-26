/**
 * useRoundtablePanel — client-side hook for the panel CRUD API.
 *
 * Phase-1: thin fetch wrappers + cached state. No real-time updates.
 * Switches to a SWR/react-query setup later if reload churn becomes
 * visible; for now the panel builder is rare enough to call refetch
 * after each mutation.
 */

import { useCallback, useEffect, useState } from 'react';

const ROUNDTABLE_PANEL_CHANGED = 'roundtable-panel-changed';

interface RoundtablePanelChangedDetail {
  conversationId?: string | null;
  panelId?: string | null;
}

function broadcastRoundtablePanelChanged(detail: RoundtablePanelChangedDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RoundtablePanelChangedDetail>(ROUNDTABLE_PANEL_CHANGED, { detail }));
}

export type AgentModel = 'strong' | 'mini';

export interface RoundtablePanelDTO {
  id: string;
  userId: string;
  conversationId: string | null;
  name: string;
  description: string | null;
  isTemplate: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RoundtableAgentDTO {
  id: string;
  panelId: string;
  name: string;
  avatar: string | null;
  color: string | null;
  systemPrompt: string;
  useBaseKnowledge: boolean;
  model: AgentModel;
  toolAllowlist: string[] | null;
  createdFromTemplate: string | null;
  position: number;
}

export interface HydratedAgentDTO extends RoundtableAgentDTO {
  kbDocIds: string[];
}

export interface RoundtableKbDocDTO {
  id: string;
  panelId: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  ingestStatus: 'pending' | 'ready' | 'failed';
  ingestError: string | null;
  createdAt: string;
}

export interface HydratedPanelDTO {
  panel: RoundtablePanelDTO;
  agents: HydratedAgentDTO[];
  docs: RoundtableKbDocDTO[];
}

export interface AgentTemplateDTO {
  id: string;
  name: string;
  avatar: string;
  color: string;
  category: string;
  description: string;
  useBaseKnowledge: boolean;
  model: AgentModel;
}

const BASE = '/api/roundtable/panels';

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

/**
 * Resolve (or create) a panel for a conversation. Returns the active
 * panel + hydrated agents + docs.
 */
export function useRoundtablePanel(conversationId: string | null) {
  const [panelId, setPanelId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<HydratedPanelDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvePanelForConversation = useCallback(async () => {
    if (!conversationId) {
      setPanelId(null);
      setHydrated(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await jsonFetch<{ panels: RoundtablePanelDTO[] }>(
        `${BASE}?conversationId=${encodeURIComponent(conversationId)}`,
      );
      const first = list.panels[0];
      if (first) {
        setPanelId(first.id);
      } else {
        setPanelId(null);
        setHydrated(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const refresh = useCallback(async () => {
    if (!panelId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<HydratedPanelDTO>(`${BASE}/${panelId}`);
      setHydrated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [panelId]);

  // Resolve panel for the active conversation when the conversation id
  // becomes known. If none exists, do NOT auto-create — let the user
  // explicitly open the builder so we don't litter empty panels.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!conversationId) {
        setPanelId(null);
        setHydrated(null);
        return;
      }
      try {
        await resolvePanelForConversation();
      } catch {
        // resolvePanelForConversation already records hook error state.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId, resolvePanelForConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<RoundtablePanelChangedDetail>).detail;
      const sameConversation = !!conversationId && detail?.conversationId === conversationId;
      const samePanel = !!panelId && detail?.panelId === panelId;
      if (!sameConversation && !samePanel) return;

      if (sameConversation) {
        void resolvePanelForConversation();
        return;
      }
      if (samePanel) {
        void refresh();
      }
    };

    window.addEventListener(ROUNDTABLE_PANEL_CHANGED, onChanged as EventListener);
    return () => {
      window.removeEventListener(ROUNDTABLE_PANEL_CHANGED, onChanged as EventListener);
    };
  }, [conversationId, panelId, refresh, resolvePanelForConversation]);

  useEffect(() => {
    if (panelId) refresh();
  }, [panelId, refresh]);

  // ----- panel-level ops -----
  const createPanelForConversation = useCallback(
    async (name?: string, explicitConversationId?: string) => {
      const targetConversationId = explicitConversationId ?? conversationId;
      if (!targetConversationId) throw new Error('No active conversation');
      const data = await jsonFetch<{ panel: RoundtablePanelDTO }>(BASE, {
        method: 'POST',
        body: JSON.stringify({ conversationId: targetConversationId, name: name ?? 'Untitled panel' }),
      });
      setPanelId(data.panel.id);
      broadcastRoundtablePanelChanged({ conversationId: targetConversationId, panelId: data.panel.id });
      return data.panel;
    },
    [conversationId],
  );

  const renamePanel = useCallback(
    async (name: string) => {
      if (!panelId) return;
      await jsonFetch<{ panel: RoundtablePanelDTO }>(`${BASE}/${panelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  // ----- agent ops -----
  const spawnFromTemplate = useCallback(
    async (templateId: string) => {
      if (!panelId) throw new Error('No panel');
      await jsonFetch<{ agent: RoundtableAgentDTO }>(
        `${BASE}/${panelId}/agents/spawn-template`,
        { method: 'POST', body: JSON.stringify({ templateId }) },
      );
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const createCustomAgent = useCallback(
    async (input: {
      name: string;
      systemPrompt: string;
      avatar?: string;
      color?: string;
      useBaseKnowledge?: boolean;
      model?: AgentModel;
    }) => {
      if (!panelId) throw new Error('No panel');
      await jsonFetch<{ agent: RoundtableAgentDTO }>(`${BASE}/${panelId}/agents`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const updateAgent = useCallback(
    async (agentId: string, patch: Partial<RoundtableAgentDTO>) => {
      await jsonFetch(`${BASE}/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const deleteAgent = useCallback(
    async (agentId: string) => {
      await jsonFetch(`${BASE}/agents/${agentId}`, { method: 'DELETE' });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const cloneAgent = useCallback(
    async (agentId: string) => {
      await jsonFetch(`${BASE}/agents/${agentId}/clone`, { method: 'POST' });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  // ----- KB ops -----
  const addKbText = useCallback(
    async (filename: string, contentText: string) => {
      if (!panelId) throw new Error('No panel');
      await jsonFetch(`${BASE}/${panelId}/kb/text`, {
        method: 'POST',
        body: JSON.stringify({ filename, contentText }),
      });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const uploadKbFile = useCallback(
    async (file: File) => {
      if (!panelId) throw new Error('No panel');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE}/${panelId}/kb/file`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload failed: ${text || res.statusText}`);
      }
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const deleteKbDoc = useCallback(
    async (docId: string) => {
      await jsonFetch(`${BASE}/kb/${docId}`, { method: 'DELETE' });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const attachDocToAgent = useCallback(
    async (agentId: string, docId: string) => {
      await jsonFetch(`${BASE}/agents/${agentId}/kb`, {
        method: 'POST',
        body: JSON.stringify({ docIds: [docId] }),
      });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  const detachDocFromAgent = useCallback(
    async (agentId: string, docId: string) => {
      await jsonFetch(`${BASE}/agents/${agentId}/kb/${docId}`, { method: 'DELETE' });
      await refresh();
      broadcastRoundtablePanelChanged({ conversationId, panelId });
    },
    [conversationId, panelId, refresh],
  );

  return {
    panelId,
    hydrated,
    loading,
    error,
    refresh,
    createPanelForConversation,
    renamePanel,
    spawnFromTemplate,
    createCustomAgent,
    updateAgent,
    deleteAgent,
    cloneAgent,
    addKbText,
    uploadKbFile,
    deleteKbDoc,
    attachDocToAgent,
    detachDocFromAgent,
  };
}

export async function fetchRoundtableTemplates(): Promise<AgentTemplateDTO[]> {
  const data = await jsonFetch<{ templates: AgentTemplateDTO[] }>(`${BASE}/templates`);
  return data.templates;
}
