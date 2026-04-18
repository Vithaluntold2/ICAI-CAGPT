/**
 * Feature Flags Configuration
 * Controls availability of features based on environment and implementation status
 */

export interface FeatureFlags {
  // Core features (always enabled)
  AI_CHAT: boolean;
  FINANCIAL_CALCULATIONS: boolean;
  DOCUMENT_UPLOAD: boolean;

  // Features requiring external services
  DOCUMENT_ANALYSIS: boolean;
  PAYMENTS: boolean;
  SOCIAL_LOGIN: boolean;

  // Features with incomplete implementations (disabled by default)
  DEEP_RESEARCH: boolean;
  EXPERT_ROUNDTABLE: boolean;
  KNOWLEDGE_GRAPH: boolean;

  // AI-powered search engine
  AI_SEARCH: boolean;

  // Experimental features
  EXPERIMENTAL_AGENTS: boolean;
  DEBUG_MODE: boolean;

  // Dynamic chat + whiteboard UX (Phase 9+)
  WHITEBOARD_V2: boolean;
}

/**
 * Get feature flags based on environment
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    // Core features - always enabled
    AI_CHAT: true,
    FINANCIAL_CALCULATIONS: true,
    DOCUMENT_UPLOAD: true,

    // Features requiring external services
    DOCUMENT_ANALYSIS: !!(
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    ),
    PAYMENTS: !!(
      process.env.CASHFREE_APP_ID &&
      process.env.CASHFREE_SECRET_KEY
    ),
    SOCIAL_LOGIN: !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
    ),

    // Features requiring knowledge graph seeding
    // These features use real AI and embeddings, but require documents
    // to be ingested into the knowledge graph for optimal results
    // Enable when knowledge graph has been populated with domain content
    DEEP_RESEARCH: process.env.ENABLE_DEEP_RESEARCH === 'true',
    EXPERT_ROUNDTABLE: process.env.ENABLE_EXPERT_ROUNDTABLE === 'true',
    KNOWLEDGE_GRAPH: process.env.ENABLE_KNOWLEDGE_GRAPH === 'true',

    // AI-powered search engine (requires Perplexity or Azure OpenAI)
    AI_SEARCH: !!(process.env.PERPLEXITY_API_KEY || process.env.AZURE_OPENAI_API_KEY),

    // Experimental
    EXPERIMENTAL_AGENTS: process.env.ENABLE_EXPERIMENTAL_AGENTS === 'true',
    DEBUG_MODE: process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true',

    // Dynamic chat + whiteboard UX (Phase 9+)
    WHITEBOARD_V2: process.env.ENABLE_WHITEBOARD_V2 === 'true',
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature] ?? false;
}

/**
 * Get list of disabled features with reasons
 */
export function getDisabledFeatures(): { feature: string; reason: string }[] {
  const disabled: { feature: string; reason: string }[] = [];
  const flags = getFeatureFlags();

  if (!flags.DOCUMENT_ANALYSIS) {
    disabled.push({
      feature: 'Document Analysis',
      reason: 'Azure Document Intelligence not configured',
    });
  }

  if (!flags.PAYMENTS) {
    disabled.push({
      feature: 'Payments & Subscriptions',
      reason: 'Cashfree credentials not configured',
    });
  }

  if (!flags.SOCIAL_LOGIN) {
    disabled.push({
      feature: 'Google Sign-In',
      reason: 'Google OAuth not configured',
    });
  }

  if (!flags.DEEP_RESEARCH) {
    disabled.push({
      feature: 'Deep Research Mode',
      reason: 'Set ENABLE_DEEP_RESEARCH=true to enable',
    });
  }

  if (!flags.EXPERT_ROUNDTABLE) {
    disabled.push({
      feature: 'Expert Roundtable',
      reason: 'Set ENABLE_EXPERT_ROUNDTABLE=true to enable',
    });
  }

  return disabled;
}

/**
 * Feature availability for client
 */
export function getClientFeatures(): Record<string, boolean> {
  const flags = getFeatureFlags();

  return {
    documentAnalysis: flags.DOCUMENT_ANALYSIS,
    payments: flags.PAYMENTS,
    socialLogin: flags.SOCIAL_LOGIN,
    deepResearch: flags.DEEP_RESEARCH,
    expertRoundtable: flags.EXPERT_ROUNDTABLE,
    financialCalculations: flags.FINANCIAL_CALCULATIONS,
    aiSearch: flags.AI_SEARCH,
    whiteboardV2: flags.WHITEBOARD_V2,
  };
}
