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
      `[Synthesizer] failed for thread=${threadId} agent=${agentId} attempt=${(job.attemptsMade ?? 0) + 1}:`,
      message,
    );
    // Surface to Sentry so operators see synth failures even with console
    // routing disabled.
    try {
      const { captureError } = await import('../sentry');
      captureError(err instanceof Error ? err : new Error(message), {
        feature: 'roundtable-synthesizer',
        threadId,
        agentId,
        agentName,
        panelId,
        attempt: (job.attemptsMade ?? 0) + 1,
      });
    } catch {
      // Ignore Sentry failures — the throw below is the source of truth.
    }
    // Re-throw so Bull retries per queue config (attempts: 3, exp backoff 5s).
    // Panel non-blocking guarantee comes from fire-and-forget dispatch in
    // roundtableRuntime's finally — not from swallowing here.
    throw err;
  }
}
