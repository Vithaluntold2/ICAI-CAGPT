import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Search, AlertTriangle, CheckCircle, FileText, TrendingDown, TrendingUp, Info, ArrowLeft, Loader2, Download, GitCompare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ForensicFinding {
  id: string;
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impactedMetrics?: Record<string, number>;
  status: string;
}

interface ForensicDocument {
  id: string;
  filename: string;
  documentType: string;
  analysisStatus: string;
}

export default function ForensicIntelligence() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [caseTitle, setCaseTitle] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [reconcileSource, setReconcileSource] = useState<string>("");
  const [reconcileTarget, setReconcileTarget] = useState<string>("");
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/auth');
    }
  }, [user, authLoading, setLocation]);

  // Fetch forensic cases
  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ['/api/forensics/cases']
  });

  // Fetch documents for selected case
  const { data: documents = [] } = useQuery({
    queryKey: ['/api/forensics/cases', selectedCaseId, 'documents'],
    enabled: !!selectedCaseId
  });

  // Fetch findings for selected case
  const { data: findings = [] } = useQuery({
    queryKey: ['/api/forensics/cases', selectedCaseId, 'findings'],
    enabled: !!selectedCaseId
  });

  // Create case mutation
  const createCaseMutation = useMutation({
    mutationFn: async (caseData: { title: string }) => {
      const response = await fetch('/api/forensics/cases', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(caseData),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedCaseId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/forensics/cases'] });
      toast({
        title: "Case Created",
        description: "Ready to upload documents for analysis",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Case",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ caseId, formData }: { caseId: string; formData: FormData }) => {
      const response = await fetch(`/api/forensics/cases/${caseId}/documents`, {
        method: 'POST',
        body: formData
      });
      return response.json();
    },
    onSuccess: () => {
      if (selectedCaseId) {
        queryClient.invalidateQueries({ queryKey: ['/api/forensics/cases', selectedCaseId, 'documents'] });
      }
      toast({
        title: "Document Uploaded",
        description: "Document is being analyzed for anomalies...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive"
      });
    }
  });

  // Analyze case mutation
  const analyzeCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await fetch(`/api/forensics/cases/${caseId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: () => {
      if (selectedCaseId) {
        queryClient.invalidateQueries({ queryKey: ['/api/forensics/cases', selectedCaseId, 'findings'] });
      }
      toast({
        title: "Analysis Complete",
        description: "Forensic analysis has identified potential anomalies",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze case",
        variant: "destructive"
      });
    }
  });

  const handleCreateCase = () => {
    if (!caseTitle.trim()) {
      toast({
        title: "Case Title Required",
        description: "Please enter a case title",
        variant: "destructive"
      });
      return;
    }

    createCaseMutation.mutate({ title: caseTitle });
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!selectedCaseId) {
      toast({
        title: "No Case Selected",
        description: "Please create a case first",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Uploading Documents",
      description: `Processing ${files.length} document(s)...`,
    });

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      
      await uploadDocumentMutation.mutateAsync({
        caseId: selectedCaseId,
        formData
      });
    }
  };

  const handleAnalyzeCase = () => {
    if (!selectedCaseId) {
      toast({
        title: "No Case Selected",
        description: "Please create a case and upload documents first",
        variant: "destructive"
      });
      return;
    }

    analyzeCaseMutation.mutate(selectedCaseId);
  };

  const handleGenerateReport = async () => {
    if (!selectedCaseId) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch(`/api/forensics/cases/${selectedCaseId}/report`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forensic-report-${selectedCaseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Report generated", description: "PDF downloaded" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Report failed", description: e.message });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedCaseId || !reconcileSource || !reconcileTarget) {
      toast({ variant: "destructive", title: "Pick two documents" });
      return;
    }
    if (reconcileSource === reconcileTarget) {
      toast({ variant: "destructive", title: "Source and target must differ" });
      return;
    }
    try {
      const res = await fetch(`/api/forensics/cases/${selectedCaseId}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocumentId: reconcileSource, targetDocumentId: reconcileTarget })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReconcileResult(data);
      toast({
        title: "Reconciliation complete",
        description: `${data.summary.matchedCount} matched, ${data.discrepancies.length} discrepancies`
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Reconciliation failed", description: e.message });
    }
  };

  const handleLoadTimeline = async () => {
    if (!selectedCaseId) return;
    try {
      const res = await fetch(`/api/forensics/cases/${selectedCaseId}/timeline`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTimelineData(data);
      toast({ title: "Timeline loaded", description: `${data.totalEvents} events` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Timeline failed", description: e.message });
    }
  };

  // Get overall risk score from case data
  const selectedCase = (cases as any[]).find((c: any) => c.id === selectedCaseId);
  const overallRiskScore = selectedCase?.overallRiskScore || 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'medium': return <Info className="w-5 h-5 text-secondary" />;
      case 'low': return <CheckCircle className="w-5 h-5 text-muted-foreground" />;
      default: return <Info className="w-5 h-5" />;
    }
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
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Back to Chat Button */}
        <div>
          <Button variant="ghost" size="sm" asChild data-testid="button-back-to-chat">
            <Link href="/chat">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Link>
          </Button>
        </div>
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Forensic Document Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">
            Proactive anomaly detection and cross-document reconciliation
          </p>
          {selectedCase && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border" data-testid="selected-case-banner">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Active case</p>
                  <p className="font-semibold text-lg">{(selectedCase as any).title}</p>
                  <p className="text-xs font-mono text-muted-foreground">{(selectedCase as any).id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(selectedCase as any).severityLevel && (
                    <Badge variant={['critical','high'].includes((selectedCase as any).severityLevel) ? 'destructive' : 'secondary'}>
                      {(selectedCase as any).severityLevel}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {(selectedCase as any).totalFindings ?? 0} findings
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCaseId(null)}
                    data-testid="button-close-case"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Case Setup & Document Upload */}
          <div className="lg:col-span-1 space-y-4">
            <Card data-testid="card-case-list">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Cases</span>
                  <Badge variant="outline" data-testid="badge-case-count">
                    {(cases as any[]).length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {(cases as any[]).length === 0
                    ? 'No cases yet — create one below to get started.'
                    : 'Click a case to open it.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {casesLoading && (
                  <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading cases…
                  </div>
                )}
                {!casesLoading && (cases as any[]).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No forensic cases yet.
                  </div>
                )}
                {(cases as any[]).map((c: any) => {
                  const active = c.id === selectedCaseId;
                  const sev = c.severityLevel;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      data-testid={`case-item-${c.id}`}
                      className={
                        "w-full text-left p-3 rounded-md border transition-colors " +
                        (active
                          ? "bg-primary/10 border-primary"
                          : "bg-background hover:bg-muted border-border")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm truncate flex-1">{c.title}</span>
                        {sev && (
                          <Badge
                            variant={['critical', 'high'].includes(sev) ? 'destructive' : 'secondary'}
                            className="text-[10px] shrink-0"
                          >
                            {sev}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span>{c.totalFindings ?? 0} findings</span>
                        {typeof c.overallRiskScore === 'number' && c.overallRiskScore > 0 && (
                          <span>risk {c.overallRiskScore}/100</span>
                        )}
                        <span className="ml-auto">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>New Forensic Case</CardTitle>
                <CardDescription>
                  Upload documents for analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="case-title">Case Title</Label>
                  <Input
                    id="case-title"
                    data-testid="input-case-title"
                    placeholder="e.g., Q4 2024 Revenue Analysis"
                    value={caseTitle}
                    onChange={(e) => setCaseTitle(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleCreateCase}
                  disabled={createCaseMutation.isPending || !caseTitle.trim()}
                  className="w-full"
                  data-testid="button-create-case"
                >
                  {createCaseMutation.isPending ? "Creating..." : "Create Case"}
                </Button>

                <Separator />

                <div>
                  <Label>Upload Documents</Label>
                  <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.tiff,.xlsx,.xls,.csv,.txt"
                      onChange={handleDocumentUpload}
                      className="hidden"
                      id="file-upload"
                      data-testid="input-file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, images, Excel (XLSX/XLS), CSV, TXT
                      </p>
                    </label>
                  </div>
                </div>

                {(documents as ForensicDocument[]).length > 0 && (
                  <div className="space-y-2">
                    <Label>Uploaded Documents</Label>
                    {(documents as ForensicDocument[]).map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 border rounded-lg text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{doc.filename}</span>
                        <Badge variant="outline" className="text-xs">{doc.documentType}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {(documents as ForensicDocument[]).length > 0 && (
                  <>
                    <Button
                      onClick={handleAnalyzeCase}
                      disabled={analyzeCaseMutation.isPending}
                      className="w-full"
                      data-testid="button-run-analysis"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      {analyzeCaseMutation.isPending ? "Analyzing..." : "Run Forensic Analysis"}
                    </Button>

                    <Button
                      onClick={handleGenerateReport}
                      disabled={isGeneratingReport}
                      variant="secondary"
                      className="w-full"
                      data-testid="button-generate-report"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isGeneratingReport ? "Generating..." : "Generate Report (PDF)"}
                    </Button>

                    <Button
                      onClick={handleLoadTimeline}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-timeline"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Load Timeline
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {(documents as ForensicDocument[]).length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4" />
                    Reconciliation
                  </CardTitle>
                  <CardDescription>Match entries across two documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Source document</Label>
                    <select
                      className="w-full mt-1 p-2 border rounded-md bg-background text-sm"
                      value={reconcileSource}
                      onChange={(e) => setReconcileSource(e.target.value)}
                      data-testid="select-reconcile-source"
                    >
                      <option value="">— pick source —</option>
                      {(documents as any[]).map((d) => (
                        <option key={d.id} value={d.id}>{d.filename}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Target document</Label>
                    <select
                      className="w-full mt-1 p-2 border rounded-md bg-background text-sm"
                      value={reconcileTarget}
                      onChange={(e) => setReconcileTarget(e.target.value)}
                      data-testid="select-reconcile-target"
                    >
                      <option value="">— pick target —</option>
                      {(documents as any[]).map((d) => (
                        <option key={d.id} value={d.id}>{d.filename}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleReconcile}
                    disabled={!reconcileSource || !reconcileTarget}
                    className="w-full"
                    data-testid="button-reconcile"
                  >
                    <GitCompare className="w-4 h-4 mr-2" />
                    Reconcile
                  </Button>

                  {reconcileResult && (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="p-2 bg-muted rounded">
                        <div className="font-semibold">Summary</div>
                        <div>Matched: {reconcileResult.summary.matchedCount}</div>
                        <div>Unmatched (source): {reconcileResult.summary.unmatchedSourceCount}</div>
                        <div>Unmatched (target): {reconcileResult.summary.unmatchedTargetCount}</div>
                        <div>Amount mismatches: {reconcileResult.summary.amountMismatchCount}</div>
                        <div>Timing mismatches: {reconcileResult.summary.timingMismatchCount}</div>
                      </div>
                      {reconcileResult.discrepancies.slice(0, 15).map((d: any, i: number) => (
                        <div key={i} className="p-2 border rounded">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium text-[11px]">{d.nature}</span>
                            <Badge variant={d.severity === 'high' ? 'destructive' : 'outline'} className="text-[10px]">
                              {d.severity}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-1">{d.description}</div>
                          <div className="text-[10px] text-muted-foreground mt-1 italic">→ {d.suggestedAction}</div>
                        </div>
                      ))}
                      {reconcileResult.discrepancies.length > 15 && (
                        <div className="text-muted-foreground italic">
                          …and {reconcileResult.discrepancies.length - 15} more discrepancies
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {timelineData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timeline
                  </CardTitle>
                  <CardDescription>
                    {timelineData.totalEvents} events · {timelineData.dateRange.earliest?.split('T')[0]} → {timelineData.dateRange.latest?.split('T')[0]}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto text-xs">
                  {timelineData.events.slice(0, 50).map((ev: any) => (
                    <div key={ev.id} className="border-l-2 border-muted pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[10px]">
                          {ev.date.split('T')[0]}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{ev.eventType}</Badge>
                        {ev.severity && (
                          <Badge variant={ev.severity === 'high' || ev.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {ev.severity}
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium mt-1">{ev.title}</div>
                      {ev.description && <div className="text-muted-foreground mt-0.5 text-[11px]">{ev.description}</div>}
                      {ev.sourceDocumentFilename && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                          ← {ev.sourceDocumentFilename}
                          {typeof ev.rowIndex === 'number' ? ` · row ${ev.rowIndex + 1}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                  {timelineData.events.length > 50 && (
                    <div className="text-muted-foreground italic text-center pt-2">
                      …showing first 50 of {timelineData.events.length} events
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {overallRiskScore > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Risk Score</span>
                        <span className="text-2xl font-bold text-destructive">{overallRiskScore}/100</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-destructive transition-all"
                          style={{ width: `${overallRiskScore}%` }}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Critical Issues</span>
                        <span className="font-semibold text-destructive">
                          {(findings as ForensicFinding[]).filter((f: ForensicFinding) => f.severity === 'critical').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>High Priority</span>
                        <span className="font-semibold text-destructive">
                          {(findings as ForensicFinding[]).filter((f: ForensicFinding) => f.severity === 'high').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Medium Priority</span>
                        <span className="font-semibold text-secondary">
                          {(findings as ForensicFinding[]).filter((f: ForensicFinding) => f.severity === 'medium').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Findings */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Forensic Findings</CardTitle>
                <CardDescription>
                  Anomalies and discrepancies detected across documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(findings as ForensicFinding[]).length > 0 ? (
                  (findings as ForensicFinding[]).map((finding: ForensicFinding) => (
                    <Alert
                      key={finding.id}
                      variant={finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' : 'default'}
                      className="relative"
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5">
                          {getSeverityIcon(finding.severity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <AlertTitle className="flex items-center gap-2">
                              {finding.title}
                              <Badge variant={getSeverityColor(finding.severity) as any} className="text-xs">
                                {finding.severity}
                              </Badge>
                            </AlertTitle>
                          </div>
                          <AlertDescription className="mt-2">
                            {finding.description}
                          </AlertDescription>
                          
                          {finding.impactedMetrics && (
                            <div className="mt-4 p-3 bg-background/50 rounded-lg space-y-2">
                              <p className="text-sm font-medium">Impacted Metrics:</p>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(finding.impactedMetrics).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    {(value as number) < 0 ? (
                                      <TrendingDown className="w-4 h-4 text-destructive" />
                                    ) : (
                                      <TrendingUp className="w-4 h-4 text-success" />
                                    )}
                                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                    <span className="font-medium">
                                      {typeof value === 'number' && Math.abs(value) > 100 
                                        ? `$${Math.abs(value).toLocaleString()}`
                                        : `${value}${typeof value === 'number' && key.includes('pct') ? '%' : ''}`
                                      }
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 flex gap-2">
                            <Button size="sm" variant="outline" data-testid={`button-investigate-${finding.id}`}>
                              <Search className="w-3 h-3 mr-2" />
                              Investigate
                            </Button>
                            <Button size="sm" variant="outline" data-testid={`button-resolve-${finding.id}`}>
                              Mark Resolved
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Alert>
                  ))
                ) : (
                  <div className="py-24 text-center text-muted-foreground">
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No documents analyzed yet</p>
                    <p className="text-sm mt-2">
                      Upload financial documents to begin forensic analysis
                    </p>
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
