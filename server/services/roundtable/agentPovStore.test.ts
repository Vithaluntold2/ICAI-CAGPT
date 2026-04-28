import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks (vitest hoists vi.mock above imports)
vi.mock("../../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("../hybridCache", () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  CacheService: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { CacheService } from "../hybridCache";
import { db } from "../../db";
import * as store from "./agentPovStore";

describe("agentPovStore.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when row does not exist and not cached", async () => {
    (CacheService.get as any).mockResolvedValue(null);
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    const result = await store.get("thread1", "agent1");
    expect(result).toBeNull();
  });

  it("returns cached value without DB call when cache hit", async () => {
    const cached = { threadId: "t", agentId: "a", version: 3 };
    (CacheService.get as any).mockResolvedValue(cached);
    const result = await store.get("t", "a");
    expect(result).toEqual(cached);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe("agentPovStore.getOrInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts and returns an empty doc when none exists", async () => {
    (CacheService.get as any).mockResolvedValue(null);
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    const inserted = {
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {}, outgoingQa: [], incomingQa: [],
      chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0,
      lastUpdatedAt: new Date(),
    };
    (db.insert as any).mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([inserted]),
        }),
      }),
    });
    const result = await store.getOrInit("t", "a");
    expect(result.threadId).toBe("t");
    expect(result.version).toBe(1);
  });

  it("falls back to re-read when concurrent insert wins the conflict race", async () => {
    const existing = {
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0,
      lastUpdatedAt: new Date(),
    };
    // Both reads (initial get + re-fetch get) miss cache.
    (CacheService.get as any).mockResolvedValue(null);
    // First DB select (initial get): empty. Second DB select (re-fetch): row exists.
    let dbCallCount = 0;
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(dbCallCount++ === 0 ? [] : [existing]),
        }),
      }),
    });
    // Insert returns empty (conflict path).
    (db.insert as any).mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    });
    const result = await store.getOrInit("t", "a");
    expect(result).toEqual(existing);
    expect(dbCallCount).toBe(2); // initial + re-fetch
  });

  it("throws when both insert AND re-fetch miss (impossible state)", async () => {
    (CacheService.get as any).mockResolvedValue(null);
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
    (db.insert as any).mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    });
    await expect(store.getOrInit("t", "a")).rejects.toThrow(/Failed to init POV doc/);
  });
});
