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
import { Upload, Search, AlertTriangle, CheckCircle, FileText, TrendingDown, TrendingUp, Info, ArrowLeft, Loader2 } from "lucide-react";
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
    mutationFn: async (caseData: { caseTitle: string }) => {
      const response = await fetch('/api/forensics/cases', {
        method: 'POST',
        body: JSON.stringify(caseData),
        headers: { 'Content-Type': 'application/json' }
      });
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

    createCaseMutation.mutate({ caseTitle });
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
      formData.append('document', file);
      
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Case Setup & Document Upload */}
          <div className="lg:col-span-1 space-y-4">
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
                      accept=".pdf,.png,.jpg,.jpeg,.tiff"
                      onChange={handleDocumentUpload}
                      className="hidden"
                      id="file-upload"
                      data-testid="input-file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, PNG, JPEG, TIFF
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
                  <Button
                    onClick={handleAnalyzeCase}
                    disabled={analyzeCaseMutation.isPending}
                    className="w-full"
                    data-testid="button-run-analysis"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {analyzeCaseMutation.isPending ? "Analyzing..." : "Run Forensic Analysis"}
                  </Button>
                )}
              </CardContent>
            </Card>

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
