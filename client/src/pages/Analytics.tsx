import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { TrendingUp, MessageSquare, Target, BarChart3, Brain, AlertTriangle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface AnalyticsData {
  behavior: {
    totalConversations: number;
    averageConversationLength: number;
    averageSessionDuration: number;
    topTopics: Array<{ topic: string; count: number }>;
    averageQualityScore: number | null;
    satisfactionTrend: 'improving' | 'declining' | 'stable';
    churnRisk: 'low' | 'medium' | 'high';
    churnRiskScore: number;
    frustrationFrequency: number;
    abandonmentRate: number;
    nextLikelyTopic: string;
    engagementScore: number;
    potentialUpsellCandidate: boolean;
  } | null;
  conversations: Array<{
    id: string;
    qualityScore: number | null;
    totalMessages: number;
    createdAt: string;
    topicsDiscussed: string[] | null;
    wasAbandoned: boolean;
  }>;
  sentimentTrends: Array<{
    date: string;
    averageSentimentScore: number | null;
    positiveMessageCount: number;
    neutralMessageCount: number;
    negativeMessageCount: number;
    frustratedMessageCount: number;
    averageQualityScore: number | null;
  }>;
  messageStats: Array<{
    userSentiment: string | null;
    responseQuality: number | null;
    createdAt: string;
  }>;
  summary: {
    totalConversations: number;
    averageQualityScore: number | null;
    topTopics: Array<{ topic: string; count: number }>;
  };
  userFeedback?: {
    resolvedCount: number;
    resolutionRate: number;
    ratingDistribution: Array<{ rating: number; count: number }>;
    averageUserRating: string | null;
    totalRated: number;
    totalConversations: number;
  };
}

export default function Analytics() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data, isLoading: isDataLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!isAuthLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isAuthLoading, setLocation]);

  // Show loading state while auth is being determined
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Analytics Data</CardTitle>
            <CardDescription>
              Start using CA GPT to generate analytics insights about your conversations and usage patterns.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { behavior, conversations, sentimentTrends, summary } = data;

  // Prepare sentiment trend chart data
  const sentimentChartData = sentimentTrends
    .slice()
    .reverse()
    .map(trend => ({
      date: format(new Date(trend.date), 'MMM d'),
      sentiment: trend.averageSentimentScore || 0,
      quality: trend.averageQualityScore || 0,
      positive: trend.positiveMessageCount,
      negative: trend.negativeMessageCount + trend.frustratedMessageCount,
    }));

  // Prepare quality trend chart data
  const qualityChartData = conversations
    .filter(c => c.qualityScore !== null)
    .slice()
    .reverse()
    .slice(-15)
    .map((conv, idx) => ({
      conversation: `#${idx + 1}`,
      quality: conv.qualityScore || 0,
      messages: conv.totalMessages,
    }));

  // Prepare topics bar chart data
  const topicsChartData = summary.topTopics.slice(0, 8);

  const getChurnRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getSatisfactionTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Navigation */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/chat")}
              data-testid="button-back-to-chat"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Insights about your conversations and usage patterns
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-conversations">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-conversation-count">
                {summary.totalConversations}
              </div>
              {behavior && (
                <p className="text-xs text-muted-foreground">
                  Avg {behavior.averageConversationLength} messages per conversation
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-quality-score">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-quality-score">
                {summary.averageQualityScore || 'N/A'}
                {summary.averageQualityScore && '/100'}
              </div>
              {behavior && (
                <p className="text-xs text-muted-foreground">
                  {getSatisfactionTrendIcon(behavior.satisfactionTrend)} {behavior.satisfactionTrend}
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-engagement">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-engagement-score">
                {behavior?.engagementScore || 'N/A'}
                {behavior?.engagementScore && '/100'}
              </div>
              {behavior && (
                <p className="text-xs text-muted-foreground">
                  Avg {behavior.averageSessionDuration} min per session
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-churn-risk">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retention Status</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold capitalize ${behavior ? getChurnRiskColor(behavior.churnRisk) : ''}`} data-testid="text-churn-risk">
                {behavior?.churnRisk || 'Unknown'}
              </div>
              {behavior && (
                <p className="text-xs text-muted-foreground">
                  Risk score: {behavior.churnRiskScore}/100
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Feedback Metrics */}
        {data?.userFeedback && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-resolution-rate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolution Rate (All-Time)</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-resolution-rate">
                  {data.userFeedback.totalConversations > 0 ? `${data.userFeedback.resolutionRate}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.userFeedback.resolvedCount} of {data.userFeedback.totalConversations} conversations resolved
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-user-rating">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Rating (All-Time)</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-user-rating">
                  {data.userFeedback.totalRated > 0 && data.userFeedback.averageUserRating 
                    ? `${data.userFeedback.averageUserRating} / 5.0`
                    : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {data.userFeedback.totalRated} rated conversations
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quality Trend Chart */}
          <Card data-testid="card-quality-trend">
            <CardHeader>
              <CardTitle>Quality Score Trend</CardTitle>
              <CardDescription>Conversation quality over your recent sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {qualityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={qualityChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="conversation" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="quality" stroke="#8b5cf6" strokeWidth={2} name="Quality Score" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No quality data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sentiment Trend Chart */}
          <Card data-testid="card-sentiment-trend">
            <CardHeader>
              <CardTitle>Sentiment Trend</CardTitle>
              <CardDescription>Your sentiment and quality patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              {sentimentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={sentimentChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[-100, 100]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="sentiment" stroke="#10b981" strokeWidth={2} name="Sentiment" />
                    <Line type="monotone" dataKey="quality" stroke="#d946ef" strokeWidth={2} name="Quality" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No sentiment data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Topics Bar Chart */}
          <Card data-testid="card-topics">
            <CardHeader>
              <CardTitle>Top Discussion Topics</CardTitle>
              <CardDescription>Most frequently discussed accounting topics</CardDescription>
            </CardHeader>
            <CardContent>
              {topicsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topicsChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="topic" type="category" width={120} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="count" fill="#D946EF" name="Conversations" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No topic data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Behavior Insights */}
          <Card data-testid="card-insights">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Powered Insights
              </CardTitle>
              <CardDescription>Personalized recommendations and predictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {behavior ? (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Next Likely Topic</h4>
                    <Badge variant="secondary" data-testid="badge-next-topic">{behavior.nextLikelyTopic}</Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">Usage Patterns</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li data-testid="text-abandonment-rate">Abandonment rate: {behavior.abandonmentRate}%</li>
                      <li data-testid="text-frustration-frequency">Frustration events: {behavior.frustrationFrequency}</li>
                    </ul>
                  </div>

                  {behavior.potentialUpsellCandidate && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <h4 className="text-sm font-semibold mb-1">Pro Tip</h4>
                      <p className="text-sm text-muted-foreground">
                        Your usage patterns suggest you might benefit from premium features! Upgrade for unlimited queries and advanced tools.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Continue using CA GPT to generate personalized insights and recommendations
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
