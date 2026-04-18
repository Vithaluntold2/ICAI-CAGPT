import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ChartArtifact } from "./ChartArtifact";
import { WorkflowArtifact } from "./WorkflowArtifact";
import { MindmapArtifact } from "./MindmapArtifact";
import { SpreadsheetArtifact } from "./SpreadsheetArtifact";
import { FlowchartArtifact } from "./FlowchartArtifact";

export function ArtifactRenderer({
  artifact,
  conversationId,
}: {
  artifact: WhiteboardArtifact;
  conversationId?: string;
}) {
  switch (artifact.kind) {
    case "chart":
      return <ChartArtifact payload={artifact.payload as any} />;
    case "workflow":
      return <WorkflowArtifact payload={artifact.payload as any} />;
    case "mindmap":
      return <MindmapArtifact payload={artifact.payload as any} />;
    case "spreadsheet":
      return (
        <SpreadsheetArtifact
          payload={artifact.payload as any}
          conversationId={conversationId}
          messageId={artifact.messageId}
        />
      );
    case "flowchart":
      return <FlowchartArtifact payload={artifact.payload as any} />;
    default:
      return <div className="text-muted-foreground text-sm">Unsupported artifact kind: {artifact.kind}</div>;
  }
}
