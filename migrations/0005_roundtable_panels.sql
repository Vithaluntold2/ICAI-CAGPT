-- Migration: Roundtable Panels — user-curated agent panels (Phase 1 foundation)
-- Created: 2026-04-26
-- Purpose: store user-built expert panels for roundtable mode, including
--          agents, attached session-KB documents, and embedded chunks.
-- Backward compat: purely additive. Existing roundtable_sessions table is
--                  untouched. Legacy /roundtable workflow keeps working.

-- ----------------------------------------------------------------------
-- Panels — one per chat conversation in roundtable mode (or template).
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roundtable_panels (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id VARCHAR,
  name VARCHAR(200) NOT NULL DEFAULT 'Untitled panel',
  description TEXT,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS roundtable_panels_user_id_idx ON roundtable_panels(user_id);
CREATE INDEX IF NOT EXISTS roundtable_panels_conversation_idx ON roundtable_panels(conversation_id);
CREATE INDEX IF NOT EXISTS roundtable_panels_template_idx ON roundtable_panels(user_id, is_template);

COMMENT ON TABLE roundtable_panels IS 'User-curated roundtable agent panels (custom-GPT-style).';

-- ----------------------------------------------------------------------
-- Agents inside a panel. Each row is fully independent at runtime.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roundtable_panel_agents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id VARCHAR NOT NULL REFERENCES roundtable_panels(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  avatar VARCHAR(200),
  color VARCHAR(32),
  system_prompt TEXT NOT NULL,
  use_base_knowledge BOOLEAN NOT NULL DEFAULT TRUE,
  model VARCHAR(32) NOT NULL DEFAULT 'strong',
  tool_allowlist JSONB DEFAULT '[]',
  created_from_template VARCHAR(60),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roundtable_panel_agents_panel_idx ON roundtable_panel_agents(panel_id);
CREATE INDEX IF NOT EXISTS roundtable_panel_agents_panel_position_idx ON roundtable_panel_agents(panel_id, position);

COMMENT ON TABLE roundtable_panel_agents IS 'Independent expert agents inside a roundtable panel.';
COMMENT ON COLUMN roundtable_panel_agents.use_base_knowledge IS 'When FALSE, agent must answer only from attached KB or refuse.';

-- ----------------------------------------------------------------------
-- Session knowledge-base documents.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roundtable_kb_docs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id VARCHAR NOT NULL REFERENCES roundtable_panels(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(200),
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_text TEXT NOT NULL DEFAULT '',
  ingest_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ingest_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roundtable_kb_docs_panel_idx ON roundtable_kb_docs(panel_id);
CREATE INDEX IF NOT EXISTS roundtable_kb_docs_status_idx ON roundtable_kb_docs(ingest_status);

COMMENT ON TABLE roundtable_kb_docs IS 'Documents uploaded to a panel knowledge base.';

-- ----------------------------------------------------------------------
-- Many-to-many: agent ↔ doc attachment.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roundtable_panel_agent_kb_docs (
  agent_id VARCHAR NOT NULL REFERENCES roundtable_panel_agents(id) ON DELETE CASCADE,
  doc_id VARCHAR NOT NULL REFERENCES roundtable_kb_docs(id) ON DELETE CASCADE,
  attached_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS roundtable_panel_agent_kb_docs_pk
  ON roundtable_panel_agent_kb_docs(agent_id, doc_id);
CREATE INDEX IF NOT EXISTS roundtable_panel_agent_kb_docs_doc_idx
  ON roundtable_panel_agent_kb_docs(doc_id);

COMMENT ON TABLE roundtable_panel_agent_kb_docs IS 'Per-agent KB doc attachments.';

-- ----------------------------------------------------------------------
-- Chunked + embedded text for retrieval.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roundtable_kb_chunks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id VARCHAR NOT NULL REFERENCES roundtable_kb_docs(id) ON DELETE CASCADE,
  panel_id VARCHAR NOT NULL REFERENCES roundtable_panels(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roundtable_kb_chunks_doc_idx ON roundtable_kb_chunks(doc_id);
CREATE INDEX IF NOT EXISTS roundtable_kb_chunks_panel_idx ON roundtable_kb_chunks(panel_id);
CREATE UNIQUE INDEX IF NOT EXISTS roundtable_kb_chunks_doc_chunk_idx
  ON roundtable_kb_chunks(doc_id, chunk_index);

COMMENT ON TABLE roundtable_kb_chunks IS 'Chunked KB text + JSON-serialized embedding (TEXT fallback).';
