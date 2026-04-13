import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Gauge,
  Timer,
  Zap,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";

interface PerformanceMetrics {
  cpu: {
    percentage: number;
    cores: number;
    loadAverage: number[];
    model?: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    available: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    readSpeed?: number;
    writeSpeed?: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    latency?: number;
  };
  uptime: number;
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  requests: {
    total: number;
    perSecond: number;
    errors: number;
    errorRate: number;
  };
  database: {
    connections: number;
    maxConnections: number;
    queryTime: number;
    slowQueries: number;
  };
}

export default function Performance() {
  const [timeRange, setTimeRange] = useState("1h");

  const { data, isLoading, refetch } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/admin/system/performance", timeRange],
    refetchInterval: 5000,
  });

  const metrics = data || {
    cpu: { percentage: 0, cores: 0, loadAverage: [0, 0, 0] },
    memory: { used: 0, total: 0, percentage: 0, available: 0 },
    disk: { used: 0, total: 0, percentage: 0 },
    network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
    uptime: 0,
    responseTime: { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 },
    requests: { total: 0, perSecond: 0, errors: 0, errorRate: 0 },
    database: { connections: 0, maxConnections: 100, queryTime: 0, slowQueries: 0 },
  };

  // Safe nested property access
  const cpu = metrics.cpu || { percentage: 0, cores: 0, loadAverage: [0, 0, 0] };
  const memory = metrics.memory || { used: 0, total: 0, percentage: 0, available: 0 };
  const disk = metrics.disk || { used: 0, total: 0, percentage: 0 };
  const network = metrics.network || { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
  const responseTime = metrics.responseTime || { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  const requests = metrics.requests || { total: 0, perSecond: 0, errors: 0, errorRate: 0 };
  const database = metrics.database || { connections: 0, maxConnections: 100, queryTime: 0, slowQueries: 0 };
  const uptime = metrics.uptime || 0;

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0m";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getHealthColor = (value: number, thresholds: { good: number; warn: number }) => {
    if (value <= thresholds.good) return "text-green-500";
    if (value <= thresholds.warn) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (value: number) => {
    if (value <= 50) return "bg-green-500";
    if (value <= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  const overallHealth = useMemo(() => {
    const cpuScore = Math.max(0, 100 - cpu.percentage);
    const memScore = Math.max(0, 100 - memory.percentage);
    const diskScore = Math.max(0, 100 - disk.percentage);
    const errorScore = Math.max(0, 100 - requests.errorRate * 10);
    return Math.round((cpuScore + memScore + diskScore + errorScore) / 4);
  }, [cpu, memory, disk, requests]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            Performance Metrics
          </h1>
          <p className="text-muted-foreground">
            Real-time system performance monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15m</SelectItem>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="6h">Last 6h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health */}
      <Card className="mb-8">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${getHealthColor(100 - overallHealth, { good: 30, warn: 50 })}`}>
                {overallHealth}
              </div>
              <div>
                <p className="text-lg font-medium">System Health Score</p>
                <p className="text-sm text-muted-foreground">
                  Based on CPU, Memory, Disk, and Error Rate
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-500 border-green-500">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
              <div className="text-sm text-muted-foreground">
                Uptime: {formatUptime(uptime)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(cpu.percentage, { good: 50, warn: 80 })}`}>
              {cpu.percentage.toFixed(1)}%
            </div>
            <Progress
              value={cpu.percentage}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {cpu.cores} cores • Load: {cpu.loadAverage.map((l) => l.toFixed(2)).join(", ")}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-rai-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(memory.percentage, { good: 60, warn: 85 })}`}>
              {memory.percentage.toFixed(1)}%
            </div>
            <Progress
              value={memory.percentage}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {formatBytes(memory.used)} / {formatBytes(memory.total)}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(disk.percentage, { good: 70, warn: 90 })}`}>
              {disk.percentage.toFixed(1)}%
            </div>
            <Progress
              value={disk.percentage}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {formatBytes(disk.used)} / {formatBytes(disk.total)}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
            <Network className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <ArrowDown className="h-4 w-4 text-green-500" />
                <span className="text-lg font-bold">{formatBytes(network.bytesIn)}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUp className="h-4 w-4 text-rai-500" />
                <span className="text-lg font-bold">{formatBytes(network.bytesOut)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {network.latency ? `Latency: ${network.latency}ms` : "Network traffic"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Response Time & Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Response Time
            </CardTitle>
            <CardDescription>API response time percentiles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-500">
                  {responseTime.avg.toFixed(0)}ms
                </div>
                <div className="text-sm text-muted-foreground">Average</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-yellow-500">
                  {responseTime.p95.toFixed(0)}ms
                </div>
                <div className="text-sm text-muted-foreground">p95</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-orange-500">
                  {responseTime.p99.toFixed(0)}ms
                </div>
                <div className="text-sm text-muted-foreground">p99</div>
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Min: {responseTime.min.toFixed(0)}ms</span>
              <span>Median: {responseTime.p50.toFixed(0)}ms</span>
              <span>Max: {responseTime.max.toFixed(0)}ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Request Statistics
            </CardTitle>
            <CardDescription>Request volume and error rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">
                  {requests.total.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Requests</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-rai-500">
                  {requests.perSecond.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Requests/sec</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className={`text-2xl font-bold ${requests.errors > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {requests.errors}
                </div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className={`text-2xl font-bold ${requests.errorRate > 1 ? 'text-red-500' : 'text-green-500'}`}>
                  {requests.errorRate.toFixed(2)}%
                </div>
                <div className="text-sm text-muted-foreground">Error Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Performance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Database Performance
          </CardTitle>
          <CardDescription>Database connection and query metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Connections</span>
                <span className="text-sm text-muted-foreground">
                  {database.connections}/{database.maxConnections}
                </span>
              </div>
              <Progress
                value={(database.connections / database.maxConnections) * 100}
                className="h-2"
              />
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {database.queryTime.toFixed(1)}ms
              </div>
              <div className="text-sm text-muted-foreground">Avg Query Time</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className={`text-2xl font-bold ${database.slowQueries > 10 ? 'text-yellow-500' : 'text-green-500'}`}>
                {database.slowQueries}
              </div>
              <div className="text-sm text-muted-foreground">Slow Queries</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-lg font-bold text-green-500">Healthy</span>
              </div>
              <div className="text-sm text-muted-foreground">DB Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Recommendations</CardTitle>
          <CardDescription>Automated suggestions based on current metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cpu.percentage > 80 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <Cpu className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">High CPU Usage</p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Consider scaling horizontally or optimizing compute-intensive operations.
                  </p>
                </div>
              </div>
            )}
            {memory.percentage > 85 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                <MemoryStick className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">High Memory Usage</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Review memory-intensive processes and consider increasing available RAM.
                  </p>
                </div>
              </div>
            )}
            {disk.percentage > 90 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900">
                <HardDrive className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">Low Disk Space</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Clean up old logs and temporary files, or expand storage capacity.
                  </p>
                </div>
              </div>
            )}
            {cpu.percentage <= 80 && memory.percentage <= 85 && disk.percentage <= 90 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <Gauge className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">All Systems Optimal</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    System performance is within healthy parameters. No action needed.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
