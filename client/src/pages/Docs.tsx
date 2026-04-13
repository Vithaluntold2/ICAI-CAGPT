import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Search, 
  FileText, 
  Code, 
  Zap,
  Shield,
  Globe,
  Calculator
} from "lucide-react";
import { useState } from "react";

export default function Docs() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleDocClick = (docName: string, route?: string) => {
    if (route) {
      setLocation(route);
    } else {
      toast({
        title: "Documentation Coming Soon",
        description: `The ${docName} documentation is being prepared and will be available shortly.`
      });
    }
  };

  return (
    <div className="min-h-screen">
      <LandingNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              CA GPT Documentation
            </h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to master accounting superintelligence
            </p>
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-docs-search"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Getting Started</h2>
            <p className="text-lg text-muted-foreground">
              Start using CA GPT in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 space-y-4 hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Introduction</h3>
              <p className="text-muted-foreground text-sm">
                Learn about CA GPT's architecture, multi-model AI routing, and core capabilities
              </p>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-intro-guide"
                onClick={() => handleDocClick("Introduction")}
              >
                Read Introduction →
              </Button>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Quick Start</h3>
              <p className="text-muted-foreground text-sm">
                Create your first query, upload documents, and explore professional modes
              </p>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-quickstart"
                onClick={() => handleDocClick("Quick Start", "/chat")}
              >
                Get Started →
              </Button>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Code className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">API Reference</h3>
              <p className="text-muted-foreground text-sm">
                Complete API documentation with endpoints, authentication, and examples
              </p>
              <Link href="/api">
                <Button variant="outline" className="w-full" data-testid="button-api-docs">
                  View API Docs →
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Documentation */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-12">Core Features</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Calculator className="w-8 h-8 text-primary" />
                <h3 className="text-xl font-semibold">Regulatory Scenario Simulator</h3>
              </div>
              <p className="text-muted-foreground">
                Model tax scenarios across jurisdictions and time periods with what-if analysis
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Multi-jurisdiction tax modeling</li>
                <li>• Side-by-side comparisons</li>
                <li>• Time-period stress testing</li>
                <li>• Export scenarios to PDF/XLSX</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-simulator-docs"
                onClick={() => handleDocClick("Regulatory Scenario Simulator", "/scenarios")}
              >
                Read Documentation →
              </Button>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <h3 className="text-xl font-semibold">Client Deliverable Composer</h3>
              </div>
              <p className="text-muted-foreground">
                Generate professional audit plans, tax memos, and compliance documents
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• AI-assisted content generation</li>
                <li>• Template variables and customization</li>
                <li>• Multi-format export (PDF, DOCX, PPTX)</li>
                <li>• Professional formatting</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-composer-docs"
                onClick={() => handleDocClick("Client Deliverable Composer", "/deliverables")}
              >
                Read Documentation →
              </Button>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Search className="w-8 h-8 text-primary" />
                <h3 className="text-xl font-semibold">Forensic Document Intelligence</h3>
              </div>
              <p className="text-muted-foreground">
                Proactive anomaly detection and cross-document reconciliation
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Automated discrepancy detection</li>
                <li>• Cross-document reconciliation</li>
                <li>• Risk scoring with evidence extraction</li>
                <li>• Azure Document Intelligence integration</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-forensics-docs"
                onClick={() => handleDocClick("Forensic Document Intelligence", "/forensics")}
              >
                Read Documentation →
              </Button>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8 text-primary" />
                <h3 className="text-xl font-semibold">Multi-Provider AI</h3>
              </div>
              <p className="text-muted-foreground">
                Intelligent query routing across Claude, Gemini, Perplexity, and Azure OpenAI
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Automatic model selection</li>
                <li>• Health monitoring and failover</li>
                <li>• Real-time streaming responses</li>
                <li>• Professional mode support</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-ai-docs"
                onClick={() => handleDocClick("Multi-Provider AI")}
              >
                Read Documentation →
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Guides */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-12">Guides & Tutorials</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3">
              <h3 className="font-semibold">Setting Up Integrations</h3>
              <p className="text-sm text-muted-foreground">
                Connect QuickBooks, Xero, Zoho Books, and ADP
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                data-testid="button-integration-guide"
                onClick={() => handleDocClick("Integrations", "/integrations")}
              >
                Read Guide →
              </Button>
            </Card>

            <Card className="p-6 space-y-3">
              <h3 className="font-semibold">Managing Profiles</h3>
              <p className="text-sm text-muted-foreground">
                Create business, personal, and family accounting contexts
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                data-testid="button-profile-guide"
                onClick={() => handleDocClick("Managing Profiles", "/settings")}
              >
                Read Guide →
              </Button>
            </Card>

            <Card className="p-6 space-y-3">
              <h3 className="font-semibold">Document Upload & Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Upload tax documents for AI-powered analysis
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                data-testid="button-upload-guide"
                onClick={() => handleDocClick("Document Upload & Analysis", "/chat")}
              >
                Read Guide →
              </Button>
            </Card>

            <Card className="p-6 space-y-3">
              <h3 className="font-semibold">Export & Visualization</h3>
              <p className="text-sm text-muted-foreground">
                Export data in 6 formats with charts and tables
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                data-testid="button-export-guide"
                onClick={() => handleDocClick("Export & Visualization")}
              >
                Read Guide →
              </Button>
            </Card>

            <Card className="p-6 space-y-3">
              <h3 className="font-semibold">Subscription Management</h3>
              <p className="text-sm text-muted-foreground">
                Manage account access, usage quotas, and workspace controls
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                data-testid="button-subscription-guide"
                onClick={() => handleDocClick("Subscription Management", "/settings")}
              >
                Read Guide →
              </Button>
            </Card>

            <Card className="p-6 space-y-3">
              <h3 className="font-semibold">Security Best Practices</h3>
              <p className="text-sm text-muted-foreground">
                Understand encryption, authentication, and data protection
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                data-testid="button-security-guide"
                onClick={() => handleDocClick("Security Best Practices")}
              >
                Read Guide →
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <Shield className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-4xl font-bold">Need Help?</h2>
          <p className="text-lg text-muted-foreground">
            Our support team is here to assist you with any questions
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/support">
              <Button size="lg" data-testid="button-contact-support">
                Contact Support
              </Button>
            </Link>
            <Link href="/auth">
              <Button size="lg" variant="outline" data-testid="button-get-started">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
