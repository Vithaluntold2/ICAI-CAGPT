import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Trash2, CreditCard, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import ProfilesSection from "@/components/ProfilesSection";

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [llmProvider, setLlmProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [enableCustomLLM, setEnableCustomLLM] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    try {
      if (!authLoading && !user) {
        setLocation('/auth');
      }
    } catch (e) {
      console.error('[Settings] Navigation error:', e);
      setHasError(true);
    }
  }, [user, authLoading, setLocation]);

  const { data: llmConfig } = useQuery({
    queryKey: ['/api/llm-config'],
    enabled: !!user,
  });

  const { 
    data: subscriptionData,
    isLoading: isLoadingSubscription,
    error: subscriptionError 
  } = useQuery<{
    subscription: {
      plan: string;
      status: string;
      currentPeriodEnd?: string;
    };
    quota: {
      queriesUsed: number;
      queryLimit: number;
      documentsUsed: number;
      documentLimit: number;
    };
  }>({
    queryKey: ['/api/subscription'],
    enabled: !!user,
  });

  const { 
    data: paymentHistory,
    isLoading: isLoadingPayments,
    error: paymentsError 
  } = useQuery<Array<{
    id: number;
    createdAt: string;
    plan: string;
    amount: number;
    currency: string;
    status: string;
  }>>({
    queryKey: ['/api/payments/history'],
    enabled: !!user,
  });

  // Show error toasts for query failures (in useEffect to avoid repeated triggers)
  useEffect(() => {
    if (subscriptionError) {
      toast({
        variant: "destructive",
        title: "Error loading subscription",
        description: "Failed to load subscription details. Please refresh the page."
      });
    }
  }, [subscriptionError, toast]);

  useEffect(() => {
    if (paymentsError) {
      toast({
        variant: "destructive",
        title: "Error loading payment history",
        description: "Failed to load billing history. Please refresh the page."
      });
    }
  }, [paymentsError, toast]);

  const saveLLMConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to save configuration');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your LLM configuration has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/llm-config'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save LLM configuration"
      });
    }
  });

  const handleSaveLLMConfig = () => {
    saveLLMConfigMutation.mutate({
      provider: llmProvider,
      apiKey: apiKey || undefined,
      modelName: modelName || undefined,
      endpoint: customEndpoint || undefined,
      isEnabled: enableCustomLLM
    });
  };

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/subscription/cancel');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Subscription Cancelled",
        description: data.message || "Your subscription has been cancelled."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cancel subscription"
      });
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/gdpr/delete-account', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete account');
      return res.json();
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently deleted."
      });
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete account"
      });
    }
  });

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount / 100);
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error loading settings</h1>
          <p className="text-slate-400 mb-4">Something went wrong. Please try refreshing.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-secondary"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Show loading while redirecting (redirect happens via useEffect)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
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

        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">
          Manage your account and preferences
        </p>

        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your CA GPT account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={user?.name || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Subscription Tier</Label>
                <Input value={user?.subscriptionTier || 'free'} disabled className="capitalize" />
              </div>
            </CardContent>
          </Card>

          {/* Subscription & Billing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription & Billing
              </CardTitle>
              <CardDescription>
                Manage your subscription, usage, and billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSubscription ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : subscriptionError ? (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive">
                  <p className="text-sm">Failed to load subscription details. Please refresh the page.</p>
                </div>
              ) : subscriptionData?.subscription ? (
                <>
                  {/* Current Plan */}
                  <div>
                    <h3 className="font-semibold mb-3">Current Plan</h3>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold capitalize">
                            {subscriptionData.subscription.plan}
                          </span>
                          {subscriptionData.subscription.status === 'active' && (
                            <Badge variant="secondary" data-testid="badge-subscription-active">Active</Badge>
                          )}
                          {subscriptionData.subscription.status === 'cancelled' && (
                            <Badge variant="destructive" data-testid="badge-subscription-cancelled">Cancelled</Badge>
                          )}
                        </div>
                        {subscriptionData.subscription.currentPeriodEnd && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {subscriptionData.subscription.status === 'active' 
                              ? `Renews on ${formatDate(subscriptionData.subscription.currentPeriodEnd)}`
                              : `Access until ${formatDate(subscriptionData.subscription.currentPeriodEnd)}`
                            }
                          </p>
                        )}
                      </div>
                      
                    </div>
                  </div>

                  <Separator />

                  {/* Usage Stats */}
                  <div>
                    <h3 className="font-semibold mb-3">Usage This Month</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Queries</Label>
                          <span className="text-sm text-muted-foreground">
                            {subscriptionData.quota.queriesUsed} / {subscriptionData.quota.queryLimit === -1 ? '∞' : subscriptionData.quota.queryLimit}
                          </span>
                        </div>
                        {subscriptionData.quota.queryLimit > 0 && (
                          <Progress 
                            value={(subscriptionData.quota.queriesUsed / subscriptionData.quota.queryLimit) * 100} 
                            data-testid="progress-queries"
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Documents Uploaded</Label>
                          <span className="text-sm text-muted-foreground">
                            {subscriptionData.quota.documentsUsed} / {subscriptionData.quota.documentLimit === -1 ? '∞' : subscriptionData.quota.documentLimit}
                          </span>
                        </div>
                        {subscriptionData.quota.documentLimit > 0 && (
                          <Progress 
                            value={(subscriptionData.quota.documentsUsed / subscriptionData.quota.documentLimit) * 100}
                            data-testid="progress-documents"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Fallback for free users without subscription record */
                <div>
                  <h3 className="font-semibold mb-3">Current Plan</h3>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold capitalize">Free</span>
                        <Badge variant="secondary" data-testid="badge-subscription-active">Active</Badge>
                      </div>
                    </div>
                    
                  </div>
                </div>
              )}

              {/* Billing History */}
              {isLoadingPayments ? (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Billing History</h3>
                    <Skeleton className="h-32 w-full" />
                  </div>
                </>
              ) : paymentsError ? (
                <>
                  <Separator />
                  <div className="p-4 rounded-md bg-destructive/10 text-destructive">
                    <p className="text-sm">Failed to load billing history. Please refresh the page.</p>
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Billing History</h3>
                    {paymentHistory && paymentHistory.length > 0 ? (
                      <>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paymentHistory.slice(0, 5).map((payment) => (
                                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-muted-foreground" />
                                      {formatDate(payment.createdAt)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="capitalize">{payment.plan}</TableCell>
                                  <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={payment.status === 'successful' ? 'secondary' : payment.status === 'failed' ? 'destructive' : 'outline'}
                                      data-testid={`badge-status-${payment.id}`}
                                    >
                                      {payment.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {paymentHistory.length > 5 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Showing recent 5 transactions
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="p-6 rounded-md border border-dashed text-center">
                        <p className="text-sm text-muted-foreground">No payment history yet</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Cancel Subscription */}
              {!isLoadingSubscription && subscriptionData?.subscription?.plan !== 'free' && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Cancel Subscription</h4>
                    {subscriptionData?.subscription?.status === 'cancelled' ? (
                      <p className="text-sm text-muted-foreground">
                        Your subscription has been cancelled. You'll have access until {subscriptionData.subscription.currentPeriodEnd ? formatDate(subscriptionData.subscription.currentPeriodEnd) : 'the end of your billing period'}.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">
                          You'll continue to have access until the end of your current billing period.
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              disabled={cancelSubscriptionMutation.isPending}
                              data-testid="button-cancel-subscription"
                            >
                              Cancel Subscription
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-dialog-cancel">
                                Keep Subscription
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelSubscriptionMutation.mutate()}
                                disabled={cancelSubscriptionMutation.isPending}
                                data-testid="button-cancel-dialog-confirm"
                              >
                                {cancelSubscriptionMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Profiles Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profiles</CardTitle>
              <CardDescription>
                Manage your business, personal, and family profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfilesSection />
            </CardContent>
          </Card>

          {/* Custom LLM Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Custom LLM Configuration</CardTitle>
              <CardDescription>
                Bring your own AI model (OpenAI, Anthropic, Google, or custom endpoint)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-custom-llm">Enable Custom LLM</Label>
                <Switch
                  id="enable-custom-llm"
                  checked={enableCustomLLM}
                  onCheckedChange={setEnableCustomLLM}
                  data-testid="switch-enable-custom-llm"
                />
              </div>

              {enableCustomLLM && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="llm-provider">Provider</Label>
                    <Select value={llmProvider} onValueChange={setLlmProvider}>
                      <SelectTrigger id="llm-provider" data-testid="select-llm-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google AI</SelectItem>
                        <SelectItem value="custom">Custom Endpoint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder={(llmConfig as any)?.config?.apiKeyMasked || "sk-..."}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="input-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API key is encrypted and stored securely
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model-name">Model Name (Optional)</Label>
                    <Input
                      id="model-name"
                      placeholder="gpt-4o, claude-3-opus, gemini-pro..."
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      data-testid="input-model-name"
                    />
                  </div>

                  {llmProvider === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="custom-endpoint">Custom Endpoint</Label>
                      <Input
                        id="custom-endpoint"
                        placeholder="https://api.example.com/v1"
                        value={customEndpoint}
                        onChange={(e) => setCustomEndpoint(e.target.value)}
                        data-testid="input-custom-endpoint"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleSaveLLMConfig}
                    disabled={saveLLMConfigMutation.isPending}
                    data-testid="button-save-llm-config"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save LLM Configuration
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* API Keys Section */}
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Create and manage API keys for programmatic access (Enterprise/Professional only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                API key management is available for Professional and Enterprise tier users.
                Visit your{" "}
                <a href="/subscriptions" className="text-primary hover:underline">
                  subscription settings
                </a>{" "}
                to upgrade.
              </p>
            </CardContent>
          </Card>

          {/* White-Label Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>White-Label Reports</CardTitle>
              <CardDescription>
                Customize reports with your company branding (Enterprise only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                White-label configuration is available for Enterprise tier users.
                Visit your{" "}
                <a href="/subscriptions" className="text-primary hover:underline">
                  subscription settings
                </a>{" "}
                to upgrade.
              </p>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Delete Account</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={deleteAccountMutation.isPending}
                        data-testid="button-delete-account"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete your account? This action cannot be undone. All your data, conversations, and settings will be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel 
                          disabled={deleteAccountMutation.isPending}
                          data-testid="button-delete-dialog-cancel"
                        >
                          Cancel
                        </AlertDialogCancel>
                        <Button
                          variant="destructive"
                          onClick={() => deleteAccountMutation.mutate()}
                          disabled={deleteAccountMutation.isPending}
                          data-testid="button-delete-dialog-confirm"
                        >
                          {deleteAccountMutation.isPending ? 'Deleting...' : 'Yes, Delete My Account'}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
