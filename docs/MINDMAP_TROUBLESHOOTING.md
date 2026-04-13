# Mindmap Troubleshooting Guide

## Quick Diagnosis

Run the diagnostic tool:
```bash
node scripts/diagnose-mindmap.js
```

## Common Issues & Solutions

### 1. **Mindmap Not Appearing in UI**

**Symptoms:**
- Query is processed but no mindmap visualization shows
- Console shows no errors

**Diagnosis:**
```bash
# Test if backend is generating mindmaps
curl -X POST http://localhost:5000/api/test-mindmap/trigger \
  -H "Content-Type: application/json" \
  -d '{"mode":"deep-research","query":"Explain FIFO structure"}'

# Should return: shouldTrigger: true
```

**Solutions:**
- ✅ **Check trigger detection:** Mindmap only generates for queries with trigger keywords (explain, structure, process, etc.)
- ✅ **Check AI response format:** AI must output JSON in the correct format (see below)
- ✅ **Frontend rendering:** Check browser console for ReactFlow errors

### 2. **"Cannot find module 'mindmapGenerator'" Error**

**Symptoms:**
- Server crashes on startup or when processing queries
- Error: `Cannot find module './mindmapGenerator'`

**Solutions:**
```bash
# Verify file exists
ls -la server/services/mindmapGenerator.ts

# If missing, restore from git
git checkout main -- server/services/mindmapGenerator.ts

# Rebuild TypeScript
npm run build
```

### 3. **Mindmap JSON Not Extracted**

**Symptoms:**
- Logs show "No mindmap data found in AI response"
- Trigger detection works but extraction fails

**Diagnosis:**
Check AI response format - it must contain:
```json
{
  "type": "mindmap",
  "title": "Your Title",
  "nodes": [
    {"id": "1", "label": "Root", "type": "root"},
    {"id": "2", "label": "Branch", "type": "primary"}
  ],
  "edges": [
    {"id": "e1", "source": "1", "target": "2"}
  ],
  "layout": "radial"
}
```

**Solutions:**
- Check prompt builder is including mindmap instructions
- Verify AI provider is returning structured data
- Test with example endpoint: `GET /api/test-mindmap/example/deep-research`

### 4. **ReactFlow Components Not Rendering**

**Symptoms:**
- Blank area where mindmap should be
- Browser console: "ReactFlow is not defined"

**Solutions:**
```bash
# Check ReactFlow is installed
npm list @xyflow/react

# If not found, reinstall
npm install @xyflow/react@12.9.2

# Clear cache and rebuild
rm -rf node_modules/.vite
npm run dev
```

### 5. **Validation Errors**

**Symptoms:**
- Logs: "Mindmap validation failed"
- Errors about missing required fields

**Diagnosis:**
```bash
# Test validation with sample data
curl -X POST http://localhost:5000/api/test-mindmap/validate \
  -H "Content-Type: application/json" \
  -d '{"mindmap":{"type":"mindmap","title":"Test","nodes":[{"id":"1","label":"Root","type":"root"}],"edges":[],"layout":"radial"}}'
```

**Solutions:**
- Ensure all nodes have required fields: `id`, `label`, `type`
- Verify edges reference existing node IDs
- Check `type` values are valid: root, primary, secondary, tertiary, leaf

### 6. **Mode-Specific Issues**

**Symptoms:**
- Mindmap works in some modes but not others

**Diagnosis:**
```bash
# Check mode configuration
curl http://localhost:5000/api/test-mindmap/health
```

**Solutions:**
Each mode needs configuration in `shared/types/mindmap.ts`:
- `automaticTriggers`: Keywords that trigger mindmap
- `defaultLayout`: radial, tree-vertical, tree-horizontal, organic, timeline
- `nodeIcons`: Icons for each node type
- `colorScheme`: Colors for visual hierarchy

## Test Endpoints Reference

### Health Check
```bash
GET /api/test-mindmap/health
# Returns: System status and mode configurations
```

### Trigger Detection
```bash
POST /api/test-mindmap/trigger
Body: {"mode": "deep-research", "query": "Explain structure"}
# Returns: shouldTrigger boolean and mode config
```

### Example Generation
```bash
GET /api/test-mindmap/example/:mode
# Returns: Pre-built example mindmap for testing
```

### Validation Test
```bash
POST /api/test-mindmap/validate
Body: {"mindmap": {...}}
# Returns: Validation result with errors if any
```

### Extraction Test
```bash
POST /api/test-mindmap/extract
Body: {"response": "AI response text with JSON"}
# Returns: Extracted mindmap data
```

### Full E2E Test (Uses AI tokens!)
```bash
POST /api/test-mindmap/e2e
Body: {"mode": "deep-research", "query": "Test query", "userTier": "premium"}
# Returns: Full orchestration result with mindmap
```

## Debug Checklist

- [ ] Server running on port 5000
- [ ] All dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] ReactFlow installed (`npm list @xyflow/react`)
- [ ] Test endpoint returns healthy status
- [ ] Trigger detection works for test queries
- [ ] Example generation succeeds
- [ ] Browser console shows no errors
- [ ] Network tab shows visualization data in response

## Frontend Integration Check

Check these files for proper integration:

1. **VisualizationRenderer.tsx**
   - Should import MindMapRenderer
   - Should handle `type: 'mindmap'` case
   - Should pass MindMapData to renderer

2. **MindMapRenderer.tsx**
   - Should import from @xyflow/react
   - Should have 5 layout algorithms
   - Should handle node/edge rendering

3. **Chat component**
   - Should render VisualizationRenderer for messages with visualization metadata
   - Check: `message.metadata?.visualization`

## Expected AI Response Format

The AI must include a JSON block like this:

```
Here's an explanation of FIFO...

```json
{
  "type": "mindmap",
  "title": "FIFO Inventory Method",
  "subtitle": "First In, First Out Accounting",
  "nodes": [
    {
      "id": "root",
      "label": "FIFO Method",
      "type": "root",
      "description": "First In, First Out inventory valuation"
    },
    {
      "id": "concept",
      "label": "Core Concept",
      "type": "primary",
      "description": "Oldest inventory sold first"
    },
    {
      "id": "benefits",
      "label": "Benefits",
      "type": "primary"
    }
  ],
  "edges": [
    {"id": "e1", "source": "root", "target": "concept"},
    {"id": "e2", "source": "root", "target": "benefits"}
  ],
  "layout": "radial"
}
```

The rest of the explanation...
```

## Still Not Working?

1. **Check Server Logs:**
   ```bash
   # Look for mindmap-related logs
   grep -i "mindmap" logs/server.log
   ```

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for errors related to ReactFlow or visualization
   - Check Network tab for API responses

3. **Test with curl:**
   ```bash
   # Generate example and check structure
   curl http://localhost:5000/api/test-mindmap/example/deep-research | jq
   ```

4. **Verify Database:**
   - Mindmaps are ephemeral (not stored)
   - But conversations should have visualization metadata
   - Check: `messages` table, `metadata` column

5. **Contact Support:**
   - Provide diagnostic script output
   - Include server logs
   - Screenshot of browser console errors

## Performance Notes

- Mindmap generation adds ~100-300ms to response time
- Large mindmaps (>50 nodes) may have rendering lag
- Layout algorithm runs client-side (no server impact)
- Validation is fast (~1ms per mindmap)

## Feature Flags

Check if mindmap feature is enabled:
```bash
# In your environment
echo $FEATURE_MINDMAP_ENABLED

# Should be 'true' or unset (defaults to true)
```

If you need to disable:
```bash
export FEATURE_MINDMAP_ENABLED=false
```
