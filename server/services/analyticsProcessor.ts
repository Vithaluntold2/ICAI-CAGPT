import { AIAnalyticsService } from "./aiAnalytics";
import { db } from "../db";
import { 
  conversationAnalytics, 
  messageAnalytics, 
  userBehaviorPatterns,
  sentimentTrends,
  messages,
  conversations
} from "@shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

/**
 * Analytics Processor Service
 * 
 * Handles background processing of analytics data, including:
 * - Real-time message sentiment analysis
 * - Conversation quality assessment
 * - User behavior pattern updates
 * - Sentiment trend aggregation
 */

export class AnalyticsProcessor {
  
  /**
   * Process analytics for a new message (real-time)
   */
  static async processMessage(params: {
    messageId: string;
    conversationId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<void> {
    try {
      const { messageId, conversationId, userId, role, content, previousMessages = [] } = params;

      // Analyze user messages for sentiment
      if (role === 'user') {
        const sentimentResult = await AIAnalyticsService.analyzeSentiment(content);
        
        await db.insert(messageAnalytics).values({
          messageId,
          conversationId,
          userId,
          userSentiment: sentimentResult.sentiment,
          sentimentScore: sentimentResult.sentimentScore,
          emotionalTone: sentimentResult.emotionalTone as any,
          userIntent: sentimentResult.intent,
          intentConfidence: sentimentResult.intentConfidence,
          responseLength: content.length,
        });

        console.log(`[Analytics] Sentiment analyzed for message ${messageId}:`, sentimentResult.sentiment);
      }

      // Analyze assistant messages for quality
      if (role === 'assistant' && previousMessages.length > 0) {
        const lastUserMessage = previousMessages.filter(m => m.role === 'user').pop();
        
        if (lastUserMessage) {
          const qualityResult = await AIAnalyticsService.assessResponseQuality(
            lastUserMessage.content,
            content
          );

          // Insert analytics row for assistant message with quality assessment
          await db.insert(messageAnalytics).values({
            messageId,
            conversationId,
            userId,
            responseQuality: qualityResult.responseQuality,
            accuracyScore: qualityResult.accuracyScore,
            helpfulnessScore: qualityResult.helpfulnessScore,
            technicalComplexity: qualityResult.technicalComplexity,
            containsCalculations: qualityResult.containsCalculations,
            containsCitations: qualityResult.containsCitations,
            responseLength: content.length,
          });

          console.log(`[Analytics] Quality assessed for message ${messageId}: ${qualityResult.responseQuality}/100`);
        }
      }
    } catch (error) {
      console.error('[Analytics] Error processing message analytics:', error);
      // Don't throw - analytics shouldn't break the main flow
    }
  }

  /**
   * Analyze entire conversation (when conversation ends or periodically)
   */
  static async analyzeConversation(conversationId: string): Promise<void> {
    try {
      // Fetch conversation info first to get userId
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!conversation) return;
      
      const userId = conversation.userId;

      // Fetch all messages in conversation
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);

      if (conversationMessages.length === 0) {
        return;
      }

      // Analyze conversation insights
      const messageHistory = conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const insights = await AIAnalyticsService.analyzeConversation(messageHistory);

      // Calculate metrics
      const totalMessages = conversationMessages.length;
      const userMessages = conversationMessages.filter(m => m.role === 'user');
      const assistantMessages = conversationMessages.filter(m => m.role === 'assistant');

      // Calculate engagement metrics using message counts
      const userEngagement = userMessages.length / totalMessages;
      const averageUserMessageLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / (userMessages.length || 1);
      const averageAssistantMessageLength = assistantMessages.reduce((sum, msg) => sum + msg.content.length, 0) / (assistantMessages.length || 1);

      console.log(`[Analytics] Conversation engagement: ${Math.round(userEngagement * 100)}% user messages, avg lengths: user=${Math.round(averageUserMessageLength)}, assistant=${Math.round(averageAssistantMessageLength)}`);

      const conversationDuration = conversationMessages.length > 1
        ? Math.floor(
            (new Date(conversationMessages[conversationMessages.length - 1].createdAt).getTime() -
              new Date(conversationMessages[0].createdAt).getTime()) / 1000
          )
        : 0;

      // Check if conversation was abandoned (user sent last message and no response)
      const wasAbandoned = conversationMessages[conversationMessages.length - 1]?.role === 'user';

      // Get message analytics for quality scores
      const msgAnalytics = await db
        .select()
        .from(messageAnalytics)
        .where(eq(messageAnalytics.conversationId, conversationId));

      const qualityScores = msgAnalytics
        .filter(m => m.responseQuality !== null)
        .map(m => m.responseQuality || 0);

      const averageQuality = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
        : null;

      // Insert or update conversation analytics
      const existing = await db
        .select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.conversationId, conversationId))
        .limit(1);

      const analyticsData = {
        conversationId,
        userId: conversation.userId,
        qualityScore: insights.qualityScore,
        responseRelevanceScore: averageQuality,
        completenessScore: insights.qualityScore,
        clarityScore: averageQuality,
        totalMessages,
        conversationDuration,
        wasAbandoned,
        abandonmentPoint: wasAbandoned ? totalMessages : null,
        followUpQuestionCount: insights.followUpQuestionCount,
        clarificationRequestCount: insights.clarificationRequestCount,
        userFrustrationDetected: insights.userFrustrationDetected,
        resolutionAchieved: insights.resolutionAchieved,
        topicsDiscussed: insights.topicsDiscussed as any,
        domainCategories: insights.domainCategories as any,
        complexityLevel: insights.complexityLevel,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(conversationAnalytics)
          .set(analyticsData)
          .where(eq(conversationAnalytics.conversationId, conversationId));
      } else {
        await db.insert(conversationAnalytics).values(analyticsData);
      }

      console.log(`[Analytics] Conversation ${conversationId} analyzed: quality=${insights.qualityScore}/100`);
    } catch (error) {
      console.error('[Analytics] Error analyzing conversation:', error);
    }
  }

  /**
   * Update user behavior patterns (run periodically)
   */
  static async updateUserBehaviorPatterns(userId: string): Promise<void> {
    try {
      // Get all conversation analytics for user
      const userConversations = await db
        .select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.userId, userId));

      if (userConversations.length === 0) {
        return;
      }

      // Calculate aggregate metrics
      const totalConversations = userConversations.length;
      const avgConversationLength = Math.round(
        userConversations.reduce((sum, c) => sum + c.totalMessages, 0) / totalConversations
      );
      const avgSessionDuration = Math.round(
        userConversations.reduce((sum, c) => sum + (c.conversationDuration || 0), 0) / totalConversations / 60
      );

      const qualityScores = userConversations
        .filter(c => c.qualityScore !== null)
        .map(c => c.qualityScore || 0);
      const avgQualityScore = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length)
        : null;

      const abandonmentRate = Math.round(
        (userConversations.filter(c => c.wasAbandoned).length / totalConversations) * 100
      );

      const frustrationFrequency = userConversations.filter(c => c.userFrustrationDetected).length;

      // Extract topics
      const allTopics: string[] = [];
      const allDomains: string[] = [];
      
      userConversations.forEach(c => {
        if (c.topicsDiscussed) {
          allTopics.push(...(c.topicsDiscussed as string[]));
        }
        if (c.domainCategories) {
          allDomains.push(...(c.domainCategories as string[]));
        }
      });

      // Count topic frequency
      const topicCounts = new Map<string, number>();
      allTopics.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });

      const topTopics = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get recent sentiment
      const recentMessages = await db
        .select()
        .from(messageAnalytics)
        .where(and(
          eq(messageAnalytics.userId, userId),
          sql`${messageAnalytics.userSentiment} IS NOT NULL`
        ))
        .orderBy(desc(messageAnalytics.createdAt))
        .limit(10);

      const recentSentiment = recentMessages
        .map(m => m.userSentiment)
        .filter((s): s is string => s !== null);

      // Predict behavior
      const prediction = await AIAnalyticsService.predictUserBehavior({
        totalConversations,
        averageQualityScore: avgQualityScore || 50,
        frustrationFrequency,
        abandonmentRate,
        topTopics,
        recentSentiment,
      });

      // Determine satisfaction trend
      let satisfactionTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (qualityScores.length >= 3) {
        const recent = qualityScores.slice(-3);
        const earlier = qualityScores.slice(0, Math.max(1, qualityScores.length - 3));
        const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
        const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
        
        if (recentAvg > earlierAvg + 10) satisfactionTrend = 'improving';
        else if (recentAvg < earlierAvg - 10) satisfactionTrend = 'declining';
      }

      // Insert or update user behavior patterns
      const existing = await db
        .select()
        .from(userBehaviorPatterns)
        .where(eq(userBehaviorPatterns.userId, userId))
        .limit(1);

      const behaviorData = {
        userId,
        totalConversations,
        averageConversationLength: avgConversationLength,
        averageSessionDuration: avgSessionDuration,
        topTopics: topTopics as any,
        averageQualityScore: avgQualityScore,
        satisfactionTrend,
        churnRisk: prediction.churnRisk,
        churnRiskScore: prediction.churnRiskScore,
        frustrationFrequency,
        abandonmentRate,
        nextLikelyQuestion: prediction.nextLikelyQuestion,
        nextLikelyTopic: prediction.nextLikelyTopic,
        predictedReturnDate: prediction.predictedReturnDate,
        engagementScore: prediction.engagementScore,
        potentialUpsellCandidate: prediction.potentialUpsellCandidate,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(userBehaviorPatterns)
          .set(behaviorData)
          .where(eq(userBehaviorPatterns.userId, userId));
      } else {
        await db.insert(userBehaviorPatterns).values(behaviorData);
      }

      console.log(`[Analytics] User behavior patterns updated for ${userId}: churn risk=${prediction.churnRisk}`);
    } catch (error) {
      console.error('[Analytics] Error updating user behavior patterns:', error);
    }
  }

  /**
   * Aggregate daily sentiment trends (run daily)
   */
  static async aggregateDailySentiment(userId: string, date: Date): Promise<void> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all message analytics for the day
      const dailyMessages = await db
        .select()
        .from(messageAnalytics)
        .where(and(
          eq(messageAnalytics.userId, userId),
          gte(messageAnalytics.createdAt, startOfDay),
          sql`${messageAnalytics.createdAt} <= ${endOfDay}`
        ));

      if (dailyMessages.length === 0) {
        return;
      }

      // Count sentiment types
      const sentimentCounts = {
        positive: dailyMessages.filter(m => m.userSentiment === 'positive' || m.userSentiment === 'satisfied').length,
        neutral: dailyMessages.filter(m => m.userSentiment === 'neutral').length,
        negative: dailyMessages.filter(m => m.userSentiment === 'negative').length,
        frustrated: dailyMessages.filter(m => m.userSentiment === 'frustrated').length,
      };

      const sentimentScores = dailyMessages
        .filter(m => m.sentimentScore !== null)
        .map(m => m.sentimentScore || 0);
      
      const avgSentimentScore = sentimentScores.length > 0
        ? Math.round(sentimentScores.reduce((sum, s) => sum + s, 0) / sentimentScores.length)
        : null;

      const qualityScores = dailyMessages
        .filter(m => m.responseQuality !== null)
        .map(m => m.responseQuality || 0);
      
      const avgQualityScore = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length)
        : null;

      // Get conversation count for the day
      const dailyConversations = await db
        .select()
        .from(conversationAnalytics)
        .where(and(
          eq(conversationAnalytics.userId, userId),
          gte(conversationAnalytics.createdAt, startOfDay),
          sql`${conversationAnalytics.createdAt} <= ${endOfDay}`
        ));

      // Insert or update sentiment trend
      const existing = await db
        .select()
        .from(sentimentTrends)
        .where(and(
          eq(sentimentTrends.userId, userId),
          eq(sentimentTrends.date, startOfDay)
        ))
        .limit(1);

      const trendData = {
        userId,
        date: startOfDay,
        averageSentimentScore: avgSentimentScore,
        positiveMessageCount: sentimentCounts.positive,
        neutralMessageCount: sentimentCounts.neutral,
        negativeMessageCount: sentimentCounts.negative,
        frustratedMessageCount: sentimentCounts.frustrated,
        averageQualityScore: avgQualityScore,
        conversationCount: dailyConversations.length,
      };

      if (existing.length > 0) {
        await db.update(sentimentTrends)
          .set(trendData)
          .where(and(
            eq(sentimentTrends.userId, userId),
            eq(sentimentTrends.date, startOfDay)
          ));
      } else {
        await db.insert(sentimentTrends).values(trendData);
      }

      console.log(`[Analytics] Daily sentiment aggregated for ${userId} on ${date.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('[Analytics] Error aggregating daily sentiment:', error);
    }
  }

  /**
   * Run batch analytics for all users (background job)
   */
  static async runBatchAnalytics(): Promise<void> {
    try {
      console.log('[Analytics] Starting batch analytics processing...');

      // Get all unique user IDs from conversations
      const uniqueUsers = await db
        .selectDistinct({ userId: conversations.userId })
        .from(conversations);

      for (const { userId } of uniqueUsers) {
        await this.updateUserBehaviorPatterns(userId);
        
        // Aggregate yesterday's sentiment
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.aggregateDailySentiment(userId, yesterday);
      }

      console.log(`[Analytics] Batch analytics completed for ${uniqueUsers.length} users`);
    } catch (error) {
      console.error('[Analytics] Error in batch analytics:', error);
    }
  }
}
