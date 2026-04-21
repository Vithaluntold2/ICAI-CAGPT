/**
 * Shared data shape for x6 workflow nodes. Lives on `node.getData()` and is
 * populated by WorkflowRendererX6 at node-add time.
 */
export interface WorkflowNodeData {
  label: string;
  description?: string;
  substeps?: string[];
  /** True if content likely overflows the clamp. Renders a "More" pill. */
  contentClipped?: boolean;
  /** True if this node matches the current search term. */
  matchesSearch?: boolean;
  /** Tooltip text for the native title attribute. */
  tooltip?: string;
  /** Compact mode tightens typography for large workflows. */
  compact?: boolean;
}
