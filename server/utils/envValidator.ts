/**
 * Environment Variable Validator
 * Validates required environment variables at startup
 */

export interface EnvValidationResult {
  valid: boolean;
  missing: { group: string; variable: string; required: boolean }[];
  warnings: string[];
}

// Environment variable requirements by group
const ENV_REQUIREMENTS = {
  // Critical - app won't start without these
  critical: {
    required: true,
    vars: ['DATABASE_URL', 'SESSION_SECRET'],
  },
  // AI Providers - at least one required for chat functionality
  ai: {
    required: true,
    requireAtLeastOne: true,
    vars: [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_AI_API_KEY',
      'AZURE_OPENAI_API_KEY',  // Note: Azure also needs AZURE_OPENAI_ENDPOINT
      'PERPLEXITY_API_KEY',
    ],
  },
  // Payments - required for subscription features
  payments: {
    required: false,
    vars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  },
  // Document Intelligence - required for document analysis
  documentAI: {
    required: false,
    vars: ['AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', 'AZURE_DOCUMENT_INTELLIGENCE_KEY'],
  },
  // OAuth - optional social login
  oauth: {
    required: false,
    vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  // Storage - optional cloud storage
  storage: {
    required: false,
    vars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'],
  },
  // Redis - optional caching/rate limiting
  redis: {
    required: false,
    vars: ['REDIS_URL'],
  },
  // Security - optional enhanced security
  security: {
    required: false,
    vars: ['ENCRYPTION_KEY'],
  },
};

/**
 * Validate environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: { group: string; variable: string; required: boolean }[] = [];
  const warnings: string[] = [];

  for (const [group, config] of Object.entries(ENV_REQUIREMENTS)) {
    const groupConfig = config as {
      required: boolean;
      requireAtLeastOne?: boolean;
      vars: string[];
    };

    if (groupConfig.requireAtLeastOne) {
      // For AI providers - at least one must be set
      const hasAtLeastOne = groupConfig.vars.some(v => !!process.env[v]);
      if (!hasAtLeastOne) {
        warnings.push(`No AI provider configured. Set at least one of: ${groupConfig.vars.join(', ')}`);
        missing.push({
          group,
          variable: groupConfig.vars[0],
          required: true,
        });
      }
    } else {
      // Check each variable
      for (const variable of groupConfig.vars) {
        if (!process.env[variable]) {
          missing.push({
            group,
            variable,
            required: groupConfig.required,
          });

          if (groupConfig.required) {
            warnings.push(`Missing required variable: ${variable}`);
          }
        }
      }
    }
  }

  // Add feature-specific warnings
  if (!process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT) {
    warnings.push('Document analysis disabled - Azure Document Intelligence not configured');
  }

  if (!process.env.REDIS_URL) {
    warnings.push('Using in-memory rate limiting - Redis not configured (not recommended for production)');
  }

  const criticalMissing = missing.filter(m => m.required);
  const valid = criticalMissing.length === 0;

  return { valid, missing, warnings };
}

/**
 * Validate and throw on critical failures
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    const criticalVars = result.missing
      .filter(m => m.required)
      .map(m => m.variable)
      .join(', ');

    throw new Error(
      `Cannot start server - missing critical environment variables: ${criticalVars}\n` +
      `Please configure these in your .env file.`
    );
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('[Environment] ⚠️  Configuration warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }
}

/**
 * Get environment info for health check
 */
export function getEnvironmentInfo(): {
  configured: string[];
  missing: string[];
  environment: string;
  nodeVersion: string;
  features: Record<string, boolean>;
} {
  const result = validateEnvironment();

  const allVars = Object.values(ENV_REQUIREMENTS)
    .flatMap(config => (config as { vars: string[] }).vars);

  const configured = allVars.filter(v => !!process.env[v]);
  const missingVars = result.missing.map(m => m.variable);

  return {
    configured,
    missing: missingVars,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    features: {
      aiChat: !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY || !!process.env.GOOGLE_GEMINI_API_KEY,
      payments: !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET,
      documentAnalysis: !!process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      socialLogin: !!process.env.GOOGLE_CLIENT_ID,
      cloudStorage: !!process.env.AWS_S3_BUCKET,
      redis: !!process.env.REDIS_URL,
    },
  };
}
