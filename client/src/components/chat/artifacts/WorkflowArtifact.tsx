import WorkflowRenderer from "../../visualizations/WorkflowRenderer";

export function WorkflowArtifact({ payload, embedded = false }: { payload: any; embedded?: boolean }) {
  // Embedded (whiteboard ArtifactCard): card owns border/background. We just
  // fill the available space; WorkflowRenderer respects `embedded` internally
  // to skip its own title chrome.
  if (embedded) {
    return (
      <div className="h-full w-full">
        <WorkflowRenderer
          nodes={payload.nodes}
          edges={payload.edges}
          title={payload.title}
          layout={payload.layout}
          embedded
        />
      </div>
    );
  }
  // Standalone (chat inline): own card chrome + padding so the renderer's
  // toolbar + canvas have room and a measurable box. WorkflowRenderer sizes
  // itself via its internal containerHeight when not embedded.
  return (
    <div className="bg-card border rounded-lg p-4">
      <WorkflowRenderer
        nodes={payload.nodes}
        edges={payload.edges}
        title={payload.title}
        layout={payload.layout}
      />
    </div>
  );
}
