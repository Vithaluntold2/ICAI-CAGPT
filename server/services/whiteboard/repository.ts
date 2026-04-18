import { db } from "../../db";
import { whiteboardArtifacts, type WhiteboardArtifact, type InsertWhiteboardArtifact } from "../../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

export type CreateArtifactInput = Omit<InsertWhiteboardArtifact, "id" | "sequence" | "createdAt">;

export async function createArtifact(input: CreateArtifactInput): Promise<WhiteboardArtifact> {
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${whiteboardArtifacts.sequence}), 0)` })
    .from(whiteboardArtifacts)
    .where(eq(whiteboardArtifacts.conversationId, input.conversationId));
  const nextSequence = Number(maxRow?.max ?? 0) + 1;

  const [row] = await db
    .insert(whiteboardArtifacts)
    .values({ ...input, sequence: nextSequence })
    .returning();
  return row;
}

export async function listArtifactsByConversation(conversationId: string): Promise<WhiteboardArtifact[]> {
  return db
    .select()
    .from(whiteboardArtifacts)
    .where(eq(whiteboardArtifacts.conversationId, conversationId))
    .orderBy(whiteboardArtifacts.sequence);
}

export async function getArtifactScoped(
  artifactId: string,
  conversationId: string
): Promise<WhiteboardArtifact | null> {
  const [row] = await db
    .select()
    .from(whiteboardArtifacts)
    .where(
      and(
        eq(whiteboardArtifacts.id, artifactId),
        eq(whiteboardArtifacts.conversationId, conversationId)
      )
    )
    .limit(1);
  return row ?? null;
}
