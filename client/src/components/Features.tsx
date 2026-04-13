import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  FileSearch, 
  BarChart3, 
  Download, 
  Shield, 
  Briefcase,
  Layers,
  Workflow,
  Calculator,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const featureCategories = [
  { id: "workspace", label: "Workspace & Integration", icon: Layers },
  { id: "ai", label: "AI Intelligence & Analysis", icon: Brain },
  { id: "document", label: "Document Intelligence", icon: FileSearch },
  { id: "viz", label: "Visualizations & Analytics", icon: BarChart3 },
  { id: "export", label: "Export & Integration", icon: Download },
  { id: "security", label: "Security & Compliance", icon: Shield },
  { id: "pro", label: "Professional Tools", icon: Briefcase }
];

const features = {
  workspace: [
    {
      icon: Layers,
      title: "3-Pane Resizable Layout",
      description: "Conversations sidebar, streaming chat center, and professional output pane with visualizations and export controls.",
      badge: "Premium UI",
      exclusive: true
    },
    {
      icon: Workflow,
      title: "Multi-Profile System",
      description: "Business, personal, family contexts with profile-aware conversations and intelligent context inheritance.",
      badge: "Smart Contexts",
      exclusive: true
    },
    {
      icon: FileText,
      title: "Conversation History",
      description: "Full session history with profile filtering, search, and instant context switching for seamless workflow.",
      badge: "Full History",
      exclusive: true
    }
  ],
  ai: [
    {
      icon: Brain,
      title: "Multi-LLM Orchestration",
      description: "Intelligent routing between GPT-4, Claude, and specialized financial models based on query type and complexity.",
      badge: "AI Ensemble",
      exclusive: true
    },
    {
      icon: Briefcase,
      title: "Professional Analysis Modes",
      description: "Deep Research, Checklist, Workflow, Audit Plan, Calculation modes. Each with specialized formatting and output.",
      badge: "5 Modes",
      exclusive: true
    },
    {
      icon: Sparkles,
      title: "Query Classification",
      description: "Automatic triage system classifying queries as basic Q&A, analysis, calculations, or complex scenarios.",
      badge: "Smart Routing",
      exclusive: true
    },
    {
      icon: Calculator,
      title: "Financial Calculators",
      description: "Built-in calculators for tax, depreciation, loan analysis, investment returns, and cash flow projections.",
      badge: "Built-in Tools",
      exclusive: true
    }
  ],
  document: [
    {
      icon: FileSearch,
      title: "Azure Document Intelligence",
      description: "Structured data extraction from PDFs, receipts, tax forms with field-level recognition and validation.",
      badge: "AI-Powered",
      exclusive: true
    },
    {
      icon: FileText,
      title: "Multi-Format Support",
      description: "PDF, PNG, JPEG, TIFF, Excel, CSV with automatic format detection and content extraction.",
      badge: "10+ Formats",
      exclusive: true
    },
    {
      icon: Shield,
      title: "Secure File Processing",
      description: "AES-256 encryption, per-file key wrapping, SHA-256 checksums, and automatic virus scanning.",
      badge: "Enterprise Security",
      exclusive: true
    }
  ],
  viz: [
    {
      icon: BarChart3,
      title: "Interactive Charts",
      description: "Line, bar, pie, area, combo, waterfall, gauge charts with responsive theming and interactive tooltips.",
      badge: "8 Chart Types",
      exclusive: true
    },
    {
      icon: Workflow,
      title: "Workflow Diagrams",
      description: "ReactFlow-powered interactive flowcharts for audit plans, process mapping, and decision trees.",
      badge: "Interactive",
      exclusive: true
    },
    {
      icon: BarChart3,
      title: "KPI Dashboards",
      description: "Real-time KPI cards with trend indicators, progress bars, and comparative analytics.",
      badge: "Live Metrics",
      exclusive: true
    }
  ],
  export: [
    {
      icon: Download,
      title: "6 Export Formats",
      description: "TXT, CSV, DOCX, PDF, PPTX, XLSX with markdown content and chart data as formatted tables.",
      badge: "6 Formats",
      exclusive: true
    },
    {
      icon: FileText,
      title: "Professional Documents",
      description: "One-click generation of audit plans, tax memos, client deliverables with AI assistance.",
      badge: "Templates",
      exclusive: true
    },
    {
      icon: Download,
      title: "Batch Export",
      description: "Export entire conversations or selected messages with all visualizations and metadata.",
      badge: "Bulk Export",
      exclusive: true
    }
  ],
  security: [
    {
      icon: Shield,
      title: "AES-256 Encryption",
      description: "All data encrypted at rest and in transit with industry-standard AES-256-GCM encryption.",
      badge: "Military Grade",
      exclusive: true
    },
    {
      icon: Shield,
      title: "Session Management",
      description: "Secure cookie-based sessions with sameSite protection and automatic timeout handling.",
      badge: "Secure Auth",
      exclusive: true
    },
    {
      icon: Shield,
      title: "Rate Limiting",
      description: "Intelligent rate limiting with trust proxy support and per-endpoint configuration.",
      badge: "DDoS Protection",
      exclusive: true
    }
  ],
  pro: [
    {
      icon: Briefcase,
      title: "Regulatory Simulator",
      description: "What-if stress-testing of tax and audit positions across jurisdictions and time periods.",
      badge: "CA GPT Exclusive",
      exclusive: true
    },
    {
      icon: FileText,
      title: "Client Deliverable Composer",
      description: "Professional document generation with AI assistance, template variables, and export options.",
      badge: "CA GPT Exclusive",
      exclusive: true
    },
    {
      icon: FileSearch,
      title: "Forensic Document Intelligence",
      description: "Proactive anomaly detection and cross-document reconciliation with risk scoring.",
      badge: "CA GPT Exclusive",
      exclusive: true
    }
  ],
};

export default function Features() {
  const [activeCategory, setActiveCategory] = useState("ai");
  const [carouselIndex, setCarouselIndex] = useState(0);

  const visibleCategories = featureCategories.slice(carouselIndex, carouselIndex + 5);

  return (
    <section className="py-24 px-6 bg-background" data-testid="section-features">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-6 mb-16">
          <Badge variant="outline" className="px-4 py-2 text-sm font-semibold border-primary/30 bg-primary/5 text-primary">
            Complete AI Accounting Platform
          </Badge>
          <h2 className="font-display text-4xl lg:text-5xl font-bold">
            Comprehensive{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Features
            </span>
          </h2>
          <p className="font-body text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            From basic queries to complex financial analysis, CA GPT provides everything 
            accounting professionals need in one intelligent platform.
          </p>
        </div>

        {/* Category Tabs with Carousel */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
              disabled={carouselIndex === 0}
              className="flex-shrink-0 hover:bg-primary/10"
              data-testid="button-carousel-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex gap-2 flex-wrap justify-center max-w-5xl">
              {visibleCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? "default" : "outline"}
                  onClick={() => setActiveCategory(category.id)}
                  className={`gap-2 ${activeCategory === category.id 
                    ? 'bg-primary hover:bg-secondary text-primary-foreground' 
                    : 'border-primary/30 hover:border-primary hover:bg-primary/5'}`}
                  data-testid={`button-category-${category.id}`}
                >
                  <category.icon className="w-4 h-4" />
                  {category.label}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCarouselIndex(Math.min(featureCategories.length - 5, carouselIndex + 1))}
              disabled={carouselIndex >= featureCategories.length - 5}
              className="flex-shrink-0 hover:bg-primary/10"
              data-testid="button-carousel-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Pause Icon */}
          <div className="flex justify-center mt-4">
            <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-primary/10">
              <div className="flex gap-1">
                <div className="w-1 h-3 bg-primary rounded-full" />
                <div className="w-1 h-3 bg-primary rounded-full" />
              </div>
            </Button>
          </div>
        </div>

        {/* Active Category Title */}
        <div className="text-center mb-12">
          <h3 className="font-display text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-3">
            {featureCategories.find(c => c.id === activeCategory)?.label}
          </h3>
          <p className="font-body text-foreground/70">
            Advanced AI capabilities for financial analysis and decision making
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features[activeCategory as keyof typeof features]?.map((feature, index) => (
            <Card 
              key={index}
              className="p-6 bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
              data-testid={`card-feature-${activeCategory}-${index}`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/40 flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs bg-accent/40 text-primary border-accent/60">
                    {feature.badge}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">{feature.title}</h4>
                  <p className="text-sm text-foreground/60 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {feature.exclusive && (
                  <div className="pt-3 border-t border-primary/10">
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-semibold">CA GPT Exclusive</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

      </div>
    </section>
  );
}
