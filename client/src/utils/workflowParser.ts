interface WorkflowNode {
  id: string;
  type: 'step' | 'decision' | 'start' | 'end';
  label: string;
  description?: string;
  substeps?: string[];
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface ParsedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  layout?: string;
}

export function parseWorkflowContent(content: string): ParsedWorkflow {
  // Clean the content first
  const cleanContent = content
    .replace(/```[\w]*\n?/g, '')
    .replace(/\*\*|\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .trim();

  // Try to parse as structured workflow format first
  try {
    const parsed = JSON.parse(cleanContent);
    if (parsed.nodes && parsed.edges) {
      return {
        nodes: parsed.nodes.map((node: any, index: number) => ({
          id: node.id || `node-${index}`,
          type: node.type || 'step',
          label: node.label || node.title || `Step ${index + 1}`,
          description: node.description,
          substeps: node.substeps
        })),
        edges: parsed.edges.map((edge: any, index: number) => ({
          id: edge.id || `edge-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.label
        })),
        layout: parsed.layout || 'linear-process'
      };
    }
  } catch {
    // Continue with text parsing
  }

  // Parse text-based workflow
  const lines = cleanContent.split('\n').filter(line => line.trim());
  const steps: string[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Look for various step indicators
    if (/^\s*[\d]+\./.test(trimmed) || 
        /^\s*[-•*]/.test(trimmed) || 
        /^\s*(Step|Phase|Stage|Task)\s*[\d\w]+/i.test(trimmed) ||
        /^\s*(Start|Begin|Review|Approve|Complete|End|Finish)/i.test(trimmed)) {
      
      // Clean up the step text
      let cleanStep = trimmed
        .replace(/^\s*[\d]+\.\s*/, '')
        .replace(/^\s*[-•*]\s*/, '')
        .replace(/^\s*(Step|Phase|Stage|Task)\s*[\d\w]+:?\s*/i, '');
      
      // Truncate long steps for better display
      if (cleanStep.length > 50) {
        cleanStep = cleanStep.substring(0, 50) + '...';
      }
      
      if (cleanStep) {
        steps.push(cleanStep);
      }
    }
  });

  // Create nodes and edges from parsed steps
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  if (steps.length > 0) {
    steps.forEach((step, index) => {
      const nodeId = `step-${index}`;
      let nodeType: WorkflowNode['type'] = 'step';
      
      // Determine node type based on content and position
      const lowerStep = step.toLowerCase();
      if (index === 0 || lowerStep.includes('start') || lowerStep.includes('begin')) {
        nodeType = 'start';
      } else if (index === steps.length - 1 || 
                 lowerStep.includes('end') || 
                 lowerStep.includes('complete') || 
                 lowerStep.includes('finish')) {
        nodeType = 'end';
      } else if (lowerStep.includes('decision') || 
                 lowerStep.includes('review') || 
                 lowerStep.includes('approve') || 
                 lowerStep.includes('check')) {
        nodeType = 'decision';
      }
      
      nodes.push({
        id: nodeId,
        type: nodeType,
        label: step
      });
      
      // Create sequential edges
      if (index > 0) {
        edges.push({
          id: `edge-${index - 1}-${index}`,
          source: `step-${index - 1}`,
          target: nodeId
        });
      }
    });
  }

  // Fallback if no steps found
  if (nodes.length === 0) {
    nodes.push({
      id: 'start',
      type: 'start',
      label: 'Workflow Process'
    });
  }

  // Detect layout based on content
  let layout = 'linear-process';
  const contentLower = cleanContent.toLowerCase();
  
  if (contentLower.includes('approval') || contentLower.includes('review')) {
    layout = 'approval-workflow';
  } else if (contentLower.includes('decision') || contentLower.includes('branch')) {
    layout = 'decision-tree';
  } else if (contentLower.includes('parallel') || contentLower.includes('concurrent')) {
    layout = 'parallel-workflow';
  }

  return { nodes, edges, layout };
}