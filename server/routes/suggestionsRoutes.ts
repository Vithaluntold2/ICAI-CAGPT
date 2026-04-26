/**
 * GET /api/suggestions?mode=<chatMode>
 *
 * Returns 2-3 dynamic chip suggestions for the chat empty-state.
 * Composes from: recent conversations, ICAI compliance calendar,
 * curated circular highlights.
 *
 * Authenticated. Lightly cached (60s) per (user, mode).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { normalizeChatMode } from '../services/chatModeNormalizer';
import { buildSuggestions } from '../services/suggestionsService';

const router = Router();

router.use(requireAuth);

interface CacheEntry {
  expiresAt: number;
  body: unknown;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_KEYS = 5_000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.expiresAt < now) cache.delete(k);
}, 5 * 60_000).unref();

router.get('/', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const mode = normalizeChatMode(typeof req.query.mode === 'string' ? req.query.mode : undefined);
  const cacheKey = `${userId}:${mode}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.body);
  }

  try {
    const suggestions = await buildSuggestions({ userId, mode });
    const body = { mode, suggestions, generatedAt: new Date().toISOString() };

    if (cache.size >= MAX_CACHE_KEYS) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, body });

    return res.json(body);
  } catch (err) {
    console.error('[suggestionsRoutes] /suggestions failed:', err);
    return res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

export default router;
