/**
 * Roundtable Panel Routes — `/api/roundtable/panels`
 *
 * REST surface for the user-curated panel system. Phase-1 foundation:
 * panel CRUD, agent CRUD, KB doc CRUD, agent ↔ doc attachments, and
 * starter-template listing.
 *
 * The legacy roundtable workflow under `/api/roundtable/*` is left
 * untouched so existing sessions keep running.
 */

import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, getCurrentUserId } from '../middleware/auth';
import {
  createPanel,
  getPanel,
  listPanels,
  updatePanel,
  deletePanel,
  createAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  cloneAgent,
  createKbDoc,
  listKbDocs,
  deleteKbDoc,
  attachDocsToAgent,
  detachDocFromAgent,
  listDocsForAgent,
  hydratePanel,
} from '../services/roundtable/roundtablePanelService';
import {
  ROUNDTABLE_AGENT_TEMPLATES,
  getTemplate,
} from '../services/roundtable/roundtableTemplates';
import { setDocContentAndIngest } from '../services/roundtable/roundtableKbIngest';

const router = express.Router();
router.use(requireAuth);

// 5MB cap for v1 — KB docs are usually short briefs, not long PDFs.
// Phase-2 will route binary formats through documentAnalyzer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ----------------------------------------------------------------------
// Validation schemas (zod). Kept inline for locality.
// ----------------------------------------------------------------------

const panelCreateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  conversationId: z.string().optional(),
  isTemplate: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const panelUpdateSchema = panelCreateSchema.partial();

const agentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  avatar: z.string().max(200).optional(),
  color: z.string().max(32).optional(),
  systemPrompt: z.string().min(1).max(20_000),
  useBaseKnowledge: z.boolean().optional(),
  model: z.enum(['strong', 'mini']).optional(),
  toolAllowlist: z.array(z.string()).optional(),
  createdFromTemplate: z.string().max(60).optional(),
  position: z.number().int().nonnegative().optional(),
});

const agentSpawnFromTemplateSchema = z.object({
  templateId: z.string(),
  overrides: agentCreateSchema.partial().optional(),
});

const agentUpdateSchema = agentCreateSchema.partial();

const attachDocsSchema = z.object({
  docIds: z.array(z.string()).min(1),
});

const kbTextSchema = z.object({
  filename: z.string().min(1).max(500),
  contentText: z.string().min(1),
  mimeType: z.string().max(200).optional(),
});

// Helper that types req.user without forcing every handler to re-derive.
function uid(req: Request): string {
  return getCurrentUserId(req);
}

function badRequest(res: Response, err: unknown) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'Invalid request', issues: err.issues });
  }
  console.error('[RoundtablePanels] Unexpected error:', err);
  return res.status(500).json({ error: 'Internal error' });
}

// ----------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------

router.get('/templates', (_req, res) => {
  // Strip the system prompt from the listing — it's fetched on demand to
  // keep the picker payload small.
  res.json({
    templates: ROUNDTABLE_AGENT_TEMPLATES.map(({ systemPrompt: _ignored, ...rest }) => rest),
  });
});

router.get('/templates/:id', (req, res) => {
  const tpl = getTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  res.json({ template: tpl });
});

// ----------------------------------------------------------------------
// Panels
// ----------------------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const body = panelCreateSchema.parse(req.body);
    const panel = await createPanel(uid(req), {
      name: body.name ?? 'Untitled panel',
      description: body.description ?? null,
      conversationId: body.conversationId ?? null,
      isTemplate: body.isTemplate ?? false,
      metadata: body.metadata ?? {},
    });
    res.status(201).json({ panel });
  } catch (err) {
    badRequest(res, err);
  }
});

router.get('/', async (req, res) => {
  try {
    const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
    const templatesOnly = req.query.templates === '1' || req.query.templates === 'true';
    const panels = await listPanels(uid(req), { conversationId, templatesOnly });
    res.json({ panels });
  } catch (err) {
    badRequest(res, err);
  }
});

router.get('/:panelId', async (req, res) => {
  try {
    const hydrated = await hydratePanel(uid(req), req.params.panelId);
    if (!hydrated) return res.status(404).json({ error: 'Panel not found' });
    res.json(hydrated);
  } catch (err) {
    badRequest(res, err);
  }
});

router.patch('/:panelId', async (req, res) => {
  try {
    const body = panelUpdateSchema.parse(req.body);
    const updated = await updatePanel(uid(req), req.params.panelId, body);
    if (!updated) return res.status(404).json({ error: 'Panel not found' });
    res.json({ panel: updated });
  } catch (err) {
    badRequest(res, err);
  }
});

router.delete('/:panelId', async (req, res) => {
  try {
    const ok = await deletePanel(uid(req), req.params.panelId);
    if (!ok) return res.status(404).json({ error: 'Panel not found' });
    res.json({ ok: true });
  } catch (err) {
    badRequest(res, err);
  }
});

// ----------------------------------------------------------------------
// Agents inside a panel
// ----------------------------------------------------------------------

router.get('/:panelId/agents', async (req, res) => {
  try {
    const agents = await listAgents(uid(req), req.params.panelId);
    if (agents == null) return res.status(404).json({ error: 'Panel not found' });
    res.json({ agents });
  } catch (err) {
    badRequest(res, err);
  }
});

router.post('/:panelId/agents', async (req, res) => {
  try {
    const body = agentCreateSchema.parse(req.body);
    const agent = await createAgent(uid(req), req.params.panelId, body);
    if (!agent) return res.status(404).json({ error: 'Panel not found' });
    res.status(201).json({ agent });
  } catch (err) {
    badRequest(res, err);
  }
});

router.post('/:panelId/agents/spawn-template', async (req, res) => {
  try {
    const body = agentSpawnFromTemplateSchema.parse(req.body);
    const tpl = getTemplate(body.templateId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });

    const o = body.overrides ?? {};
    const agent = await createAgent(uid(req), req.params.panelId, {
      name: o.name ?? tpl.name,
      avatar: o.avatar ?? tpl.avatar,
      color: o.color ?? tpl.color,
      systemPrompt: o.systemPrompt ?? tpl.systemPrompt,
      useBaseKnowledge: o.useBaseKnowledge ?? tpl.useBaseKnowledge,
      model: o.model ?? tpl.model,
      toolAllowlist: o.toolAllowlist ?? [],
      createdFromTemplate: tpl.id,
      position: o.position,
    });
    if (!agent) return res.status(404).json({ error: 'Panel not found' });
    res.status(201).json({ agent });
  } catch (err) {
    badRequest(res, err);
  }
});

router.patch('/agents/:agentId', async (req, res) => {
  try {
    const body = agentUpdateSchema.parse(req.body);
    const updated = await updateAgent(uid(req), req.params.agentId, body);
    if (!updated) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agent: updated });
  } catch (err) {
    badRequest(res, err);
  }
});

router.delete('/agents/:agentId', async (req, res) => {
  try {
    const ok = await deleteAgent(uid(req), req.params.agentId);
    if (!ok) return res.status(404).json({ error: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) {
    badRequest(res, err);
  }
});

router.post('/agents/:agentId/clone', async (req, res) => {
  try {
    const cloned = await cloneAgent(uid(req), req.params.agentId);
    if (!cloned) return res.status(404).json({ error: 'Agent not found' });
    res.status(201).json({ agent: cloned });
  } catch (err) {
    badRequest(res, err);
  }
});

// ----------------------------------------------------------------------
// KB docs (text uploads only in v1; binary parsing comes in Phase 2)
// ----------------------------------------------------------------------

router.get('/:panelId/kb', async (req, res) => {
  try {
    const docs = await listKbDocs(uid(req), req.params.panelId);
    if (docs == null) return res.status(404).json({ error: 'Panel not found' });
    res.json({ docs });
  } catch (err) {
    badRequest(res, err);
  }
});

// Plain-text upload (paste into a textarea, or short JSON payload).
router.post('/:panelId/kb/text', async (req, res) => {
  try {
    const body = kbTextSchema.parse(req.body);
    const doc = await createKbDoc(uid(req), req.params.panelId, {
      filename: body.filename,
      mimeType: body.mimeType ?? 'text/plain',
      sizeBytes: Buffer.byteLength(body.contentText, 'utf8'),
      contentText: body.contentText,
    });
    if (!doc) return res.status(404).json({ error: 'Panel not found' });

    // Ingest synchronously for short texts; small UX win and avoids
    // queue infra in v1. For long texts the user can poll the doc.
    setDocContentAndIngest(doc.id, body.contentText).catch((err) =>
      console.error('[RoundtableKB] Ingest failed', { docId: doc.id, err }),
    );
    res.status(201).json({ doc });
  } catch (err) {
    badRequest(res, err);
  }
});

// File upload — accepts text-like formats only in v1. Binary formats
// fall through to Phase 2 where documentAnalyzer is wired in.
router.post('/:panelId/kb/file', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const filename = file.originalname || 'unnamed';
    const mime = file.mimetype || 'application/octet-stream';

    const isTextLike =
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/xml' ||
      filename.match(/\.(txt|md|markdown|csv|tsv|json|xml|html?)$/i);

    if (!isTextLike) {
      return res.status(415).json({
        error: 'Binary KB ingest not yet supported',
        hint: 'Paste extracted text via /kb/text for now (PDF/DOCX support coming in Phase 2).',
      });
    }

    const contentText = file.buffer.toString('utf8');
    const doc = await createKbDoc(uid(req), req.params.panelId, {
      filename,
      mimeType: mime,
      sizeBytes: file.size,
      contentText,
    });
    if (!doc) return res.status(404).json({ error: 'Panel not found' });

    setDocContentAndIngest(doc.id, contentText).catch((err) =>
      console.error('[RoundtableKB] Ingest failed', { docId: doc.id, err }),
    );
    res.status(201).json({ doc });
  } catch (err) {
    badRequest(res, err);
  }
});

router.delete('/kb/:docId', async (req, res) => {
  try {
    const ok = await deleteKbDoc(uid(req), req.params.docId);
    if (!ok) return res.status(404).json({ error: 'Doc not found' });
    res.json({ ok: true });
  } catch (err) {
    badRequest(res, err);
  }
});

// ----------------------------------------------------------------------
// Agent ↔ Doc attachments
// ----------------------------------------------------------------------

router.get('/agents/:agentId/kb', async (req, res) => {
  try {
    const docs = await listDocsForAgent(uid(req), req.params.agentId);
    if (docs == null) return res.status(404).json({ error: 'Agent not found' });
    res.json({ docs });
  } catch (err) {
    badRequest(res, err);
  }
});

router.post('/agents/:agentId/kb', async (req, res) => {
  try {
    const body = attachDocsSchema.parse(req.body);
    const ok = await attachDocsToAgent(uid(req), req.params.agentId, body.docIds);
    if (!ok) return res.status(404).json({ error: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) {
    badRequest(res, err);
  }
});

router.delete('/agents/:agentId/kb/:docId', async (req, res) => {
  try {
    const ok = await detachDocFromAgent(uid(req), req.params.agentId, req.params.docId);
    if (!ok) return res.status(404).json({ error: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) {
    badRequest(res, err);
  }
});

export default router;
