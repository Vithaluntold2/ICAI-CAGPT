/**
 * Test endpoint for mindmap functionality
 * 
 * Usage:
 * POST /api/test-mindmap
 * Body: { "mode": "deep-research", "query": "Explain FIFO inventory method" }
 */

import { Router, Request, Response } from 'express';
import { MindMapGenerator } from '../services/mindmapGenerator';
import { aiOrchestrator } from '../services/aiOrchestrator';

const router = Router();

/**
 * Test mindmap trigger detection
 */
router.post('/test-mindmap/trigger', async (req: Request, res: Response) => {
  try {
    const { query, mode } = req.body;

    if (!query || !mode) {
      return res.status(400).json({
        error: 'Missing required fields: query, mode'
      });
    }

    const shouldTrigger = MindMapGenerator.shouldGenerateMindmap(query, mode);
    const modeConfig = MindMapGenerator.MODE_MINDMAP_CONFIGS?.[mode];

    return res.json({
      query,
      mode,
      shouldTrigger,
      modeConfig: modeConfig ? {
        defaultLayout: modeConfig.defaultLayout,
        automaticTriggers: modeConfig.automaticTriggers,
        colorScheme: modeConfig.colorScheme,
      } : null,
    });
  } catch (error: any) {
    console.error('[Test] Trigger test error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Test mindmap extraction from sample response
 */
router.post('/test-mindmap/extract', async (req: Request, res: Response) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({ error: 'Missing response field' });
    }

    const startTime = Date.now();
    const mindmapData = MindMapGenerator.extractMindMapFromResponse(response);
    const extractTime = Date.now() - startTime;

    if (mindmapData) {
      const validation = MindMapGenerator.validateMindMap(mindmapData);
      
      return res.json({
        success: true,
        extractionTimeMs: extractTime,
        mindmap: mindmapData,
        validation,
        stats: {
          nodeCount: mindmapData.nodes.length,
          edgeCount: mindmapData.edges.length,
          layout: mindmapData.layout,
          rootNodes: mindmapData.nodes.filter(n => n.type === 'root').length,
        },
      });
    } else {
      return res.json({
        success: false,
        extractionTimeMs: extractTime,
        message: 'No mindmap data found in response',
      });
    }
  } catch (error: any) {
    console.error('[Test] Extract test error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Test mindmap validation
 */
router.post('/test-mindmap/validate', async (req: Request, res: Response) => {
  try {
    const { mindmap } = req.body;

    if (!mindmap) {
      return res.status(400).json({ error: 'Missing mindmap field' });
    }

    const validation = MindMapGenerator.validateMindMap(mindmap);

    return res.json({
      valid: validation.valid,
      errors: validation.errors,
      stats: validation.valid ? {
        nodeCount: mindmap.nodes.length,
        edgeCount: mindmap.edges.length,
        rootNodes: mindmap.nodes.filter((n: any) => n.type === 'root').length,
        primaryNodes: mindmap.nodes.filter((n: any) => n.type === 'primary').length,
        secondaryNodes: mindmap.nodes.filter((n: any) => n.type === 'secondary').length,
      } : null,
    });
  } catch (error: any) {
    console.error('[Test] Validate test error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Generate example mindmap for a mode
 */
router.get('/test-mindmap/example/:mode', async (req: Request, res: Response) => {
  try {
    const { mode } = req.params;

    const exampleMindmap = MindMapGenerator.generateExample(mode);

    return res.json({
      mode,
      mindmap: exampleMindmap,
      stats: {
        nodeCount: exampleMindmap.nodes.length,
        edgeCount: exampleMindmap.edges.length,
        layout: exampleMindmap.layout,
      },
    });
  } catch (error: any) {
    console.error('[Test] Example generation error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Full end-to-end mindmap generation test
 * WARNING: This makes a real AI call and consumes tokens!
 */
router.post('/test-mindmap/e2e', async (req: Request, res: Response) => {
  try {
    const { query, mode, userTier } = req.body;

    if (!query || !mode) {
      return res.status(400).json({
        error: 'Missing required fields: query, mode'
      });
    }

    console.log(`[Test] E2E test: ${mode} mode, query: "${query}"`);

    const startTime = Date.now();

    // Make actual AI orchestrator call
    const result = await aiOrchestrator.processQuery(
      query,
      [], // Empty conversation history
      userTier || 'premium',
      'test-user', // userId
      { chatMode: mode }
    );

    const totalTime = Date.now() - startTime;

    // Check if mindmap was generated
    const hasMindmap = result.metadata?.visualization?.type === 'mindmap';

    return res.json({
      success: true,
      totalTimeMs: totalTime,
      processingTimeMs: result.processingTimeMs,
      hasMindmap,
      visualization: result.metadata?.visualization,
      response: result.response.substring(0, 500) + '...', // Truncate for readability
      stats: {
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        responseLength: result.response.length,
        visualizationType: result.metadata?.visualization?.type,
      },
    });
  } catch (error: any) {
    console.error('[Test] E2E test error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

/**
 * Test prompt generation for mindmap
 */
router.post('/test-mindmap/prompt', async (req: Request, res: Response) => {
  try {
    const { query, mode } = req.body;

    if (!query || !mode) {
      return res.status(400).json({
        error: 'Missing required fields: query, mode'
      });
    }

    const prompt = MindMapGenerator.getMindMapGenerationPrompt(mode, query);

    return res.json({
      mode,
      query,
      prompt,
      promptLength: prompt.length,
    });
  } catch (error: any) {
    console.error('[Test] Prompt test error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Health check for mindmap system
 */
router.get('/test-mindmap/health', async (req: Request, res: Response) => {
  try {
    const modes = [
      'deep-research',
      'calculation',
      'audit-plan',
      'workflow',
      'checklist',
      'scenario-simulator',
      'deliverable-composer',
      'forensic-intelligence',
      'roundtable',
      'standard',
    ];

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      modes: modes.map(mode => ({
        mode,
        hasConfig: !!MindMapGenerator.MODE_MINDMAP_CONFIGS?.[mode],
        triggerCount: MindMapGenerator.MODE_MINDMAP_CONFIGS?.[mode]?.automaticTriggers?.length || 0,
      })),
      testQueries: [
        { mode: 'deep-research', query: 'Explain the FIFO inventory method' },
        { mode: 'calculation', query: 'Calculate NPV step by step' },
        { mode: 'audit-plan', query: 'Create an audit plan structure' },
        { mode: 'workflow', query: 'Explain the month-end close process' },
      ],
    };

    return res.json(health);
  } catch (error: any) {
    console.error('[Test] Health check error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
