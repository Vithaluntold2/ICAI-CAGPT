import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  Ban,
  ShieldCheck,
  Activity,
  Globe,
  Clock,
  Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Threat {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  source?: string;
  ipAddress?: string;
  target?: string;
  description: string;
  status?: "active" | "blocked" | "resolved" | "investigating";
  blocked?: boolean;
  detectedAt?: string;
  timestamp?: string;
  resolvedAt?: string;
  userId?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

interface ThreatStats {
  total: number;
  active: number;
  blocked: number;
  resolved?: number;
  bySeverity?: Record<string, number>;
  byType?: Record<string, number>;
}

export default function SecurityThreats() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ threats: Threat[]; stats: ThreatStats }>({
    queryKey: ["/api/admin/system/threats"],
    refetchInterval: 5000,
  });

  const blockThreatMutation = useMutation({
    mutationFn: async (threatId: string) => {
      const response = await fetch(`/api/admin/system/threats/${threatId}/block`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to block threat");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/threats"] });
      toast({ title: "Threat blocked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to block threat", variant: "destructive" });
    },
  });

  const resolveThreatMutation = useMutation({
    mutationFn: async (threatId: string) => {
      const response = await fetch(`/api/admin/system/threats/${threatId}/resolve`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to resolve threat");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system/threats"] });
      toast({ title: "Threat resolved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to resolve threat", variant: "destructive" });
    },
  });

  const threats = data?.threats || [];
  const stats = data?.stats || { total: 0, active: 0, blocked: 0, resolved: 0, bySeverity: {}, byType: {} };
  
  // Ensure bySeverity and byType are always objects
  const bySeverity = stats.bySeverity || {};
  const byType = stats.byType || {};

  const filteredThreats = threats.filter((threat) => {
    const description = threat.description || '';
    const source = threat.source || threat.ipAddress || '';
    const type = threat.type || '';
    const matchesSearch =
      description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === "all" || threat.severity === severityFilter;
    const threatStatus = threat.status || (threat.blocked ? "blocked" : "active");
    const matchesStatus = statusFilter === "all" || threatStatus === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Active</Badge>;
      case "blocked":
        return <Badge className="bg-rai-500 flex items-center gap-1"><Ban className="h-3 w-3" /> Blocked</Badge>;
      case "resolved":
        return <Badge className="bg-green-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Resolved</Badge>;
      case "investigating":
        return <Badge className="bg-primary/100 flex items-center gap-1"><Eye className="h-3 w-3" /> Investigating</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
            Security Threats
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage security threats in real-time
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Threats</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time detected</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <Ban className="h-4 w-4 text-rai-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rai-500">{stats.blocked}</div>
            <p className="text-xs text-muted-foreground">Successfully blocked</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.resolved || 0}</div>
            <p className="text-xs text-muted-foreground">Fully resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Threats by Severity</CardTitle>
            <CardDescription>Distribution of threat severity levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(bySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(severity)}
                  </div>
                  <span className="font-medium">{typeof count === 'number' ? count : 0}</span>
                </div>
              ))}
              {Object.keys(bySeverity).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No threat data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Threats by Type</CardTitle>
            <CardDescription>Categorization of detected threats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="capitalize">{type.replace(/_/g, " ")}</span>
                  <span className="font-medium">{typeof count === 'number' ? count : 0}</span>
                </div>
              ))}
              {Object.keys(byType).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No threat data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Threats List */}
      <Card>
        <CardHeader>
          <CardTitle>All Threats</CardTitle>
          <CardDescription>Detailed list of detected security threats</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search threats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Activity className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThreats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {threats.length === 0 ? "No threats detected" : "No threats match your filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredThreats.map((threat) => {
                    const threatSource = threat.source || threat.ipAddress || "Unknown";
                    const threatStatus = threat.status || (threat.blocked ? "blocked" : "active");
                    const threatDate = threat.detectedAt || threat.timestamp;
                    
                    return (
                    <TableRow key={threat.id}>
                      <TableCell className="font-medium capitalize">
                        {(threat.type || "unknown").replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>{getSeverityBadge(threat.severity || "medium")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{threatSource}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{threat.description || "No description"}</TableCell>
                      <TableCell>{getStatusBadge(threatStatus)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {threatDate ? format(new Date(threatDate), "MMM d, HH:mm") : "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {threatStatus === "active" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => blockThreatMutation.mutate(threat.id)}
                                disabled={blockThreatMutation.isPending}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Block
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveThreatMutation.mutate(threat.id)}
                                disabled={resolveThreatMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolve
                              </Button>
                            </>
                          )}
                          {threatStatus === "investigating" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveThreatMutation.mutate(threat.id)}
                              disabled={resolveThreatMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
