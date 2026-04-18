/**
 * Provider-agnostic tool-call loop.
 *
 * Many providers return `finishReason: "tool_calls"` with a list of tool invocations
 * the model wants executed. This helper drives the loop: execute each tool via the
 * shared ToolRegistry, append the results to the conversation, and re-ask the model
 * until it stops requesting tools (or we hit MAX_TOOL_ITERATIONS).
 *
 * Pragmatic MVP: tool results are encoded as plain text `user` turns rather than
 * provider-native tool-result blocks (Anthropic `tool_result` content / OpenAI
 * `role: "tool"` messages). Modern LLMs parse this reliably. Upgrading to native
 * tool-result shapes is a future follow-up.
 */

import { toolRegistry } from "./tools/registry";
import type { AIProvider } from "./aiProviders/base";
import type { CompletionRequest, CompletionResponse } from "./aiProviders/types";
import type { ToolContext } from "./tools/types";

const MAX_TOOL_ITERATIONS = 5;

export async function completeWithToolLoop(
  provider: AIProvider,
  initialRequest: CompletionRequest,
  ctx: ToolContext
): Promise<CompletionResponse> {
  let request = initialRequest;
  let lastResponse: CompletionResponse | undefined;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await provider.generateCompletion(request);
    lastResponse = response;

    const toolCalls = (response.metadata?.toolCalls ?? []) as Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;

    if (response.finishReason !== "tool_calls" || toolCalls.length === 0) {
      return response;
    }

    // Execute each tool call
    const toolResults: Array<{ toolCallId: string; name: string; output: string }> = [];
    for (const call of toolCalls) {
      try {
        const out = await toolRegistry.invoke(call.name, call.input, ctx);
        toolResults.push({
          toolCallId: call.id,
          name: call.name,
          output: JSON.stringify(out),
        });
      } catch (e: any) {
        toolResults.push({
          toolCallId: call.id,
          name: call.name,
          output: JSON.stringify({ error: e?.message ?? String(e) }),
        });
      }
    }

    // Encode tool results as a plain-text user turn. This works across providers
    // because the `messages` array only expects system|user|assistant roles.
    const toolBlock = toolResults
      .map(r => `[Tool result for ${r.name} (call_id=${r.toolCallId})]\n${r.output}`)
      .join("\n\n");

    request = {
      ...request,
      messages: [
        ...request.messages,
        { role: "assistant" as const, content: response.content || "(tool_use)" },
        { role: "user" as const, content: toolBlock },
      ],
    };
  }

  if (!lastResponse) {
    throw new Error("completeWithToolLoop produced no response");
  }
  return lastResponse;
}
