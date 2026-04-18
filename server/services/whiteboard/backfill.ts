import { db } from "../../db";
import { messages, whiteboardArtifacts } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { buildArtifactsForMessage } from "./extractPipeline";
import { createArtifact } from "./repository";
import type { LayoutState } from "./autoLayout";
import { randomUUID } from "crypto";

/**
 * First time a user opens the whiteboard on a legacy conversation, walk its
 * assistant messages, run the extractor, and persist any artifacts we find.
 * Subsequent calls are no-ops (guarded by the "any artifact exists?" check).
 */
export async function backfillIfNeeded(conversationId: string): Promise<void> {
  const [anyArtifact] = await db
    .select({ id: whiteboardArtifacts.id })
    .from(whiteboardArtifacts)
    .where(eq(whiteboardArtifacts.conversationId, conversationId))
    .limit(1);
  if (anyArtifact) return;

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  let layoutState: LayoutState = { cursorX: 0, rowTop: 0, rowHeight: 0 };
  for (const m of msgs) {
    if (m.role !== "assistant") continue;
    const built = buildArtifactsForMessage({
      content: m.content,
      conversationId,
      messageId: m.id,
      precomputed: {},
      layoutState,
      idFactory: () => `art_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    });
    if (built.artifacts.length === 0) continue;
    for (const a of built.artifacts) {
      await createArtifact(a);
    }
    await db
      .update(messages)
      .set({ content: built.updatedContent, artifactIds: built.generatedIds })
      .where(eq(messages.id, m.id));
    layoutState = built.layoutState;
  }
}
