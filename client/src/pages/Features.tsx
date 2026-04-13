import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { 
  Calculator, 
  FileText, 
  Search, 
  Brain, 
  Globe, 
  Shield,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";

export default function Features() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              Accounting Superintelligence
            </h1>
            <p className="text-xl text-muted-foreground">
              Three powerful capabilities that transform how you handle tax, audit, and financial analysis
            </p>
            <Link href="/auth">
              <Button size="lg" className="mt-4" data-testid="button-get-started">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* MVP Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Three MVP Capabilities</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Purpose-built tools that go beyond traditional accounting software
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Regulatory Scenario Simulator */}
            <Card className="p-8 space-y-4 hover-elevate">
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calculator className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold">Regulatory Scenario Simulator</h3>
              <p className="text-muted-foreground">
                Stress-test tax and audit positions across jurisdictions and time periods with "what-if" modeling
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Multi-jurisdiction tax scenario modeling</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Side-by-side comparisons</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Time-period analysis</span>
                </li>
              </ul>
              <Link href="/scenarios">
                <Button variant="outline" className="w-full" data-testid="button-try-simulator">
                  Try Simulator →
                </Button>
              </Link>
            </Card>

            {/* Client Deliverable Composer */}
            <Card className="p-8 space-y-4 hover-elevate">
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold">Client Deliverable Composer</h3>
              <p className="text-muted-foreground">
                One-click generation of professional-grade audit plans, tax memos, and compliance documents
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>AI-assisted content generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Template variables and customization</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Multi-format export (PDF, DOCX, XLSX)</span>
                </li>
              </ul>
              <Link href="/deliverables">
                <Button variant="outline" className="w-full" data-testid="button-try-composer">
                  Try Composer →
                </Button>
              </Link>
            </Card>

            {/* Forensic Document Intelligence */}
            <Card className="p-8 space-y-4 hover-elevate">
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold">Forensic Document Intelligence</h3>
              <p className="text-muted-foreground">
                Proactive anomaly detection and cross-document reconciliation with AI-powered risk scoring
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Automated discrepancy detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Cross-document reconciliation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Risk scoring with evidence extraction</span>
                </li>
              </ul>
              <Link href="/forensics">
                <Button variant="outline" className="w-full" data-testid="button-try-forensics">
                  Try Forensics →
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Intelligence Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">AI-Powered Intelligence</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Multi-provider AI architecture with intelligent routing and real-time processing
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6 space-y-3">
              <Brain className="w-8 h-8 text-primary" />
              <h3 className="font-semibold text-lg">Multi-Model Routing</h3>
              <p className="text-sm text-muted-foreground">
                Intelligent query triage across Claude, Gemini, Perplexity, and Azure OpenAI for optimal responses
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Globe className="w-8 h-8 text-primary" />
              <h3 className="font-semibold text-lg">Global Coverage</h3>
              <p className="text-sm text-muted-foreground">
                Compliance and tax expertise across 6 markets: USA, Canada, India, UAE, Indonesia, Turkey
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Shield className="w-8 h-8 text-primary" />
              <h3 className="font-semibold text-lg">Document Intelligence</h3>
              <p className="text-sm text-muted-foreground">
                Azure Document Intelligence extraction with automatic fallback for comprehensive document analysis
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              <h3 className="font-semibold text-lg">Real-Time Processing</h3>
              <p className="text-sm text-muted-foreground">
                WebSocket streaming for instant responses with live calculations and visualizations
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Users className="w-8 h-8 text-primary" />
              <h3 className="font-semibold text-lg">Multi-Profile Support</h3>
              <p className="text-sm text-muted-foreground">
                Manage business, personal, and family accounting contexts with profile-aware conversations
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Zap className="w-8 h-8 text-primary" />
              <h3 className="font-semibold text-lg">Advanced Export</h3>
              <p className="text-sm text-muted-foreground">
                Industry-grade exports in 6 formats: TXT, CSV, DOCX, PDF, PPTX, XLSX with chart data
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-4xl font-bold">Ready to Transform Your Accounting?</h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of professionals using CA GPT for advanced tax, audit, and financial analysis
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" data-testid="button-get-started-cta">
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
