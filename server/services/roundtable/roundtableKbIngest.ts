/**
 * Roundtable KB Ingest
 *
 * Phase-1: chunk a doc's plain text and persist embeddings. Text
 * extraction from binary formats (PDF/DOCX) is handled at the route
 * boundary by reusing existing extraction infra; this service assumes
 * the doc row already has `contentText` populated.
 *
 * Embedding generation reuses the existing embeddingService singleton.
 * If embeddings fail (e.g. Azure not configured), chunks are still
 * persisted with a NULL embedding — the runtime can fall back to BM25
 * or substring filtering until embeddings come back online.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { roundtableKbChunks, roundtableKbDocs } from '@shared/schema';
import { embeddingService } from '../embeddingService';
import { setKbDocStatus } from './roundtablePanelService';

// Tunables — small docs are common, keep chunks legible.
const CHUNK_TARGET_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 150;

/**
 * Split text into overlapping chunks on paragraph / sentence boundaries.
 * Conservative implementation: prefers double-newline breaks, falls back
 * to single newline, then sentence ends.
 */
export function chunkText(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= CHUNK_TARGET_CHARS) return [clean];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < clean.length) {
    const end = Math.min(cursor + CHUNK_TARGET_CHARS, clean.length);
    let slice = clean.slice(cursor, end);

    // If we're not at the end of doc, look for a sane break inside the slice.
    if (end < clean.length) {
      const candidates = [
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('\n'),
      ].filter((i) => i > CHUNK_TARGET_CHARS / 2);
      const breakAt = candidates.length > 0 ? Math.max(...candidates) : -1;
      if (breakAt > 0) slice = slice.slice(0, breakAt + 1);
    }

    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);

    cursor += slice.length;
    if (cursor < clean.length) cursor = Math.max(cursor - CHUNK_OVERLAP_CHARS, cursor);
  }

  return chunks;
}

/**
 * Roughly estimate token count from char count (≈4 chars/token).
 * We don't need a tokenizer for v1 — this is just for cost telemetry.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface IngestResult {
  docId: string;
  chunksCreated: number;
  embeddingsGenerated: number;
  embeddingsFailed: number;
}

/**
 * Chunk + embed + persist for one doc. Idempotent: re-running for the
 * same docId clears existing chunks and rewrites them.
 */
export async function ingestKbDoc(docId: string): Promise<IngestResult> {
  const docRows = await db
    .select()
    .from(roundtableKbDocs)
    .where(eq(roundtableKbDocs.id, docId))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    throw new Error(`KB doc not found: ${docId}`);
  }

  await setKbDocStatus(docId, 'pending');

  // Wipe any prior chunks for clean re-ingest.
  await db.delete(roundtableKbChunks).where(eq(roundtableKbChunks.docId, docId));

  const chunks = chunkText(doc.contentText ?? '');
  if (chunks.length === 0) {
    await setKbDocStatus(docId, 'ready'); // empty docs are valid (just useless)
    return { docId, chunksCreated: 0, embeddingsGenerated: 0, embeddingsFailed: 0 };
  }

  // Try to ensure embeddings are available — non-fatal if not.
  if (!embeddingService['initialized']) {
    embeddingService.initialize();
  }

  let generated = 0;
  let failed = 0;

  // Persist chunks one at a time so partial failures don't lose progress.
  // For larger uploads we could batch into the embedding service's batch
  // API, but v1 stays simple.
  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];
    let embeddingLiteral: string | null = null;
    try {
      const result = await embeddingService.generateEmbedding(text);
      embeddingLiteral = JSON.stringify(result.embedding);
      generated++;
    } catch (err) {
      failed++;
      // Continue without embedding; chunk text is still searchable.
    }

    await db.insert(roundtableKbChunks).values({
      docId,
      panelId: doc.panelId,
      chunkIndex: i,
      text,
      embedding: embeddingLiteral,
      tokenCount: estimateTokens(text),
    });
  }

  // If everything failed, mark doc as failed so the UI can surface a retry.
  if (generated === 0 && failed > 0) {
    await setKbDocStatus(docId, 'failed', `Embeddings failed for all ${failed} chunks`);
  } else {
    await setKbDocStatus(docId, 'ready');
  }

  return {
    docId,
    chunksCreated: chunks.length,
    embeddingsGenerated: generated,
    embeddingsFailed: failed,
  };
}

/**
 * Convenience helper: write fresh content + ingest in one shot.
 */
export async function setDocContentAndIngest(
  docId: string,
  contentText: string,
): Promise<IngestResult> {
  await db
    .update(roundtableKbDocs)
    .set({ contentText, ingestStatus: 'pending', ingestError: null })
    .where(eq(roundtableKbDocs.id, docId));
  return ingestKbDoc(docId);
}
