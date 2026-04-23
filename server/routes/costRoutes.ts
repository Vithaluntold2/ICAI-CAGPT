/**
 * Cost / budget / telemetry read-only routes.
 *
 * Powers the Step 8 cost-estimator UI. Every endpoint is scoped to a
 * single conversation ID to avoid leaking spend data across users —
 * the client passes the active conversationId it already knows about.
 *
 * Endpoints:
 *   GET  /api/cost/:conversationId            → current budget + spend summary
 *   GET  /api/cost/:conversationId/telemetry  → recent tool-call rows (max 50)
 *
 * Storage is USD cents; the UI converts to the chosen display currency.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { conversationBudgets, toolCallTelemetry } from '@shared/schema';
import { eq, desc, sum, count, sql } from 'drizzle-orm';

const router = Router();

const MAX_TELEMETRY_ROWS = 50;

router.get('/:conversationId', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  if (!conversationId || conversationId.length > 128) {
    return res.status(400).json({ error: 'Invalid conversation id' });
  }

  try {
    const [budgetRow] = await db
      .select()
      .from(conversationBudgets)
      .where(eq(conversationBudgets.conversationId, conversationId))
      .limit(1);

    // If no explicit budget row exists, fall back to derived totals so
    // the UI can still show spend-to-date without forcing the caller
    // to pre-create a row.
    const [aggregate] = await db
      .select({
        totalCostCents: sum(toolCallTelemetry.costUsdCents).mapWith(Number),
        totalCalls: count(toolCallTelemetry.id),
        totalPromptTokens: sum(toolCallTelemetry.promptTokens).mapWith(Number),
        totalCompletionTokens: sum(toolCallTelemetry.completionTokens).mapWith(Number),
      })
      .from(toolCallTelemetry)
      .where(eq(toolCallTelemetry.conversationId, conversationId));

    return res.json({
      conversationId,
      budget: budgetRow
        ? {
            budgetUsdCents: budgetRow.budgetUsdCents,
            spentUsdCents: budgetRow.spentUsdCents,
            reservedUsdCents: budgetRow.reservedUsdCents,
            enforce: budgetRow.enforce,
            displayCurrency: budgetRow.displayCurrency,
          }
        : {
            budgetUsdCents: 0,
            spentUsdCents: aggregate?.totalCostCents ?? 0,
            reservedUsdCents: 0,
            enforce: false,
            displayCurrency: 'INR',
          },
      aggregate: {
        totalCostCents: aggregate?.totalCostCents ?? 0,
        totalCalls: aggregate?.totalCalls ?? 0,
        totalPromptTokens: aggregate?.totalPromptTokens ?? 0,
        totalCompletionTokens: aggregate?.totalCompletionTokens ?? 0,
      },
    });
  } catch (err) {
    console.error('[costRoutes] /cost/:id failed:', err);
    return res.status(500).json({ error: 'Failed to load cost summary' });
  }
});

router.get('/:conversationId/telemetry', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  if (!conversationId || conversationId.length > 128) {
    return res.status(400).json({ error: 'Invalid conversation id' });
  }

  const limitParam = Number.parseInt(String(req.query.limit ?? ''), 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_TELEMETRY_ROWS)
    : MAX_TELEMETRY_ROWS;

  try {
    const rows = await db
      .select({
        id: toolCallTelemetry.id,
        toolName: toolCallTelemetry.toolName,
        agentId: toolCallTelemetry.agentId,
        outcome: toolCallTelemetry.outcome,
        durationMs: toolCallTelemetry.durationMs,
        promptTokens: toolCallTelemetry.promptTokens,
        completionTokens: toolCallTelemetry.completionTokens,
        costUsdCents: toolCallTelemetry.costUsdCents,
        roundTrips: toolCallTelemetry.roundTrips,
        meta: toolCallTelemetry.meta,
        createdAt: toolCallTelemetry.createdAt,
      })
      .from(toolCallTelemetry)
      .where(eq(toolCallTelemetry.conversationId, conversationId))
      .orderBy(desc(toolCallTelemetry.createdAt))
      .limit(limit);

    // Per-tool breakdown so the UI can show a compact histogram.
    const byTool = await db
      .select({
        toolName: toolCallTelemetry.toolName,
        calls: count(toolCallTelemetry.id),
        costCents: sum(toolCallTelemetry.costUsdCents).mapWith(Number),
        avgDurationMs: sql<number>`COALESCE(AVG(${toolCallTelemetry.durationMs}), 0)`.mapWith(Number),
      })
      .from(toolCallTelemetry)
      .where(eq(toolCallTelemetry.conversationId, conversationId))
      .groupBy(toolCallTelemetry.toolName);

    return res.json({
      conversationId,
      rows,
      byTool,
    });
  } catch (err) {
    console.error('[costRoutes] /cost/:id/telemetry failed:', err);
    return res.status(500).json({ error: 'Failed to load telemetry' });
  }
});

export default router;
