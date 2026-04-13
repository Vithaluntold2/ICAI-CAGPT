import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Settings,
  Link,
  Unlink,
  Clock,
  Activity,
  Filter,
  Bot,
  Cloud,
  Database,
  CreditCard,
  FileText,
  Send,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  name: string;
  type: "ai_provider" | "payment" | "storage" | "email" | "analytics" | "accounting" | "auth";
  provider: string;
  status: "connected" | "disconnected" | "error" | "rate_limited";
  enabled: boolean;
  lastSync?: string;
  lastError?: string;
  healthScore: number;
  requestsToday?: number;
  rateLimit?: number;
  rateLimitRemaining?: number;
  config?: Record<string, any>;
}

interface IntegrationStats {
  total: number;
  connected: number;
  errors: number;
  byType: Record<string, number>;
  totalRequestsToday: number;
}

export default function SuperAdminIntegrations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ integrations: Integration[]; stats: IntegrationStats }>({
    queryKey: ["/api/admin/system/integrations"],
    refetchInterval: 30000,
  });

  const toggleIntegrationMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch(`/api/admin/system/integrations/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to toggle integration");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/integrations"] });
      toast({ 
        title: data.message || "Integration updated",
        description: `${data.id} has been ${data.enabled ? 'enabled' : 'disabled'}`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update integration", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const syncIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/system/integrations/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to sync integration");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/integrations"] });
      toast({ 
        title: data.message || "Integration synced successfully",
        description: `Synced at ${new Date(data.syncedAt).toLocaleTimeString()}`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to sync integration", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const testIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/system/integrations/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to test integration");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/integrations"] });
      if (data.success) {
        toast({ 
          title: "Connection test passed ✓",
          description: `Response time: ${data.responseTime}ms`
        });
      } else {
        toast({ 
          title: "Connection test failed ✗",
          description: data.message || "Check your credentials",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to test integration", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const integrations = data?.integrations || [];
  const stats = data?.stats || {
    total: 0,
    connected: 0,
    errors: 0,
    byType: {},
    totalRequestsToday: 0,
  };

  // Safe reference for Object.entries and values
  const byType = stats.byType || {};
  const totalCount = stats.total || 0;
  const connectedCount = stats.connected || 0;
  const errorsCount = stats.errors || 0;
  const requestsToday = stats.totalRequestsToday || 0;

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || integration.type === typeFilter;
    const matchesStatus = statusFilter === "all" || integration.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>;
      case "disconnected":
        return <Badge variant="secondary" className="flex items-center gap-1"><Unlink className="h-3 w-3" /> Disconnected</Badge>;
      case "error":
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
      case "rate_limited":
        return <Badge className="bg-yellow-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Rate Limited</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ai_provider":
        return <Bot className="h-4 w-4 text-primary" />;
      case "payment":
        return <CreditCard className="h-4 w-4 text-green-500" />;
      case "storage":
        return <Cloud className="h-4 w-4 text-rai-500" />;
      case "email":
        return <Send className="h-4 w-4 text-orange-500" />;
      case "analytics":
        return <Activity className="h-4 w-4 text-pink-500" />;
      case "accounting":
        return <FileText className="h-4 w-4 text-rai-500" />;
      case "auth":
        return <Database className="h-4 w-4 text-yellow-500" />;
      default:
        return <Globe className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
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
            Integrations
          </h1>
          <p className="text-muted-foreground">
            Manage third-party service integrations and API connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Link className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">Configured services</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{connectedCount}</div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${errorsCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {errorsCount}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requestsToday.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">API calls made</p>
          </CardContent>
        </Card>
      </div>

      {/* Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Integrations by Type</CardTitle>
            <CardDescription>Distribution across service categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(type)}
                    <span className="capitalize">{type.replace(/_/g, " ")}</span>
                  </div>
                  <span className="font-medium">{typeof count === 'number' ? count : 0}</span>
                </div>
              ))}
              {Object.keys(byType).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No integrations configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Provider Status</CardTitle>
            <CardDescription>AI model provider health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {integrations
                .filter((i) => i.type === "ai_provider")
                .map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{integration.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {integration.rateLimitRemaining !== undefined && integration.rateLimit
                            ? `${integration.rateLimitRemaining}/${integration.rateLimit} requests remaining`
                            : integration.provider}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getHealthColor(integration.healthScore || 0)}`}>
                        {integration.healthScore || 0}%
                      </span>
                      {getStatusBadge(integration.status)}
                    </div>
                  </div>
                ))}
              {integrations.filter((i) => i.type === "ai_provider").length === 0 && (
                <p className="text-muted-foreground text-center py-4">No AI providers configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations List */}
      <Card>
        <CardHeader>
          <CardTitle>All Integrations</CardTitle>
          <CardDescription>Complete list of third-party service connections</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ai_provider">AI Provider</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
                <SelectItem value="accounting">Accounting</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Activity className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="rate_limited">Rate Limited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIntegrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {integrations.length === 0 ? "No integrations configured" : "No integrations match your filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIntegrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getTypeIcon(integration.type)}
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <p className="text-xs text-muted-foreground">{integration.provider}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{integration.type.replace(/_/g, " ")}</TableCell>
                      <TableCell>{getStatusBadge(integration.status)}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${getHealthColor(integration.healthScore || 0)}`}>
                          {integration.healthScore || 0}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {integration.lastSync ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(integration.lastSync), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={integration.enabled}
                          onCheckedChange={(enabled) =>
                            toggleIntegrationMutation.mutate({ id: integration.id, enabled })
                          }
                          disabled={toggleIntegrationMutation.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testIntegrationMutation.mutate(integration.id)}
                            disabled={testIntegrationMutation.isPending}
                          >
                            {testIntegrationMutation.isPending && testIntegrationMutation.variables === integration.id ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3 mr-1" />
                            )}
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncIntegrationMutation.mutate(integration.id)}
                            disabled={syncIntegrationMutation.isPending}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${syncIntegrationMutation.isPending && syncIntegrationMutation.variables === integration.id ? 'animate-spin' : ''}`} />
                            Sync
                          </Button>
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

          {/* Error Details */}
          {integrations.some((i) => i.status === "error" && i.lastError) && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">Integration Errors</h3>
              <div className="space-y-3">
                {integrations
                  .filter((i) => i.status === "error" && i.lastError)
                  .map((integration) => (
                    <div
                      key={integration.id}
                      className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                    >
                      <div className="flex items-start gap-3">
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-800 dark:text-red-200">
                            {integration.name}
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            {integration.lastError}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
