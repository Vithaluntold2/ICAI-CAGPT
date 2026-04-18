import { describe, it, expect } from "vitest";
import { toolsToOpenAISchema, parseOpenAIToolCall } from "./openai";
import type { Tool } from "../types";

const tool: Tool = {
  name: "read_whiteboard",
  description: "x",
  inputSchema: { type: "object", properties: { artifact_id: { type: "string" } }, required: ["artifact_id"] },
  handler: async () => ({}),
};

describe("openai adapter", () => {
  it("maps tools to OpenAI function schema", () => {
    const out = toolsToOpenAISchema([tool]);
    expect(out[0].type).toBe("function");
    expect(out[0].function.name).toBe("read_whiteboard");
    expect(out[0].function.parameters).toEqual(tool.inputSchema);
  });

  it("parses a tool_calls response", () => {
    const message = {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "read_whiteboard", arguments: '{"artifact_id":"art_1"}' } },
      ],
    };
    const calls = parseOpenAIToolCall(message as any);
    expect(calls).toEqual([{ id: "call_1", name: "read_whiteboard", input: { artifact_id: "art_1" } }]);
  });

  it("tolerates invalid JSON in arguments by returning empty input", () => {
    const message = {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "call_2", type: "function", function: { name: "read_whiteboard", arguments: "{not json" } }],
    };
    const calls = parseOpenAIToolCall(message as any);
    expect(calls[0].input).toEqual({});
  });
});
