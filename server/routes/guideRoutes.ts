import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { guideTestResults } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/guide/results
 * Returns all test results from the database, keyed by testId.
 * Shape: { [testId]: { status, tester, notes, updatedAt } }
 */
router.get('/results', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(guideTestResults);
    // Merge: last-updated tester wins per testId
    const merged: Record<string, { status: string; tester: string; notes: string; updatedAt: string }> = {};
    rows.forEach(row => {
      const existing = merged[row.testId];
      if (!existing || new Date(row.updatedAt) > new Date(existing.updatedAt)) {
        merged[row.testId] = {
          status: row.status,
          tester: row.tester,
          notes: row.notes ?? '',
          updatedAt: row.updatedAt.toISOString(),
        };
      }
    });
    res.json(merged);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch guide test results' });
  }
});

/**
 * GET /api/guide/results/all
 * Returns every row (all testers, all tests) — useful for multi-tester overview.
 */
router.get('/results/all', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(guideTestResults);
    res.json(rows.map(r => ({
      testId: r.testId,
      status: r.status,
      tester: r.tester,
      notes: r.notes ?? '',
      updatedAt: r.updatedAt.toISOString(),
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch all guide test results' });
  }
});

/**
 * POST /api/guide/results
 * Upsert a single test result for a tester.
 * Body: { testId, tester, status, notes? }
 */
router.post('/results', async (req: Request, res: Response) => {
  const { testId, tester, status, notes } = req.body ?? {};
  if (!testId || !tester || !status) {
    return res.status(400).json({ error: 'testId, tester, and status are required' });
  }
  if (!['pass', 'fail', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be pass, fail, or pending' });
  }
  const testerSafe = String(tester).trim().slice(0, 100);
  const testIdSafe = String(testId).trim().slice(0, 100);
  const notesSafe = notes ? String(notes).slice(0, 2000) : '';

  try {
    const now = new Date();
    // Use INSERT ... ON CONFLICT (upsert) via Drizzle
    await db
      .insert(guideTestResults)
      .values({ testId: testIdSafe, tester: testerSafe, status, notes: notesSafe, updatedAt: now, createdAt: now })
      .onConflictDoUpdate({
        target: [guideTestResults.testId, guideTestResults.tester],
        set: { status, notes: notesSafe, updatedAt: now },
      });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save guide test result' });
  }
});

export default router;
