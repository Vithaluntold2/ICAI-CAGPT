import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { users, conversations, messages, whiteboardArtifacts } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { buildArtifactsForMessage } from "./extractPipeline";
import { createArtifact, listArtifactsByConversation } from "./repository";
import { randomUUID } from "crypto";

describe("whiteboard extraction + persistence (Phase 2.4 integration)", () => {
  const u = "test-orch-u";
  const c = "test-orch-c";
  const m = "test-orch-m";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(messages).where(eq(messages.id, m));
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
    await db.insert(users).values({ id: u, email: `${u}@t.test`, password: "x", name: "Orch Integ" } as any);
    await db.insert(conversations).values({ id: c, userId: u, title: "t" });
    await db.insert(messages).values({ id: m, conversationId: c, role: "assistant", content: "placeholder", artifactIds: [] });
  });

  it("extracts + persists artifacts; updates message content with placeholders", async () => {
    const raw = "Here:\n```mermaid\nflowchart TD\nA-->B\n```\nSee chart.";
    const built = buildArtifactsForMessage({
      content: raw,
      conversationId: c,
      messageId: m,
      precomputed: {
        visualization: { type: "bar", title: "Sales", data: [{ q: "Q1", v: 1 }] },
      },
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => `art_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    });

    expect(built.artifacts).toHaveLength(2);
    for (const a of built.artifacts) await createArtifact(a);
    await db.update(messages).set({
      content: built.updatedContent,
      artifactIds: built.generatedIds,
    }).where(eq(messages.id, m));

    const persisted = await listArtifactsByConversation(c);
    expect(persisted).toHaveLength(2);
    expect(persisted.map(a => a.kind).sort()).toEqual(["chart", "flowchart"]);

    const [stored] = await db.select().from(messages).where(eq(messages.id, m));
    expect(stored.content).not.toContain("```mermaid");
    expect(stored.content).toContain('<artifact id="');
    expect(stored.artifactIds).toHaveLength(2);
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(messages).where(eq(messages.id, m));
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
  });
});
