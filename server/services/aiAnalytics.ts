import { aiProviderRegistry } from "./aiProviders/registry";
import { AIProviderName } from "./aiProviders/types";
import { providerHealthMonitor } from "./aiProviders/healthMonitor";
import type { Message } from "@shared/schema";

/**
 * Clean JSON response from AI that may be wrapped in markdown code blocks
 * Handles: ```json ... ```, ``` ... ```, or raw JSON
 */
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();
  // Remove markdown code fences (```json or ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

/**
 * Safely parse JSON from AI response, handling markdown code blocks
 */
function safeParseJson<T>(content: string, defaultValue: T): T {
  try {
    const cleaned = cleanJsonResponse(content);
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn('[AIAnalytics] Failed to parse JSON, using default:', error);
    return defaultValue;
  }
}

// Provider fallback order for analytics - Azure OpenAI only for now
const ANALYTICS_PROVIDER_FALLBACKS: AIProviderName[] = [
  AIProviderName.AZURE_OPENAI
];

// Provider fallback order for deep reasoning tasks - Azure OpenAI only for now
const REASONING_PROVIDER_FALLBACKS: AIProviderName[] = [
  AIProviderName.AZURE_OPENAI
];

/**
 * AI Analytics Service
 * 
 * Provides sentiment analysis, quality assessment, and behavioral insights
 * using existing AI providers (OpenAI, Claude, Gemini, Perplexity)
 */

export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'satisfied';
  sentimentScore: number; // -100 to 100
  emotionalTone: {
    anger?: number;
    joy?: number;
    sadness?: number;
    fear?: number;
    surprise?: number;
    frustration?: number;
    satisfaction?: number;
  };
  intent: string; // 'question', 'clarification', 'complaint', 'appreciation', etc.
  intentConfidence: number; // 0-100
}

export interface QualityAssessmentResult {
  responseQuality: number; // 0-100
  accuracyScore: number; // 0-100
  helpfulnessScore: number; // 0-100
  relevanceScore: number; // 0-100
  clarityScore: number; // 0-100
  completenessScore: number; // 0-100
  technicalComplexity: 'simple' | 'moderate' | 'advanced';
  containsCalculations: boolean;
  containsCitations: boolean;
}

export interface ConversationInsights {
  qualityScore: number; // 0-100
  complexityLevel: 'simple' | 'moderate' | 'complex' | 'expert';
  topicsDiscussed: string[];
  domainCategories: string[];
  followUpQuestionCount: number;
  clarificationRequestCount: number;
  userFrustrationDetected: boolean;
  resolutionAchieved: boolean;
}

export interface BehaviorPrediction {
  churnRisk: 'low' | 'medium' | 'high';
  churnRiskScore: number; // 0-100
  nextLikelyTopic: string;
  nextLikelyQuestion: string;
  predictedReturnDate: Date | null;
  engagementScore: number; // 0-100
  potentialUpsellCandidate: boolean;
}

export class AIAnalyticsService {
  
  /**
   * Get the best available provider for analytics tasks
   * Uses health monitoring to avoid rate-limited providers
   */
  private static getBestAnalyticsProvider(
    fallbackOrder: AIProviderName[] = ANALYTICS_PROVIDER_FALLBACKS
  ): { provider: ReturnType<typeof aiProviderRegistry.getProvider>; name: AIProviderName } | null {
    // Filter to only available providers
    const availableProviders = fallbackOrder.filter(name => 
      aiProviderRegistry.hasProvider(name)
    );
    
    if (availableProviders.length === 0) {
      return null;
    }
    
    // Get the healthiest available provider
    const healthyProviders = providerHealthMonitor.getHealthyProviders(availableProviders);
    
    if (healthyProviders.length > 0) {
      const bestName = healthyProviders[0];
      try {
        return { provider: aiProviderRegistry.getProvider(bestName), name: bestName };
      } catch {
        // Fall through to try others
      }
    }
    
    // Fallback: try each provider in order
    for (const name of availableProviders) {
      try {
        const provider = aiProviderRegistry.getProvider(name);
        return { provider, name };
      } catch {
        continue;
      }
    }
    
    return null;
  }
  
  /**
   * Timeout wrapper for AI calls with fallback to heuristics
   */
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]).catch(() => fallback);
  }

  /**
   * Simple heuristic-based sentiment analysis (fallback)
   */
  private static analyzeSentimentHeuristic(message: string): SentimentAnalysisResult {
    const lowerMessage = message.toLowerCase();
    
    // Frustration keywords
    const frustrationWords = ['frustrated', 'annoying', 'terrible', 'awful', 'hate', 'worst', 'useless'];
    const hasFrustration = frustrationWords.some(word => lowerMessage.includes(word));
    
    // Positive keywords
    const positiveWords = ['thank', 'great', 'perfect', 'excellent', 'helpful', 'appreciate'];
    const hasPositive = positiveWords.some(word => lowerMessage.includes(word));
    
    // Negative keywords
    const negativeWords = ['wrong', 'error', 'problem', 'issue', 'fail', 'broken'];
    const hasNegative = negativeWords.some(word => lowerMessage.includes(word));
    
    // Question indicators
    const hasQuestion = lowerMessage.includes('?') || 
                       lowerMessage.startsWith('what') || 
                       lowerMessage.startsWith('how') ||
                       lowerMessage.startsWith('can you');
    
    let sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'satisfied' = 'neutral';
    let sentimentScore = 0;
    
    if (hasFrustration) {
      sentiment = 'frustrated';
      sentimentScore = -80;
    } else if (hasPositive) {
      sentiment = 'satisfied';
      sentimentScore = 70;
    } else if (hasNegative) {
      sentiment = 'negative';
      sentimentScore = -50;
    }
    
    return {
      sentiment,
      sentimentScore,
      emotionalTone: {},
      intent: hasQuestion ? 'question' : 'other',
      intentConfidence: 40 // Low confidence for heuristics
    };
  }
  
  /**
   * Analyze sentiment of a user message (with timeout and fallback)
   */
  static async analyzeSentiment(message: string): Promise<SentimentAnalysisResult> {
    try {
      // Use health-aware provider selection for cost-effective sentiment analysis
      const providerInfo = this.getBestAnalyticsProvider();
      if (!providerInfo) {
        console.warn('[AIAnalytics] No analytics providers available, using heuristics');
        return this.analyzeSentimentHeuristic(message);
      }
      const { provider } = providerInfo;
      
      const prompt = `Analyze the sentiment and intent of this message from a user asking accounting questions.
      
User message: "${message}"

Respond with a JSON object containing:
1. sentiment: one of 'positive', 'neutral', 'negative', 'frustrated', 'satisfied'
2. sentimentScore: number from -100 (very negative) to 100 (very positive)
3. emotionalTone: object with scores 0-1 for anger, joy, sadness, fear, surprise, frustration, satisfaction
4. intent: classify as 'question', 'clarification', 'complaint', 'appreciation', 'follow_up', 'confirmation', 'other'
5. intentConfidence: 0-100 confidence in intent classification

Only respond with valid JSON, no additional text.`;

      const aiAnalysis = provider.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500
      }).then(response => {
        const result = safeParseJson(response.content, {} as Record<string, unknown>);
        return {
          sentiment: (result.sentiment as 'positive' | 'negative' | 'neutral' | 'frustrated' | 'satisfied') || 'neutral',
          sentimentScore: (result.sentimentScore as number) || 50,
          emotionalTone: (result.emotionalTone as any) || {},
          intent: (result.intent as string) || 'inquiry',
          intentConfidence: (result.intentConfidence as number) || 50
        };
      });

      // 3 second timeout - fallback to heuristics if too slow
      return await this.withTimeout(
        aiAnalysis,
        3000,
        this.analyzeSentimentHeuristic(message)
      );
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      // Fallback to heuristics
      return this.analyzeSentimentHeuristic(message);
    }
  }

  /**
   * Assess quality of an AI response
   */
  static async assessResponseQuality(
    userQuestion: string,
    aiResponse: string
  ): Promise<QualityAssessmentResult> {
    try {
      // Use health-aware provider selection for cost-effective quality assessment
      const providerInfo = this.getBestAnalyticsProvider();
      if (!providerInfo) {
        console.warn('[AIAnalytics] No analytics providers available for quality assessment');
        return this.getDefaultQualityResult();
      }
      const { provider, name: providerName } = providerInfo;
      
      const prompt = `Evaluate the quality of this AI response to an accounting question.

User Question: "${userQuestion}"

AI Response: "${aiResponse}"

Respond with a JSON object containing:
1. responseQuality: overall quality score 0-100
2. accuracyScore: how accurate/correct the response is 0-100
3. helpfulnessScore: how helpful for the user 0-100
4. relevanceScore: how relevant to the question 0-100
5. clarityScore: how clear and understandable 0-100
6. completenessScore: how complete/thorough 0-100
7. technicalComplexity: 'simple', 'moderate', or 'advanced'
8. containsCalculations: boolean - does it include calculations?
9. containsCitations: boolean - does it reference sources/laws/regulations?

Only respond with valid JSON, no additional text.`;

      const response = await provider.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500
      });

      // Record success for health monitoring
      providerHealthMonitor.recordSuccess(providerName);

      const result = safeParseJson(response.content, {} as Record<string, unknown>);
      
      return {
        responseQuality: (result.responseQuality as number) || 50,
        accuracyScore: (result.accuracyScore as number) || 50,
        helpfulnessScore: (result.helpfulnessScore as number) || 50,
        relevanceScore: (result.relevanceScore as number) || 50,
        clarityScore: (result.clarityScore as number) || 50,
        completenessScore: (result.completenessScore as number) || 50,
        technicalComplexity: (result.technicalComplexity as 'simple' | 'moderate' | 'advanced') || 'moderate',
        containsCalculations: (result.containsCalculations as boolean) || false,
        containsCitations: (result.containsCitations as boolean) || false
      };
    } catch (error: unknown) {
      // Record failure for health monitoring if we have provider info
      const errorObj = error as { code?: string; message?: string };
      console.error('Quality assessment error:', errorObj.message || error);
      
      // If rate limited, record the failure so health monitor avoids this provider
      if (errorObj.code === 'RATE_LIMIT_EXCEEDED') {
        console.warn('[AIAnalytics] Provider rate limited, will try alternative on next request');
      }
      
      // Return moderate defaults if assessment fails
      return this.getDefaultQualityResult();
    }
  }

  /**
   * Get default quality result when assessment fails or no provider available
   */
  private static getDefaultQualityResult(): QualityAssessmentResult {
    return {
      responseQuality: 50,
      accuracyScore: 50,
      helpfulnessScore: 50,
      relevanceScore: 50,
      clarityScore: 50,
      completenessScore: 50,
      technicalComplexity: 'moderate',
      containsCalculations: false,
      containsCitations: false
    };
  }

  /**
   * Analyze entire conversation to extract insights
   */
  static async analyzeConversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<ConversationInsights> {
    try {
      // Use health-aware provider selection (prefer Claude for deep reasoning)
      const providerInfo = this.getBestAnalyticsProvider(REASONING_PROVIDER_FALLBACKS);
      if (!providerInfo) {
        console.warn('[AIAnalytics] No providers available for conversation analysis');
        return this.getDefaultConversationInsights();
      }
      const { provider } = providerInfo;
      
      const conversationText = messages.map((m, i) => 
        `${i + 1}. ${m.role.toUpperCase()}: ${m.content}`
      ).join('\n\n');

      const prompt = `Analyze this accounting conversation between a user and AI assistant.

Conversation:
${conversationText}

Respond with a JSON object containing:
1. qualityScore: overall conversation quality 0-100
2. complexityLevel: 'simple', 'moderate', 'complex', or 'expert'
3. topicsDiscussed: array of specific topics covered (e.g., ["LLC formation", "depreciation"])
4. domainCategories: array of accounting domains (e.g., ["tax", "compliance", "audit"])
5. followUpQuestionCount: number of follow-up questions user asked
6. clarificationRequestCount: number of times user asked for clarification
7. userFrustrationDetected: boolean - did user seem frustrated?
8. resolutionAchieved: boolean - was the user's question fully resolved?

Only respond with valid JSON, no additional text.`;

      const response = await provider.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 800
      });

      const result = safeParseJson(response.content, {} as Record<string, unknown>);
      
      return {
        qualityScore: (result.qualityScore as number) || 50,
        complexityLevel: (result.complexityLevel as 'simple' | 'moderate' | 'complex' | 'expert') || 'moderate',
        topicsDiscussed: (result.topicsDiscussed as string[]) || [],
        domainCategories: (result.domainCategories as string[]) || [],
        followUpQuestionCount: (result.followUpQuestionCount as number) || 0,
        clarificationRequestCount: (result.clarificationRequestCount as number) || 0,
        userFrustrationDetected: (result.userFrustrationDetected as boolean) || false,
        resolutionAchieved: (result.resolutionAchieved as boolean) || false
      };
    } catch (error) {
      console.error('Conversation analysis error:', error);
      return this.getDefaultConversationInsights();
    }
  }

  /**
   * Get default conversation insights when analysis fails
   */
  private static getDefaultConversationInsights(): ConversationInsights {
    return {
      qualityScore: 50,
      complexityLevel: 'moderate',
      topicsDiscussed: [],
      domainCategories: [],
      followUpQuestionCount: 0,
      clarificationRequestCount: 0,
      userFrustrationDetected: false,
      resolutionAchieved: false
    };
  }

  /**
   * Predict user behavior based on historical patterns
   */
  static async predictUserBehavior(
    userHistory: {
      totalConversations: number;
      averageQualityScore: number;
      frustrationFrequency: number;
      abandonmentRate: number;
      topTopics: Array<{ topic: string; count: number }>;
      recentSentiment: string[];
    }
  ): Promise<BehaviorPrediction> {
    try {
      // Use health-aware provider selection (prefer Claude for behavioral analysis)
      const providerInfo = this.getBestAnalyticsProvider(REASONING_PROVIDER_FALLBACKS);
      if (!providerInfo) {
        console.warn('[AIAnalytics] No providers available for behavior prediction');
        return this.getDefaultBehaviorPrediction();
      }
      const { provider } = providerInfo;
      
      const prompt = `Analyze this user's behavior pattern and predict future behavior.

User Statistics:
- Total Conversations: ${userHistory.totalConversations}
- Average Quality Score: ${userHistory.averageQualityScore}/100
- Frustration Frequency: ${userHistory.frustrationFrequency}
- Abandonment Rate: ${userHistory.abandonmentRate}%
- Top Topics: ${JSON.stringify(userHistory.topTopics)}
- Recent Sentiment Trend: ${JSON.stringify(userHistory.recentSentiment)}

Respond with a JSON object containing:
1. churnRisk: 'low', 'medium', or 'high' - likelihood user will stop using the service
2. churnRiskScore: 0-100 numeric score
3. nextLikelyTopic: predicted next topic user will ask about
4. nextLikelyQuestion: predicted next question
5. predictedReturnDate: ISO date string when user likely to return (or null)
6. engagementScore: 0-100 how engaged is this user
7. potentialUpsellCandidate: boolean - good candidate for premium features?

Consider:
- High frustration + high abandonment = high churn risk
- Consistent engagement + diverse topics = good upsell candidate
- Quality score trends indicate satisfaction
- Topic patterns suggest expertise level

Only respond with valid JSON, no additional text.`;

      const response = await provider.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 600
      });

      const result = safeParseJson(response.content, {} as Record<string, unknown>);
      
      return {
        churnRisk: (result.churnRisk as 'low' | 'medium' | 'high') || 'medium',
        churnRiskScore: (result.churnRiskScore as number) || 50,
        nextLikelyTopic: (result.nextLikelyTopic as string) || 'General accounting',
        nextLikelyQuestion: (result.nextLikelyQuestion as string) || 'Follow-up question',
        predictedReturnDate: result.predictedReturnDate ? new Date(result.predictedReturnDate as string) : null,
        engagementScore: (result.engagementScore as number) || 50,
        potentialUpsellCandidate: (result.potentialUpsellCandidate as boolean) || false
      };
    } catch (error) {
      console.error('Behavior prediction error:', error);
      return this.getDefaultBehaviorPrediction();
    }
  }

  /**
   * Get default behavior prediction when analysis fails
   */
  private static getDefaultBehaviorPrediction(): BehaviorPrediction {
    return {
      churnRisk: 'medium',
      churnRiskScore: 50,
      nextLikelyTopic: 'General accounting',
      nextLikelyQuestion: 'Follow-up question',
      predictedReturnDate: null,
      engagementScore: 50,
      potentialUpsellCandidate: false
    };
  }

  /**
   * Batch analyze multiple messages efficiently
   */
  static async batchAnalyzeSentiment(messages: string[]): Promise<SentimentAnalysisResult[]> {
    // Process in parallel for efficiency
    const results = await Promise.allSettled(
      messages.map(msg => this.analyzeSentiment(msg))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        sentiment: 'neutral',
        sentimentScore: 0,
        emotionalTone: {},
        intent: 'question',
        intentConfidence: 0
      } as SentimentAnalysisResult
    );
  }
}
