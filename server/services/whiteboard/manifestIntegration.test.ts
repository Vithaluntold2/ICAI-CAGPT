import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { users, conversations, whiteboardArtifacts, messages } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { listArtifactsByConversation } from "./repository";
import { formatManifest } from "./manifest";
import { buildSelectionPreamble } from "./selectionPreamble";

describe("whiteboard manifest integration (Phase 4.6)", () => {
  const u = "test-mi-u";
  const c = "test-mi-c";
  const m = "test-mi-m";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(messages).where(eq(messages.id, m));
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
    await db.insert(users).values({ id: u, email: `${u}@t.test`, password: "x", name: "MI User" } as any);
    await db.insert(conversations).values({ id: c, userId: u, title: "t" });
    await db.insert(messages).values({ id: m, conversationId: c, role: "assistant", content: "h", artifactIds: [] });
    await db.insert(whiteboardArtifacts).values([
      {
        id: "art_mi_1", conversationId: c, messageId: m, kind: "chart",
        title: "Revenue", summary: "quarterly revenue comparison",
        payload: {}, canvasX: 0, canvasY: 0, width: 600, height: 400, sequence: 1,
      },
      {
        id: "art_mi_2", conversationId: c, messageId: m, kind: "workflow",
        title: "Month-end close", summary: "9-step closing process",
        payload: {}, canvasX: 0, canvasY: 0, width: 800, height: 500, sequence: 2,
      },
    ]);
  });

  it("manifest reflects both artifacts in sequence order", async () => {
    const artifacts = await listArtifactsByConversation(c);
    const manifest = formatManifest(artifacts);
    expect(manifest).toContain("current conversation, 2 artifacts");
    expect(manifest).toContain("art_mi_1");
    expect(manifest).toContain("Revenue");
    expect(manifest).toContain("art_mi_2");
    expect(manifest).toContain("Month-end close");
    expect(manifest.indexOf("art_mi_1")).toBeLessThan(manifest.indexOf("art_mi_2"));
  });

  it("selection preamble composes with user query as expected", () => {
    const preamble = buildSelectionPreamble({ artifactIds: ["art_mi_1", "art_mi_2"], highlightedText: "cash flow" });
    const effective = `${preamble}\n\nRewrite this.`;
    expect(effective).toContain("art_mi_1, art_mi_2");
    expect(effective).toContain('"cash flow"');
    expect(effective.endsWith("Rewrite this.")).toBe(true);
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(messages).where(eq(messages.id, m));
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
  });
});
