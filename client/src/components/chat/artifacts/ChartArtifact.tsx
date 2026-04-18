import VisualizationRenderer, { type ChartData } from "../../visualizations/VisualizationRenderer";

export function ChartArtifact({ payload }: { payload: ChartData }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <VisualizationRenderer chartData={payload} />
    </div>
  );
}
