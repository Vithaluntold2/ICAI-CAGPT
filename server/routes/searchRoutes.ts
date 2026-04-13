/**
 * CA GPT Search API Routes
 *
 * POST /api/search           — Execute a search query (blocking)
 * POST /api/search/stream     — Execute a search query (SSE streaming with research plan)
 * GET  /api/search/history    — Get user's search history
 * GET  /api/search/suggestions — Get suggested searches
 * POST /api/search/:id/pin    — Pin/unpin a search result
 * DELETE /api/search/:id      — Delete a search history entry
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, getCurrentUserId } from '../middleware/auth';
import { isFeatureEnabled } from '../config/featureFlags';
import { searchEngine, SearchDomain } from '../services/searchEngine';
import type { SearchSSEEvent } from '../services/searchEngine';
import { z } from 'zod';

const router = Router();

// All search routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Rate limiting (per-user, in-memory)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // 30 searches per minute
const RATE_LIMIT_WINDOW = 60_000; // 1 minute

// Clean up expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60_000).unref();

function checkSearchRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const searchSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters').max(2000),
  domain: z.enum(['tax', 'audit', 'gaap_ifrs', 'compliance', 'advisory', 'general']).optional(),
  jurisdiction: z.string().max(50).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/search — Execute a search
// ---------------------------------------------------------------------------

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!isFeatureEnabled('AI_SEARCH')) {
      return res.status(503).json({
        error: 'AI Search is not available. No search provider configured.',
      });
    }

    const userId = getCurrentUserId(req);

    if (!checkSearchRateLimit(userId)) {
      return res.status(429).json({
        error: 'Search rate limit exceeded. Please wait a moment before searching again.',
      });
    }

    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid search request',
        details: parsed.error.issues,
      });
    }

    const { query, domain, jurisdiction } = parsed.data;

    const result = await searchEngine.search({
      query,
      domain: domain as SearchDomain | undefined,
      jurisdiction,
      userId,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Search failed';
    console.error('[SearchRoutes] Search error:', message);
    return res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/search/stream — Execute a search with SSE streaming
// ---------------------------------------------------------------------------

router.post('/stream', async (req: Request, res: Response) => {
  try {
    if (!isFeatureEnabled('AI_SEARCH')) {
      return res.status(503).json({
        error: 'AI Search is not available. No search provider configured.',
      });
    }

    const userId = getCurrentUserId(req);

    if (!checkSearchRateLimit(userId)) {
      return res.status(429).json({
        error: 'Search rate limit exceeded. Please wait a moment before searching again.',
      });
    }

    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid search request',
        details: parsed.error.issues,
      });
    }

    const { query, domain, jurisdiction } = parsed.data;

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendSSE = (event: SearchSSEEvent) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch (err) {
        console.error('[SearchStream] Error sending SSE:', err);
      }
    };

    // Handle client disconnect
    let disconnected = false;
    req.on('close', () => {
      disconnected = true;
    });

    await searchEngine.searchStream(
      {
        query,
        domain: domain as SearchDomain | undefined,
        jurisdiction,
        userId,
      },
      (event) => {
        if (!disconnected) sendSSE(event);
      },
    );

    res.end();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Search failed';
    console.error('[SearchStream] Error:', message);
    // If headers already sent (SSE mode), send error event
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
      } catch { /* ignore */ }
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/search/history — Get search history
// ---------------------------------------------------------------------------

router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const history = await searchEngine.getHistory(userId, limit);
    return res.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history';
    console.error('[SearchRoutes] History error:', message);
    return res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/search/suggestions — Get suggested searches
// ---------------------------------------------------------------------------

router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const domain = (req.query.domain as SearchDomain) || undefined;
    const suggestions = searchEngine.getSuggestions(domain);
    return res.json({ suggestions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get suggestions';
    return res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/search/:id/pin — Pin/unpin a search result
// ---------------------------------------------------------------------------

router.post('/:id/pin', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const searchId = req.params.id;

    const pinned = await searchEngine.togglePin(searchId, userId);
    return res.json({ pinned });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to toggle pin';
    return res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/search/:id — Delete a search history entry
// ---------------------------------------------------------------------------

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const searchId = req.params.id;

    await searchEngine.deleteHistory(searchId, userId);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete search';
    return res.status(500).json({ error: message });
  }
});

export default router;
