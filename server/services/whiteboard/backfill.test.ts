import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { users, conversations, messages, whiteboardArtifacts } from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { backfillIfNeeded } from "./backfill";
import { listArtifactsByConversation } from "./repository";

describe("backfillIfNeeded", () => {
  const u = "test-bf-u";
  const c = "test-bf-c";
  const m1 = "test-bf-m1";
  const m2 = "test-bf-m2";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(messages).where(sql`id in (${m1}, ${m2})`);
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
    await db.insert(users).values({ id: u, email: `${u}@t.test`, password: "x", name: "Backfill User" } as any);
    await db.insert(conversations).values({ id: c, userId: u, title: "t" });
    await db.insert(messages).values([
      { id: m1, conversationId: c, role: "user", content: "build me a flowchart" },
      { id: m2, conversationId: c, role: "assistant",
        content: "Here:\n```mermaid\nflowchart TD\nA-->B\n```\nDone." },
    ]);
  });

  it("creates artifacts from legacy assistant messages with mermaid blocks", async () => {
    await backfillIfNeeded(c);
    const artifacts = await listArtifactsByConversation(c);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].kind).toBe("flowchart");
  });

  it("is a no-op on subsequent calls", async () => {
    await backfillIfNeeded(c);
    await backfillIfNeeded(c);
    const artifacts = await listArtifactsByConversation(c);
    expect(artifacts).toHaveLength(1);
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(messages).where(sql`id in (${m1}, ${m2})`);
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
  });
});
