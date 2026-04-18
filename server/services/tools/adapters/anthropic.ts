import type { Tool } from "../types";

export interface AnthropicToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export function toolsToAnthropicSchema(tools: Tool[]): AnthropicToolSchema[] {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
}

export function parseAnthropicToolCall(content: Array<{ type: string; [k: string]: unknown }>): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  for (const block of content) {
    if (block.type === "tool_use") {
      calls.push({
        id: block.id as string,
        name: block.name as string,
        input: (block.input ?? {}) as Record<string, unknown>,
      });
    }
  }
  return calls;
}
