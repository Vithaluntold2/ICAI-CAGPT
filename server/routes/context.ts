/**
 * Context and Template API Routes
 * RESTful endpoints for context and template management
 */

import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { contextManager } from '../services/core/contextManager';
import { templateManager } from '../services/core/templateManager';
import type { ProfessionalMode } from '../../shared/types/agentTypes';

const router = express.Router();

// Configure multer for template file uploads
const templateUploadDir = path.join(process.cwd(), 'uploads', 'templates');
if (!fs.existsSync(templateUploadDir)) {
  fs.mkdirSync(templateUploadDir, { recursive: true });
}

const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, templateUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `template-${uniqueSuffix}${ext}`);
  },
});

const templateUpload = multer({
  storage: templateStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/pdf',
      'text/csv',
      'application/json',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.docx', '.doc', '.pdf', '.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

// Validation schemas
const createContextSchema = z.object({
  mode: z.enum(['deep-research', 'financial-calculation', 'workflow-visualization', 'audit-planning', 'scenario-simulator', 'deliverable-composer', 'forensic-intelligence', 'roundtable']),
  title: z.string().optional(),
  initialVariables: z.record(z.any()).optional(),
  userPreferences: z.record(z.any()).optional(),
});

const updateContextSchema = z.object({
  currentStep: z.string().optional(),
  variables: z.record(z.any()).optional(),
  agentOutputs: z.record(z.any()).optional(),
  userPreferences: z.record(z.any()).optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  mode: z.enum(['deep-research', 'financial-calculation', 'workflow-visualization', 'audit-planning', 'scenario-simulator', 'deliverable-composer', 'forensic-intelligence', 'roundtable']),
  category: z.enum(['query', 'document', 'workflow', 'report', 'analysis', 'calculation']),
  content: z.object({
    prompt: z.string().optional(),
    variables: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
      description: z.string(),
      required: z.boolean(),
      defaultValue: z.any().optional(),
      validation: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
        enum: z.array(z.any()).optional(),
      }).optional(),
    })),
    structure: z.any().optional(),
    workflow: z.any().optional(),
  }),
});

const renderTemplateSchema = z.object({
  variables: z.record(z.any()),
});

// ============== CONTEXT ROUTES ==============

/**
 * POST /api/context
 * Create a new conversation context
 */
router.post('/context', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validated = createContextSchema.parse(req.body);

    const context = await contextManager.createContext(
      userId,
      validated.mode as ProfessionalMode,
      {
        title: validated.title,
        initialVariables: validated.initialVariables,
        userPreferences: validated.userPreferences,
        userTier: req.user?.tier || 'free',
      }
    );

    res.json(context);
  } catch (error) {
    console.error('[Context API] Create context error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create context' });
  }
});

/**
 * GET /api/context/:id
 * Get context by ID
 */
router.get('/context/:id', async (req, res) => {
  try {
    const context = await contextManager.getContext(req.params.id);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    // Check ownership
    if (context.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(context);
  } catch (error) {
    console.error('[Context API] Get context error:', error);
    res.status(500).json({ error: 'Failed to retrieve context' });
  }
});

/**
 * GET /api/contexts
 * Get all contexts for current user
 */
router.get('/contexts', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { mode, tags, limit } = req.query;

    const contexts = await contextManager.getUserContexts(userId, {
      mode: mode as ProfessionalMode,
      tags: tags ? (tags as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(contexts);
  } catch (error) {
    console.error('[Context API] List contexts error:', error);
    res.status(500).json({ error: 'Failed to list contexts' });
  }
});

/**
 * PATCH /api/context/:id
 * Update context
 */
router.patch('/context/:id', async (req, res) => {
  try {
    const context = await contextManager.getContext(req.params.id);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    if (context.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const validated = updateContextSchema.parse(req.body);
    
    const updated = await contextManager.updateContext(req.params.id, validated);
    res.json(updated);
  } catch (error) {
    console.error('[Context API] Update context error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update context' });
  }
});

/**
 * DELETE /api/context/:id
 * Delete context
 */
router.delete('/context/:id', async (req, res) => {
  try {
    const context = await contextManager.getContext(req.params.id);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    if (context.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await contextManager.deleteContext(req.params.id);
    res.json({ success: deleted });
  } catch (error) {
    console.error('[Context API] Delete context error:', error);
    res.status(500).json({ error: 'Failed to delete context' });
  }
});

/**
 * GET /api/context/:id/snapshots
 * Get context snapshots
 */
router.get('/context/:id/snapshots', async (req, res) => {
  try {
    const context = await contextManager.getContext(req.params.id);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    if (context.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const snapshots = await contextManager.getSnapshots(req.params.id);
    res.json(snapshots);
  } catch (error) {
    console.error('[Context API] Get snapshots error:', error);
    res.status(500).json({ error: 'Failed to retrieve snapshots' });
  }
});

/**
 * POST /api/context/:id/restore
 * Restore context to a snapshot
 */
router.post('/context/:id/restore', async (req, res) => {
  try {
    const context = await contextManager.getContext(req.params.id);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    if (context.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { snapshotIndex } = req.body;
    if (typeof snapshotIndex !== 'number') {
      return res.status(400).json({ error: 'snapshotIndex is required' });
    }

    const restored = await contextManager.restoreSnapshot(req.params.id, snapshotIndex);
    res.json({ success: restored });
  } catch (error) {
    console.error('[Context API] Restore snapshot error:', error);
    res.status(500).json({ error: 'Failed to restore snapshot' });
  }
});

/**
 * GET /api/context/stats
 * Get context statistics
 */
router.get('/context/stats', async (req, res) => {
  try {
    const stats = contextManager.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('[Context API] Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// ============== TEMPLATE ROUTES ==============

/**
 * POST /api/template
 * Create a new template
 */
router.post('/template', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validated = createTemplateSchema.parse(req.body);

    const template = templateManager.createTemplate(validated, userId);
    res.json(template);
  } catch (error) {
    console.error('[Template API] Create template error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * GET /api/template/:id
 * Get template by ID
 */
router.get('/template/:id', async (req, res) => {
  try {
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check access (public or owned by user)
    if (!template.metadata.isPublic && template.metadata.createdBy !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(template);
  } catch (error) {
    console.error('[Template API] Get template error:', error);
    res.status(500).json({ error: 'Failed to retrieve template' });
  }
});

/**
 * GET /api/templates
 * Search templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { mode, category, tags, search } = req.query;

    const templates = templateManager.searchTemplates({
      mode: mode as ProfessionalMode,
      category: category as any,
      tags: tags ? (tags as string).split(',') : undefined,
      searchText: search as string,
    });

    // Filter to only public templates or user's own templates
    const filtered = templates.filter(t => 
      t.metadata.isPublic || t.metadata.createdBy === req.user?.id
    );

    res.json(filtered);
  } catch (error) {
    console.error('[Template API] Search templates error:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

/**
 * GET /api/templates/mode/:mode
 * Get templates by mode
 */
router.get('/templates/mode/:mode', async (req, res) => {
  try {
    const templates = templateManager.getTemplatesByMode(req.params.mode as ProfessionalMode);
    
    // Filter to only public templates or user's own templates
    const filtered = templates.filter(t => 
      t.metadata.isPublic || t.metadata.createdBy === req.user?.id
    );

    res.json(filtered);
  } catch (error) {
    console.error('[Template API] Get templates by mode error:', error);
    res.status(500).json({ error: 'Failed to retrieve templates' });
  }
});

/**
 * POST /api/template/:id/render
 * Render template with variables
 */
router.post('/template/:id/render', async (req, res) => {
  try {
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!template.metadata.isPublic && template.metadata.createdBy !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const validated = renderTemplateSchema.parse(req.body);
    
    const rendered = templateManager.renderTemplate(req.params.id, validated.variables);
    res.json(rendered);
  } catch (error) {
    console.error('[Template API] Render template error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('validation failed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to render template' });
  }
});

/**
 * PATCH /api/template/:id
 * Update template
 */
router.patch('/template/:id', async (req, res) => {
  try {
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.metadata.createdBy !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = templateManager.updateTemplate(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('[Template API] Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/template/:id
 * Delete template
 */
router.delete('/template/:id', async (req, res) => {
  try {
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.metadata.createdBy !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = templateManager.deleteTemplate(req.params.id);
    res.json({ success: deleted });
  } catch (error) {
    console.error('[Template API] Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * GET /api/template/stats
 * Get template statistics
 */
router.get('/template/stats', async (req, res) => {
  try {
    const stats = templateManager.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('[Template API] Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

/**
 * POST /api/template/upload
 * Upload a custom template file (Excel, Word, PDF, CSV, JSON)
 */
router.post('/template/upload', templateUpload.single('file'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, description, mode, category, tags } = req.body;

    if (!name) {
      // Clean up uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Create template record with file reference
    const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const template = templateManager.createTemplate({
      name: name || req.file.originalname,
      description: description || `Uploaded template: ${req.file.originalname}`,
      mode: (mode as ProfessionalMode) || 'financial-calculation',
      category: category || 'document',
      content: {
        prompt: `Use the uploaded template file: ${req.file.originalname}`,
        variables: [],
        structure: {
          type: 'uploaded-file',
          originalName: req.file.originalname,
          storedName: req.file.filename,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
        },
      },
    }, userId);

    // Update template with tags if provided
    if (tags) {
      const tagList = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
      templateManager.updateTemplate(template.id, {
        metadata: { ...template.metadata, tags: tagList }
      });
    }

    console.log(`[Template API] Template uploaded: ${template.id} by user ${userId}`);

    res.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        file: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        },
      },
    });
  } catch (error) {
    console.error('[Template API] Upload template error:', error);
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('[Template API] Failed to clean up file:', e);
      }
    }
    res.status(500).json({ error: 'Failed to upload template' });
  }
});

/**
 * GET /api/template/:id/download
 * Download an uploaded template file
 */
router.get('/template/:id/download', async (req, res) => {
  try {
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check access
    if (!template.metadata.isPublic && template.metadata.createdBy !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if this is an uploaded file template
    const structure = template.content.structure as any;
    if (!structure || structure.type !== 'uploaded-file') {
      return res.status(400).json({ error: 'Template is not a file-based template' });
    }

    const filePath = structure.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template file not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${structure.originalName}"`);
    res.setHeader('Content-Type', structure.mimeType);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[Template API] Download template error:', error);
    res.status(500).json({ error: 'Failed to download template' });
  }
});

/**
 * GET /api/templates/user
 * Get current user's templates (including uploaded ones)
 */
router.get('/templates/user', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allTemplates = templateManager.searchTemplates({});
    const userTemplates = allTemplates.filter(t => t.metadata.createdBy === userId);

    res.json(userTemplates);
  } catch (error) {
    console.error('[Template API] Get user templates error:', error);
    res.status(500).json({ error: 'Failed to retrieve user templates' });
  }
});

export default router;
