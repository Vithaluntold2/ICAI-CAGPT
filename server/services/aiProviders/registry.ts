/**
 * AI Provider Registry and Factory
 * Manages all available AI providers and routes requests
 */

import { AIProvider } from './base';
import { AIProviderName, ProviderError } from './types';
import { OpenAIProvider } from './openai.provider';
import { AzureOpenAIProvider } from './azureOpenAI.provider';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { PerplexityProvider } from './perplexity.provider';
import { AzureDocumentIntelligenceProvider } from './azure.provider';
import { providerHealthMonitor } from './healthMonitor';

const GLOBAL_REGISTRY_KEY = '__icai_cagpt_ai_provider_registry__';

export class AIProviderRegistry {
  private providers: Map<AIProviderName, AIProvider> = new Map();

  private constructor() {
    (this as any).__instanceId = Math.random().toString(36).slice(2, 8);
    console.log(`[AIProviderRegistry] constructed (id: ${(this as any).__instanceId})`);
    this.initializeProviders();
  }

  /**
   * Get singleton instance.
   *
   * Pinned to globalThis so any duplicate module load (tsx loader quirks,
   * differing resolved paths, ts-node-style re-execution) still returns the
   * same instance. Without this, some consumers would get an empty registry
   * and fail with PROVIDER_NOT_FOUND even though startup registered providers.
   */
  static getInstance(): AIProviderRegistry {
    const g = globalThis as any;
    if (!g[GLOBAL_REGISTRY_KEY]) {
      g[GLOBAL_REGISTRY_KEY] = new AIProviderRegistry();
    }
    return g[GLOBAL_REGISTRY_KEY] as AIProviderRegistry;
  }

  /**
   * Initialize available providers from environment. Idempotent — safe to re-run;
   * it only registers providers that are not already in the map. Useful when the
   * first construction happened before env vars were fully available.
   */
  private initializeProviders(): void {
    console.log('[AIProviderRegistry] initializeProviders() — env snapshot:', {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      openAIEnabled: process.env.ENABLE_OPENAI === 'true',
      hasClaude: !!process.env.ANTHROPIC_API_KEY,
      hasGemini: !!process.env.GOOGLE_AI_API_KEY,
      hasAzureOpenAI: !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
      hasAzureDocIntel: !!(process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY),
    });
    // OpenAI - Disabled by default to avoid rate limits, enable with ENABLE_OPENAI=true
    if (!this.providers.has(AIProviderName.OPENAI) && process.env.OPENAI_API_KEY && process.env.ENABLE_OPENAI === 'true') {
      try {
        const openai = new OpenAIProvider({
          name: AIProviderName.OPENAI,
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: 'gpt-4o',
          enabled: true,
        });
        this.providers.set(AIProviderName.OPENAI, openai);
        providerHealthMonitor.initializeProvider(AIProviderName.OPENAI);
        console.log('[AIProviders] ✓ OpenAI provider initialized');
      } catch (error) {
        console.error('[AIProviders] ✗ Failed to initialize OpenAI:', error);
      }
    } else if (process.env.OPENAI_API_KEY) {
      console.log('[AIProviders] OpenAI disabled (set ENABLE_OPENAI=true to enable)');
    }

    // Claude (Anthropic) - Disabled by default, enable with ENABLE_CLAUDE=true
    if (!this.providers.has(AIProviderName.CLAUDE) && process.env.ANTHROPIC_API_KEY && process.env.ENABLE_CLAUDE === 'true') {
      try {
        const claude = new ClaudeProvider({
          name: AIProviderName.CLAUDE,
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: 'claude-3-5-sonnet-20241022',
          enabled: true,
        });
        this.providers.set(AIProviderName.CLAUDE, claude);
        providerHealthMonitor.initializeProvider(AIProviderName.CLAUDE);
        console.log('[AIProviders] ✓ Claude provider initialized');
      } catch (error) {
        console.error('[AIProviders] ✗ Failed to initialize Claude:', error);
      }
    } else if (process.env.ANTHROPIC_API_KEY) {
      console.log('[AIProviders] Claude disabled (set ENABLE_CLAUDE=true to enable)');
    }

    // Gemini (Google) - Disabled by default, enable with ENABLE_GEMINI=true
    if (!this.providers.has(AIProviderName.GEMINI) && process.env.GOOGLE_AI_API_KEY && process.env.ENABLE_GEMINI === 'true') {
      try {
        const gemini = new GeminiProvider({
          name: AIProviderName.GEMINI,
          apiKey: process.env.GOOGLE_AI_API_KEY,
          defaultModel: 'gemini-2.0-flash-exp',
          enabled: true,
        });
        this.providers.set(AIProviderName.GEMINI, gemini);
        providerHealthMonitor.initializeProvider(AIProviderName.GEMINI);
        console.log('[AIProviders] ✓ Gemini provider initialized');
      } catch (error) {
        console.error('[AIProviders] ✗ Failed to initialize Gemini:', error);
      }
    } else if (process.env.GOOGLE_AI_API_KEY) {
      console.log('[AIProviders] Gemini disabled (set ENABLE_GEMINI=true to enable)');
    }

    // Perplexity - Disabled by default, enable with ENABLE_PERPLEXITY=true
    if (!this.providers.has(AIProviderName.PERPLEXITY) && process.env.PERPLEXITY_API_KEY && process.env.ENABLE_PERPLEXITY === 'true') {
      try {
        const perplexity = new PerplexityProvider({
          name: AIProviderName.PERPLEXITY,
          apiKey: process.env.PERPLEXITY_API_KEY,
          defaultModel: 'llama-3.1-sonar-large-128k-online',
          enabled: true,
        });
        this.providers.set(AIProviderName.PERPLEXITY, perplexity);
        providerHealthMonitor.initializeProvider(AIProviderName.PERPLEXITY);
        console.log('[AIProviders] ✓ Perplexity provider initialized');
      } catch (error) {
        console.error('[AIProviders] ✗ Failed to initialize Perplexity:', error);
      }
    } else if (process.env.PERPLEXITY_API_KEY) {
      console.log('[AIProviders] Perplexity disabled (set ENABLE_PERPLEXITY=true to enable)');
    }

    // Azure OpenAI - Primary provider (always enabled when configured)
    if (!this.providers.has(AIProviderName.AZURE_OPENAI) && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
      try {
        const azureOpenAI = new AzureOpenAIProvider({
          name: AIProviderName.AZURE_OPENAI,
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          defaultModel: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
          enabled: true,
        });
        this.providers.set(AIProviderName.AZURE_OPENAI, azureOpenAI);
        providerHealthMonitor.initializeProvider(AIProviderName.AZURE_OPENAI);
        console.log('[AIProviders] ✓ Azure OpenAI provider initialized');
      } catch (error) {
        console.error('[AIProviders] ✗ Failed to initialize Azure OpenAI:', error);
      }
    }

    // Azure Document Intelligence
    if (!this.providers.has(AIProviderName.AZURE_DOCUMENT_INTELLIGENCE) && process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY) {
      try {
        const azure = new AzureDocumentIntelligenceProvider({
          name: AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
          endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
          apiKey: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
          defaultModel: 'prebuilt-document',
          enabled: true,
        });
        this.providers.set(AIProviderName.AZURE_DOCUMENT_INTELLIGENCE, azure);
        providerHealthMonitor.initializeProvider(AIProviderName.AZURE_DOCUMENT_INTELLIGENCE);
        console.log('[AIProviders] ✓ Azure Document Intelligence provider initialized');
      } catch (error) {
        console.error('[AIProviders] ✗ Failed to initialize Azure Document Intelligence:', error);
      }
    }

    // Log summary
    const activeProviders = Array.from(this.providers.keys()).join(', ');
    if (this.providers.size === 0) {
      console.warn('[AIProviders] ⚠ No AI providers initialized! Check environment variables.');
    } else {
      console.log(`[AIProviders] ${this.providers.size} provider(s) active: ${activeProviders}`);
    }
  }

  /**
   * Get a specific provider by name. Self-heals: if the requested provider is
   * missing but the relevant env vars are present, re-runs initialization once
   * before giving up. Handles the case where the registry was first constructed
   * before env loading finished.
   */
  getProvider(name: AIProviderName): AIProvider {
    let provider = this.providers.get(name);

    if (!provider) {
      console.warn(`[AIProviderRegistry] getProvider(${name}) miss; re-running init in case env wasn't ready at first construction.`);
      this.initializeProviders();
      provider = this.providers.get(name);
    }

    if (!provider) {
      const present = Array.from(this.providers.keys()).join(',') || '<empty>';
      console.error(`[AIProviderRegistry] getProvider(${name}) still missing after re-init. Registry contains: [${present}]. Instance id: ${(this as any).__instanceId}`);
      throw new ProviderError(
        `Provider ${name} is not available`,
        name,
        'PROVIDER_NOT_FOUND',
        false
      );
    }

    if (!provider.isEnabled()) {
      throw new ProviderError(
        `Provider ${name} is disabled`,
        name,
        'PROVIDER_DISABLED',
        false
      );
    }

    return provider;
  }

  /**
   * Get all available providers
   */
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isEnabled());
  }

  /**
   * Get provider names that are available
   */
  getAvailableProviderNames(): AIProviderName[] {
    return this.getAllProviders().map(p => p.getName());
  }

  /**
   * Check if a provider is available
   */
  hasProvider(name: AIProviderName): boolean {
    const provider = this.providers.get(name);
    return provider !== undefined && provider.isEnabled();
  }

  /**
   * Register a new provider (for testing or custom providers)
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.getName(), provider);
    console.log(`[AIProviders] Registered provider: ${provider.getName()}`);
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    const entries = Array.from(this.providers.entries());
    for (const [name, provider] of entries) {
      try {
        status[name] = await provider.healthCheck();
      } catch {
        status[name] = false;
      }
    }

    return status;
  }
}

// Export singleton instance
export const aiProviderRegistry = AIProviderRegistry.getInstance();
