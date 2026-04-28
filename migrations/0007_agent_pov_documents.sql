-- ============================================================================
-- Per-agent POV documents (synthesizer output).
-- One row per (thread, agent). Maintained by a background "synthesizer"
-- subworker that summarises the broader roundtable conversation from this
-- agent's POV. Replaces the in-memory rule-based POV map under feature flag
-- ROUNDTABLE_SYNTHESIZER_ENABLED.
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_pov_documents (
  thread_id                 VARCHAR NOT NULL REFERENCES roundtable_threads(id) ON DELETE CASCADE,
  agent_id                  VARCHAR NOT NULL REFERENCES roundtable_panel_agents(id) ON DELETE CASCADE,
  self_position             JSONB   NOT NULL DEFAULT '{}'::jsonb,
  others_summary            JSONB   NOT NULL DEFAULT '{}'::jsonb,
  outgoing_qa               JSONB   NOT NULL DEFAULT '[]'::jsonb,
  incoming_qa               JSONB   NOT NULL DEFAULT '[]'::jsonb,
  chair_qa                  JSONB   NOT NULL DEFAULT '[]'::jsonb,
  open_threads              JSONB   NOT NULL DEFAULT '[]'::jsonb,
  glossary                  JSONB   NOT NULL DEFAULT '{}'::jsonb,
  last_synthesized_turn_id  VARCHAR,
  token_count               INTEGER NOT NULL DEFAULT 0,
  version                   INTEGER NOT NULL DEFAULT 1,
  last_updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_pov_documents_pk ON agent_pov_documents(thread_id, agent_id);
CREATE INDEX IF NOT EXISTS agent_pov_documents_thread_idx ON agent_pov_documents(thread_id);
