import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Share2, Eye, FileSpreadsheet, FileCheck, Presentation, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DeliverableTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  category: string;
  isSystem: boolean;
}

export default function DeliverableComposer() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<DeliverableTemplate | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({
    client_name: "",
    entity_type: "",
    tax_year: "2025",
    income_amount: "",
    jurisdiction: ""
  });
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedInstanceId, setGeneratedInstanceId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/auth');
    }
  }, [user, authLoading, setLocation]);

  // Fetch templates from API
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/deliverables/templates']
  });

  // Fetch user's deliverable instances
  const { data: instances = [] } = useQuery({
    queryKey: ['/api/deliverables/instances']
  });

  // Generate deliverable mutation
  const generateMutation = useMutation({
    mutationFn: async ({ templateId, variables }: { templateId: string; variables: Record<string, any> }) => {
      const response = await fetch('/api/deliverables/generate', {
        method: 'POST',
        body: JSON.stringify({ templateId, variables }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedContent((data as any).contentMarkdown);
      setGeneratedInstanceId((data as any).id);
      queryClient.invalidateQueries({ queryKey: ['/api/deliverables/instances'] });
      toast({
        title: "Deliverable Generated",
        description: "Your professional document is ready for review",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate deliverable",
        variant: "destructive"
      });
    }
  });

  // Export deliverable mutation
  const exportMutation = useMutation({
    mutationFn: async ({ instanceId, format }: { instanceId: string; format: string }) => {
      const response = await fetch(`/api/deliverables/instances/${instanceId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      // Download the exported file from base64 buffer
      if (data.buffer) {
        const byteCharacters = atob(data.buffer);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const mimeType = data.format === 'docx' 
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          : 'application/pdf';
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deliverable.${data.format || 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast({
        title: "Export Complete",
        description: `Document exported to ${data.format?.toUpperCase()}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export deliverable",
        variant: "destructive"
      });
    }
  });

  const handleSelectTemplate = (templateId: string) => {
    const template = (templates as any[]).find((t: any) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setDocumentTitle("");
      setGeneratedContent(null);
      setGeneratedInstanceId(null);
    }
  };

  const handleGenerateDeliverable = async () => {
    if (!selectedTemplate) {
      toast({
        title: "No Template Selected",
        description: "Please select a template first",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Generating Deliverable",
      description: "Creating professional document with AI assistance...",
    });

    generateMutation.mutate({
      templateId: selectedTemplate.id,
      variables: {
        deliverableTitle: documentTitle || selectedTemplate.name,
        ...variables
      }
    });
  };

  const handleExportDeliverable = (format: 'docx' | 'pdf') => {
    const instanceId = generatedInstanceId || ((instances as any[]).length > 0 ? (instances as any[])[0].id : null);
    if (!instanceId) {
      toast({
        title: "No Deliverable",
        description: "Please generate a deliverable first",
        variant: "destructive"
      });
      return;
    }

    exportMutation.mutate({ instanceId, format });
  };

  if (templatesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

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
            Client Deliverable Composer
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate professional-grade documents in minutes: audit plans, tax memos, checklists, presentations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Template Selection */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Template</CardTitle>
                <CardDescription>
                  Choose from professional templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(templates as any[]).map((template: any) => (
                  <div
                    key={template.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover-elevate ${
                      selectedTemplate?.id === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                    onClick={() => handleSelectTemplate(template.id)}
                    data-testid={`template-${template.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {template.type === 'audit_plan' && <FileCheck className="w-5 h-5 text-primary" />}
                        {template.type === 'tax_memo' && <FileText className="w-5 h-5 text-secondary" />}
                        {template.type === 'checklist' && <FileSpreadsheet className="w-5 h-5 text-success" />}
                        {template.type === 'board_presentation' && <Presentation className="w-5 h-5 text-gold" />}
                        {template.type === 'client_letter' && <Mail className="w-5 h-5 text-accent" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Middle Column: Configuration */}
          <div className="lg:col-span-2 space-y-4">
            {selectedTemplate ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Configure Document</CardTitle>
                    <CardDescription>
                      Fill in the details for {selectedTemplate.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="document-title">Document Title</Label>
                      <Input
                        id="document-title"
                        data-testid="input-document-title"
                        placeholder={selectedTemplate.name}
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                      />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="client-name">Client Name</Label>
                        <Input
                          id="client-name"
                          data-testid="input-client-name"
                          placeholder="ABC Corporation"
                          value={variables.client_name}
                          onChange={(e) => setVariables({ ...variables, client_name: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="entity-type">Entity Type</Label>
                        <Select
                          value={variables.entity_type}
                          onValueChange={(value) => setVariables({ ...variables, entity_type: value })}
                        >
                          <SelectTrigger id="entity-type" data-testid="select-entity-type">
                            <SelectValue placeholder="Select entity type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                            <SelectItem value="llc">LLC</SelectItem>
                            <SelectItem value="s-corp">S-Corporation</SelectItem>
                            <SelectItem value="c-corp">C-Corporation</SelectItem>
                            <SelectItem value="partnership">Partnership</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="tax-year">Tax Year</Label>
                        <Input
                          id="tax-year"
                          data-testid="input-tax-year"
                          type="number"
                          value={variables.tax_year}
                          onChange={(e) => setVariables({ ...variables, tax_year: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="jurisdiction">Jurisdiction</Label>
                        <Select
                          value={variables.jurisdiction}
                          onValueChange={(value) => setVariables({ ...variables, jurisdiction: value })}
                        >
                          <SelectTrigger id="jurisdiction" data-testid="select-jurisdiction">
                            <SelectValue placeholder="Select jurisdiction" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="California">California</SelectItem>
                            <SelectItem value="Delaware">Delaware</SelectItem>
                            <SelectItem value="Texas">Texas</SelectItem>
                            <SelectItem value="New York">New York</SelectItem>
                            <SelectItem value="Florida">Florida</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="income-amount">Income Amount</Label>
                        <Input
                          id="income-amount"
                          data-testid="input-income-amount"
                          type="number"
                          placeholder="200000"
                          value={variables.income_amount}
                          onChange={(e) => setVariables({ ...variables, income_amount: e.target.value })}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleGenerateDeliverable}
                      disabled={generateMutation.isPending || !variables.client_name}
                      data-testid="button-generate-deliverable"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {generateMutation.isPending ? "Generating..." : "Generate Deliverable"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview/Generated Content */}
                {generatedContent && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Generated Document</CardTitle>
                          <CardDescription>Review and export your deliverable</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPreviewOpen(true)}
                            data-testid="button-preview-fullscreen"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportDeliverable('docx')}
                            disabled={exportMutation.isPending}
                            data-testid="button-export-docx"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {exportMutation.isPending ? "Exporting..." : "Export DOCX"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportDeliverable('pdf')}
                            disabled={exportMutation.isPending}
                            data-testid="button-export-pdf"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {exportMutation.isPending ? "Exporting..." : "Export PDF"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="button-share-deliverable"
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none">
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-lg border">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {generatedContent}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Fullscreen Preview Dialog */}
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Document Preview: {documentTitle || selectedTemplate?.name}
                      </DialogTitle>
                      <DialogDescription>
                        Full preview of your generated deliverable
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto">
                      <div className="prose prose-sm max-w-none p-6 bg-white dark:bg-slate-900 rounded-lg border min-h-[400px]">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {generatedContent}
                        </pre>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => handleExportDeliverable('docx')}
                        disabled={exportMutation.isPending}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export DOCX
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleExportDeliverable('pdf')}
                        disabled={exportMutation.isPending}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>
                      <Button onClick={() => setIsPreviewOpen(false)}>
                        Close Preview
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Card>
                <CardContent className="py-24 text-center text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Select a template to get started</p>
                  <p className="text-sm mt-2">
                    Choose from audit plans, tax memos, checklists, and more
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
