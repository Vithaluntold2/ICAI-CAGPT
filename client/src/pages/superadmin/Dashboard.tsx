import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Server,
  Shield,
  Cpu,
  Database,
  Globe,
  GitBranch,
  Bell,
  ArrowRight,
  Zap,
  Users,
  MessageSquare,
  Clock,
  HardDrive,
  MemoryStick,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Bot
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

// API Response Interfaces - matching actual server response
interface SystemMetrics {
  timestamp?: string;
  uptime?: number;
  memory?: { 
    total?: number; 
    used?: number; 
    free?: number; 
    percentage?: number;
  };
  cpu?: { 
    cores?: number; 
    loadAverage?: number[]; 
    percentage?: number;
  };
  health?: {
    overall?: 'healthy' | 'degraded' | 'unhealthy';
    score?: number;
    status?: string;
    components?: {
      database?: { status?: string; message?: string; metrics?: { latency?: number } };
      redis?: { status?: string; message?: string; metrics?: { hitRate?: number } };
      aiProviders?: { status?: string; message?: string; metrics?: { healthyCount?: number; totalCount?: number } };
      jobQueues?: { status?: string; message?: string };
      circuitBreakers?: { status?: string; message?: string };
    };
    database?: { status?: string; latency?: number; connections?: number };
    cache?: { status?: string; hitRate?: number };
    aiProviders?: { healthy?: number; total?: number };
    responseTime?: number;
  };
}

interface PerformanceMetrics {
  cpu?: { percentage?: number; cores?: number; loadAverage?: number[] };
  memory?: { used?: number; total?: number; percentage?: number };
  uptime?: number;
  responseTime?: { avg?: number; p95?: number; p99?: number; min?: number; max?: number };
  requests?: { total?: number; perSecond?: number; errors?: number; errorRate?: number };
  database?: { queryTime?: number; connections?: number; activeQueries?: number };
}

interface AdminKPIs {
  totalUsers?: number;
  totalConversations?: number;
  totalMessages?: number;
  subscriptionCounts?: { tier: string; count: number }[];
  activeUsersLast30Days?: number;
}

interface ThreatStats {
  total?: number;
  active?: number;
  blocked?: number;
  bySeverity?: Record<string, number>;
  byType?: Record<string, number>;
}

interface AlertStats {
  total?: number;
  unacknowledged?: number;
  errors?: number;
  warnings?: number;
  byCategory?: Record<string, number>;
}

interface DeploymentStats {
  totalDeployments?: number;
  successRate?: number;
  avgDuration?: number;
  lastDeployment?: string;
  byEnvironment?: Record<string, number>;
  byStatus?: Record<string, number>;
}

interface IntegrationStats {
  total?: number;
  connected?: number;
  disconnected?: number;
  errors?: number;
  byType?: Record<string, number>;
}

export default function SuperAdminDashboard() {
  // Fetch system health metrics
  const { data: systemData, isLoading: systemLoading, refetch: refetchSystem } = useQuery<{ metrics: SystemMetrics }>({
    queryKey: ["/api/admin/system/health"],
    refetchInterval: 5000,
  });

  // Fetch admin KPIs (users, conversations, etc.)
  const { data: kpisData, isLoading: kpisLoading } = useQuery<AdminKPIs>({
    queryKey: ["/api/admin/kpis"],
    refetchInterval: 30000,
  });

  // Fetch threats
  const { data: threatsData, isLoading: threatsLoading } = useQuery<{ threats: any[]; stats: ThreatStats }>({
    queryKey: ["/api/admin/system/threats"],
    refetchInterval: 5000,
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery<{ alerts: any[]; stats: AlertStats }>({
    queryKey: ["/api/admin/system/alerts"],
    refetchInterval: 5000,
  });

  // Fetch deployments
  const { data: deploymentsData } = useQuery<{ deployments: any[]; stats: any }>({
    queryKey: ["/api/admin/system/deployments"],
    refetchInterval: 30000,
  });

  // Fetch performance metrics
  const { data: performanceData } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/admin/system/performance"],
    refetchInterval: 5000,
  });

  // Fetch integrations
  const { data: integrationsData } = useQuery<{ integrations: any[]; stats: IntegrationStats }>({
    queryKey: ["/api/admin/system/integrations"],
    refetchInterval: 30000,
  });

  // Extract data with null safety
  const metrics = systemData?.metrics || {};
  const kpis = kpisData || {};
  const performance = performanceData || {};
  
  // Safe stats extraction
  const threatStats: ThreatStats = threatsData?.stats || { total: 0, active: 0, blocked: 0, bySeverity: {} };
  const alertStats: AlertStats = alertsData?.stats || { total: 0, unacknowledged: 0, errors: 0, warnings: 0 };
  const deploymentStats: DeploymentStats = deploymentsData?.stats || { totalDeployments: 0, successRate: 100, avgDuration: 0 };
  const integrationStats: IntegrationStats = integrationsData?.stats || { total: 0, connected: 0, errors: 0 };
  
  // Extract health score from nested structure
  const healthScore = metrics?.health?.score || 0;
  
  // CPU and memory with fallbacks from both metrics and performance
  const cpuPercentage = performance?.cpu?.percentage || metrics?.cpu?.percentage || 0;
  const cpuCores = performance?.cpu?.cores || metrics?.cpu?.cores || 0;
  const memoryPercentage = performance?.memory?.percentage || metrics?.memory?.percentage || 0;
  const memoryUsed = performance?.memory?.used || metrics?.memory?.used || 0;
  const memoryTotal = performance?.memory?.total || metrics?.memory?.total || 0;
  const uptime = performance?.uptime || metrics?.uptime || 0;
  
  // AI Provider health
  const aiProvidersHealthy = metrics?.health?.aiProviders?.healthy || 
                             metrics?.health?.components?.aiProviders?.metrics?.healthyCount || 0;
  const aiProvidersTotal = metrics?.health?.aiProviders?.total || 
                           metrics?.health?.components?.aiProviders?.metrics?.totalCount || 0;
  
  // Database and cache health
  const dbLatency = metrics?.health?.database?.latency || 
                    metrics?.health?.components?.database?.metrics?.latency || 0;
  const cacheHitRate = metrics?.health?.cache?.hitRate || 
                       metrics?.health?.components?.redis?.metrics?.hitRate || 0;

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  const quickLinks = [
    { name: "System Health", href: "/superadmin/health", icon: Activity, color: "text-green-500" },
    { name: "Security Threats", href: "/superadmin/threats", icon: Shield, color: "text-red-500", badge: threatStats.active },
    { name: "Deployments", href: "/superadmin/deployments", icon: GitBranch, color: "text-rai-500" },
    { name: "Maintenance", href: "/superadmin/maintenance", icon: Server, color: "text-orange-500" },
    { name: "Alerts", href: "/superadmin/alerts", icon: Bell, color: "text-yellow-500", badge: alertStats.unacknowledged },
    { name: "Performance", href: "/superadmin/performance", icon: Cpu, color: "text-primary" },
    { name: "Integrations", href: "/superadmin/integrations", icon: Globe, color: "text-rai-500", badge: integrationStats.errors },
  ];

  if (systemLoading && kpisLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time system monitoring and management console
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchSystem()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Health Score */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${getHealthColor(healthScore)}`}>
                {healthScore}
              </span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{healthScore >= 70 ? 'System Operational' : 'System Degraded'}</span>
            </p>
          </CardContent>
        </Card>

        {/* CPU Usage */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cpuPercentage.toFixed(1)}%
            </div>
            <Progress 
              value={cpuPercentage} 
              className="mt-2 h-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              {cpuCores} cores available
            </p>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memoryPercentage.toFixed(1)}%
            </div>
            <Progress 
              value={memoryPercentage} 
              className="mt-2 h-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(memoryUsed)} / {formatBytes(memoryTotal)}
            </p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatUptime(uptime)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>Since last restart</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Business & Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{kpis?.activeUsersLast30Days || 0} active (30d)</span>
            </p>
          </CardContent>
        </Card>

        {/* Conversations */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalConversations || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis?.totalMessages || 0} messages total
            </p>
          </CardContent>
        </Card>

        {/* Active Threats */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Threats</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {(threatStats.active || 0) > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <span className="text-2xl font-bold">{threatStats.active || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {threatStats.blocked || 0} blocked today
            </p>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Bell className={(alertStats.unacknowledged || 0) > 0 ? "h-5 w-5 text-yellow-500" : "h-5 w-5 text-green-500"} />
              <span className="text-2xl font-bold">{alertStats.unacknowledged || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {alertStats.errors || 0} errors, {alertStats.warnings || 0} warnings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
          <CardDescription>Navigate to system management sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <Link key={link.name} href={link.href}>
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer hover-elevate">
                  <div className="flex items-center gap-3">
                    <link.icon className={`h-5 w-5 ${link.color}`} />
                    <span className="font-medium">{link.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.badge !== undefined && link.badge > 0 && (
                      <Badge variant="destructive">{link.badge}</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Component Health & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Component Health */}
        <Card>
          <CardHeader>
            <CardTitle>Component Health</CardTitle>
            <CardDescription>Status of core system components</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">
                    {dbLatency}ms latency
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={dbLatency < 100 ? "text-green-500 border-green-500" : "text-yellow-500 border-yellow-500"}>
                {dbLatency < 100 ? 'Healthy' : 'Degraded'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-rai-500" />
                <div>
                  <p className="font-medium">Cache</p>
                  <p className="text-xs text-muted-foreground">
                    {cacheHitRate.toFixed(0)}% hit rate
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={cacheHitRate >= 80 ? "text-green-500 border-green-500" : "text-yellow-500 border-yellow-500"}>
                {cacheHitRate >= 80 ? 'Healthy' : 'Degraded'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">AI Providers</p>
                  <p className="text-xs text-muted-foreground">
                    {aiProvidersHealthy}/{aiProvidersTotal || 1} healthy
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={aiProvidersHealthy === (aiProvidersTotal || 1) ? "text-green-500 border-green-500" : "text-yellow-500 border-yellow-500"}>
                {aiProvidersHealthy === (aiProvidersTotal || 1) ? 'All Healthy' : 'Degraded'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-rai-500" />
                <div>
                  <p className="font-medium">Integrations</p>
                  <p className="text-xs text-muted-foreground">
                    {integrationStats.connected || 0}/{integrationStats.total || 0} connected
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={(integrationStats.errors || 0) === 0 ? "text-green-500 border-green-500" : "text-red-500 border-red-500"}>
                {(integrationStats.errors || 0) === 0 ? 'All Good' : `${integrationStats.errors} Errors`}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
            <CardDescription>User breakdown by plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(kpis?.subscriptionCounts || []).map((sub) => (
              <div key={sub.tier} className="flex items-center justify-between">
                <span className="capitalize">{sub.tier}</span>
                <div className="flex items-center gap-3">
                  <Progress 
                    value={(sub.count / (kpis?.totalUsers || 1)) * 100} 
                    className="w-24 h-2" 
                  />
                  <span className="font-medium w-12 text-right">{sub.count}</span>
                </div>
              </div>
            ))}
            {(!kpis?.subscriptionCounts || kpis.subscriptionCounts.length === 0) && (
              <p className="text-muted-foreground text-center py-4">No subscription data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deployment & Performance Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deployment Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment Statistics</CardTitle>
            <CardDescription>Recent deployment metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{deploymentStats.totalDeployments || 0}</div>
                <div className="text-sm text-muted-foreground">Total Deployments</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className={`text-2xl font-bold ${(deploymentStats.successRate || 100) >= 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                  {deploymentStats.successRate || 100}%
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-rai-500">{deploymentStats.avgDuration || 0}s</div>
                <div className="text-sm text-muted-foreground">Avg Duration</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">
                  {deploymentStats.lastDeployment 
                    ? format(new Date(deploymentStats.lastDeployment), 'MMM d, HH:mm')
                    : 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">Last Deploy</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Response time and request stats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-xl font-bold text-green-500">
                  {(performance?.responseTime?.avg || 0).toFixed(0)}ms
                </div>
                <div className="text-xs text-muted-foreground">Avg Response</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-xl font-bold text-yellow-500">
                  {(performance?.responseTime?.p95 || 0).toFixed(0)}ms
                </div>
                <div className="text-xs text-muted-foreground">p95</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-xl font-bold text-orange-500">
                  {(performance?.responseTime?.p99 || 0).toFixed(0)}ms
                </div>
                <div className="text-xs text-muted-foreground">p99</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-xl font-bold">
                  {(performance?.requests?.total || 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Total Requests</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-xl font-bold text-rai-500">
                  {(performance?.requests?.perSecond || 0).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Req/sec</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className={`text-xl font-bold ${(performance?.requests?.errors || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {performance?.requests?.errors || 0}
                </div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
