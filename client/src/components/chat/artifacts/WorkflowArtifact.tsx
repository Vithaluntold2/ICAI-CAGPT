import WorkflowRenderer from "../../visualizations/workflow-x6/WorkflowRendererX6";
import { cn } from "@/lib/utils";

export function WorkflowArtifact({ payload, embedded = false }: { payload: any; embedded?: boolean }) {
  // When embedded (inline chat card OR whiteboard aggregation card) the
  // parent provides the height; this wrapper must propagate `h-full` so
  // the inner WorkflowRenderer can fill it. Without `flex flex-col h-full`
  // here, WorkflowRenderer's own `h-full` resolved against 0 — the graph
  // rendered at its `minHeight: 420` floor inside a much taller card,
  // leaving the rest of the card empty.
  return (
    <div
      className={cn(
        "bg-card border rounded-lg p-4",
        embedded && "h-full flex flex-col min-h-0"
      )}
    >
      <WorkflowRenderer
        nodes={payload.nodes}
        edges={payload.edges}
        title={payload.title}
        layout={payload.layout}
        embedded={embedded}
      />
    </div>
  );
}
