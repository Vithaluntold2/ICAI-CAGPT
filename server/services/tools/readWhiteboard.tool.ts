import type { Tool } from "./types";
import { getArtifactScoped } from "../whiteboard/repository";

export const readWhiteboardTool: Tool<{ artifact_id: string }, { kind: string; title: string; payload: unknown }> = {
  name: "read_whiteboard",
  description:
    "Retrieve the full structured payload of an artifact currently on the whiteboard. Use when you need exact numbers, workflow steps, mindmap nodes, or spreadsheet cells from a prior artifact. The artifact_id must come from the whiteboard manifest in the system context.",
  inputSchema: {
    type: "object",
    properties: {
      artifact_id: { type: "string", description: "The artifact id from the whiteboard manifest (e.g. art_abc123)" },
    },
    required: ["artifact_id"],
  },
  handler: async ({ artifact_id }, ctx) => {
    const row = await getArtifactScoped(artifact_id, ctx.conversationId);
    if (!row) throw new Error("artifact_not_found");
    return { kind: row.kind, title: row.title, payload: row.payload };
  },
};
