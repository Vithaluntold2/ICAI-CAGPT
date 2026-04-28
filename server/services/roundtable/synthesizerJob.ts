/**
 * Bull processor for the roundtable-synthesizer queue. Wraps
 * synthesizeAgentPOV with a retry-and-swallow shape so that synthesis
 * failures NEVER block the panel — the agent will fall through to its
 * last-good POV + raw tail on the read side.
 */

import type { Job } from "bull";
import { synthesizeAgentPOV } from "./agentSynthesizer";

export interface SynthesizerJobData {
  threadId: string;
  agentId: string;
  agentName: string;
  panelId: string;
}

export interface SynthesizerJobResult {
  success: boolean;
  version?: number;
  tokenCount?: number;
  error?: string;
}

export async function processSynthesizerJob(
  job: Job<SynthesizerJobData>,
): Promise<SynthesizerJobResult> {
  const { threadId, agentId, agentName, panelId } = job.data;
  try {
    const result = await synthesizeAgentPOV({
      threadId,
      agentId,
      agentName,
      panelId,
    });
    return { success: true, version: result.version, tokenCount: result.tokenCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Synthesizer] failed for thread=${threadId} agent=${agentId}:`,
      message,
    );
    return { success: false, error: message };
  }
}
