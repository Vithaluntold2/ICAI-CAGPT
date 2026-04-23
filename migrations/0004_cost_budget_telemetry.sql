-- Step 5 + Step 12 of the Spreadsheet Mode / Two-Agent Solver plan.
--
-- Adds two tables:
--   conversation_budgets  — per-conversation spend envelope (USD cents) used
--                           by the cost estimator to refuse paid work once
--                           the envelope is exhausted. Storage is always USD
--                           cents; the UI handles ₹ / $ / € / £ / AED display
--                           conversion. `enforce` controls whether the
--                           orchestrator actually blocks on overspend (off by
--                           default, so existing users are unaffected).
--   tool_call_telemetry   — one row per tool invocation (runSolver,
--                           buildSpreadsheet, quoteCost, twoAgentSolver,
--                           read_whiteboard, calcExecutor, …). Used for
--                           debugging and per-mode aggregate dashboards.
--
-- Idempotent: every statement uses IF NOT EXISTS so re-running the migration
-- is safe. No existing data is modified.

CREATE TABLE IF NOT EXISTS conversation_budgets (
  conversation_id VARCHAR PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  budget_usd_cents INTEGER NOT NULL DEFAULT 0,
  spent_usd_cents INTEGER NOT NULL DEFAULT 0,
  reserved_usd_cents INTEGER NOT NULL DEFAULT 0,
  enforce BOOLEAN NOT NULL DEFAULT FALSE,
  display_currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversation_budgets_enforce_idx
  ON conversation_budgets(enforce);

CREATE TABLE IF NOT EXISTS tool_call_telemetry (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL,
  tool_name VARCHAR(64) NOT NULL,
  agent_id VARCHAR(64),
  outcome VARCHAR(16) NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd_cents INTEGER NOT NULL DEFAULT 0,
  round_trips INTEGER NOT NULL DEFAULT 1,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tool_call_telemetry_conversation_idx
  ON tool_call_telemetry(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS tool_call_telemetry_tool_name_idx
  ON tool_call_telemetry(tool_name, created_at);

CREATE INDEX IF NOT EXISTS tool_call_telemetry_outcome_idx
  ON tool_call_telemetry(outcome);
