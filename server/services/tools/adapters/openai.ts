import type { Tool } from "../types";
import type { ParsedToolCall } from "./anthropic";

export interface OpenAIToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toolsToOpenAISchema(tools: Tool[]): OpenAIToolSchema[] {
  return tools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export function parseOpenAIToolCall(message: { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  for (const tc of message.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(tc.function.arguments); } catch { input = {}; }
    calls.push({ id: tc.id, name: tc.function.name, input });
  }
  return calls;
}
