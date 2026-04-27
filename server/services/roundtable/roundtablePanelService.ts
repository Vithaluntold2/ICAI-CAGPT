/**
 * Roundtable Panel Service — CRUD for user-curated agent panels.
 *
 * Phase-1 foundation. Pure DB layer, no HTTP. Tested via routes layer
 * and (later) by the runtime when it consumes panels.
 *
 * Design notes:
 * - Each call validates ownership via userId. Routes pass the
 *   authenticated user's id; this service refuses cross-user access.
 * - Agent attachments to KB docs are managed via dedicated helpers so
 *   route handlers stay thin.
 * - Chunk + embedding writes live in roundtableKbIngest.ts to keep
 *   this file storage-only.
 */

import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  roundtablePanels,
  roundtablePanelAgents,
  roundtableKbDocs,
  roundtablePanelAgentKbDocs,
  roundtableKbChunks,
  type RoundtablePanel,
  type RoundtablePanelAgent,
  type RoundtableKbDoc,
  type InsertRoundtablePanel,
  type InsertRoundtablePanelAgent,
  type InsertRoundtableKbDoc,
} from '@shared/schema';
import { getTemplate } from './roundtableTemplates';

// ----------------------------------------------------------------------
// Panels
// ----------------------------------------------------------------------

export async function createPanel(
  userId: string,
  data: Pick<InsertRoundtablePanel, 'name' | 'description' | 'conversationId' | 'isTemplate' | 'metadata'>,
): Promise<RoundtablePanel> {
  // Idempotency guard: one live (non-template) panel per conversation/user.
  // If one already exists, return the latest instead of creating a sibling
  // row that can desync Builder vs Boardroom resolution.
  if (data.conversationId && !(data.isTemplate ?? false)) {
    const existing = await db
      .select()
      .from(roundtablePanels)
      .where(and(
        eq(roundtablePanels.userId, userId),
        eq(roundtablePanels.conversationId, data.conversationId),
        eq(roundtablePanels.isTemplate, false),
      ))
      .orderBy(desc(roundtablePanels.updatedAt))
      .limit(1);
    if (existing[0]) {
      return existing[0];
    }
  }

  const [panel] = await db
    .insert(roundtablePanels)
    .values({
      userId,
      name: data.name ?? 'Untitled panel',
      description: data.description ?? null,
      conversationId: data.conversationId ?? null,
      isTemplate: data.isTemplate ?? false,
      metadata: data.metadata ?? {},
    })
    .returning();

  // Every live panel needs two governance agents:
  //   - Moderator: routes the discussion, proposes phase transitions,
  //     produces the final memo.
  //   - Devil's Advocate: steel-mans the rejected option in cross-
  //     examination so the panel never locks a recommendation without
  //     hearing the strongest case against it.
  // Without these the loop converges into parallel monologues and
  // produces echo-chamber consensus.
  // Skip for template panels (user-curated reusable presets — composition
  // is deliberate).
  if (!panel.isTemplate) {
    const governanceTemplates = ['moderator-bot', 'devil-advocate-bot'];
    let position = 0;
    for (const templateId of governanceTemplates) {
      const tpl = getTemplate(templateId);
      if (!tpl) continue;
      await db
        .insert(roundtablePanelAgents)
        .values({
          panelId: panel.id,
          name: tpl.name,
          avatar: tpl.avatar,
          color: tpl.color,
          systemPrompt: tpl.systemPrompt,
          useBaseKnowledge: tpl.useBaseKnowledge,
          model: tpl.model,
          toolAllowlist: [],
          createdFromTemplate: tpl.id,
          position,
        });
      position++;
    }
  }

  return panel;
}

async function touchPanel(panelId: string): Promise<void> {
  await db
    .update(roundtablePanels)
    .set({ updatedAt: new Date() })
    .where(eq(roundtablePanels.id, panelId));
}

export async function getPanel(userId: string, panelId: string): Promise<RoundtablePanel | null> {
  const rows = await db
    .select()
    .from(roundtablePanels)
    .where(and(eq(roundtablePanels.id, panelId), eq(roundtablePanels.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPanels(
  userId: string,
  opts: { conversationId?: string; templatesOnly?: boolean } = {},
): Promise<RoundtablePanel[]> {
  const conds = [eq(roundtablePanels.userId, userId)];
  if (opts.conversationId) conds.push(eq(roundtablePanels.conversationId, opts.conversationId));
  if (opts.templatesOnly) conds.push(eq(roundtablePanels.isTemplate, true));
  return db
    .select()
    .from(roundtablePanels)
    .where(and(...conds))
    .orderBy(desc(roundtablePanels.updatedAt));
}

export async function updatePanel(
  userId: string,
  panelId: string,
  patch: Partial<Pick<RoundtablePanel, 'name' | 'description' | 'isTemplate' | 'metadata' | 'conversationId'>>,
): Promise<RoundtablePanel | null> {
  const owned = await getPanel(userId, panelId);
  if (!owned) return null;
  const [updated] = await db
    .update(roundtablePanels)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(roundtablePanels.id, panelId))
    .returning();
  return updated ?? null;
}

export async function deletePanel(userId: string, panelId: string): Promise<boolean> {
  const owned = await getPanel(userId, panelId);
  if (!owned) return false;
  await db.delete(roundtablePanels).where(eq(roundtablePanels.id, panelId));
  return true;
}

// ----------------------------------------------------------------------
// Agents
// ----------------------------------------------------------------------

export async function createAgent(
  userId: string,
  panelId: string,
  data: Pick<
    InsertRoundtablePanelAgent,
    | 'name'
    | 'avatar'
    | 'color'
    | 'systemPrompt'
    | 'useBaseKnowledge'
    | 'model'
    | 'toolAllowlist'
    | 'createdFromTemplate'
    | 'position'
  >,
): Promise<RoundtablePanelAgent | null> {
  const owned = await getPanel(userId, panelId);
  if (!owned) return null;

  // Default position to end of list when caller didn't specify.
  let position = data.position ?? 0;
  if (data.position == null) {
    const existing = await db
      .select({ position: roundtablePanelAgents.position })
      .from(roundtablePanelAgents)
      .where(eq(roundtablePanelAgents.panelId, panelId))
      .orderBy(desc(roundtablePanelAgents.position))
      .limit(1);
    position = (existing[0]?.position ?? -1) + 1;
  }

  const [agent] = await db
    .insert(roundtablePanelAgents)
    .values({
      panelId,
      name: data.name,
      avatar: data.avatar ?? null,
      color: data.color ?? null,
      systemPrompt: data.systemPrompt,
      useBaseKnowledge: data.useBaseKnowledge ?? true,
      model: data.model ?? 'strong',
      toolAllowlist: data.toolAllowlist ?? [],
      createdFromTemplate: data.createdFromTemplate ?? null,
      position,
    })
    .returning();
  await touchPanel(panelId);
  return agent;
}

export async function listAgents(
  userId: string,
  panelId: string,
): Promise<RoundtablePanelAgent[] | null> {
  const owned = await getPanel(userId, panelId);
  if (!owned) return null;
  return db
    .select()
    .from(roundtablePanelAgents)
    .where(eq(roundtablePanelAgents.panelId, panelId))
    .orderBy(asc(roundtablePanelAgents.position));
}

async function ownedAgent(userId: string, agentId: string): Promise<{ agent: RoundtablePanelAgent; panel: RoundtablePanel } | null> {
  const rows = await db
    .select({ agent: roundtablePanelAgents, panel: roundtablePanels })
    .from(roundtablePanelAgents)
    .innerJoin(roundtablePanels, eq(roundtablePanelAgents.panelId, roundtablePanels.id))
    .where(and(eq(roundtablePanelAgents.id, agentId), eq(roundtablePanels.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateAgent(
  userId: string,
  agentId: string,
  patch: Partial<Pick<RoundtablePanelAgent,
    'name' | 'avatar' | 'color' | 'systemPrompt' | 'useBaseKnowledge' | 'model' | 'toolAllowlist' | 'position'
  >>,
): Promise<RoundtablePanelAgent | null> {
  const owned = await ownedAgent(userId, agentId);
  if (!owned) return null;
  const [updated] = await db
    .update(roundtablePanelAgents)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(roundtablePanelAgents.id, agentId))
    .returning();
  await touchPanel(owned.agent.panelId);
  return updated ?? null;
}

export async function deleteAgent(userId: string, agentId: string): Promise<boolean> {
  const owned = await ownedAgent(userId, agentId);
  if (!owned) return false;
  await db.delete(roundtablePanelAgents).where(eq(roundtablePanelAgents.id, agentId));
  await touchPanel(owned.agent.panelId);
  return true;
}

export async function cloneAgent(userId: string, agentId: string): Promise<RoundtablePanelAgent | null> {
  const owned = await ownedAgent(userId, agentId);
  if (!owned) return null;
  const src = owned.agent;
  const cloned = await createAgent(userId, src.panelId, {
    name: `${src.name} (copy)`,
    avatar: src.avatar ?? undefined,
    color: src.color ?? undefined,
    systemPrompt: src.systemPrompt,
    useBaseKnowledge: src.useBaseKnowledge,
    model: src.model,
    toolAllowlist: (src.toolAllowlist as string[]) ?? [],
    createdFromTemplate: src.createdFromTemplate ?? undefined,
  });
  await touchPanel(src.panelId);
  return cloned;
}

// ----------------------------------------------------------------------
// KB docs (metadata only — chunking lives in roundtableKbIngest.ts)
// ----------------------------------------------------------------------

export async function createKbDoc(
  userId: string,
  panelId: string,
  data: Pick<InsertRoundtableKbDoc, 'filename' | 'mimeType' | 'sizeBytes' | 'contentText'>,
): Promise<RoundtableKbDoc | null> {
  const owned = await getPanel(userId, panelId);
  if (!owned) return null;
  const [doc] = await db
    .insert(roundtableKbDocs)
    .values({
      panelId,
      filename: data.filename,
      mimeType: data.mimeType ?? null,
      sizeBytes: data.sizeBytes ?? 0,
      contentText: data.contentText ?? '',
      ingestStatus: 'pending',
    })
    .returning();
  await touchPanel(panelId);
  return doc;
}

export async function listKbDocs(
  userId: string,
  panelId: string,
): Promise<RoundtableKbDoc[] | null> {
  const owned = await getPanel(userId, panelId);
  if (!owned) return null;
  return db
    .select()
    .from(roundtableKbDocs)
    .where(eq(roundtableKbDocs.panelId, panelId))
    .orderBy(desc(roundtableKbDocs.createdAt));
}

async function ownedDoc(userId: string, docId: string): Promise<RoundtableKbDoc | null> {
  const rows = await db
    .select({ doc: roundtableKbDocs })
    .from(roundtableKbDocs)
    .innerJoin(roundtablePanels, eq(roundtableKbDocs.panelId, roundtablePanels.id))
    .where(and(eq(roundtableKbDocs.id, docId), eq(roundtablePanels.userId, userId)))
    .limit(1);
  return rows[0]?.doc ?? null;
}

export async function deleteKbDoc(userId: string, docId: string): Promise<boolean> {
  const owned = await ownedDoc(userId, docId);
  if (!owned) return false;
  await db.delete(roundtableKbDocs).where(eq(roundtableKbDocs.id, docId));
  await touchPanel(owned.panelId);
  return true;
}

export async function setKbDocStatus(
  docId: string,
  status: 'pending' | 'ready' | 'failed',
  error?: string | null,
): Promise<void> {
  await db
    .update(roundtableKbDocs)
    .set({ ingestStatus: status, ingestError: error ?? null })
    .where(eq(roundtableKbDocs.id, docId));
}

// ----------------------------------------------------------------------
// Agent ↔ Doc attachments
// ----------------------------------------------------------------------

export async function attachDocsToAgent(
  userId: string,
  agentId: string,
  docIds: string[],
): Promise<boolean> {
  const owned = await ownedAgent(userId, agentId);
  if (!owned) return false;
  if (docIds.length === 0) return true;

  // Confirm every doc lives in the same panel as the agent.
  const docs = await db
    .select({ id: roundtableKbDocs.id, panelId: roundtableKbDocs.panelId })
    .from(roundtableKbDocs)
    .where(inArray(roundtableKbDocs.id, docIds));
  const valid = docs
    .filter((d: { id: string; panelId: string }) => d.panelId === owned.agent.panelId)
    .map((d: { id: string; panelId: string }) => d.id);
  if (valid.length === 0) return true;

  await db
    .insert(roundtablePanelAgentKbDocs)
    .values(valid.map((docId: string) => ({ agentId, docId })))
    .onConflictDoNothing();
  await touchPanel(owned.agent.panelId);
  return true;
}

export async function detachDocFromAgent(
  userId: string,
  agentId: string,
  docId: string,
): Promise<boolean> {
  const owned = await ownedAgent(userId, agentId);
  if (!owned) return false;
  await db
    .delete(roundtablePanelAgentKbDocs)
    .where(and(
      eq(roundtablePanelAgentKbDocs.agentId, agentId),
      eq(roundtablePanelAgentKbDocs.docId, docId),
    ));
  await touchPanel(owned.agent.panelId);
  return true;
}

export async function listDocsForAgent(
  userId: string,
  agentId: string,
): Promise<RoundtableKbDoc[] | null> {
  const owned = await ownedAgent(userId, agentId);
  if (!owned) return null;
  const rows = await db
    .select({ doc: roundtableKbDocs })
    .from(roundtablePanelAgentKbDocs)
    .innerJoin(roundtableKbDocs, eq(roundtablePanelAgentKbDocs.docId, roundtableKbDocs.id))
    .where(eq(roundtablePanelAgentKbDocs.agentId, agentId));
  return rows.map((r: { doc: RoundtableKbDoc }) => r.doc);
}

// ----------------------------------------------------------------------
// Hydrated panel for runtime / UI
// ----------------------------------------------------------------------

export interface HydratedPanel {
  panel: RoundtablePanel;
  agents: Array<RoundtablePanelAgent & { kbDocIds: string[] }>;
  docs: RoundtableKbDoc[];
}

export async function hydratePanel(userId: string, panelId: string): Promise<HydratedPanel | null> {
  const panel = await getPanel(userId, panelId);
  if (!panel) return null;

  const [agentRows, docRows] = await Promise.all([
    db
      .select()
      .from(roundtablePanelAgents)
      .where(eq(roundtablePanelAgents.panelId, panelId))
      .orderBy(asc(roundtablePanelAgents.position)),
    db
      .select()
      .from(roundtableKbDocs)
      .where(eq(roundtableKbDocs.panelId, panelId))
      .orderBy(desc(roundtableKbDocs.createdAt)),
  ]);

  const agentIds = agentRows.map((a: RoundtablePanelAgent) => a.id);
  const attachments = agentIds.length > 0
    ? await db
        .select()
        .from(roundtablePanelAgentKbDocs)
        .where(inArray(roundtablePanelAgentKbDocs.agentId, agentIds))
    : [];

  const docIdsByAgent = new Map<string, string[]>();
  for (const row of attachments) {
    const list = docIdsByAgent.get(row.agentId) ?? [];
    list.push(row.docId);
    docIdsByAgent.set(row.agentId, list);
  }

  return {
    panel,
    agents: agentRows.map((a: RoundtablePanelAgent) => ({ ...a, kbDocIds: docIdsByAgent.get(a.id) ?? [] })),
    docs: docRows,
  };
}

// ----------------------------------------------------------------------
// Chunk lookup (consumed by the retrieval layer in Phase 2)
// ----------------------------------------------------------------------

export async function getChunksForDocs(docIds: string[]): Promise<Array<typeof roundtableKbChunks.$inferSelect>> {
  if (docIds.length === 0) return [];
  return db
    .select()
    .from(roundtableKbChunks)
    .where(inArray(roundtableKbChunks.docId, docIds))
    .orderBy(asc(roundtableKbChunks.docId), asc(roundtableKbChunks.chunkIndex));
}
