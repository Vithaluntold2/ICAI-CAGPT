-- ============================================================================
-- Roundtable Boardroom (Phase 2): runtime tables — threads, turns, question cards.
-- Additive only. Existing roundtable_panels / roundtable_panel_agents /
-- roundtable_kb_docs from migration 0005 are untouched.
-- ============================================================================

CREATE TABLE IF NOT EXISTS roundtable_threads (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id        VARCHAR NOT NULL REFERENCES roundtable_panels(id) ON DELETE CASCADE,
  conversation_id VARCHAR,
  title           VARCHAR(300) NOT NULL DEFAULT 'Boardroom session',
  -- 'opening' | 'independent-views' | 'cross-examination' | 'user-qa' | 'synthesis' | 'resolution'
  phase           VARCHAR(40)  NOT NULL DEFAULT 'opening',
  -- Last full turn that's currently streaming, if any.
  current_turn_id VARCHAR,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS roundtable_threads_panel_idx ON roundtable_threads(panel_id);
CREATE INDEX IF NOT EXISTS roundtable_threads_conversation_idx ON roundtable_threads(conversation_id);

CREATE TABLE IF NOT EXISTS roundtable_turns (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       VARCHAR NOT NULL REFERENCES roundtable_threads(id) ON DELETE CASCADE,
  panel_id        VARCHAR NOT NULL REFERENCES roundtable_panels(id) ON DELETE CASCADE,
  -- 'agent' | 'user' | 'system' | 'moderator'
  speaker_kind    VARCHAR(20) NOT NULL,
  agent_id        VARCHAR REFERENCES roundtable_panel_agents(id) ON DELETE SET NULL,
  parent_turn_id  VARCHAR REFERENCES roundtable_turns(id) ON DELETE SET NULL,
  content         TEXT NOT NULL DEFAULT '',
  -- 'queued' | 'streaming' | 'completed' | 'cancelled' | 'failed'
  status          VARCHAR(20) NOT NULL DEFAULT 'queued',
  cancel_reason   VARCHAR(120),
  citations       JSONB DEFAULT '[]'::jsonb,
  tokens_input    INTEGER NOT NULL DEFAULT 0,
  tokens_output   INTEGER NOT NULL DEFAULT 0,
  -- 1/100 of a US cent so the int stays sane while keeping precision
  cost_micros     INTEGER NOT NULL DEFAULT 0,
  position        INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP
);
CREATE INDEX IF NOT EXISTS roundtable_turns_thread_idx        ON roundtable_turns(thread_id);
CREATE INDEX IF NOT EXISTS roundtable_turns_thread_position_idx ON roundtable_turns(thread_id, position);
CREATE INDEX IF NOT EXISTS roundtable_turns_parent_idx        ON roundtable_turns(parent_turn_id);
CREATE INDEX IF NOT EXISTS roundtable_turns_agent_idx         ON roundtable_turns(agent_id);

CREATE TABLE IF NOT EXISTS roundtable_question_cards (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             VARCHAR NOT NULL REFERENCES roundtable_threads(id) ON DELETE CASCADE,
  parent_turn_id        VARCHAR REFERENCES roundtable_turns(id) ON DELETE SET NULL,
  from_agent_id         VARCHAR REFERENCES roundtable_panel_agents(id) ON DELETE SET NULL,
  to_agent_id           VARCHAR REFERENCES roundtable_panel_agents(id) ON DELETE SET NULL,
  to_user               BOOLEAN NOT NULL DEFAULT FALSE,
  text                  TEXT NOT NULL,
  -- 'open' | 'answered' | 'redirected' | 'skipped'
  status                VARCHAR(20) NOT NULL DEFAULT 'open',
  answer                TEXT,
  answered_by_agent_id  VARCHAR REFERENCES roundtable_panel_agents(id) ON DELETE SET NULL,
  answered_by_user      BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at           TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS roundtable_question_cards_thread_idx ON roundtable_question_cards(thread_id);
CREATE INDEX IF NOT EXISTS roundtable_question_cards_status_idx ON roundtable_question_cards(status);
