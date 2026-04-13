import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ListChecks, GitBranch, FileCheck, Calculator } from "lucide-react";

const modes = [
  {
    id: "deep-research",
    name: "Deep Research",
    icon: Search,
    color: "primary",
    description: "Multi-source analysis with citations and cross-references across tax codes, accounting standards, and case law.",
    features: [
      "Real-time regulatory updates",
      "Cross-jurisdiction comparisons",
      "Annotated citations and sources",
      "Scenario modeling"
    ],
    outputPreview: "Comprehensive research reports with structured findings, regulatory citations, and compliance recommendations displayed in the Output Pane."
  },
  {
    id: "checklist",
    name: "Checklist Mode",
    icon: ListChecks,
    color: "success",
    description: "Step-by-step compliance checklists with jurisdiction-specific requirements and completion tracking.",
    features: [
      "Pre-audit checklists",
      "Tax filing workflows",
      "Due diligence tracking",
      "Deadline management"
    ],
    outputPreview: "Interactive checklists with progress tracking, document requirements, and automated reminders in the Output Pane."
  },
  {
    id: "workflow",
    name: "Workflow Diagrams",
    icon: GitBranch,
    color: "chart-2",
    description: "Visual process flows using ReactFlow with decision nodes, approval gates, and compliance checkpoints.",
    features: [
      "Interactive flowcharts",
      "Decision tree mapping",
      "Approval workflows",
      "Process documentation"
    ],
    outputPreview: "Interactive workflow diagrams with draggable nodes, automated layouts via dagre, and export to PPTX/PDF."
  },
  {
    id: "audit-plan",
    name: "Audit Planning",
    icon: FileCheck,
    color: "secondary",
    description: "Structured audit plans with risk assessments, testing procedures, and evidence documentation.",
    features: [
      "Risk-based scoping",
      "Test plan generation",
      "Materiality calculations",
      "Sampling methodologies"
    ],
    outputPreview: "Professional audit plans with scope definitions, testing matrices, and documentation templates in the Output Pane."
  },
  {
    id: "calculation",
    name: "Financial Calculations",
    icon: Calculator,
    color: "gold",
    description: "Precise financial computations with formula transparency and scenario analysis capabilities.",
    features: [
      "NPV, IRR, WACC calculations",
      "Tax provision modeling",
      "Depreciation schedules",
      "Amortization tables"
    ],
    outputPreview: "Detailed calculation breakdowns with formula display, assumptions, and export to Excel with preserved formulas."
  }
];

export default function ProfessionalModes() {
  const [activeMode, setActiveMode] = useState(modes[0]);

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-2/5 to-background" />
      
      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-6 mb-16">
          <Badge variant="outline" className="px-4 py-2 text-sm font-semibold border-chart-2/30">
            Professional Modes
          </Badge>
          <h2 className="text-4xl lg:text-5xl font-bold">
            Specialized{" "}
            <span className="gradient-text">Intelligence</span>
          </h2>
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            Each mode delivers tailored outputs in the Output Pane. 
            Perplexity gives you text. CA GPT gives you actionable deliverables.
          </p>
        </div>

        {/* Mode Selector Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode.id === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode)}
                className={`
                  px-6 py-3 rounded-full font-semibold text-sm
                  transition-smooth hover-elevate
                  flex items-center gap-2
                  ${isActive 
                    ? 'glass-heavy border-2 border-primary/50 text-primary shadow-lg' 
                    : 'glass border border-border/50 text-foreground/70 hover:border-primary/30'
                  }
                `}
                data-testid={`button-mode-${mode.id}`}
              >
                <Icon className="w-4 h-4" />
                {mode.name}
              </button>
            );
          })}
        </div>

        {/* Active Mode Display */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Mode Details */}
          <div className="space-y-8 animate-slide-up">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-chart-2/20 flex items-center justify-center">
                  <activeMode.icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold">{activeMode.name}</h3>
                  <Badge variant="secondary" className="mt-1">
                    Output Pane Feature
                  </Badge>
                </div>
              </div>
              <p className="text-lg text-foreground/80 leading-relaxed">
                {activeMode.description}
              </p>
            </div>

            {/* Features List */}
            <div>
              <p className="text-sm font-semibold text-foreground/90 uppercase tracking-wide mb-4">
                Key Capabilities
              </p>
              <div className="grid grid-cols-2 gap-3">
                {activeMode.features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm text-foreground/70"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Preview */}
            <Card className="p-6 glass-heavy border-primary/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                Output Pane Preview
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {activeMode.outputPreview}
              </p>
            </Card>
          </div>

          {/* Right: Visual Mockup */}
          <div className="relative">
            <Card className="p-8 glass-heavy border-primary/20 min-h-[500px] relative overflow-hidden">
              {/* Simulated Output Pane Interface */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-border/30">
                  <h4 className="text-lg font-bold">Output Pane</h4>
                  <Badge variant="outline" className="text-xs">
                    {activeMode.name}
                  </Badge>
                </div>

                {/* Mode-specific content simulation */}
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-border/30 animate-pulse"
                      style={{ animationDelay: `${i * 100}ms`, animationDuration: '2s' }}
                    />
                  ))}
                </div>

                {/* Export buttons mockup */}
                <div className="pt-6 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-3">Export Options</p>
                  <div className="flex flex-wrap gap-2">
                    {['PDF', 'DOCX', 'XLSX', 'PPTX'].map((format) => (
                      <Badge key={format} variant="secondary" className="text-xs">
                        {format}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decorative glow */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[60px]" />
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
