/**
 * Roundtable Boardroom Routes — `/api/roundtable/boardroom`
 *
 * REST + SSE surface for the live boardroom runtime (Phase 2).
 * Mounted independently from `/api/roundtable` (legacy) and
 * `/api/roundtable/panels` (factory) so each layer evolves on its own.
 */

import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, getCurrentUserId } from '../middleware/auth';
import {
  createThread,
  listThreads,
  getThread,
  listTurns,
  listQuestionCards,
  chairInterject,
  chairTagAgent,
  cancelTurn,
  setPhase,
  answerQuestion,
  redirectQuestion,
  skipQuestion,
  subscribe,
  kickoff,
  pauseThread,
  resumeThread,
} from '../services/roundtable/roundtableRuntime';

const router = express.Router();
router.use(requireAuth);

// -----------------------------------------------------------------------
// Threads
// -----------------------------------------------------------------------

const createThreadSchema = z.object({
  panelId: z.string().min(1),
  title: z.string().max(300).optional(),
  conversationId: z.string().nullable().optional(),
});

router.post('/threads', async (req: Request, res: Response) => {
  try {
    const body = createThreadSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const thread = await createThread(userId, body.panelId, {
      title: body.title,
      conversationId: body.conversationId ?? null,
    });
    res.json({ thread });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/threads', async (req: Request, res: Response) => {
  try {
    const panelId = String(req.query.panelId || '');
    if (!panelId) return res.status(400).json({ error: 'panelId required' });
    const userId = getCurrentUserId(req);
    const threads = await listThreads(userId, panelId);
    res.json({ threads });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/threads/:threadId', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const thread = await getThread(userId, req.params.threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const [turns, questionCards] = await Promise.all([
      listTurns(userId, thread.id),
      listQuestionCards(userId, thread.id),
    ]);
    res.json({ thread, turns, questionCards });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// -----------------------------------------------------------------------
// SSE stream
// -----------------------------------------------------------------------

router.get('/threads/:threadId/stream', async (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const thread = await getThread(userId, req.params.threadId);
  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send('connected', { threadId: thread.id, phase: thread.phase });

  const keepAlive = setInterval(() => {
    try { res.write(`: keepalive ${Date.now()}\n\n`); } catch { /* socket gone */ }
  }, 25_000);

  const unsubscribe = subscribe(thread.id, (event, data) => {
    send(event, data);
  });

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

// -----------------------------------------------------------------------
// Chair actions
// -----------------------------------------------------------------------

const interjectSchema = z.object({ text: z.string().min(1) });
router.post('/threads/:threadId/interject', async (req: Request, res: Response) => {
  try {
    const body = interjectSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const turn = await chairInterject(userId, req.params.threadId, body.text);
    res.json({ turn });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const tagSchema = z.object({ agentId: z.string().min(1), text: z.string().min(1) });
router.post('/threads/:threadId/tag', async (req: Request, res: Response) => {
  try {
    const body = tagSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const turn = await chairTagAgent(userId, req.params.threadId, body.agentId, body.text);
    res.json({ turn });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const cancelSchema = z.object({ turnId: z.string().min(1), reason: z.string().optional() });
router.post('/threads/:threadId/cancel-turn', async (req: Request, res: Response) => {
  try {
    const body = cancelSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    await cancelTurn(userId, req.params.threadId, body.turnId, body.reason ?? 'chair-stop');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const phaseSchema = z.object({ phase: z.string().min(1) });
router.post('/threads/:threadId/phase', async (req: Request, res: Response) => {
  try {
    const body = phaseSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const thread = await setPhase(userId, req.params.threadId, body.phase);
    res.json({ thread });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// -----------------------------------------------------------------------
// Question card actions
// -----------------------------------------------------------------------

const answerSchema = z.object({ qid: z.string().min(1), answer: z.string().min(1) });
router.post('/threads/:threadId/answer-question', async (req: Request, res: Response) => {
  try {
    const body = answerSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const card = await answerQuestion(userId, req.params.threadId, body.qid, body.answer);
    res.json({ card });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const redirectSchema = z.object({ qid: z.string().min(1), toAgentId: z.string().min(1) });
router.post('/threads/:threadId/redirect-question', async (req: Request, res: Response) => {
  try {
    const body = redirectSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const card = await redirectQuestion(userId, req.params.threadId, body.qid, body.toAgentId);
    res.json({ card });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const skipSchema = z.object({ qid: z.string().min(1) });
router.post('/threads/:threadId/skip-question', async (req: Request, res: Response) => {
  try {
    const body = skipSchema.parse(req.body);
    const userId = getCurrentUserId(req);
    const card = await skipQuestion(userId, req.params.threadId, body.qid);
    res.json({ card });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Manual loop kick (rare; relevance loop usually auto-fires after each
// chair turn). Useful for test harnesses and the "Get the room going"
// button when no chair message has been sent yet.
router.post('/threads/:threadId/kickoff', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    await kickoff(userId, req.params.threadId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Pause / resume the boardroom — user-controlled "stop everything" /
// "carry on". Pause aborts the active stream and prevents any further
// agent turns until resume is called.
router.post('/threads/:threadId/pause', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    await pauseThread(userId, req.params.threadId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/threads/:threadId/resume', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    await resumeThread(userId, req.params.threadId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
