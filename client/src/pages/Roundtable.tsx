import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Sparkles,
  Calculator,
  FileBarChart,
  TrendingUp,
  FileEdit,
  Search,
  Network,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Send,
  RefreshCw,
  History,
} from "lucide-react";

interface ModeStatus {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'active' | 'complete' | 'error';
  progress: number;
  agents: string[];
  output?: any;
}

interface ErrorDetails {
  error: string;
  code?: string;
  retryable?: boolean;
  recoveryHint?: string;
  partialResults?: any;
  successfulAgents?: string[];
  failedAgents?: string[];
}

export default function Roundtable() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [modesStatus, setModesStatus] = useState<ModeStatus[]>([]);
  const [query, setQuery] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [workflowError, setWorkflowError] = useState<ErrorDetails | null>(null);
  const [finalResults, setFinalResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("workflows");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Past-session history — fetched from /api/roundtable/sessions. The
  // backend has always been persisting each run; the page just wasn't
  // rendering anything, so 15 prior roundtables were "lost" from the
  // user's perspective. Loading + reload handled here.
  interface PastSession {
    sessionId: string;
    query: string;
    workflowId: string;
    status: string;
    startedAt?: string;
    finalResult?: any;
  }
  const [history, setHistory] = useState<PastSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/roundtable/sessions', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Server merges in-memory + DB sessions under `sessions`. Sort by
      // startedAt desc so newest bubbles to top.
      const list: PastSession[] = (data.sessions || []).slice().sort(
        (a: any, b: any) =>
          new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime(),
      );
      setHistory(list);
    } catch (err) {
      console.error('[Roundtable] Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Initial fetch + refetch after every successful run so a new entry
  // appears in the History tab without a manual refresh.
  useEffect(() => {
    if (user) loadHistory();
  }, [user, loadHistory]);
  useEffect(() => {
    if (finalResults && !isExecuting) {
      // Give the server a moment to persist the final status update.
      const t = setTimeout(() => loadHistory(), 400);
      return () => clearTimeout(t);
    }
  }, [finalResults, isExecuting, loadHistory]);

  // Replay a past session: restore query + final result from history
  // and jump to the Results tab. Doesn't re-run the agents.
  const loadPastSession = useCallback((s: PastSession) => {
    setQuery(s.query);
    setSessionId(s.sessionId);
    setActiveWorkflow(s.workflowId);
    setFinalResults(s.finalResult ?? null);
    setWorkflowError(null);
    setActiveTab(s.finalResult ? 'results' : 'workflows');
  }, []);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/auth');
    }
  }, [user, authLoading, setLocation]);

  const workflows = [
    {
      id: 'ma-analysis',
      name: 'M&A Analysis',
      description: 'Complete merger & acquisition due diligence',
      modes: ['expert-assembler', 'perspective-collector', 'argument-analyzer', 'consensus-synthesizer', 'recommendation-finalizer'],
    },
    {
      id: 'fraud-investigation',
      name: 'Fraud Investigation',
      description: 'Comprehensive forensic analysis and reporting',
      modes: ['expert-assembler', 'discussion-moderator', 'argument-analyzer', 'consensus-synthesizer', 'recommendation-finalizer'],
    },
    {
      id: 'tax-planning',
      name: 'Tax Planning',
      description: 'Multi-scenario tax optimization strategy',
      modes: ['expert-assembler', 'perspective-collector', 'argument-analyzer', 'consensus-synthesizer', 'recommendation-finalizer'],
    },
    {
      id: 'audit-execution',
      name: 'Audit Execution',
      description: 'End-to-end audit planning and execution',
      modes: ['expert-assembler', 'discussion-moderator', 'perspective-collector', 'argument-analyzer', 'consensus-synthesizer', 'recommendation-finalizer'],
    },
  ];

  const modeDetails = {
    'deep-research': { name: 'Deep Research', icon: Sparkles, color: 'text-primary' },
    'calculation': { name: 'Financial Calculation', icon: Calculator, color: 'text-accent' },
    'audit-plan': { name: 'Audit Planning', icon: FileBarChart, color: 'text-gold' },
    'scenario-simulator': { name: 'Scenario Simulator', icon: TrendingUp, color: 'text-primary' },
    'deliverable-composer': { name: 'Deliverable Composer', icon: FileEdit, color: 'text-rai-500' },
    'forensic-intelligence': { name: 'Forensic Intelligence', icon: Search, color: 'text-red-500' },
    'workflow': { name: 'Workflow Visualization', icon: Network, color: 'text-secondary' },
    // Roundtable agents
    'expert-assembler': { name: 'Expert Assembler', icon: Users, color: 'text-green-500' },
    'discussion-moderator': { name: 'Discussion Moderator', icon: Users, color: 'text-rai-400' },
    'perspective-collector': { name: 'Perspective Collector', icon: Sparkles, color: 'text-primary/80' },
    'argument-analyzer': { name: 'Argument Analyzer', icon: Search, color: 'text-orange-500' },
    'consensus-synthesizer': { name: 'Consensus Synthesizer', icon: Network, color: 'text-rai-500' },
    'recommendation-finalizer': { name: 'Recommendation Finalizer', icon: FileEdit, color: 'text-gold' },
  };

  const getStatusIcon = (status: ModeStatus['status']) => {
    switch (status) {
      case 'pending':
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
      case 'active':
        return <Loader2 className="h-4 w-4 animate-spin text-rai-500" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  // Poll for workflow status
  const pollStatus = useCallback(async (sid: string) => {
    try {
      const response = await fetch(`/api/roundtable/status/${sid}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      
      const data = await response.json();
      
      // Update progress based on status
      if (data.status === 'running') {
        setModesStatus(prev => {
          const updated = [...prev];
          // Update progress proportionally
          const progressPerMode = 100 / updated.length;
          const completedModes = Math.floor(data.progress / progressPerMode);
          
          updated.forEach((mode, idx) => {
            if (idx < completedModes) {
              mode.status = 'complete';
              mode.progress = 100;
            } else if (idx === completedModes) {
              mode.status = 'active';
              mode.progress = (data.progress % progressPerMode) * (100 / progressPerMode);
            } else {
              mode.status = 'pending';
              mode.progress = 0;
            }
          });
          
          return updated;
        });
        
        // Continue polling
        setTimeout(() => pollStatus(sid), 1000);
      } else if (data.status === 'completed') {
        // Fetch final results
        const resultsResponse = await fetch(`/api/roundtable/results/${sid}`, {
          credentials: 'include',
        });
        
        if (resultsResponse.ok) {
          const results = await resultsResponse.json();
          setFinalResults(results);
          
          // Mark all modes complete
          setModesStatus(prev => prev.map(m => ({
            ...m,
            status: 'complete' as const,
            progress: 100,
            output: results.agentOutputs?.[m.id] || null,
          })));
        }
        
        setIsExecuting(false);
        setActiveTab('results');
        toast({
          title: "Workflow Complete",
          description: "All agents have finished processing your query.",
        });
      } else if (data.status === 'failed' || data.status === 'partial') {
        // Store full error details from API
        const errorDetails: ErrorDetails = {
          error: data.error || 'Workflow execution failed',
          code: data.errorCode,
          retryable: data.errorDetails?.retryable ?? true,
          recoveryHint: data.errorDetails?.recoveryHint,
          partialResults: data.errorDetails?.partialResults,
          successfulAgents: data.successfulAgents || [],
          failedAgents: data.failedAgents || [],
        };
        setWorkflowError(errorDetails);
        setIsExecuting(false);
        
        // Mark modes based on success/failure tracking
        setModesStatus(prev => {
          const updated = [...prev];
          updated.forEach((mode) => {
            if (errorDetails.successfulAgents?.some(a => mode.id.includes(a.split('-')[0]))) {
              mode.status = 'complete';
              mode.progress = 100;
            } else if (errorDetails.failedAgents?.some(a => mode.id.includes(a.split('-')[0]))) {
              mode.status = 'error';
            }
          });
          // Fallback: mark first active as error
          const hasMarked = updated.some(m => m.status === 'error');
          if (!hasMarked) {
            const activeIdx = updated.findIndex(m => m.status === 'active');
            if (activeIdx >= 0) {
              updated[activeIdx].status = 'error';
            }
          }
          return updated;
        });
        
        toast({
          title: errorDetails.retryable ? "Workflow Failed - Retry Available" : "Workflow Failed",
          description: errorDetails.recoveryHint || errorDetails.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Status polling error:', error);
      // Retry on transient errors
      setTimeout(() => pollStatus(sid), 2000);
    }
  }, [toast]);

  // Connect to SSE stream for real-time updates
  const connectToStream = useCallback((sid: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/roundtable/stream/${sid}`, {
      withCredentials: true,
    });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Connected:', data);
    });

    eventSource.addEventListener('agent-started', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Agent started:', data.agent);
      
      setModesStatus(prev => {
        const updated = [...prev];
        updated.forEach((mode, idx) => {
          if (idx < data.index) {
            mode.status = 'complete';
            mode.progress = 100;
          } else if (idx === data.index) {
            mode.status = 'active';
            mode.progress = 0;
          } else {
            mode.status = 'pending';
            mode.progress = 0;
          }
        });
        return updated;
      });
    });

    eventSource.addEventListener('workflow-completed', async () => {
      console.log('[SSE] Workflow completed');
      eventSource.close();
      
      // Fetch final results
      try {
        const resultsResponse = await fetch(`/api/roundtable/results/${sid}`, {
          credentials: 'include',
        });
        
        if (resultsResponse.ok) {
          const results = await resultsResponse.json();
          setFinalResults(results);
          
          // Mark all modes complete
          setModesStatus(prev => prev.map(m => ({
            ...m,
            status: 'complete' as const,
            progress: 100,
            output: results.agentOutputs?.[m.id] || null,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch results:', err);
      }
      
      setIsExecuting(false);
      setActiveTab('results');
      toast({
        title: "Workflow Complete",
        description: "All agents have finished processing your query.",
      });
    });

    eventSource.addEventListener('workflow-failed', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Workflow failed:', data);
      eventSource.close();
      
      // Store full error details
      const errorDetails: ErrorDetails = {
        error: data.error || 'Workflow execution failed',
        code: data.code,
        retryable: data.retryable ?? true,
        recoveryHint: data.recoveryHint,
        partialResults: data.partialResults,
        successfulAgents: data.successfulAgents || [],
        failedAgents: data.failedAgents || [],
      };
      setWorkflowError(errorDetails);
      setIsExecuting(false);
      
      // Mark failed agents and successful ones
      setModesStatus(prev => {
        const updated = [...prev];
        updated.forEach((mode) => {
          if (errorDetails.successfulAgents?.some(a => mode.id.includes(a.split('-')[0]))) {
            mode.status = 'complete';
            mode.progress = 100;
          } else if (errorDetails.failedAgents?.some(a => mode.id.includes(a.split('-')[0]))) {
            mode.status = 'error';
          }
        });
        // If no specific tracking, mark first active as error
        const hasMarked = updated.some(m => m.status === 'error');
        if (!hasMarked) {
          const activeIdx = updated.findIndex(m => m.status === 'active');
          if (activeIdx >= 0) {
            updated[activeIdx].status = 'error';
          }
        }
        return updated;
      });
      
      toast({
        title: errorDetails.retryable ? "Workflow Failed - Retry Available" : "Workflow Failed",
        description: errorDetails.recoveryHint || errorDetails.error,
        variant: "destructive",
      });
    });

    eventSource.onerror = (e) => {
      console.error('[SSE] Connection error:', e);
      eventSource.close();
      
      // Fallback to polling if SSE fails
      console.log('[SSE] Falling back to polling...');
      pollStatus(sid);
    };

    return eventSource;
  }, [toast, pollStatus]);

  // Execute workflow via API
  const executeWorkflow = async (workflowId: string) => {
    if (!query.trim() || query.length < 10) {
      toast({
        title: "Query Required",
        description: "Please enter a query with at least 10 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    setWorkflowError(null);
    setFinalResults(null);
    setActiveWorkflow(workflowId);
    setActiveTab('execution');

    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    // Initialize mode statuses
    const initialStatus: ModeStatus[] = workflow.modes.map((modeId, index) => ({
      id: modeId,
      name: modeDetails[modeId as keyof typeof modeDetails]?.name || modeId,
      icon: modeDetails[modeId as keyof typeof modeDetails]?.icon || Users,
      status: index === 0 ? 'active' : 'pending',
      progress: 0,
      agents: [],
    }));
    setModesStatus(initialStatus);

    try {
      const response = await fetch('/api/roundtable/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: query.trim(),
          workflowId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start workflow');
      }

      const data = await response.json();
      setSessionId(data.sessionId);

      toast({
        title: "Workflow Started",
        description: "Processing your query with multiple expert agents...",
      });

      // Connect to SSE stream for real-time updates
      connectToStream(data.sessionId);

    } catch (error) {
      console.error('Execute workflow error:', error);
      setWorkflowError(error instanceof Error ? error.message : 'Unknown error');
      setIsExecuting(false);
      
      toast({
        title: "Failed to Start",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  // Reset workflow state
  const resetWorkflow = () => {
    // Close SSE connection if open
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setActiveWorkflow(null);
    setModesStatus([]);
    setSessionId(null);
    setIsExecuting(false);
    setWorkflowError(null);
    setFinalResults(null);
    setActiveTab('workflows');
  };

  // Show loading state while checking authentication
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{authLoading ? 'Loading...' : 'Redirecting to login...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-green-500" />
          <h1 className="text-3xl font-bold">Roundtable Mode</h1>
        </div>
        <p className="text-muted-foreground">
          Multi-mode orchestration for complex accounting and advisory workflows
        </p>
      </div>

      {/* Query Input Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Your Query
          </CardTitle>
          <CardDescription>
            Enter a complex question that requires multiple expert perspectives
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Example: Analyze the tax implications and financial viability of a cross-border M&A transaction between a US tech company and a UK fintech startup, considering transfer pricing, withholding taxes, and regulatory compliance..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[100px]"
              disabled={isExecuting}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {query.length} characters {query.length < 10 && query.length > 0 && "(minimum 10)"}
              </span>
              {activeWorkflow && (
                <Button variant="outline" onClick={resetWorkflow} disabled={isExecuting}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="execution" disabled={!activeWorkflow}>
            Execution
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!finalResults}>
            Results
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="roundtable-history-tab">
            <History className="h-3.5 w-3.5 mr-1.5" />
            History{history.length > 0 ? ` (${history.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Past Roundtables</h3>
              <p className="text-sm text-muted-foreground">
                Your previous queries and their expert-panel results.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
              disabled={loadingHistory}
              data-testid="roundtable-history-refresh"
            >
              {loadingHistory ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
          </div>

          {loadingHistory && history.length === 0 ? (
            <Card>
              <CardContent className="py-10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No past roundtables yet. Run a workflow above and it'll show up here.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((s) => {
                const workflow = workflows.find((w) => w.id === s.workflowId);
                const isDone = s.status === 'completed' || !!s.finalResult;
                return (
                  <Card
                    key={s.sessionId}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => loadPastSession(s)}
                    data-testid={`roundtable-history-item-${s.sessionId}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {workflow?.name || s.workflowId}
                            </Badge>
                            <Badge
                              variant={isDone ? 'default' : s.status === 'failed' ? 'destructive' : 'outline'}
                              className="text-[10px]"
                            >
                              {s.status}
                            </Badge>
                            {s.startedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(s.startedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground line-clamp-2 leading-snug">
                            {s.query}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{workflow.name}</CardTitle>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {workflow.modes.map((modeId, index) => {
                        const mode = modeDetails[modeId as keyof typeof modeDetails];
                        const Icon = mode?.icon || Users;
                        return (
                          <div key={modeId} className="flex items-center gap-1">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Icon className={`h-3 w-3 ${mode?.color}`} />
                              {mode?.name}
                            </Badge>
                            {index < workflow.modes.length - 1 && (
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={() => executeWorkflow(workflow.id)}
                      className="w-full"
                      disabled={isExecuting || query.length < 10}
                    >
                      {isExecuting && activeWorkflow === workflow.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Start Workflow
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          {activeWorkflow && (
            <Card>
              <CardHeader>
                <CardTitle>Workflow Execution</CardTitle>
                <CardDescription>
                  {workflows.find(w => w.id === activeWorkflow)?.name}
                  {sessionId && <span className="ml-2 text-xs opacity-50">Session: {sessionId.slice(0, 8)}...</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Show query being processed */}
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Query:</p>
                  <p className="text-sm text-muted-foreground">{query}</p>
                </div>

                {/* Error display */}
                {workflowError && (
                  <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Execution Error</span>
                        {workflowError.code && (
                          <Badge variant="outline" className="text-destructive border-destructive/50">
                            {workflowError.code}
                          </Badge>
                        )}
                      </div>
                      {workflowError.retryable && (
                        <Badge variant="secondary">Retryable</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-destructive/80">{workflowError.error}</p>
                    {workflowError.recoveryHint && (
                      <p className="mt-1 text-sm text-muted-foreground italic">{workflowError.recoveryHint}</p>
                    )}
                    
                    {/* Show partial success info */}
                    {workflowError.successfulAgents && workflowError.successfulAgents.length > 0 && (
                      <div className="mt-3 text-sm">
                        <span className="text-green-600 font-medium">
                          ✓ {workflowError.successfulAgents.length} agents completed successfully
                        </span>
                      </div>
                    )}
                    {workflowError.failedAgents && workflowError.failedAgents.length > 0 && (
                      <div className="text-sm">
                        <span className="text-red-600 font-medium">
                          ✗ {workflowError.failedAgents.length} agents failed: {workflowError.failedAgents.join(', ')}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-3">
                      {workflowError.retryable && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => executeWorkflow(activeWorkflow)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={resetWorkflow}
                      >
                        Start Over
                      </Button>
                    </div>
                  </div>
                )}

                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {modesStatus.map((mode, index) => {
                      const Icon = mode.icon;
                      return (
                        <div key={mode.id}>
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 pt-1">
                              {getStatusIcon(mode.status)}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-5 w-5" />
                                <h3 className="font-semibold">{mode.name}</h3>
                                <Badge
                                  variant={
                                    mode.status === 'complete'
                                      ? 'default'
                                      : mode.status === 'active'
                                      ? 'secondary'
                                      : mode.status === 'error'
                                      ? 'destructive'
                                      : 'outline'
                                  }
                                >
                                  {mode.status}
                                </Badge>
                              </div>
                              {mode.status === 'active' && (
                                <Progress value={mode.progress} className="w-full" />
                              )}
                              {mode.agents.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  Agents: {mode.agents.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                          {index < modesStatus.length - 1 && (
                            <Separator className="my-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {finalResults && (
            <Card>
              <CardHeader>
                <CardTitle>Unified Results</CardTitle>
                <CardDescription>
                  Combined output from all modes in the workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Query summary */}
                  <div className="p-3 bg-muted rounded-lg mb-4">
                    <p className="text-sm font-medium mb-1">Original Query:</p>
                    <p className="text-sm text-muted-foreground">{finalResults.query || query}</p>
                  </div>

                  {/* Final synthesized result */}
                  {finalResults.finalResult && (
                    <Card className="border-primary/50">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          Final Recommendation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {typeof finalResults.finalResult === 'string' ? (
                            <p>{finalResults.finalResult}</p>
                          ) : (
                            <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg overflow-auto">
                              {JSON.stringify(finalResults.finalResult, null, 2)}
                            </pre>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Individual agent outputs */}
                  {modesStatus
                    .filter(m => m.status === 'complete' && m.output)
                    .map(mode => (
                      <Card key={mode.id}>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {mode.icon && <mode.icon className="h-5 w-5" />}
                            {mode.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {typeof mode.output === 'string' ? (
                              <p>{mode.output}</p>
                            ) : (
                              <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg overflow-auto">
                                {JSON.stringify(mode.output, null, 2)}
                              </pre>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                  {modesStatus.every(m => m.status === 'complete') && (
                    <div className="flex gap-4">
                      <Button className="flex-1" size="lg">
                        Export Complete Report
                      </Button>
                      <Button variant="outline" size="lg" onClick={resetWorkflow}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        New Query
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
