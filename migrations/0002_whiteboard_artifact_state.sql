-- Adds mutable state + updated_at to whiteboard_artifacts.
-- Used by interactive artifacts (currently the 'checklist' kind) to record
-- user/agent toggles without rewriting the immutable payload. Shape is
-- kind-specific; for checklists the jsonb holds { checkedIds: string[], updatedAt }.

ALTER TABLE "whiteboard_artifacts"
  ADD COLUMN IF NOT EXISTS "state" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "whiteboard_artifacts"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
