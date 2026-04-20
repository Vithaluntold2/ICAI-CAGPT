import SpreadsheetViewer from "../../SpreadsheetViewer";

export function SpreadsheetArtifact({
  payload,
  conversationId,
  messageId,
}: {
  payload: any;
  conversationId?: string;
  messageId?: string;
}) {
  return <SpreadsheetViewer data={payload} conversationId={conversationId} messageId={messageId} />;
}
