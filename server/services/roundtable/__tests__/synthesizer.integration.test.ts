/**
 * Integration smoke test for the Roundtable agent synthesizer.
 *
 * Uses a real Postgres connection (via DATABASE_URL) but mocks ONLY the LLM
 * provider so the test is deterministic and free.
 *
 * The global tests/setup.ts loads `.env.test` (which does not exist on most
 * dev boxes) and falls back to a localhost default. We import `dotenv/config`
 * here so the project's main `.env` is picked up too — this is a no-op when
 * DATABASE_URL is already in the shell env.
 */
import "dotenv/config";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock the model — return a deterministic POV BEFORE importing modules that
// resolve the registry at import time.
vi.mock("../../aiProviders/registry", () => ({
  aiProviderRegistry: {
    getProvider: () => ({
      generateCompletion: async () => ({
        content: JSON.stringify({
          selfPosition: { stance: "Synthesized stance" },
          othersSummary: { Moderator: "moderator-summary" },
          outgoingQa: [],
          incomingQa: [],
          chairQa: [],
          openThreads: [],
          glossary: { Entity: "TestCo" },
        }),
        finishReason: "stop",
        tokensUsed: { input: 100, output: 50, total: 150 },
        model: "gpt-4o-mini",
        provider: "azure-openai",
      }),
    }),
  },
}));

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  users,
  roundtablePanels,
  roundtablePanelAgents,
  roundtableThreads,
  roundtableTurns,
  agentPovDocuments,
} from "@shared/schema";
import { synthesizeAgentPOV } from "../agentSynthesizer";
import * as povStore from "../agentPovStore";

describe("synthesizer integration (real DB)", () => {
  let userId: string;
  let panelId: string;
  let threadId: string;
  let auditorId: string;
  let modId: string;

  beforeAll(async () => {
    // Create a throwaway user — roundtable_panels.user_id has a FK to users.id.
    const uniqueEmail = `synth-int-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@test.local`;
    const [user] = await db
      .insert(users)
      .values({
        email: uniqueEmail,
        password: "x",
        name: "Synth Integration Tester",
      })
      .returning();
    userId = user.id;

    const [panel] = await db
      .insert(roundtablePanels)
      .values({
        userId,
        name: "synth-test-panel",
        description: "",
        isTemplate: false,
      })
      .returning();
    panelId = panel.id;

    const [auditor] = await db
      .insert(roundtablePanelAgents)
      .values({
        panelId,
        name: "Auditor",
        systemPrompt: "audit",
        model: "mini",
        useBaseKnowledge: true,
        position: 0,
      })
      .returning();
    auditorId = auditor.id;

    const [mod] = await db
      .insert(roundtablePanelAgents)
      .values({
        panelId,
        name: "Moderator",
        systemPrompt: "mod",
        model: "mini",
        useBaseKnowledge: true,
        position: 1,
        createdFromTemplate: "moderator-bot",
      })
      .returning();
    modId = mod.id;

    const [thread] = await db
      .insert(roundtableThreads)
      .values({
        panelId,
        conversationId: null,
        title: "synth-test-thread",
        phase: "opening",
      })
      .returning();
    threadId = thread.id;

    // One turn from Moderator before synthesis runs for Auditor.
    await db.insert(roundtableTurns).values({
      threadId,
      panelId,
      speakerKind: "agent",
      agentId: modId,
      content: "Welcome to the panel. Let us discuss Plant 3.",
      status: "completed",
      position: 1,
    });
  });

  afterAll(async () => {
    // Reverse dependency order. Most rows cascade-delete from panels/threads,
    // but we delete explicitly to be safe even if FK cascades change.
    if (threadId) {
      await db
        .delete(agentPovDocuments)
        .where(eq(agentPovDocuments.threadId, threadId));
      await db
        .delete(roundtableTurns)
        .where(eq(roundtableTurns.threadId, threadId));
      await db
        .delete(roundtableThreads)
        .where(eq(roundtableThreads.id, threadId));
    }
    if (panelId) {
      await db
        .delete(roundtablePanelAgents)
        .where(eq(roundtablePanelAgents.panelId, panelId));
      await db.delete(roundtablePanels).where(eq(roundtablePanels.id, panelId));
    }
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("creates and updates POV doc end-to-end", async () => {
    const result = await synthesizeAgentPOV({
      threadId,
      agentId: auditorId,
      agentName: "Auditor",
      panelId,
    });
    expect(result.version).toBeGreaterThanOrEqual(2);

    const doc = await povStore.get(threadId, auditorId);
    expect(doc).not.toBeNull();
    expect((doc!.selfPosition as any).stance).toBe("Synthesized stance");
    expect((doc!.glossary as any).Entity).toBe("TestCo");
    expect(doc!.lastSynthesizedTurnId).not.toBeNull();
  });

  it("renderForPrompt produces injectable text", async () => {
    const doc = await povStore.get(threadId, auditorId);
    expect(doc).not.toBeNull();
    const text = povStore.renderForPrompt(doc!);
    expect(text).toContain("Synthesized stance");
    expect(text).toContain("TestCo");
    expect(text).toContain("YOUR PERSPECTIVE");
  });
});
