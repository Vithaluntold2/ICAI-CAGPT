import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Rocket,
  RotateCcw,
  Play,
  Filter,
  User,
  Timer,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Deployment {
  id: string;
  version: string;
  environment: "production" | "staging" | "development";
  status: "pending" | "in_progress" | "success" | "failed" | "rolled_back";
  branch: string;
  commit: string;
  deployedBy: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  changes: string[];
  errorMessage?: string;
}

interface DeploymentStats {
  totalDeployments: number;
  successRate: number;
  avgDuration: number;
  lastDeployment: string | null;
  byEnvironment: Record<string, number>;
  byStatus: Record<string, number>;
}

export default function Deployments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ deployments: Deployment[]; stats: DeploymentStats }>({
    queryKey: ["/api/admin/system/deployments"],
    refetchInterval: 10000,
  });

  const rollbackMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      const response = await fetch(`/api/admin/system/deployments/${deploymentId}/rollback`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to rollback deployment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/deployments"] });
      toast({ title: "Rollback initiated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to initiate rollback", variant: "destructive" });
    },
  });

  const redeployMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      const response = await fetch(`/api/admin/system/deployments/${deploymentId}/redeploy`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to redeploy");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/deployments"] });
      toast({ title: "Redeployment started" });
    },
    onError: () => {
      toast({ title: "Failed to start redeployment", variant: "destructive" });
    },
  });

  const deployments = data?.deployments || [];
  const stats = data?.stats || {
    totalDeployments: 0,
    successRate: 100,
    avgDuration: 0,
    lastDeployment: null,
    byEnvironment: {},
    byStatus: {},
  };

  // Safe references for Object.entries
  const byEnvironment = stats.byEnvironment || {};
  const byStatus = stats.byStatus || {};

  const filteredDeployments = deployments.filter((deployment) => {
    const matchesSearch =
      deployment.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deployment.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deployment.deployedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEnvironment = environmentFilter === "all" || deployment.environment === environmentFilter;
    const matchesStatus = statusFilter === "all" || deployment.status === statusFilter;
    return matchesSearch && matchesEnvironment && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Success</Badge>;
      case "failed":
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case "in_progress":
        return <Badge className="bg-rai-500 flex items-center gap-1"><Activity className="h-3 w-3 animate-pulse" /> In Progress</Badge>;
      case "pending":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "rolled_back":
        return <Badge className="bg-orange-500 flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Rolled Back</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEnvironmentBadge = (environment: string) => {
    switch (environment) {
      case "production":
        return <Badge className="bg-red-500">Production</Badge>;
      case "staging":
        return <Badge className="bg-yellow-500">Staging</Badge>;
      case "development":
        return <Badge variant="secondary">Development</Badge>;
      default:
        return <Badge variant="outline">{environment}</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
            Deployments
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage application deployments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Rocket className="h-4 w-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeployments}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(stats.successRate ?? 100) >= 90 ? 'text-green-500' : (stats.successRate ?? 100) >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
              {(stats.successRate ?? 100).toFixed(1)}%
            </div>
            <Progress value={stats.successRate ?? 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Timer className="h-4 w-4 text-rai-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
            <p className="text-xs text-muted-foreground">Per deployment</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Deployment</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {stats.lastDeployment
                ? formatDistanceToNow(new Date(stats.lastDeployment), { addSuffix: true })
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.lastDeployment ? format(new Date(stats.lastDeployment), "MMM d, HH:mm") : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Environment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Deployments by Environment</CardTitle>
            <CardDescription>Distribution across deployment targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byEnvironment).map(([env, count]) => {
                const safeCount = typeof count === 'number' ? count : 0;
                return (
                  <div key={env} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getEnvironmentBadge(env)}
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={(safeCount / (stats.totalDeployments || 1)) * 100} className="w-24 h-2" />
                      <span className="font-medium w-12 text-right">{safeCount}</span>
                    </div>
                  </div>
                );
              })}
              {Object.keys(byEnvironment).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No deployment data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deployments by Status</CardTitle>
            <CardDescription>Success and failure breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byStatus).map(([status, count]) => {
                const safeCount = typeof count === 'number' ? count : 0;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(status)}
                    </div>
                    <span className="font-medium">{safeCount}</span>
                  </div>
                );
              })}
              {Object.keys(byStatus).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No deployment data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments List */}
      <Card>
        <CardHeader>
          <CardTitle>All Deployments</CardTitle>
          <CardDescription>Complete deployment history</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deployments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Activity className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rolled_back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deployed By</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeployments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {deployments.length === 0 ? "No deployments found" : "No deployments match your filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeployments.map((deployment) => (
                    <TableRow key={deployment.id}>
                      <TableCell className="font-mono font-medium">{deployment.version}</TableCell>
                      <TableCell>{getEnvironmentBadge(deployment.environment)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-mono">{deployment.branch}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{deployment.deployedBy}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDuration(deployment.duration)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(deployment.startedAt), "MMM d, HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {deployment.status === "success" && deployment.environment === "production" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rollbackMutation.mutate(deployment.id)}
                              disabled={rollbackMutation.isPending}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Rollback
                            </Button>
                          )}
                          {deployment.status === "failed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => redeployMutation.mutate(deployment.id)}
                              disabled={redeployMutation.isPending}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
