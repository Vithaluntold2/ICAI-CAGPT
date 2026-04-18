import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { users, conversations, messages, whiteboardArtifacts } from "../../../shared/schema";
import {
  createArtifact,
  listArtifactsByConversation,
  getArtifactScoped,
} from "./repository";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

describe("whiteboard repository", () => {
  const userId = "test-user-wb-repo";
  const conv1 = "test-conv-wb-1";
  const conv2 = "test-conv-wb-2";
  const msg1 = "test-msg-wb-1";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, conv1));
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, conv2));
    await db.delete(messages).where(eq(messages.id, msg1));
    await db.delete(conversations).where(eq(conversations.id, conv1));
    await db.delete(conversations).where(eq(conversations.id, conv2));
    await db.delete(users).where(eq(users.id, userId));

    await db.insert(users).values({
      id: userId,
      email: `${userId}@t.test`,
      password: "x",
      name: "Test WB Repo User",
    } as any);
    await db.insert(conversations).values([
      { id: conv1, userId, title: "c1" },
      { id: conv2, userId, title: "c2" },
    ]);
    await db.insert(messages).values({ id: msg1, conversationId: conv1, role: "assistant", content: "hi" });
  });

  it("creates an artifact and assigns sequence 1 on first insert", async () => {
    const art = await createArtifact({
      conversationId: conv1,
      messageId: msg1,
      kind: "chart",
      title: "t",
      summary: "s",
      payload: { foo: 1 },
      width: 600,
      height: 400,
      canvasX: 0,
      canvasY: 0,
    });
    expect(art.sequence).toBe(1);
    expect(art.id).toBeTruthy();
  });

  it("increments sequence per conversation independently", async () => {
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "a", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "b", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const c2 = await createArtifact({ conversationId: conv2, messageId: msg1, kind: "chart", title: "c", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const list1 = await listArtifactsByConversation(conv1);
    expect(list1.map(a => a.sequence)).toEqual([1, 2]);
    expect(c2.sequence).toBe(1);
  });

  it("listArtifactsByConversation returns rows in sequence order", async () => {
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "x", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "workflow", title: "y", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const list = await listArtifactsByConversation(conv1);
    expect(list.map(a => a.title)).toEqual(["x", "y"]);
  });

  it("getArtifactScoped returns artifact when conversationId matches", async () => {
    const a = await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "ok", summary: "", payload: { k: 1 }, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const got = await getArtifactScoped(a.id, conv1);
    expect(got?.title).toBe("ok");
  });

  it("getArtifactScoped returns null when conversationId mismatches", async () => {
    const a = await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "secret", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const got = await getArtifactScoped(a.id, conv2);
    expect(got).toBeNull();
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(sql`conversation_id in (${conv1}, ${conv2})`);
    await db.delete(messages).where(eq(messages.id, msg1));
    await db.delete(conversations).where(sql`id in (${conv1}, ${conv2})`);
    await db.delete(users).where(eq(users.id, userId));
  });
});
