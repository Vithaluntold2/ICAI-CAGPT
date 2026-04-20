import SpreadsheetViewer from "../../SpreadsheetViewer";

export function SpreadsheetArtifact({
  payload,
  conversationId,
  messageId,
  embedded = false,
}: {
  payload: any;
  conversationId?: string;
  messageId?: string;
  embedded?: boolean;
}) {
  const viewer = (
    <SpreadsheetViewer
      data={payload}
      conversationId={conversationId}
      messageId={messageId}
    />
  );

  // Embedded (inside ArtifactCard on whiteboard): card owns chrome; fill it.
  // SpreadsheetViewer is already scroll-capable internally.
  if (embedded) {
    return <div className="h-full w-full overflow-hidden">{viewer}</div>;
  }
  // Standalone (chat inline): SpreadsheetViewer renders its own titled,
  // bordered table block. No extra wrapper needed here — adding one
  // collapses the viewer's intrinsic sizing in a zero-height parent.
  return viewer;
}
