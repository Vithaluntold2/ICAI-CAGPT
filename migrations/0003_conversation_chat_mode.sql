-- Add chat_mode column to conversations so each conversation remembers the
-- mode it was created in. Required for the mode-grouped sidebar — without this
-- every conversation fell back to the 'standard' bucket.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS chat_mode TEXT NOT NULL DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS conversations_chat_mode_idx
  ON conversations(chat_mode);
