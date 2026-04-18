import WorkflowRenderer from "../../visualizations/WorkflowRenderer";

export function WorkflowArtifact({ payload }: { payload: any }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <WorkflowRenderer nodes={payload.nodes} edges={payload.edges} title={payload.title} layout={payload.layout} />
    </div>
  );
}
