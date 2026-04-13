import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, TrendingUp, FileBarChart, Share2, Save, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ScenarioConfig {
  jurisdiction: string;
  entityType: string;
  taxYear: number;
  income: number;
  deductionStrategy: string;
}

interface ScenarioVariant {
  id: string;
  name: string;
  description?: string;
  assumptions: Record<string, any>;
  isBaseline: boolean;
}

export default function ScenarioSimulator() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("create");

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/auth');
    }
  }, [user, authLoading, setLocation]);
  
  // Playbook creation state
  const [playbookName, setPlaybookName] = useState("");
  const [playbookDescription, setPlaybookDescription] = useState("");
  const [category, setCategory] = useState("tax_strategy");
  
  // Baseline configuration
  const [baselineConfig, setBaselineConfig] = useState<ScenarioConfig>({
    jurisdiction: "california",
    entityType: "llc",
    taxYear: 2025,
    income: 200000,
    deductionStrategy: "standard"
  });
  
  // Variants
  const [variants, setVariants] = useState<ScenarioVariant[]>([]);
  const [comparisonResults, setComparisonResults] = useState<any>(null);

  const handleAddVariant = async () => {
    if (!playbooks || (playbooks as any[]).length === 0) {
      toast({
        title: "No Playbook",
        description: "Please create a scenario playbook first",
        variant: "destructive"
      });
      return;
    }

    const latestPlaybook = (playbooks as any[])[0];
    const variantData = {
      name: `Alternative ${variants.length + 1}`,
      description: "Scenario variant for comparison",
      assumptions: {
        ...baselineConfig,
        entityType: "s-corp" // Default variation
      }
    };

    try {
      const savedVariant = await createVariantMutation.mutateAsync({
        playbookId: latestPlaybook.id,
        variantData
      });
      
      // Add to local state with the database ID
      const newVariant: ScenarioVariant = {
        id: savedVariant.id,
        name: savedVariant.name,
        description: savedVariant.description,
        assumptions: savedVariant.assumptions as Record<string, any>,
        isBaseline: false
      };
      setVariants([...variants, newVariant]);
    } catch (error) {
      console.error('Failed to add variant:', error);
    }
  };

  // Fetch playbooks
  const { data: playbooks } = useQuery({
    queryKey: ['/api/scenarios/playbooks'],
    enabled: activeTab === "simulate" || activeTab === "results"
  });

  // Create playbook mutation
  const createPlaybookMutation = useMutation({
    mutationFn: async (playbookData: any) => {
      const res = await apiRequest('POST', '/api/scenarios/playbooks', playbookData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scenarios/playbooks'] });
      toast({
        title: "Playbook Created",
        description: "Scenario playbook has been saved successfully",
      });
      setActiveTab("simulate");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create playbook",
        variant: "destructive"
      });
    }
  });

  // Create variant mutation
  const createVariantMutation = useMutation({
    mutationFn: async ({ playbookId, variantData }: { playbookId: string; variantData: any }) => {
      const res = await apiRequest('POST', `/api/scenarios/playbooks/${playbookId}/variants`, variantData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Variant Added",
        description: "Scenario variant has been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create variant",
        variant: "destructive"
      });
    }
  });

  // Run simulation mutation
  const runSimulationMutation = useMutation({
    mutationFn: async ({ playbookId, variantIds }: { playbookId: string; variantIds: string[] }) => {
      const res = await apiRequest('POST', `/api/scenarios/playbooks/${playbookId}/simulate`, { variantIds });
      return await res.json();
    },
    onSuccess: (data) => {
      setComparisonResults(data);
      setActiveTab("results");
      toast({
        title: "Simulation Complete",
        description: "Results are ready for review",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Simulation Failed",
        description: error.message || "Failed to run simulation",
        variant: "destructive"
      });
    }
  });

  const handleSavePlaybook = async () => {
    if (!playbookName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a scenario name",
        variant: "destructive"
      });
      return;
    }

    createPlaybookMutation.mutate({
      name: playbookName,
      description: playbookDescription,
      category,
      baselineConfig
    });
  };

  const handleRunSimulation = async () => {
    if (!playbooks || (playbooks as any[]).length === 0) {
      toast({
        title: "No Playbook",
        description: "Please create a scenario playbook first",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Running Simulation",
      description: "Calculating tax implications across all scenarios...",
    });

    const latestPlaybook = (playbooks as any[])[0];
    runSimulationMutation.mutate({
      playbookId: latestPlaybook.id,
      variantIds: variants.map(v => v.id)
    });
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
            Regulatory Scenario Simulator
          </h1>
          <p className="text-muted-foreground mt-2">
            Stress-test tax and audit positions across jurisdictions, entities, and time periods
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create" data-testid="tab-create-scenario">
              Create Scenario
            </TabsTrigger>
            <TabsTrigger value="simulate" data-testid="tab-simulate">
              Run Simulation
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              View Results
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Create Scenario */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>New Scenario Playbook</CardTitle>
                <CardDescription>
                  Define the baseline configuration for your tax scenario analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Playbook Details */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="playbook-name">Scenario Name</Label>
                    <Input
                      id="playbook-name"
                      data-testid="input-playbook-name"
                      placeholder="e.g., LLC vs S-Corp Tax Comparison 2025"
                      value={playbookName}
                      onChange={(e) => setPlaybookName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="playbook-description">Description</Label>
                    <Textarea
                      id="playbook-description"
                      data-testid="input-playbook-description"
                      placeholder="Describe the purpose and goals of this scenario analysis..."
                      value={playbookDescription}
                      onChange={(e) => setPlaybookDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="category" data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tax_strategy">Tax Strategy</SelectItem>
                        <SelectItem value="entity_comparison">Entity Comparison</SelectItem>
                        <SelectItem value="deduction_analysis">Deduction Analysis</SelectItem>
                        <SelectItem value="audit_risk">Audit Risk Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Baseline Configuration */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Baseline Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="jurisdiction">Jurisdiction</Label>
                      <Select
                        value={baselineConfig.jurisdiction}
                        onValueChange={(value) => setBaselineConfig({ ...baselineConfig, jurisdiction: value })}
                      >
                        <SelectTrigger id="jurisdiction" data-testid="select-jurisdiction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="california">California</SelectItem>
                          <SelectItem value="delaware">Delaware</SelectItem>
                          <SelectItem value="texas">Texas</SelectItem>
                          <SelectItem value="new_york">New York</SelectItem>
                          <SelectItem value="florida">Florida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="entity-type">Entity Type</Label>
                      <Select
                        value={baselineConfig.entityType}
                        onValueChange={(value) => setBaselineConfig({ ...baselineConfig, entityType: value })}
                      >
                        <SelectTrigger id="entity-type" data-testid="select-entity-type">
                          <SelectValue />
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
                        value={baselineConfig.taxYear}
                        onChange={(e) => setBaselineConfig({ ...baselineConfig, taxYear: parseInt(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="income">Annual Income ($)</Label>
                      <Input
                        id="income"
                        data-testid="input-income"
                        type="number"
                        value={baselineConfig.income}
                        onChange={(e) => setBaselineConfig({ ...baselineConfig, income: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="deduction-strategy">Deduction Strategy</Label>
                      <Select
                        value={baselineConfig.deductionStrategy}
                        onValueChange={(value) => setBaselineConfig({ ...baselineConfig, deductionStrategy: value })}
                      >
                        <SelectTrigger id="deduction-strategy" data-testid="select-deduction-strategy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard Deduction</SelectItem>
                          <SelectItem value="itemized">Itemized Deductions</SelectItem>
                          <SelectItem value="qbi">QBI Deduction</SelectItem>
                          <SelectItem value="home_office_actual">Home Office (Actual Method)</SelectItem>
                          <SelectItem value="home_office_simplified">Home Office (Simplified Method)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    data-testid="button-save-playbook"
                    onClick={handleSavePlaybook}
                    disabled={createPlaybookMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createPlaybookMutation.isPending ? "Saving..." : "Save Playbook"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("simulate")}
                    data-testid="button-next-to-simulate"
                  >
                    Next: Add Variants
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Run Simulation */}
          <TabsContent value="simulate" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Scenario Variants</CardTitle>
                    <CardDescription>
                      Add alternative scenarios to compare against your baseline
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleAddVariant}
                    data-testid="button-add-variant"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Variant
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Baseline Card */}
                <div className="border rounded-lg p-4 bg-accent/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Baseline Scenario</h4>
                      <Badge variant="outline" className="bg-primary/10 text-primary">Baseline</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Jurisdiction</p>
                      <p className="font-medium capitalize">{baselineConfig.jurisdiction}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Entity Type</p>
                      <p className="font-medium uppercase">{baselineConfig.entityType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Income</p>
                      <p className="font-medium">${baselineConfig.income.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Variant Cards */}
                {variants.map((variant, index) => (
                  <div key={variant.id} className="border rounded-lg p-4 hover-elevate">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{variant.name}</h4>
                      <Badge variant="secondary">Alternative {index + 1}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Jurisdiction</p>
                        <p className="font-medium capitalize">{variant.assumptions.jurisdiction || baselineConfig.jurisdiction}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Entity Type</p>
                        <p className="font-medium uppercase">{variant.assumptions.entityType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Income</p>
                        <p className="font-medium">${(variant.assumptions.income || baselineConfig.income).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {variants.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No variants added yet</p>
                    <p className="text-sm">Click "Add Variant" to create alternative scenarios</p>
                  </div>
                )}

                {variants.length > 0 && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleRunSimulation}
                    data-testid="button-run-simulation"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run Simulation & Compare
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Results */}
          <TabsContent value="results" className="space-y-6">
            {comparisonResults ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Scenario Comparison Results</CardTitle>
                        <CardDescription>
                          Side-by-side analysis of tax implications
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" data-testid="button-share-results">
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                        <Button variant="outline" data-testid="button-export-results">
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Export Report
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Baseline Results */}
                      <div className="border rounded-lg p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Baseline</h3>
                          <Badge variant="outline">Current</Badge>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Tax Liability</p>
                            <p className="text-2xl font-bold">${comparisonResults.baseline?.taxLiability?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Effective Tax Rate</p>
                            <p className="text-xl font-semibold">{comparisonResults.baseline?.effectiveTaxRate}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">QBI Deduction</p>
                            <p className="text-lg">${comparisonResults.baseline?.qbiDeduction?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Audit Risk Score</p>
                            <p className="text-lg">{comparisonResults.baseline?.auditRiskScore}/100</p>
                          </div>
                        </div>
                      </div>

                      {/* Variant Results */}
                      {(comparisonResults.variants || []).map((v: any, index: number) => (
                        <div key={index} className="border rounded-lg p-6 space-y-4 bg-success/5 border-success/20">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{v.variant?.name || `Alternative ${index + 1}`}</h3>
                            {v.savings > 0 && <Badge className="bg-success text-success-foreground">Savings</Badge>}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Total Tax Liability</p>
                              <p className="text-2xl font-bold text-success">${v.metrics?.taxLiability?.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Effective Tax Rate</p>
                              <p className="text-xl font-semibold text-success">{v.metrics?.effectiveTaxRate}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">QBI Deduction</p>
                              <p className="text-lg">${v.metrics?.qbiDeduction?.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Audit Risk Score</p>
                              <p className="text-lg">{v.metrics?.auditRiskScore}/100</p>
                            </div>
                            {v.savings !== undefined && (
                              <div className="pt-3 border-t border-success/20">
                                <p className="text-sm font-medium text-success">💰 Estimated Annual Savings</p>
                                <p className="text-2xl font-bold text-success">${v.savings?.toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                          {v.aiAdvisory && (
                            <div className="pt-3 border-t">
                              <p className="text-sm text-muted-foreground italic">{v.aiAdvisory}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Key Insights & Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(comparisonResults.variants || []).filter((v: any) => v.aiAdvisory).map((v: any, index: number) => (
                      <div key={index} className="flex gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
                        <div className="text-2xl">✓</div>
                        <div>
                          <p className="font-semibold text-success">{v.variant?.name || `Alternative ${index + 1}`}</p>
                          <p className="text-sm text-muted-foreground mt-1">{v.aiAdvisory}</p>
                        </div>
                      </div>
                    ))}
                    {(comparisonResults.variants || []).filter((v: any) => v.aiAdvisory).length === 0 && (
                      <div className="flex gap-3 p-4 bg-accent/10 border rounded-lg">
                        <div className="text-2xl">ℹ</div>
                        <div>
                          <p className="font-semibold">Analysis Complete</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Review the metrics above to compare scenarios. Run additional variants for deeper insights.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No simulation results yet</p>
                  <p className="text-sm">Run a simulation to see comparative analysis</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
