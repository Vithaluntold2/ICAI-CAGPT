import { useQuery } from "@tanstack/react-query";
import type { WhiteboardArtifact } from "../../../shared/schema";

export interface ConversationArtifactsData {
  artifacts: WhiteboardArtifact[];
  byId: Record<string, WhiteboardArtifact>;
}

export function useConversationArtifacts(conversationId?: string) {
  return useQuery<ConversationArtifactsData>({
    queryKey: ["whiteboard", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/whiteboard`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { artifacts } = (await res.json()) as { artifacts: WhiteboardArtifact[] };
      const byId: Record<string, WhiteboardArtifact> = {};
      for (const a of artifacts) byId[a.id] = a;
      return { artifacts, byId };
    },
  });
}
