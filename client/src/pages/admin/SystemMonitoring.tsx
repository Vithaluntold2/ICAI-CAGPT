import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Server,
  Shield,
  TrendingUp,
  XCircle,
  Cpu,
  HardDrive,
  Zap,
  Globe,
  RefreshCw,
  Bell,
  Calendar,
  GitBranch,
  Eye
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SystemMonitoring() {
  const { toast } = useToast();
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);

  // Fetch system metrics
  const { data: systemData, isLoading: systemLoading, refetch: refetchSystem } = useQuery({
    queryKey: ["/api/admin/system/health"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch threats
  const { data: threatsData, isLoading: threatsLoading } = useQuery({
    queryKey: ["/api/admin/system/threats"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch routes health
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ["/api/admin/system/routes"],
    refetchInterval: 15000,
  });

  // Fetch integrations health
  const { data: integrationsData, isLoading: integrationsLoading } = useQuery({
    queryKey: ["/api/admin/system/integrations"],
    refetchInterval: 30000,
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/admin/system/alerts"],
    refetchInterval: 5000,
  });

  // Fetch maintenance schedules
  const { data: maintenanceData, refetch: refetchMaintenance } = useQuery({
    queryKey: ["/api/admin/system/maintenance"],
    refetchInterval: 30000,
  });

  // Fetch deployment history
  const { data: deploymentsData, refetch: refetchDeployments } = useQuery({
    queryKey: ["/api/admin/system/deployments"],
    refetchInterval: 30000,
  });

  // Fetch performance metrics
  const { data: perfData, isLoading: perfLoading } = useQuery({
    queryKey: ["/api/admin/system/performance"],
    refetchInterval: 10000,
  });

  const metricsRaw = (systemData as any)?.metrics;
  const threats = (threatsData as any)?.threats || [];
  const threatStatsRaw = (threatsData as any)?.stats;
  const routes = (routesData as any)?.routes || [];
  const integrations = (integrationsData as any)?.integrations || [];
  const alerts = (alertsData as any)?.alerts || [];
  const alertStatsRaw = (alertsData as any)?.stats;
  // Maintenance API returns {tasks, health} - map tasks to maintenances format
  const maintenanceTasks = (maintenanceData as any)?.tasks || [];
  const maintenances = maintenanceTasks.map((t: any) => ({
    id: t.id,
    status: t.status,
    reason: t.name || t.description,
    startTime: t.scheduledAt,
    endTime: t.completedAt,
    affectedServices: t.affectedServices || ['system']
  }));
  const maintenanceHealth = (maintenanceData as any)?.health;
  // Deployments API returns {deployments, stats}
  const deployments = (deploymentsData as any)?.deployments || [];
  const deploymentStats = (deploymentsData as any)?.stats;
  // Performance API returns object directly (not wrapped in {performance: ...})
  const performanceRaw = perfData as any;

  // Safe extraction with defaults to prevent null reference errors
  const metrics = {
    uptime: metricsRaw?.uptime || 0,
    cpu: {
      percentage: metricsRaw?.cpu?.percentage || 0,
      cores: metricsRaw?.cpu?.cores || 0,
      loadAverage: metricsRaw?.cpu?.loadAverage || [0, 0, 0],
    },
    memory: {
      total: metricsRaw?.memory?.total || 0,
      used: metricsRaw?.memory?.used || 0,
      free: metricsRaw?.memory?.free || 0,
      percentage: metricsRaw?.memory?.percentage || 0,
    },
    health: {
      overall: metricsRaw?.health?.overall || 'unknown',
      score: metricsRaw?.health?.score || 0,
      components: metricsRaw?.health?.components || {},
    },
  };

  const threatStats = {
    total: threatStatsRaw?.total || 0,
    active: threatStatsRaw?.active || 0,
    blocked: threatStatsRaw?.blocked || 0,
    bySeverity: threatStatsRaw?.bySeverity || {},
    byType: threatStatsRaw?.byType || {},
  };

  const alertStats = {
    total: alertStatsRaw?.total || 0,
    // API returns 'unacknowledged' - map to 'active' for display
    active: alertStatsRaw?.unacknowledged || alertStatsRaw?.active || 0,
    unacknowledged: alertStatsRaw?.unacknowledged || 0,
    errors: alertStatsRaw?.errors || 0,
    warnings: alertStatsRaw?.warnings || 0,
  };

  // Performance API returns: cpu, memory, responseTime, requests, database, uptime
  const performance = {
    avg: performanceRaw?.responseTime?.avg || 0,
    p95: performanceRaw?.responseTime?.p95 || 0,
    p99: performanceRaw?.responseTime?.p99 || 0,
    count: performanceRaw?.requests?.total || 0,
    cpu: performanceRaw?.cpu || { percentage: 0, cores: 0, loadAverage: [0, 0, 0] },
    memory: performanceRaw?.memory || { used: 0, total: 0, percentage: 0 },
    database: performanceRaw?.database || { queryTime: 0, connections: 0, activeQueries: 0 },
    uptime: performanceRaw?.uptime || 0,
  };

  // Helper function to format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "unhealthy":
      case "error":
      case "disconnected":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "unhealthy":
      case "error":
      case "disconnected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-rai-500/10 text-rai-500",
      medium: "bg-yellow-500/10 text-yellow-500",
      high: "bg-orange-500/10 text-orange-500",
      critical: "bg-red-500/10 text-red-500",
    };
    return (
      <Badge className={colors[severity as keyof typeof colors] || "bg-gray-500/10"}>
        {severity}
      </Badge>
    );
  };

  const scheduleMaintenanceWindow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch("/api/admin/system/maintenance/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
          reason: formData.get("reason"),
          affectedServices: (formData.get("affectedServices") as string).split(",").map(s => s.trim()),
        }),
      });

      if (response.ok) {
        toast({ title: "Maintenance scheduled successfully" });
        setMaintenanceDialogOpen(false);
        refetchMaintenance();
      }
    } catch (error) {
      toast({ title: "Failed to schedule maintenance", variant: "destructive" });
    }
  };

  const startDeployment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch("/api/admin/system/deployments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: formData.get("version"),
          changes: (formData.get("changes") as string).split("\n").filter(c => c.trim()),
        }),
      });

      if (response.ok) {
        toast({ title: "Deployment started" });
        setDeploymentDialogOpen(false);
        refetchDeployments();
      }
    } catch (error) {
      toast({ title: "Failed to start deployment", variant: "destructive" });
    }
  };

  if (systemLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-96 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            System Monitoring
          </h1>
          <p className="text-muted-foreground">
            Real-time health monitoring and incident management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchSystem()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Maintenance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Maintenance Window</DialogTitle>
                <DialogDescription>
                  Plan system maintenance with zero downtime
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={scheduleMaintenanceWindow} className="space-y-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" name="startTime" type="datetime-local" required />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input id="endTime" name="endTime" type="datetime-local" required />
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Input id="reason" name="reason" placeholder="Database optimization" required />
                </div>
                <div>
                  <Label htmlFor="affectedServices">Affected Services (comma-separated)</Label>
                  <Input id="affectedServices" name="affectedServices" placeholder="database, cache" required />
                </div>
                <Button type="submit" className="w-full">Schedule Maintenance</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={deploymentDialogOpen} onOpenChange={setDeploymentDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <GitBranch className="h-4 w-4 mr-2" />
                Deploy Update
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deploy New Version</DialogTitle>
                <DialogDescription>
                  Deploy with automatic health checks and rollback capability
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={startDeployment} className="space-y-4">
                <div>
                  <Label htmlFor="version">Version</Label>
                  <Input id="version" name="version" placeholder="v1.2.3" required />
                </div>
                <div>
                  <Label htmlFor="changes">Changes (one per line)</Label>
                  <Textarea id="changes" name="changes" rows={5} placeholder="- Added new feature&#10;- Fixed bug" required />
                </div>
                <Button type="submit" className="w-full">Start Deployment</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overall Health Score */}
      <Card className="mb-6 border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">System Health Score</CardTitle>
              <CardDescription>Overall system status based on all components</CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-5xl font-bold ${getHealthColor(metrics.health.overall)}`}>
                {metrics.health.score}/100
              </div>
              <Badge className={`mt-2 ${metrics.health.overall === 'healthy' ? 'bg-green-500' : metrics.health.overall === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                {metrics.health.overall}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={metrics.health.score} className="h-4" />
        </CardContent>
      </Card>

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpu.percentage}%</div>
            <Progress value={metrics.cpu.percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.cpu.cores} cores · Load: {metrics.cpu.loadAverage[0]?.toFixed(2) || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.memory.percentage}%</div>
            <Progress value={metrics.memory.percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.memory.used} MB / {metrics.memory.total} MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(metrics.uptime / 3600)}h
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {Math.floor((metrics.uptime % 3600) / 60)} minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{alertStats.active}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {alertStats.total} total alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Component Health Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Component Health</CardTitle>
          <CardDescription>Status of critical system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(metrics.health.components).map(([name, component]: [string, any]) => (
              <Card key={name} className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</div>
                    {getHealthIcon(component?.status || 'unknown')}
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge className={getHealthColor(component?.status || 'unknown') + " bg-opacity-10"}>
                    {component?.status || 'unknown'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">{component?.message || 'No status available'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Threats */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Security Threats (Last 24h)</CardTitle>
              <CardDescription>Detected attacks and suspicious activity</CardDescription>
            </div>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold">{threatStats.total}</div>
              <p className="text-xs text-muted-foreground">Total Threats</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{threatStats.blocked}</div>
              <p className="text-xs text-muted-foreground">Blocked</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">
                {(threatStats.bySeverity.high || 0) + (threatStats.bySeverity.critical || 0)}
              </div>
              <p className="text-xs text-muted-foreground">High/Critical</p>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {threatStats.byType.brute_force || 0}
              </div>
              <p className="text-xs text-muted-foreground">Brute Force</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {threats.slice(0, 10).map((threat: any) => (
                <TableRow key={threat.id}>
                  <TableCell className="font-medium">{threat.type?.replace(/_/g, ' ') || 'Unknown'}</TableCell>
                  <TableCell>{getSeverityBadge(threat.severity || 'low')}</TableCell>
                  <TableCell className="font-mono text-sm">{threat.ipAddress || 'N/A'}</TableCell>
                  <TableCell className="max-w-md truncate">{threat.description || ''}</TableCell>
                  <TableCell>{threat.timestamp ? format(new Date(threat.timestamp), 'HH:mm:ss') : 'N/A'}</TableCell>
                  <TableCell>
                    {threat.blocked ? (
                      <Badge className="bg-red-500">Blocked</Badge>
                    ) : (
                      <Badge variant="outline">Detected</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* API Routes Health */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Routes Health</CardTitle>
              <CardDescription>Performance and error rates for top endpoints</CardDescription>
            </div>
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Avg Response</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Error Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route: any) => (
                <TableRow key={`${route.method}:${route.path}`}>
                  <TableCell className="font-mono text-sm">{route.path}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{route.method}</Badge>
                  </TableCell>
                  <TableCell>{getHealthIcon(route.status)}</TableCell>
                  <TableCell>{route.avgResponseTime}ms</TableCell>
                  <TableCell>{route.requestCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={route.errorRate > 0.1 ? 'text-red-500' : 'text-green-500'}>
                      {(route.errorRate * 100).toFixed(2)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Integrations Health */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>External Integrations</CardTitle>
          <CardDescription>Status of third-party services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration: any) => (
              <Card key={integration.name} className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{integration.name}</div>
                    {getHealthIcon(integration.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge className={getHealthColor(integration.status) + " bg-opacity-10 mb-2"}>
                    {integration.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Type: {integration.type.replace(/_/g, ' ')}
                  </p>
                  {integration.latency && (
                    <p className="text-xs text-muted-foreground">
                      Latency: {integration.latency}ms
                    </p>
                  )}
                  {integration.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{integration.errorMessage}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="mb-6 border-red-500 border-2">
          <CardHeader>
            <CardTitle className="text-red-500">Active Alerts</CardTitle>
            <CardDescription>Issues requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert: any) => (
                <Card key={alert.id} className="border-2">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(alert.severity || 'info')}
                        <Badge variant="outline">{alert.type || 'alert'}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {alert.timestamp ? format(new Date(alert.timestamp), 'MMM dd, HH:mm') : 'N/A'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{alert.message}</p>
                    {alert.metadata && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {JSON.stringify(alert.metadata)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Real-time system performance from /api/admin/system/performance</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Response Time Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground">Avg Response</div>
              <div className="text-2xl font-bold text-green-500">{typeof performance.avg === 'number' ? performance.avg.toFixed(1) : performance.avg}ms</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground">P95</div>
              <div className="text-2xl font-bold text-yellow-500">{typeof performance.p95 === 'number' ? performance.p95.toFixed(1) : performance.p95}ms</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground">P99</div>
              <div className="text-2xl font-bold text-orange-500">{typeof performance.p99 === 'number' ? performance.p99.toFixed(1) : performance.p99}ms</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground">Total Requests</div>
              <div className="text-2xl font-bold">{performance.count.toLocaleString()}</div>
            </div>
          </div>
          
          {/* CPU & Memory from Performance API */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">CPU (Perf API)</span>
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold">{typeof performance.cpu.percentage === 'number' ? performance.cpu.percentage.toFixed(1) : 0}%</div>
              <p className="text-xs text-muted-foreground">
                {performance.cpu.cores} cores · Load: {performance.cpu.loadAverage?.[0]?.toFixed(2) || 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Memory (Perf API)</span>
                <HardDrive className="h-4 w-4 text-rai-500" />
              </div>
              <div className="text-xl font-bold">{typeof performance.memory.percentage === 'number' ? performance.memory.percentage.toFixed(1) : 0}%</div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(performance.memory.used)} / {formatBytes(performance.memory.total)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Database (Perf API)</span>
                <Database className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-xl font-bold">{performance.database.queryTime}ms</div>
              <p className="text-xs text-muted-foreground">
                {performance.database.connections} connections · {performance.database.activeQueries} active
              </p>
            </div>
          </div>
          
          {/* Uptime from Performance API */}
          <div className="text-sm text-muted-foreground text-center">
            Process Uptime: {Math.floor(performance.uptime / 3600)}h {Math.floor((performance.uptime % 3600) / 60)}m {Math.floor(performance.uptime % 60)}s
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Schedule */}
      {maintenances.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scheduled Maintenance</CardTitle>
            <CardDescription>Upcoming maintenance windows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {maintenances.map((maintenance: any) => (
                <Card key={maintenance.id} className="border-2">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={maintenance.status === 'active' ? 'bg-yellow-500' : 'bg-rai-500'}>
                          {maintenance.status || 'scheduled'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {maintenance.startTime ? format(new Date(maintenance.startTime), 'MMM dd, HH:mm') : 'TBD'} - {maintenance.endTime ? format(new Date(maintenance.endTime), 'HH:mm') : 'TBD'}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{maintenance.reason || 'Scheduled maintenance'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Affected: {maintenance.affectedServices?.join(', ') || 'system'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployment History */}
      {deployments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Deployments</CardTitle>
            <CardDescription>Deployment history and status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health Checks</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Deployed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment: any) => (
                  <TableRow key={deployment.id}>
                    <TableCell className="font-mono">{deployment.version || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={
                        deployment.status === 'completed' ? 'bg-green-500' :
                        deployment.status === 'failed' ? 'bg-red-500' :
                        deployment.status === 'rolled-back' ? 'bg-orange-500' :
                        'bg-rai-500'
                      }>
                        {deployment.status || 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deployment.healthChecksPassed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>{deployment.startTime ? format(new Date(deployment.startTime), 'MMM dd, HH:mm') : 'N/A'}</TableCell>
                    <TableCell>
                      {deployment.endTime && deployment.startTime ? 
                        `${Math.round((new Date(deployment.endTime).getTime() - new Date(deployment.startTime).getTime()) / 1000)}s` :
                        'In progress'
                      }
                    </TableCell>
                    <TableCell>{deployment.deployedBy || 'system'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
