import { describe, it, expect } from "vitest";
import { toolsToAnthropicSchema, parseAnthropicToolCall } from "./anthropic";
import type { Tool } from "../types";

const tool: Tool = {
  name: "read_whiteboard",
  description: "x",
  inputSchema: { type: "object", properties: { artifact_id: { type: "string" } }, required: ["artifact_id"] },
  handler: async () => ({}),
};

describe("anthropic adapter", () => {
  it("maps tools to Anthropic tool schema", () => {
    const out = toolsToAnthropicSchema([tool]);
    expect(out[0].name).toBe("read_whiteboard");
    expect(out[0].input_schema).toEqual(tool.inputSchema);
    expect(out[0].description).toBe("x");
  });

  it("parses a tool_use block", () => {
    const content = [
      { type: "text", text: "ok" },
      { type: "tool_use", id: "tool_1", name: "read_whiteboard", input: { artifact_id: "art_1" } },
    ];
    const calls = parseAnthropicToolCall(content as any);
    expect(calls).toEqual([{ id: "tool_1", name: "read_whiteboard", input: { artifact_id: "art_1" } }]);
  });

  it("returns empty array when no tool_use blocks", () => {
    expect(parseAnthropicToolCall([{ type: "text", text: "hi" }] as any)).toEqual([]);
  });
});
