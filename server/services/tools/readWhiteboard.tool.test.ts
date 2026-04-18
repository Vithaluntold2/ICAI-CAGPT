import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { whiteboardArtifacts, conversations, users, messages } from "../../../shared/schema";
import { readWhiteboardTool } from "./readWhiteboard.tool";
import { eq, sql } from "drizzle-orm";

describe("read_whiteboard tool", () => {
  const u = "test-tool-user";
  const c1 = "test-tool-c1";
  const c2 = "test-tool-c2";
  const m = "test-tool-m";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(sql`conversation_id in (${c1}, ${c2})`);
    await db.delete(messages).where(eq(messages.id, m));
    await db.delete(conversations).where(sql`id in (${c1}, ${c2})`);
    await db.delete(users).where(eq(users.id, u));
    await db.insert(users).values({ id: u, email: `${u}@t.test`, password: "x", name: "Tool Test User" } as any);
    await db.insert(conversations).values([{ id: c1, userId: u, title: "t" }, { id: c2, userId: u, title: "t" }]);
    await db.insert(messages).values({ id: m, conversationId: c1, role: "assistant", content: "h" });
    await db.insert(whiteboardArtifacts).values({
      id: "art_t_1", conversationId: c1, messageId: m, kind: "chart",
      title: "Revenue", summary: "s", payload: { rows: [1, 2, 3] },
      canvasX: 0, canvasY: 0, width: 600, height: 400, sequence: 1,
    });
  });

  it("returns payload for an owned artifact", async () => {
    const out: any = await readWhiteboardTool.handler({ artifact_id: "art_t_1" }, { conversationId: c1, userId: u });
    expect(out.title).toBe("Revenue");
    expect(out.payload).toEqual({ rows: [1, 2, 3] });
    expect(out.kind).toBe("chart");
  });

  it("throws when artifact belongs to a different conversation", async () => {
    await expect(
      readWhiteboardTool.handler({ artifact_id: "art_t_1" }, { conversationId: c2, userId: u })
    ).rejects.toThrow(/artifact_not_found/);
  });

  it("throws when artifact does not exist", async () => {
    await expect(
      readWhiteboardTool.handler({ artifact_id: "missing" }, { conversationId: c1, userId: u })
    ).rejects.toThrow(/artifact_not_found/);
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(sql`conversation_id in (${c1}, ${c2})`);
    await db.delete(messages).where(eq(messages.id, m));
    await db.delete(conversations).where(sql`id in (${c1}, ${c2})`);
    await db.delete(users).where(eq(users.id, u));
  });
});
