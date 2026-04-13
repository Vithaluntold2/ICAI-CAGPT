/**
 * Chat Mode Normalizer
 * 
 * Ensures consistent chat mode naming across the entire application.
 * Frontend sends modern names (deep-research, calculation, audit-plan)
 * but some legacy code or defaults might use old names (research, calculate, audit).
 * 
 * This utility normalizes all variations to the canonical modern names.
 */

export type CanonicalChatMode = 
  | 'standard' 
  | 'deep-research' 
  | 'checklist' 
  | 'workflow' 
  | 'audit-plan' 
  | 'calculation'
  | 'scenario-simulator'
  | 'deliverable-composer'
  | 'forensic-intelligence'
  | 'roundtable'
  | 'web-search';

/**
 * Mapping of legacy/alternative chat mode names to canonical names
 */
const CHAT_MODE_ALIASES: Record<string, CanonicalChatMode> = {
  // Legacy names (for backward compatibility)
  'research': 'deep-research',
  'calculate': 'calculation',
  'audit': 'audit-plan',
  'scenario': 'scenario-simulator',
  'deliverable': 'deliverable-composer',
  'forensic': 'forensic-intelligence',
  'search': 'web-search',
  'web-search': 'web-search',
  
  // Canonical names (pass through)
  'standard': 'standard',
  'deep-research': 'deep-research',
  'checklist': 'checklist',
  'workflow': 'workflow',
  'audit-plan': 'audit-plan',
  'calculation': 'calculation',
  'scenario-simulator': 'scenario-simulator',
  'deliverable-composer': 'deliverable-composer',
  'forensic-intelligence': 'forensic-intelligence',
  'roundtable': 'roundtable',
};

/**
 * Normalize a chat mode string to its canonical form
 * 
 * @param chatMode - Raw chat mode from request (may be legacy name or empty)
 * @returns Canonical chat mode name
 * 
 * @example
 * normalizeChatMode('research')      // 'deep-research'
 * normalizeChatMode('deep-research') // 'deep-research'
 * normalizeChatMode('calculate')     // 'calculation'
 * normalizeChatMode('')              // 'standard'
 * normalizeChatMode(undefined)       // 'standard'
 */
export function normalizeChatMode(chatMode?: string | null): CanonicalChatMode {
  if (!chatMode) {
    return 'standard';
  }
  
  const normalized = CHAT_MODE_ALIASES[chatMode.toLowerCase()];
  if (normalized) {
    return normalized;
  }
  
  // Unknown mode defaults to standard
  console.warn(`[ChatMode] Unknown chat mode '${chatMode}' defaulting to 'standard'`);
  return 'standard';
}

/**
 * Check if a chat mode requires Chain-of-Thought reasoning
 * 
 * @param chatMode - Chat mode to check (will be normalized first)
 * @returns true if mode should use CoT reasoning
 */
export function isCotMode(chatMode?: string | null): boolean {
  const normalized = normalizeChatMode(chatMode);
  return normalized === 'deep-research' || normalized === 'calculation';
}

/**
 * Check if a chat mode is a professional mode that should show in Output Pane
 * 
 * @param chatMode - Chat mode to check (will be normalized first)
 * @returns true if mode is professional (non-standard)
 */
export function isProfessionalMode(chatMode?: string | null): boolean {
  const normalized = normalizeChatMode(chatMode);
  return normalized !== 'standard';
}

/**
 * Check if a chat mode requires multi-agent workflow execution
 * 
 * @param chatMode - Chat mode to check (will be normalized first)
 * @returns true if mode should execute agent workflows
 */
export function isAgentWorkflowMode(chatMode?: string | null): boolean {
  const normalized = normalizeChatMode(chatMode);
  return [
    'deep-research',
    'calculation',           // Financial Calculation mode - 5 agents
    'workflow',
    'audit-plan',
    'scenario-simulator',
    'deliverable-composer',
    'forensic-intelligence',
    'roundtable'
  ].includes(normalized);
}
