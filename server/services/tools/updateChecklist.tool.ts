import type { Tool } from "./types";
import { getArtifactScoped, updateArtifactState } from "../whiteboard/repository";

export interface UpdateChecklistInput {
  artifact_id: string;
  item_id: string;
  checked: boolean;
}

/**
 * Toggle a single item on a checklist artifact. Scoped to the current
 * conversation — an agent cannot modify a checklist from a different user's
 * conversation even if it guesses the id.
 *
 * Stores the full list of checked item ids inside the artifact's `state.checkedIds`
 * jsonb array, alongside an `updatedAt` ISO timestamp. Reads are via the
 * read_whiteboard tool (returns state) or the manifest (summary).
 */
export const updateChecklistTool: Tool<UpdateChecklistInput, { checkedIds: string[] }> = {
  name: "update_checklist",
  description:
    "Mark a single checklist item as checked or unchecked. Use after the user asks you to check/uncheck items, or when you want to record a decision yourself. The artifact must be of kind 'checklist'. Returns the new full list of checked item ids after the update.",
  inputSchema: {
    type: "object",
    properties: {
      artifact_id: {
        type: "string",
        description: "The checklist artifact's id from the whiteboard manifest (e.g. art_abc123).",
      },
      item_id: {
        type: "string",
        description: "The item's id inside the checklist's payload.items array.",
      },
      checked: {
        type: "boolean",
        description: "true to mark checked, false to un-check.",
      },
    },
    required: ["artifact_id", "item_id", "checked"],
  },
  handler: async ({ artifact_id, item_id, checked }, ctx) => {
    const existing = await getArtifactScoped(artifact_id, ctx.conversationId);
    if (!existing) throw new Error("artifact_not_found");
    if (existing.kind !== "checklist") throw new Error("not_a_checklist");

    const items = ((existing.payload as any)?.items ?? []) as Array<{ id: string }>;
    if (!items.some(i => i.id === item_id)) throw new Error("item_not_found");

    const prev = ((existing.state ?? {}) as { checkedIds?: string[] }).checkedIds ?? [];
    const set = new Set(prev);
    if (checked) set.add(item_id);
    else set.delete(item_id);
    const checkedIds = Array.from(set);

    const updated = await updateArtifactState(artifact_id, ctx.conversationId, { checkedIds });
    if (!updated) throw new Error("update_failed");

    return { checkedIds };
  },
};
