import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "../../db";
import { users, conversations, messages, whiteboardArtifacts } from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { listArtifactsByConversation } from "./repository";

describe("GET /api/conversations/:id/whiteboard — handler behavior", () => {
  const userA = "test-wb-route-a";
  const userB = "test-wb-route-b";
  const convA = "test-wb-conv-a";
  const msgA = "test-wb-msg-a";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, convA));
    await db.delete(messages).where(eq(messages.id, msgA));
    await db.delete(conversations).where(eq(conversations.id, convA));
    await db.delete(users).where(sql`id in (${userA}, ${userB})`);

    await db.insert(users).values([
      { id: userA, email: `${userA}@t.test`, password: "x", name: "A" },
      { id: userB, email: `${userB}@t.test`, password: "x", name: "B" },
    ] as any);
    await db.insert(conversations).values({ id: convA, userId: userA, title: "t" });
    await db.insert(messages).values({ id: msgA, conversationId: convA, role: "assistant", content: "h" });
    await db.insert(whiteboardArtifacts).values({
      id: "art_r_1",
      conversationId: convA,
      messageId: msgA,
      kind: "chart",
      title: "Revenue",
      summary: "s",
      payload: {},
      canvasX: 0,
      canvasY: 0,
      width: 600,
      height: 400,
      sequence: 1,
    });
  });

  function buildTestApp(currentUserId: string | null) {
    const app = express();
    app.use(express.json());
    const requireAuth = (_req: any, _res: any, next: any) => next();
    const getCurrentUserId = () => currentUserId;
    const storage = {
      getConversation: async (id: string) => {
        const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
        return row ?? null;
      },
    };
    app.get("/api/conversations/:id/whiteboard", requireAuth, async (req, res) => {
      const userId = getCurrentUserId();
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      if (conversation.userId !== userId) return res.status(403).json({ error: "Access denied" });
      const artifacts = await listArtifactsByConversation(id);
      res.json({ artifacts });
    });
    return app;
  }

  it("returns 401 when no current user", async () => {
    const app = buildTestApp(null);
    const res = await request(app).get(`/api/conversations/${convA}/whiteboard`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not the conversation owner", async () => {
    const app = buildTestApp(userB);
    const res = await request(app).get(`/api/conversations/${convA}/whiteboard`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when conversation does not exist", async () => {
    const app = buildTestApp(userA);
    const res = await request(app).get(`/api/conversations/does-not-exist/whiteboard`);
    expect(res.status).toBe(404);
  });

  it("returns artifacts for the owner", async () => {
    const app = buildTestApp(userA);
    const res = await request(app).get(`/api/conversations/${convA}/whiteboard`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts).toHaveLength(1);
    expect(res.body.artifacts[0].id).toBe("art_r_1");
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, convA));
    await db.delete(messages).where(eq(messages.id, msgA));
    await db.delete(conversations).where(eq(conversations.id, convA));
    await db.delete(users).where(sql`id in (${userA}, ${userB})`);
  });
});
