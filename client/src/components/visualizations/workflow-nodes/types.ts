/**
 * Shared data shape for workflow node components.
 *
 * Every custom node receives `data` through React Flow's `NodeProps`. The
 * WorkflowRenderer populates this object once per node when it builds the
 * graph; the node components just consume it.
 */
export interface WorkflowNodeData {
  label: string;
  description?: string;
  substeps?: string[];
  /** Render a pulsing underline / outline effect while the playback
   *  animation is on this node. Owned by the WorkflowRenderer. */
  highlighted?: boolean;
  /** True if this node matches the search term; renders a teal outline. */
  matchesSearch?: boolean;
  /** True if content likely overflows the clamp. Renders a "More" pill
   *  affordance instead of a plain Info icon. */
  contentClipped?: boolean;
  /** Tooltip text (full label + description + substeps) for the native
   *  title attribute — keeps content reachable when clamped. */
  tooltip?: string;
  /** True when the workflow is in compact mode (20+ nodes). Node
   *  components tighten typography / clamp lines harder. */
  compact?: boolean;
}
