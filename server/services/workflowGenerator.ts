import { VisualizationData, WorkflowNode, WorkflowEdge } from '@shared/types/visualization';

/**
 * Generate workflow visualization from AI response
 * This extracts workflow structure and creates nodes/edges for ReactFlow
 */
export class WorkflowGenerator {
  /**
   * Generate workflow visualization if the response contains workflow structure
   * Now supports multiple workflow formats based on content analysis
   */
  static async generateWorkflowVisualization(
    response: string,
    chatMode?: string
  ): Promise<VisualizationData | null> {
    // Only generate workflow visualizations in workflow mode
    if (chatMode !== 'workflow') {
      return null;
    }

    // Parse the deliverable content if available
    const deliverableMatch = response.match(/<DELIVERABLE>([\s\S]*?)<\/DELIVERABLE>/i);
    const workflowContent = deliverableMatch ? deliverableMatch[1].trim() : response;

    // Detect workflow format type
    const formatType = this.detectWorkflowFormat(response);
    
    // Parse the response to extract workflow steps
    const nodes = this.extractNodes(workflowContent, formatType);
    const edges = this.extractEdges(nodes, formatType);

    if (nodes.length === 0) {
      return null;
    }
    
    // Determine if this is a large workflow for frontend optimization
    const isLargeWorkflow = nodes.length > 20;

    return {
      type: 'workflow' as const,
      title: `${formatType} Workflow`,
      data: [], // Not used for workflows
      config: {
        nodes,
        edges,
        layout: (formatType.toLowerCase().replace(' ', '-') === 'horizontal' ? 'horizontal' : 'vertical') as 'horizontal' | 'vertical',
        isLargeWorkflow
      }
    };
  }

  /**
   * Detect the type of workflow format from the response
   */
  private static detectWorkflowFormat(response: string): string {
    const lower = response.toLowerCase();
    
    if (lower.includes('decision') && (lower.includes('yes') || lower.includes('no'))) {
      return 'Decision Tree';
    }
    if (lower.includes('parallel') || lower.includes('simultaneous')) {
      return 'Parallel Workflow';
    }
    if (lower.includes('approval') && lower.includes('review')) {
      return 'Approval Workflow';
    }
    
    return 'Linear Process';
  }

  /**
   * Parse an "If Yes/No: go to Step N" substep and return the target step id.
   * Returns null if the substep does not match the pattern.
   */
  private static parseBranchTarget(substep: string): { branch: 'yes' | 'no' | 'other'; targetStep: string; label?: string } | null {
    // "If Yes: go to Step 4"  /  "If No - go to Step 3"  /  "Yes → Step 4"
    const m = substep.match(/\b(?:if\s+)?(yes|no|accepted|rejected|approved|denied|on[- ]?time|late|appeal|no\s+appeal)\b[^a-z0-9]*(?:go\s+to\s+|→|->|goto\s+)?step\s+(\d+)/i);
    if (m) {
      const tag = m[1].toLowerCase();
      const branch: 'yes' | 'no' | 'other' =
        /yes|accepted|approved|on[- ]?time/.test(tag) ? 'yes' :
        /no|rejected|denied|late|no\s+appeal/.test(tag) ? 'no' : 'other';
      return { branch, targetStep: `step-${m[2]}`, label: m[1] };
    }
    return null;
  }

  /**
   * Extract workflow nodes from AI response with support for different formats.
   * Honors explicit "Start:" / "End:" labels when the agent supplies them.
   */
  private static extractNodes(response: string, _formatType: string = 'Linear Process'): WorkflowNode[] {
    const nodes: WorkflowNode[] = [];

    // Match patterns like "Step 1:", "Phase 1:", etc.
    const stepPattern = /(?:Step|Phase|Stage)\s+(\d+):\s*([^\n]+)/gi;
    const matches = Array.from(response.matchAll(stepPattern));

    // Explicit start / end labels (agent-provided). Falls back to generic labels.
    const startLabelMatch = response.match(/(?:^|\n)\s*Start\s*:\s*([^\n]+)/i);
    const endLabelMatch = response.match(/(?:^|\n)\s*End\s*:\s*([^\n]+)/i);

    nodes.push({
      id: 'start',
      type: 'start',
      label: (startLabelMatch?.[1].trim()) || 'Start',
    });

    matches.forEach((match, index) => {
      const stepNumber = match[1];
      const stepTitle = match[2].trim();

      // Extract substeps that belong to this step (until the next "Step N:").
      const stepIndex = match.index!;
      const nextStepMatch = matches[index + 1];
      const endIndex = nextStepMatch ? nextStepMatch.index! : response.length;
      const stepContent = response.substring(stepIndex, endIndex);

      const substepPattern = /(?:^|\n)\s*[-•*]\s*([^\n]+)/g;
      const substeps = Array.from(stepContent.matchAll(substepPattern))
        .map(m => m[1].trim())
        .filter(s => s.length > 0);

      const titleLower = stepTitle.toLowerCase();
      const hasBranchSubstep = substeps.some(s => /^(?:if\s+)?(yes|no|accepted|rejected|approved|denied|on[- ]?time|late|appeal|no\s+appeal)\b/i.test(s));
      const isDecision =
        /\bdecision\b/.test(titleLower) ||
        /\?\s*$/.test(stepTitle) ||
        hasBranchSubstep;

      nodes.push({
        id: `step-${stepNumber}`,
        type: isDecision ? 'decision' : 'step',
        label: stepTitle,
        substeps: substeps.slice(0, 5),
      });
    });

    nodes.push({
      id: 'end',
      type: 'end',
      label: (endLabelMatch?.[1].trim()) || 'Complete',
    });

    return nodes;
  }

  /**
   * Generate edges connecting nodes based on workflow format.
   * For decision nodes, honors explicit "If Yes: go to Step N" substeps to
   * route Yes/No branches into the correct target steps. Otherwise falls
   * back to the node's linear successor.
   */
  private static extractEdges(nodes: WorkflowNode[], formatType: string = 'Linear Process'): WorkflowEdge[] {
    const edges: WorkflowEdge[] = [];
    let edgeId = 0;
    const addEdge = (source: string, target: string, label?: string) => {
      edges.push({ id: `edge-${edgeId++}`, source, target, label });
    };

    const stepOnly = nodes.filter(n => n.type !== 'start' && n.type !== 'end');
    const startNode = nodes.find(n => n.type === 'start');
    const endNode = nodes.find(n => n.type === 'end');

    if (formatType === 'Decision Tree') {
      // Sequential walk, but decision nodes emit labeled edges based on their
      // "If Yes/No: go to Step N" substeps when the agent supplied them.
      for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        if (current.type === 'end') continue;

        if (current.type === 'decision') {
          const subs = (current as any).substeps as string[] | undefined;
          const branches = (subs || [])
            .map(s => this.parseBranchTarget(s))
            .filter((b): b is NonNullable<ReturnType<typeof this.parseBranchTarget>> => b !== null);

          if (branches.length > 0) {
            for (const b of branches) {
              const target = nodes.find(n => n.id === b.targetStep);
              if (target) addEdge(current.id, target.id, b.label ?? (b.branch === 'yes' ? 'Yes' : b.branch === 'no' ? 'No' : undefined));
            }
            continue;
          }

          // No explicit branching given — fall through to linear successor with Yes/No default labels
          const next = nodes[i + 1];
          if (next) {
            addEdge(current.id, next.id, 'Yes');
            // Attach a No-branch stub to the step after next, if we have one, else to End.
            const afterNext = nodes[i + 2] ?? endNode;
            if (afterNext && afterNext.id !== next.id) addEdge(current.id, afterNext.id, 'No');
          }
          continue;
        }

        // Non-decision: connect to next node
        const next = nodes[i + 1];
        if (next) addEdge(current.id, next.id);
      }
    } else if (formatType === 'Parallel Workflow') {
      // Handle parallel workflow logic
      const startNode = nodes[0];
      const endNode = nodes[nodes.length - 1];
      const middleNodes = nodes.slice(1, -1);
      
      // Connect start to first few steps in parallel
      const parallelSteps = middleNodes.slice(0, Math.min(3, middleNodes.length));
      parallelSteps.forEach((node, index) => {
        edges.push({
          id: `edge-start-${index}`,
          source: startNode.id,
          target: node.id
        });
      });
      
      // Connect parallel steps to end
      parallelSteps.forEach((node, index) => {
        edges.push({
          id: `edge-end-${index}`,
          source: node.id,
          target: endNode.id
        });
      });
    } else {
      // Linear process (default)
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${i}`,
          source: nodes[i].id,
          target: nodes[i + 1].id
        });
      }
    }

    return edges;
  }
}
