import MindMapRenderer from "../../visualizations/MindMapRenderer";

export function MindmapArtifact({ payload }: { payload: any }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <MindMapRenderer data={payload} />
    </div>
  );
}
