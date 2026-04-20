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

  // Embedded: ArtifactCard owns the border / background / title. Just fill it.
  if (embedded) {
    return <div className="h-full w-full overflow-auto">{viewer}</div>;
  }
  // Standalone (chat inline): own bordered card, capped height so large
  // sheets don't blow out the transcript.
  return (
    <div className="bg-card border rounded-lg overflow-auto max-h-[720px]">
      {viewer}
    </div>
  );
}
