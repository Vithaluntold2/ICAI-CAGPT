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
   * Extract workflow nodes from AI response with support for different formats
   */
  private static extractNodes(response: string, formatType: string = 'Linear Process'): WorkflowNode[] {
    const nodes: WorkflowNode[] = [];
    
    // Match patterns like "Step 1:", "Phase 1:", etc.
    const stepPattern = /(?:Step|Phase|Stage)\s+(\d+):\s*([^\n]+)/gi;
    const matches = Array.from(response.matchAll(stepPattern));

    // Add start node
    nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start'
    });

    matches.forEach((match, index) => {
      const stepNumber = match[1];
      const stepTitle = match[2].trim();
      
      // Extract description and substeps after this step title
      const stepIndex = match.index!;
      const nextStepMatch = matches[index + 1];
      const endIndex = nextStepMatch ? nextStepMatch.index! : response.length;
      const stepContent = response.substring(stepIndex, endIndex);
      
      // Extract substeps (lines starting with -, •, or *)
      const substepPattern = /(?:^|\n)\s*[-•*]\s*([^\n]+)/g;
      const substeps = Array.from(stepContent.matchAll(substepPattern))
        .map(m => m[1].trim())
        .filter(s => s.length > 0);

      // Detect if this is a decision point
      const isDecision = stepTitle.toLowerCase().includes('decision') || 
                        stepTitle.toLowerCase().includes('review') ||
                        substeps.some(s => s.toLowerCase().includes('if') || s.toLowerCase().includes('yes') || s.toLowerCase().includes('no'));

      nodes.push({
        id: `step-${stepNumber}`,
        type: isDecision ? 'decision' : 'step',
        label: stepTitle,
        substeps: substeps.slice(0, 5) // Limit to 5 substeps for readability
      });
    });

    // For decision trees, add outcome nodes
    if (formatType === 'Decision Tree') {
      const decisionNodes = nodes.filter(n => n.type === 'decision');
      decisionNodes.forEach((decisionNode, index) => {
        // Add Yes/No outcome nodes
        nodes.push({
          id: `${decisionNode.id}-yes`,
          type: 'step',
          label: 'Yes - Continue'
        });
        nodes.push({
          id: `${decisionNode.id}-no`,
          type: 'step',
          label: 'No - Alternative'
        });
      });
    }

    // Add end node
    nodes.push({
      id: 'end',
      type: 'end',
      label: 'Complete'
    });

    return nodes;
  }

  /**
   * Generate edges connecting nodes based on workflow format
   */
  private static extractEdges(nodes: WorkflowNode[], formatType: string = 'Linear Process'): WorkflowEdge[] {
    const edges: WorkflowEdge[] = [];

    if (formatType === 'Decision Tree') {
      // Handle decision tree logic
      let edgeId = 0;
      for (let i = 0; i < nodes.length; i++) {
        const currentNode = nodes[i];
        
        if (currentNode.type === 'decision') {
          // Connect decision to Yes/No outcomes
          const yesNode = nodes.find(n => n.id === `${currentNode.id}-yes`);
          const noNode = nodes.find(n => n.id === `${currentNode.id}-no`);
          
          if (yesNode) {
            edges.push({
              id: `edge-${edgeId++}`,
              source: currentNode.id,
              target: yesNode.id,
              label: 'Yes'
            });
          }
          
          if (noNode) {
            edges.push({
              id: `edge-${edgeId++}`,
              source: currentNode.id,
              target: noNode.id,
              label: 'No'
            });
          }
        } else if (currentNode.type !== 'end' && i < nodes.length - 1) {
          // Connect non-decision nodes sequentially
          const nextNode = nodes[i + 1];
          if (nextNode && !nextNode.id.includes('-yes') && !nextNode.id.includes('-no')) {
            edges.push({
              id: `edge-${edgeId++}`,
              source: currentNode.id,
              target: nextNode.id
            });
          }
        }
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
