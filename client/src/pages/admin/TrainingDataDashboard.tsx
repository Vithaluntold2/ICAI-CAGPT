/**
 * Training Data Admin Dashboard
 * 
 * Features:
 * - Review pending training examples
 * - Approve/reject with bulk actions
 * - View finetuning job status
 * - Monitor system statistics
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Play,
  Pause,
  Trash2,
  Eye,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// ================================
// Types
// ================================

interface TrainingExample {
  id: string;
  systemPrompt: string;
  userMessage: string;
  assistantResponse: string;
  domain: string;
  jurisdiction: string | null;
  qualityScore: number;
  isApproved: boolean | null;
  isUsed: boolean;
  createdAt: string;
  sourceType: string;
  sourceId: string | null;
  metadata?: {
    qualityAssessment?: {
      tier: string;
      factors: Array<{ name: string; contribution: number; rationale: string }>;
      flags: Array<{ type: string; code: string; message: string }>;
      recommendation: string;
    };
    requiresExpertReview?: boolean;
  };
}

interface ExpertReviewItem {
  exampleId: string;
  domain: string;
  priority: 'high' | 'medium' | 'low';
  qualityScore: number;
  flags: Array<{ type: string; code: string; message: string }>;
  status: string;
  createdAt: string;
}

interface QualityStats {
  totalExamples: number;
  autoApproved: number;
  expertReviewed: number;
  autoRejected: number;
  pendingReview: number;
  averageQualityScore: number;
  qualityDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  anomaliesDetected: number;
  gamingAttemptsBlocked: number;
  thresholds: {
    autoApprove: number;
    expertReview: number;
    minimum: number;
    anomaly: number;
  };
}

interface FinetuningJob {
  id: string;
  openaiJobId?: string;
  status: string;
  baseModel: string;
  finetuningModel?: string;
  examplesCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface FinetuningStatus {
  isEnabled: boolean;
  currentExamples: number;
  threshold: number;
  readyForFinetuning: boolean;
  activeJobs: FinetuningJob[];
  lastJobAt?: string;
  latestModel?: string;
}

interface Stats {
  trainingData: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    used: number;
    averageQuality: string;
  };
  feedback: {
    total: number;
    positive: number;
    negative: number;
    withComments: number;
    positiveRate: string;
  };
  domainBreakdown: Array<{ domain: string; count: number }>;
  jurisdictionBreakdown: Array<{ jurisdiction: string; count: number }>;
  finetuning: FinetuningStatus;
}

// ================================
// API Functions
// ================================

// CSRF token cache with refresh capability
let csrfToken: string | null = null;

function clearCsrfToken(): void {
  csrfToken = null;
}

async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (csrfToken && !forceRefresh) return csrfToken;
  
  const res = await fetch('/api/admin/csrf-token', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get CSRF token');
  const data = await res.json();
  csrfToken = data.token as string;
  return csrfToken;
}

// Authenticated fetch with automatic CSRF refresh on 403
async function authenticatedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCsrfToken();
  
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
      ...options.headers,
    },
  };
  
  const res = await fetch(url, fetchOptions);
  
  // If 403, token may be stale - refresh and retry once
  if (res.status === 403) {
    clearCsrfToken();
    const newToken = await getCsrfToken(true);
    
    const retryOptions: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': newToken,
        ...options.headers,
      },
    };
    
    return fetch(url, retryOptions);
  }
  
  return res;
}

async function fetchTrainingData(params: {
  status: string;
  page: number;
  limit: number;
  domain?: string;
}): Promise<{ data: TrainingExample[]; pagination: { total: number; totalPages: number } }> {
  const queryParams = new URLSearchParams({
    status: params.status,
    page: params.page.toString(),
    limit: params.limit.toString(),
    ...(params.domain && { domain: params.domain }),
  });
  
  const res = await fetch(`/api/admin/training-data?${queryParams}`, {
    credentials: 'include',
  });
  
  if (!res.ok) throw new Error('Failed to fetch training data');
  return res.json();
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/admin/stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function fetchFinetuningStatus(): Promise<FinetuningStatus> {
  const res = await fetch('/api/admin/finetuning/status', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch finetuning status');
  return res.json();
}

async function approveExample(id: string, approved: boolean, rejectionReason?: string) {
  const res = await authenticatedFetch(`/api/admin/training-data/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approved, rejectionReason }),
  });
  if (!res.ok) throw new Error('Failed to update example');
  return res.json();
}

async function bulkApprove(ids: string[], approved: boolean, rejectionReason?: string) {
  const res = await authenticatedFetch('/api/admin/training-data/bulk-approve', {
    method: 'POST',
    body: JSON.stringify({ ids, approved, rejectionReason }),
  });
  if (!res.ok) throw new Error('Failed to bulk update');
  return res.json();
}

async function triggerFinetuning() {
  const res = await authenticatedFetch('/api/admin/finetuning/trigger', {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to trigger finetuning');
  }
  return res.json();
}

async function fetchExpertReviewQueue(): Promise<{ queue: ExpertReviewItem[]; thresholds: Record<string, number> }> {
  const res = await fetch('/api/admin/expert-review/queue', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch expert review queue');
  return res.json();
}

async function fetchQualityStats(): Promise<QualityStats> {
  const res = await fetch('/api/admin/quality-stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch quality stats');
  return res.json();
}

async function completeExpertReview(id: string, approved: boolean, notes?: string) {
  const res = await authenticatedFetch(`/api/admin/expert-review/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ approved, notes }),
  });
  if (!res.ok) throw new Error('Failed to complete expert review');
  return res.json();
}

// ================================
// Components
// ================================

function StatusBadge({ status }: { status: boolean | null }) {
  if (status === true) {
    return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
  }
  if (status === false) {
    return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
  }
  return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
}

function QualityTierBadge({ tier }: { tier: string }) {
  switch (tier) {
    case 'auto-approve':
      return <Badge className="bg-green-100 text-green-800"><Sparkles className="w-3 h-3 mr-1" /> Auto-Approved</Badge>;
    case 'expert-review':
      return <Badge className="bg-rai-100 text-rai-800"><Eye className="w-3 h-3 mr-1" /> Expert Review</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case 'auto-reject':
      return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Auto-Rejected</Badge>;
    default:
      return <Badge variant="outline">{tier}</Badge>;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-100 text-red-800">High Priority</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    case 'low':
      return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
}

function QualityIndicator({ score }: { score: number }) {
  const percentage = Math.min(100, Math.max(0, score * 100));
  
  // Determine color based on score
  const getIndicatorColor = (pct: number): string => {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 60) return 'text-yellow-600';
    if (pct >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="flex items-center gap-2">
      <Progress value={percentage} className="w-16 h-2" />
      <span className={`text-xs font-medium ${getIndicatorColor(percentage)}`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="w-3 h-3" /> },
    validating: { color: 'bg-rai-100 text-rai-800', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    queued: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
    running: { color: 'bg-primary/15 text-primary', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    succeeded: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
    cancelled: { color: 'bg-gray-100 text-gray-800', icon: <XCircle className="w-3 h-3" /> },
  };

  const { color, icon } = config[status] || config.pending;

  return (
    <Badge className={color}>
      {icon}
      <span className="ml-1 capitalize">{status}</span>
    </Badge>
  );
}

// ================================
// Main Component
// ================================

export default function TrainingDataDashboard() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingReject, setPendingReject] = useState<string | string[] | null>(null);
  // Per-item expert review notes (keyed by exampleId)
  const [expertReviewNotesMap, setExpertReviewNotesMap] = useState<Record<string, string>>({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const limit = 20;

  // Helper to get/set per-item notes
  const getExpertNotes = (exampleId: string) => expertReviewNotesMap[exampleId] || '';
  const setExpertNotes = (exampleId: string, notes: string) => {
    setExpertReviewNotesMap(prev => ({ ...prev, [exampleId]: notes }));
  };

  // Queries
  const { data: trainingData, isLoading: isLoadingData, refetch: refetchData } = useQuery({
    queryKey: ['training-data', statusFilter, domainFilter, page],
    queryFn: () => fetchTrainingData({ status: statusFilter, page, limit, domain: domainFilter === 'all' ? undefined : domainFilter }),
  });

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const { data: finetuningStatus, refetch: refetchFinetuning } = useQuery({
    queryKey: ['finetuning-status'],
    queryFn: fetchFinetuningStatus,
    refetchInterval: 10000,
  });

  const { data: expertReviewData, refetch: refetchExpertQueue } = useQuery({
    queryKey: ['expert-review-queue'],
    queryFn: fetchExpertReviewQueue,
    refetchInterval: 30000,
  });

  const { data: qualityStats, refetch: refetchQualityStats } = useQuery({
    queryKey: ['quality-stats'],
    queryFn: fetchQualityStats,
    refetchInterval: 60000,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      approveExample(id, approved, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({ title: 'Success', description: 'Example updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update example', variant: 'destructive' });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: ({ ids, approved, reason }: { ids: string[]; approved: boolean; reason?: string }) =>
      bulkApprove(ids, approved, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setSelectedIds(new Set());
      toast({ title: 'Success', description: data.message });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to bulk update', variant: 'destructive' });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: triggerFinetuning,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['finetuning-status'] });
      toast({ title: 'Finetuning Triggered', description: `Job ${data.job.id} started` });
    },
    onError: (error) => {
      toast({ title: 'Cannot Trigger', description: (error as Error).message, variant: 'destructive' });
    },
  });

  const expertReviewMutation = useMutation({
    mutationFn: ({ id, approved, notes }: { id: string; approved: boolean; notes?: string }) =>
      completeExpertReview(id, approved, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expert-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['training-data'] });
      queryClient.invalidateQueries({ queryKey: ['quality-stats'] });
      // Clear only the notes for the completed item
      setExpertReviewNotesMap(prev => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast({ title: 'Expert Review Complete', description: 'Training example updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete review', variant: 'destructive' });
    },
  });

  // Handlers
  const handleApprove = (id: string) => {
    approveMutation.mutate({ id, approved: true });
  };

  const handleReject = (id: string) => {
    setPendingReject(id);
    setRejectDialogOpen(true);
  };

  const handleExpertApprove = (id: string) => {
    const notes = getExpertNotes(id);
    expertReviewMutation.mutate({ id, approved: true, notes: notes || undefined });
    // Clear notes after submission
    setExpertNotes(id, '');
  };

  const handleExpertReject = (id: string) => {
    const notes = getExpertNotes(id);
    expertReviewMutation.mutate({ id, approved: false, notes: notes || 'Rejected by CPA expert' });
    // Clear notes after submission
    setExpertNotes(id, '');
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkApproveMutation.mutate({ ids: Array.from(selectedIds), approved: true });
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return;
    setPendingReject(Array.from(selectedIds));
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!pendingReject) return;
    
    if (Array.isArray(pendingReject)) {
      bulkApproveMutation.mutate({ ids: pendingReject, approved: false, reason: rejectReason });
    } else {
      approveMutation.mutate({ id: pendingReject, approved: false, reason: rejectReason });
    }
    
    setRejectDialogOpen(false);
    setRejectReason('');
    setPendingReject(null);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!trainingData?.data) return;
    if (selectedIds.size === trainingData.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trainingData.data.map(e => e.id)));
    }
  };

  const refreshAll = () => {
    refetchData();
    refetchStats();
    refetchFinetuning();
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, domainFilter]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training Data Dashboard</h1>
          <p className="text-gray-500">Review and manage training examples for finetuning</p>
        </div>
        <Button onClick={refreshAll} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.trainingData.pending}</div>
              <div className="text-sm text-gray-500">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.trainingData.approved}</div>
              <div className="text-sm text-gray-500">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.trainingData.rejected}</div>
              <div className="text-sm text-gray-500">Rejected</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-rai-600">{stats.trainingData.used}</div>
              <div className="text-sm text-gray-500">Used in Training</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{stats.feedback.positiveRate}%</div>
              <div className="text-sm text-gray-500">Positive Feedback</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.trainingData.averageQuality}</div>
              <div className="text-sm text-gray-500">Avg Quality</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Finetuning Status */}
      {finetuningStatus && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle>Finetuning Status</CardTitle>
              </div>
              <Button 
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending || !finetuningStatus.readyForFinetuning || finetuningStatus.activeJobs.length > 0}
                size="sm"
              >
                {triggerMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Trigger Finetuning
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Training Examples Progress</span>
                  <span>{finetuningStatus.currentExamples} / {finetuningStatus.threshold}</span>
                </div>
                <Progress 
                  value={(finetuningStatus.currentExamples / finetuningStatus.threshold) * 100} 
                  className="h-2"
                />
              </div>

              {finetuningStatus.activeJobs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Active Jobs</h4>
                  {finetuningStatus.activeJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <code className="text-sm">{job.id}</code>
                        <p className="text-xs text-gray-500">{job.examplesCount} examples</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                  ))}
                </div>
              )}

              {finetuningStatus.latestModel && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Latest Model:</span>
                    <code className="text-sm">{finetuningStatus.latestModel}</code>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training Data List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Training Examples</CardTitle>
            <div className="flex items-center gap-4">
              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                  <Button size="sm" variant="outline" onClick={handleBulkApprove}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkReject}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}

              {/* Filters */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>

              {stats && (
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    {stats.domainBreakdown.map(d => (
                      <SelectItem key={d.domain} value={d.domain}>
                        {d.domain} ({d.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : trainingData?.data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No training examples found
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded font-medium text-sm">
                <Checkbox 
                  checked={selectedIds.size === trainingData?.data.length && trainingData?.data.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <div className="flex-1">Message Preview</div>
                <div className="w-24">Domain</div>
                <div className="w-24">Quality</div>
                <div className="w-24">Status</div>
                <div className="w-32">Actions</div>
              </div>

              {/* Data rows */}
              {trainingData?.data.map(example => (
                <div key={example.id} className="border rounded">
                  <div className="flex items-center gap-4 px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.has(example.id)}
                      onCheckedChange={() => toggleSelect(example.id)}
                    />
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === example.id ? null : example.id)}
                    >
                      <div className="text-sm font-medium truncate">
                        {example.userMessage.substring(0, 100)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(example.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="w-24">
                      <Badge variant="outline">{example.domain}</Badge>
                    </div>
                    <div className="w-24">
                      <QualityIndicator score={example.qualityScore} />
                    </div>
                    <div className="w-24">
                      <StatusBadge status={example.isApproved} />
                    </div>
                    <div className="w-32 flex items-center gap-1">
                      {example.isApproved === null && (
                        <>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleApprove(example.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleReject(example.id)}
                            disabled={approveMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setExpandedId(expandedId === example.id ? null : example.id)}
                      >
                        {expandedId === example.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === example.id && (
                    <div className="px-4 pb-4 space-y-3 border-t bg-gray-50">
                      <div className="pt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">System Prompt</h4>
                        <pre className="text-xs bg-white p-2 rounded border whitespace-pre-wrap">
                          {example.systemPrompt}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">User Message</h4>
                        <pre className="text-xs bg-white p-2 rounded border whitespace-pre-wrap">
                          {example.userMessage}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Assistant Response</h4>
                        <pre className="text-xs bg-white p-2 rounded border whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {example.assistantResponse}
                        </pre>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Source: {example.sourceType}</span>
                        {example.jurisdiction && <span>Jurisdiction: {example.jurisdiction}</span>}
                        {example.isUsed && <Badge variant="secondary">Used in Training</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {trainingData && trainingData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-gray-500">
                    Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, trainingData.pagination.total)} of {trainingData.pagination.total}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPage(p => Math.min(trainingData.pagination.totalPages, p + 1))}
                      disabled={page === trainingData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expert Review Queue (CPA Validation) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-rai-500" />
            <CardTitle>Expert Review Queue (CPA Validation)</CardTitle>
            <Badge variant="outline" className="ml-2">
              {expertReviewData?.queue?.length || 0} pending
            </Badge>
          </div>
          <CardDescription>
            Training examples requiring CPA/expert validation before use in finetuning.
            Quality thresholds: Auto-approve ≥{qualityStats?.thresholds?.autoApprove ? (qualityStats.thresholds.autoApprove * 100).toFixed(0) : '90'}% | 
            Expert Review ≥{qualityStats?.thresholds?.expertReview ? (qualityStats.thresholds.expertReview * 100).toFixed(0) : '70'}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quality Statistics */}
          {qualityStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">{qualityStats.qualityDistribution.excellent}</div>
                <div className="text-xs text-green-600">Excellent (≥90%)</div>
              </div>
              <div className="p-3 bg-rai-50 rounded-lg">
                <div className="text-lg font-bold text-rai-700">{qualityStats.qualityDistribution.good}</div>
                <div className="text-xs text-rai-600">Good (70-89%)</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-bold text-yellow-700">{qualityStats.qualityDistribution.fair}</div>
                <div className="text-xs text-yellow-600">Fair (50-69%)</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-700">{qualityStats.anomaliesDetected}</div>
                <div className="text-xs text-red-600">Anomalies Detected</div>
              </div>
            </div>
          )}

          {/* Expert Review Queue */}
          {(!expertReviewData?.queue || expertReviewData.queue.length === 0) ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No examples pending expert review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expertReviewData.queue.slice(0, 10).map((item) => (
                <div key={item.exampleId} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <Badge variant="outline">{item.domain}</Badge>
                      <QualityIndicator score={item.qualityScore} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Textarea 
                        placeholder="Review notes..."
                        className="w-48 h-8 text-sm"
                        value={getExpertNotes(item.exampleId)}
                        onChange={(e) => setExpertNotes(item.exampleId, e.target.value)}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleExpertApprove(item.exampleId)}
                        disabled={expertReviewMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleExpertReject(item.exampleId)}
                        disabled={expertReviewMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                  {item.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.flags.map((flag, idx) => (
                        <Badge 
                          key={idx}
                          variant={flag.type === 'error' ? 'destructive' : flag.type === 'warning' ? 'outline' : 'secondary'}
                          className="text-xs"
                        >
                          {flag.code}: {flag.message}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {expertReviewData.queue.length > 10 && (
                <p className="text-sm text-gray-500 text-center">
                  + {expertReviewData.queue.length - 10} more items in queue
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Training Example</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejection. This helps improve future data quality.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
