import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Server,
  Power,
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Trash2,
  Settings,
  Database,
  HardDrive,
  Wrench,
  Timer,
  Activity,
  FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface MaintenanceTask {
  id: string;
  name: string;
  type: "scheduled" | "manual" | "recurring";
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  category: "database" | "cache" | "logs" | "backup" | "cleanup" | "update";
  description: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  progress?: number;
  lastRun?: string;
  nextRun?: string;
  enabled: boolean;
}

interface MaintenanceStats {
  totalTasks: number;
  activeTasks: number;
  scheduledTasks: number;
  completedToday: number;
  failedToday: number;
  systemHealth: number;
}

interface MaintenanceResponse {
  tasks: MaintenanceTask[];
  stats: MaintenanceStats;
  health?: any;
  maintenanceMode?: boolean;
}

export default function Maintenance() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<MaintenanceResponse>({
    queryKey: ["/api/admin/system/maintenance"],
    refetchInterval: 10000,
  });

  // Get maintenance mode from API response
  const maintenanceMode = data?.maintenanceMode ?? false;

  const toggleMaintenanceModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/admin/system/maintenance/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error("Failed to toggle maintenance mode");
      return response.json();
    },
    onSuccess: (data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/maintenance"] });
      toast({ title: enabled ? "Maintenance mode enabled" : "Maintenance mode disabled" });
    },
    onError: () => {
      toast({ title: "Failed to toggle maintenance mode", variant: "destructive" });
    },
  });

  const quickActionMutation = useMutation({
    mutationFn: async (action: string) => {
      const response = await fetch("/api/admin/system/maintenance/quick-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("Failed to execute action");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/maintenance"] });
      toast({ title: data.message || "Action completed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to execute action", variant: "destructive" });
    },
  });

  const runTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/admin/system/maintenance/${taskId}/run`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to run task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/maintenance"] });
      toast({ title: "Task started successfully" });
    },
    onError: () => {
      toast({ title: "Failed to start task", variant: "destructive" });
    },
  });

  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/admin/system/maintenance/${taskId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to cancel task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/maintenance"] });
      toast({ title: "Task cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel task", variant: "destructive" });
    },
  });

  const tasks = data?.tasks || [];
  const stats = data?.stats || {
    totalTasks: 0,
    activeTasks: 0,
    scheduledTasks: 0,
    completedToday: 0,
    failedToday: 0,
    systemHealth: 100,
  };

  // Safe stat values with null safety
  const systemHealth = typeof stats.systemHealth === 'number' ? stats.systemHealth : 100;
  const activeTasksCount = typeof stats.activeTasks === 'number' ? stats.activeTasks : 0;
  const scheduledTasksCount = typeof stats.scheduledTasks === 'number' ? stats.scheduledTasks : 0;
  const completedTodayCount = typeof stats.completedToday === 'number' ? stats.completedToday : 0;
  const failedTodayCount = typeof stats.failedToday === 'number' ? stats.failedToday : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Failed</Badge>;
      case "in_progress":
        return <Badge className="bg-rai-500 flex items-center gap-1"><Activity className="h-3 w-3 animate-pulse" /> Running</Badge>;
      case "pending":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="flex items-center gap-1"><PauseCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "database":
        return <Database className="h-4 w-4 text-primary" />;
      case "cache":
        return <HardDrive className="h-4 w-4 text-rai-500" />;
      case "logs":
        return <FileText className="h-4 w-4 text-gray-500" />;
      case "backup":
        return <Server className="h-4 w-4 text-green-500" />;
      case "cleanup":
        return <Trash2 className="h-4 w-4 text-orange-500" />;
      case "update":
        return <RefreshCw className="h-4 w-4 text-rai-500" />;
      default:
        return <Wrench className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const activeTasks = tasks.filter((t) => t.status === "in_progress");
  const scheduledTasks = tasks.filter((t) => t.status === "pending" && t.scheduledAt);
  const recentTasks = tasks.filter((t) => t.status === "completed" || t.status === "failed");

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
            System Maintenance
          </h1>
          <p className="text-muted-foreground">
            Manage scheduled tasks and system maintenance operations
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Switch
              id="maintenance-mode"
              checked={maintenanceMode}
              onCheckedChange={(checked) => toggleMaintenanceModeMutation.mutate(checked)}
              disabled={toggleMaintenanceModeMutation.isPending}
            />
            <Label htmlFor="maintenance-mode" className="font-medium">
              Maintenance Mode
            </Label>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Maintenance Mode Warning */}
      {maintenanceMode && (
        <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Maintenance Mode Active
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  The system is currently in maintenance mode. Users may experience limited functionality.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${systemHealth >= 90 ? 'text-green-500' : systemHealth >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
              {systemHealth}%
            </div>
            <Progress value={systemHealth} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <PlayCircle className="h-4 w-4 text-rai-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rai-500">{activeTasksCount}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledTasksCount}</div>
            <p className="text-xs text-muted-foreground">Upcoming tasks</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{completedTodayCount}</div>
            {failedTodayCount > 0 && (
              <p className="text-xs text-red-500">{failedTodayCount} failed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-rai-500 animate-pulse" />
              Active Tasks
            </CardTitle>
            <CardDescription>Tasks currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-4">
                    {getCategoryIcon(task.category)}
                    <div>
                      <p className="font-medium">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {task.progress !== undefined && (
                      <div className="w-32">
                        <Progress value={task.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center mt-1">{task.progress}%</p>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelTaskMutation.mutate(task.id)}
                      disabled={cancelTaskMutation.isPending}
                    >
                      <PauseCircle className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common maintenance operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => quickActionMutation.mutate('database_vacuum')}
              disabled={quickActionMutation.isPending}
            >
              <Database className="h-6 w-6 text-primary" />
              <span>Database Vacuum</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => quickActionMutation.mutate('clear_cache')}
              disabled={quickActionMutation.isPending}
            >
              <HardDrive className="h-6 w-6 text-rai-500" />
              <span>Clear Cache</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => quickActionMutation.mutate('rotate_logs')}
              disabled={quickActionMutation.isPending}
            >
              <FileText className="h-6 w-6 text-gray-500" />
              <span>Rotate Logs</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => quickActionMutation.mutate('create_backup')}
              disabled={quickActionMutation.isPending}
            >
              <Server className="h-6 w-6 text-green-500" />
              <span>Create Backup</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Tasks</CardTitle>
          <CardDescription>All scheduled and recurring maintenance tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No maintenance tasks configured
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(task.category)}
                          <span className="capitalize">{task.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{task.type}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        {task.lastRun ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(task.lastRun), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.nextRun ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(task.nextRun), "MMM d, HH:mm")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(task.status === "pending" || task.status === "completed" || task.status === "failed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runTaskMutation.mutate(task.id)}
                              disabled={runTaskMutation.isPending}
                            >
                              <PlayCircle className="h-3 w-3 mr-1" />
                              Run Now
                            </Button>
                          )}
                          <Button size="sm" variant="ghost">
                            <Settings className="h-3 w-3" />
                          </Button>
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
