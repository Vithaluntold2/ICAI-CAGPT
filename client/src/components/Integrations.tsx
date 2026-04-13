import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Wallet, 
  FileText, 
  Cloud,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  BookOpen
} from "lucide-react";

const integrationCategories = [
  { id: "accounting", label: "Accounting Software", icon: Building2 },
  { id: "erp", label: "Enterprise ERP", icon: Building2 },
  { id: "banking", label: "Banking & Payments", icon: Wallet },
  { id: "documents", label: "Document & Data", icon: FileText }
];

const integrations = {
  accounting: [
    {
      name: "QuickBooks",
      icon: "Q",
      description: "Full accounting platform integration",
      badge: "Accounting Software",
      features: [
        "Chart of accounts sync",
        "Transaction import",
        "Financial reporting"
      ],
      available: true
    },
    {
      name: "Xero",
      icon: "X",
      description: "Beautiful accounting software for small business",
      badge: "Cloud Accounting",
      features: [
        "Bank reconciliation",
        "Invoicing",
        "Financial reporting"
      ],
      available: true
    },
    {
      name: "Zoho Books",
      icon: "Z",
      description: "Comprehensive business management",
      badge: "Business Suite",
      features: [
        "Invoice automation",
        "Expense tracking",
        "Project accounting"
      ],
      available: true
    },
    {
      name: "Sage Business Cloud",
      icon: "S",
      description: "Comprehensive business management",
      badge: "Accounting Software",
      features: [
        "Multi-company",
        "Advanced reporting",
        "Cash flow forecasting"
      ],
      available: true
    }
  ],
  erp: [
    {
      name: "SAP Business One",
      icon: "SAP",
      description: "Enterprise resource planning",
      badge: "Enterprise ERP",
      features: [
        "Full ERP integration",
        "Real-time data sync",
        "Multi-entity support"
      ],
      available: true
    },
    {
      name: "Oracle NetSuite",
      icon: "ON",
      description: "Cloud ERP solution",
      badge: "Cloud ERP",
      features: [
        "Financial management",
        "Revenue recognition",
        "Global compliance"
      ],
      available: true
    },
    {
      name: "Microsoft Dynamics",
      icon: "MD",
      description: "Business applications platform",
      badge: "Enterprise ERP",
      features: [
        "Financial operations",
        "Supply chain",
        "Project management"
      ],
      available: true
    }
  ],
  banking: [
    {
      name: "Stripe",
      icon: "ST",
      description: "Payment processing platform",
      badge: "Payments",
      features: [
        "Transaction reconciliation",
        "Revenue recognition",
        "Automated reports"
      ],
      available: true
    },
    {
      name: "PayPal",
      icon: "PP",
      description: "Online payment system",
      badge: "Payments",
      features: [
        "Transaction history",
        "Fee tracking",
        "Multi-currency"
      ],
      available: true
    },
    {
      name: "Razorpay",
      icon: "RP",
      description: "Payment gateway for India",
      badge: "Payments",
      features: [
        "Payment reconciliation",
        "Settlement tracking",
        "Refund management"
      ],
      available: true
    },
    {
      name: "Cashfree",
      icon: "CF",
      description: "India payment gateway",
      badge: "Payments",
      features: [
        "UPI & card payments",
        "Order management",
        "Webhook verification"
      ],
      available: true
    }
  ],
  documents: [
    {
      name: "Box",
      icon: "B",
      description: "Enterprise storage",
      badge: "Cloud Storage",
      features: [
        "Document management",
        "Version control",
        "Secure sharing"
      ],
      available: true
    },
    {
      name: "AWS S3",
      icon: "S3",
      description: "Cloud storage",
      badge: "Cloud Storage",
      features: [
        "Object storage",
        "Archive management",
        "Data backup"
      ],
      available: true
    },
    {
      name: "Azure Blob",
      icon: "AZ",
      description: "Microsoft storage",
      badge: "Cloud Storage",
      features: [
        "Blob storage",
        "Document indexing",
        "Secure access"
      ],
      available: true
    },
    {
      name: "Tally ERP",
      icon: "T",
      description: "India ERP",
      badge: "Enterprise ERP",
      features: [
        "Accounting integration",
        "GST compliance",
        "Inventory management"
      ],
      available: true
    }
  ]
};

export default function Integrations() {
  const [activeCategory, setActiveCategory] = useState("accounting");
  const [carouselIndex, setCarouselIndex] = useState(0);

  const visibleCategories = integrationCategories.slice(carouselIndex, carouselIndex + 4);
  
  const totalIntegrations = Object.values(integrations).flat().length;
  const availableIntegrations = Object.values(integrations).flat().filter(i => i.available).length;

  return (
    <section className="py-24 px-6 relative overflow-hidden" data-testid="section-integrations">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-2/5 to-background" />
      
      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Connect <span className="gradient-text">Everything</span>
          </h2>
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            Integrate with your favorite accounting software and business tools. CA GPT works 
            where you work.
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
              className="flex-shrink-0"
              data-testid="button-integration-carousel-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex gap-2 flex-wrap justify-center">
              {visibleCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? "default" : "outline"}
                  onClick={() => setActiveCategory(category.id)}
                  className="gap-2"
                  data-testid={`button-integration-category-${category.id}`}
                >
                  <category.icon className="w-4 h-4" />
                  {category.label}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCarouselIndex(Math.min(integrationCategories.length - 4, carouselIndex + 1))}
              disabled={carouselIndex >= integrationCategories.length - 4}
              className="flex-shrink-0"
              data-testid="button-integration-carousel-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Pause Icon */}
          <div className="flex justify-center mt-4">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <div className="flex gap-1">
                <div className="w-1 h-3 bg-primary rounded-full" />
                <div className="w-1 h-3 bg-primary rounded-full" />
              </div>
            </Button>
          </div>
        </div>

        {/* Active Category Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-4">
            {integrationCategories.find(c => c.id === activeCategory)?.icon && (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
            )}
            <span className="text-lg font-bold gradient-text">
              {integrationCategories.find(c => c.id === activeCategory)?.label}
            </span>
          </div>
          <p className="text-foreground/70">
            Connect with leading accounting platforms
          </p>
        </div>

        {/* Integrations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {integrations[activeCategory as keyof typeof integrations]?.map((integration, index) => (
            <Card 
              key={index}
              className="glass border-primary/20 hover-elevate transition-smooth"
              data-testid={`card-integration-${activeCategory}-${index}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary text-lg">{integration.icon}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {integration.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{integration.name}</CardTitle>
                <p className="text-sm text-foreground/70">{integration.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground/80 mb-2 uppercase tracking-wide">
                      Key Features
                    </p>
                    <ul className="space-y-1.5">
                      {integration.features.map((feature, fIdx) => (
                        <li key={fIdx} className="text-xs text-foreground/70 flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {integration.available && (
                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="font-semibold">Integration Available</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Plus Many More */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-8 mb-4">
            <Badge variant="outline" className="gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {integrations[activeCategory as keyof typeof integrations]?.length} Integrations
            </Badge>
            <Badge variant="outline" className="gap-2">
              <span className="w-2 h-2 rounded-full bg-chart-2" />
              Category 1 of {integrationCategories.length}
            </Badge>
            <Badge variant="outline" className="gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              All Available
            </Badge>
          </div>

          <h3 className="text-2xl font-bold mb-12">Plus Many More</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-16">
            {["Box", "AWS S3", "Azure Blob", "Tally ERP"].map((name, idx) => (
              <Card key={idx} className="p-6 glass border-primary/10">
                <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center mx-auto mb-3">
                  <Cloud className="w-6 h-6 text-primary/50" />
                </div>
                <p className="font-bold text-sm">{name}</p>
                <p className="text-xs text-foreground/60 mt-1">
                  {idx === 0 || idx === 1 || idx === 2 ? "Cloud storage" : idx === 1 ? "Cloud storage" : idx === 2 ? "Microsoft storage" : "India ERP"}
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center glass-heavy rounded-2xl p-12 border border-primary/20">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Connect Your Workflow?
          </h3>
          <p className="text-foreground/70 mb-8 max-w-2xl mx-auto">
            Seamlessly integrate CA GPT with your existing accounting software and business tools. Our 
            API makes custom integrations simple.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="glow-primary gap-2" data-testid="button-view-api">
              <BookOpen className="w-4 h-4" />
              View API Documentation
            </Button>
            <Button size="lg" variant="outline" className="gap-2" data-testid="button-request-integration">
              <ArrowRight className="w-4 h-4" />
              Request Custom Integration
            </Button>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-border/30">
            <div>
              <div className="text-4xl font-bold gradient-text mb-2">{totalIntegrations}+</div>
              <div className="text-sm text-foreground/60">Total Integrations</div>
            </div>
            <div>
              <div className="text-4xl font-bold gradient-text mb-2">{integrationCategories.length}</div>
              <div className="text-sm text-foreground/60">Categories</div>
            </div>
            <div>
              <div className="text-4xl font-bold gradient-text mb-2">100%</div>
              <div className="text-sm text-foreground/60">Available Now</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
