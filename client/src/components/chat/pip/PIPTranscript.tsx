import type { WhiteboardArtifact } from "../../../../../shared/schema";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const ARTIFACT_RE = /<artifact\s+id="([^"]+)"\s*\/?>\s*/g;

function chipFor(a: WhiteboardArtifact | undefined, id: string) {
  const label = a ? a.title : id;
  return ` [📊 ${label} — on board] `;
}

export function PIPTranscript({
  messages, byId,
}: {
  messages: Msg[];
  byId: Record<string, WhiteboardArtifact>;
}) {
  return (
    <div className="flex flex-col gap-2 p-3 overflow-auto flex-1" data-testid="pip-transcript">
      {messages.map((m) => {
        const text = m.content.replace(ARTIFACT_RE, (_match, id) => chipFor(byId[id], id));
        return (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "self-end bg-primary text-primary-foreground rounded-lg px-3 py-1.5 max-w-[85%] text-xs"
                : "self-start bg-muted rounded-lg px-3 py-1.5 max-w-[85%] text-xs"
            }
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
