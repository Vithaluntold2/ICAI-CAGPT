/**
 * Provider-agnostic tool-call loop.
 *
 * Many providers return `finishReason: "tool_calls"` with a list of tool invocations
 * the model wants executed. This helper drives the loop: execute each tool via the
 * shared ToolRegistry, append the results to the conversation, and re-ask the model
 * until it stops requesting tools (or we hit MAX_TOOL_ITERATIONS).
 *
 * Tool results are emitted as structured `role: 'tool'` messages with
 * `toolCallId` + `toolName` fields; each provider adapter translates those
 * into the native tool-result shape (OpenAI `role:'tool'`,
 * Anthropic `content: [{type:'tool_result', tool_use_id}]`,
 * Gemini `functionResponse`). This is required for Spreadsheet Mode and
 * Agent 2 of the Two-Agent Solver where callers set
 * `toolChoice: 'required'` — Anthropic rejects a forced-tool conversation
 * whose prior assistant tool_use turn isn't echoed with a matching
 * tool_result block.
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

    // Echo the assistant's tool_use turn and append native tool_result
    // turns. Adapters translate these per-provider; the `content` string
    // stays set to the JSON result so legacy consumers still see a
    // useful payload (e.g. log transcripts).
    request = {
      ...request,
      messages: [
        ...request.messages,
        {
          role: "assistant" as const,
          content: response.content ?? "",
          toolCalls,
        },
        ...toolResults.map(r => ({
          role: "tool" as const,
          content: r.output,
          toolCallId: r.toolCallId,
          toolName: r.name,
        })),
      ],
    };
  }

  if (!lastResponse) {
    throw new Error("completeWithToolLoop produced no response");
  }
  return lastResponse;
}
