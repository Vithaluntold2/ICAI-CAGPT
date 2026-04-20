import WorkflowRenderer from "../../visualizations/WorkflowRenderer";

export function WorkflowArtifact({ payload, embedded = false }: { payload: any; embedded?: boolean }) {
  return (
    <div className="bg-card border rounded-lg p-4">
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
