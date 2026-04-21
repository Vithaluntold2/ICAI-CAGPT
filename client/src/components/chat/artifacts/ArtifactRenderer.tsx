import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ChartArtifact } from "./ChartArtifact";
import { WorkflowArtifact } from "./WorkflowArtifact";
import { MindmapArtifact } from "./MindmapArtifact";
import { SpreadsheetArtifact } from "./SpreadsheetArtifact";
import { FlowchartArtifact } from "./FlowchartArtifact";
import { ChecklistArtifact } from "./ChecklistArtifact";
import { DocumentArtifact } from "./DocumentArtifact";

export function ArtifactRenderer({
  artifact,
  conversationId,
  embedded = false,
  preview = false,
}: {
  artifact: WhiteboardArtifact;
  conversationId?: string;
  /** True when the artifact is being rendered inside the whiteboard ArtifactCard
   *  (which already shows the title + kind + menu in its own header). The
   *  individual artifact components suppress their own redundant title chrome
   *  in that case. */
  embedded?: boolean;
  /** True when rendered inside the whiteboard canvas. Interactive artifacts
   *  (workflow, mindmap) render as non-interactive thumbnails with a click
   *  target that opens a fresh fullscreen instance — avoids the nested
   *  pan/zoom trap where x6 / mind-elixir's scroll capture competes with
   *  the whiteboard's react-zoom-pan-pinch. */
  preview?: boolean;
}) {
  switch (artifact.kind) {
    case "chart":
      return <ChartArtifact payload={artifact.payload as any} embedded={embedded} />;
    case "workflow":
      return <WorkflowArtifact payload={artifact.payload as any} embedded={embedded} preview={preview} />;
    case "mindmap":
      return <MindmapArtifact payload={artifact.payload as any} embedded={embedded} preview={preview} />;
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
    case "document":
      return <DocumentArtifact payload={artifact.payload as any} />;
    case "checklist":
      return (
        <ChecklistArtifact
          artifactId={artifact.id}
          conversationId={conversationId}
          payload={artifact.payload as any}
          state={(artifact.state ?? {}) as any}
        />
      );
    default:
      return <div className="text-muted-foreground text-sm">Unsupported artifact kind: {artifact.kind}</div>;
  }
}
