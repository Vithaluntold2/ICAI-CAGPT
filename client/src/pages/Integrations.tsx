import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, CheckCircle2, XCircle, Trash2, Plus, Upload, Download, FileText, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Integration {
  id: string;
  provider: string;
  companyName: string | null;
  isActive: boolean;
  lastSync: string | null;
  createdAt: string;
}

interface TaxFile {
  id: string;
  vendor: string;
  filename: string;
  formType: string | null;
  size: number;
  scanStatus: 'pending' | 'scanning' | 'clean' | 'infected';
  importStatus: 'pending' | 'imported' | 'failed';
  uploadedAt: string;
}

export default function Integrations() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      // Store the current path so we can redirect back after login
      sessionStorage.setItem('pendingRedirect', '/integrations');
      setLocation('/auth');
    }
  }, [user, authLoading, setLocation]);

  // Check for OAuth callback success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const provider = params.get('provider');
    const message = params.get('message');

    if (success === 'true') {
      toast({
        title: "Integration Connected!",
        description: `Successfully connected to ${provider || 'the service'}.`
      });
      // Clean up URL
      window.history.replaceState({}, '', '/integrations');
    } else if (error === 'true') {
      toast({
        variant: "destructive",
        title: "Integration Failed",
        description: message || "Failed to connect. Please try again."
      });
      // Clean up URL
      window.history.replaceState({}, '', '/integrations');
    }
  }, [toast]);

  const { data: integrationsData } = useQuery({
    queryKey: ['/api/integrations'],
    enabled: !!user,
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete integration');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration Removed",
        description: "The integration has been disconnected successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove integration"
      });
    }
  });

  const connectIntegrationMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/integrations/${providerId}/initiate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to initiate integration');
      return res.json();
    },
    onSuccess: (data: { authUrl: string; provider: string }) => {
      // Redirect to OAuth provider's authorization page
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initiate integration. Please try again."
      });
    }
  });

  const handleConnect = (providerId: string) => {
    connectIntegrationMutation.mutate(providerId);
  };

  const handleDelete = (id: string, provider: string) => {
    if (confirm(`Are you sure you want to disconnect ${provider}?`)) {
      deleteIntegrationMutation.mutate(id);
    }
  };

  const integrations: Integration[] = (integrationsData as any)?.integrations || [];

  const { data: taxFilesData } = useQuery({
    queryKey: ['/api/tax-files'],
    enabled: !!user,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ vendor, file }: { vendor: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('vendor', vendor);
      
      const res = await fetch('/api/tax-files/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "File Uploaded",
        description: "Your file is being scanned and will be available shortly."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-files'] });
      setUploadDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message
      });
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tax-files/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete file');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "File Deleted",
        description: "The file has been securely deleted."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-files'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete file"
      });
    }
  });

  const handleFileUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file || !selectedVendor) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a file and vendor"
      });
      return;
    }
    
    // Client-side file size validation (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Maximum file size is 50MB. Please select a smaller file."
      });
      return;
    }
    
    uploadFileMutation.mutate({ vendor: selectedVendor, file });
  };

  const handleDownloadFile = async (id: string, filename: string) => {
    try {
      const res = await fetch(`/api/tax-files/${id}/download`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Download failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: `${filename} has been downloaded.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: (error as Error).message
      });
    }
  };

  const taxFiles: TaxFile[] = (taxFilesData as any)?.files || [];

  const providers = [
    {
      id: 'tally',
      name: 'Tally Prime',
      description: 'Connect your Tally Prime account for automatic financial data sync',
      icon: Building2,
      color: 'bg-green-500',
    },
    {
      id: 'cleartax',
      name: 'ClearTax',
      description: 'Sync your ClearTax accounting & GST data for comprehensive analysis',
      icon: Building2,
      color: 'bg-rai-500',
    },
    {
      id: 'zoho',
      name: 'Zoho Books India',
      description: 'Integrate with Zoho Books for seamless data access',
      icon: Building2,
      color: 'bg-red-500',
    },
  ];

  const payrollProviders = [
    {
      id: 'keka',
      name: 'Keka HR',
      description: 'Connect Keka for Indian payroll and HR data integration',
      icon: Building2,
      color: 'bg-primary/100',
    },
  ];

  const taxSoftware = [
    { id: 'cleartax-gst', name: 'ClearTax GST', description: 'Upload GST returns and GSTR forms' },
    { id: 'taxcloud', name: 'TaxCloud India', description: 'Upload tax documents and worksheets' },
    { id: 'winman', name: 'Winman CA ERP', description: 'Upload professional tax return files' },
  ];

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
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/chat')}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Chat
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-muted-foreground mb-8">
          Connect your accounting and tax software for comprehensive analysis
        </p>

        {/* Active Integrations */}
        {integrations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Active Integrations</h2>
            <div className="grid gap-4">
              {integrations.map((integration) => (
                <Card key={integration.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold capitalize">{integration.provider}</h3>
                          <p className="text-sm text-muted-foreground">
                            {integration.companyName || 'Company not set'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {integration.isActive ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(integration.id, integration.provider)}
                          disabled={deleteIntegrationMutation.isPending}
                          aria-label={`Disconnect ${integration.provider} integration`}
                          data-testid={`button-delete-${integration.provider}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-8" />

        {/* Accounting Software */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Accounting Software</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => {
              const isConnected = integrations.some(i => i.provider.toLowerCase() === provider.id);
              const Icon = provider.icon;
              
              return (
                <Card key={provider.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg ${provider.color} flex items-center justify-center`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                    </div>
                    <CardDescription>{provider.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isConnected ? (
                      <Badge variant="default" className="w-full justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleConnect(provider.id)}
                        disabled={connectIntegrationMutation.isPending}
                        data-testid={`button-connect-${provider.id}`}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Payroll & HR */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Payroll & HR Software</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {payrollProviders.map((provider) => {
              const isConnected = integrations.some(i => i.provider.toLowerCase() === provider.id);
              const Icon = provider.icon;
              
              return (
                <Card key={provider.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg ${provider.color} flex items-center justify-center`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                    </div>
                    <CardDescription>{provider.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isConnected ? (
                      <Badge variant="default" className="w-full justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleConnect(provider.id)}
                        disabled={connectIntegrationMutation.isPending}
                        data-testid={`button-connect-${provider.id}`}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Tax Software - File Upload */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Tax Software</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload tax documents securely. Files are encrypted and scanned before processing.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            {taxSoftware.map((software) => (
              <Card key={software.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{software.name}</CardTitle>
                  <CardDescription>{software.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={uploadDialogOpen && selectedVendor === software.id} onOpenChange={(open) => {
                    setUploadDialogOpen(open);
                    if (!open) setSelectedVendor('');
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelectedVendor(software.id);
                          setUploadDialogOpen(true);
                        }}
                        data-testid={`button-upload-${software.id}`}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload File
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload {software.name} File</DialogTitle>
                        <DialogDescription>
                          Upload tax documents (CSV, Excel, TXT). Maximum file size: 50MB.
                          Files are encrypted and scanned for security.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleFileUpload} className="space-y-4">
                        <div>
                          <Label htmlFor="file">Tax Document</Label>
                          <Input
                            id="file"
                            name="file"
                            type="file"
                            accept=".csv,.xls,.xlsx,.txt"
                            required
                            data-testid="input-file"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={uploadFileMutation.isPending}
                          data-testid="button-submit-upload"
                        >
                          {uploadFileMutation.isPending ? "Uploading..." : "Upload File"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Uploaded Files */}
          {taxFiles.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Uploaded Tax Files</h3>
              <div className="grid gap-4">
                {taxFiles.map((file) => (
                  <Card key={file.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{file.filename}</h4>
                            <p className="text-sm text-muted-foreground capitalize">
                              {file.vendor} • {(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.scanStatus === 'pending' && (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Scanning
                            </Badge>
                          )}
                          {file.scanStatus === 'scanning' && (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Scanning
                            </Badge>
                          )}
                          {file.scanStatus === 'clean' && (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Clean
                            </Badge>
                          )}
                          {file.scanStatus === 'infected' && (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Infected
                            </Badge>
                          )}
                          
                          {file.scanStatus === 'clean' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadFile(file.id, file.filename)}
                              aria-label={`Download ${file.filename}`}
                              data-testid={`button-download-${file.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Delete ${file.filename}?`)) {
                                deleteFileMutation.mutate(file.id);
                              }
                            }}
                            disabled={deleteFileMutation.isPending}
                            aria-label={`Delete ${file.filename}`}
                            data-testid={`button-delete-file-${file.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
