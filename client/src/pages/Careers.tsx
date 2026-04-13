import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { Briefcase, MapPin, Clock, Globe, Heart, Zap, Users, TrendingUp } from "lucide-react";

export default function Careers() {
  const positions = [
    {
      id: 1,
      title: "Senior AI/ML Engineer",
      department: "Engineering",
      location: "Remote (Global)",
      type: "Full-time",
      description: "Build and optimize multi-model AI routing systems for accounting intelligence"
    },
    {
      id: 2,
      title: "Full-Stack Engineer",
      department: "Engineering",
      location: "Remote (Global)",
      type: "Full-time",
      description: "Develop real-time chat interfaces and document processing pipelines"
    },
    {
      id: 3,
      title: "Product Manager - Tax & Compliance",
      department: "Product",
      location: "Remote (Global)",
      type: "Full-time",
      description: "Define roadmap for regulatory scenario simulator and global compliance features"
    },
    {
      id: 4,
      title: "Senior Accountant / Tax Specialist",
      department: "Domain Expertise",
      location: "Remote (Global)",
      type: "Full-time",
      description: "Validate AI outputs and contribute accounting domain knowledge"
    },
    {
      id: 5,
      title: "DevOps Engineer",
      department: "Engineering",
      location: "Remote (Global)",
      type: "Full-time",
      description: "Scale infrastructure for multi-region deployment and real-time processing"
    },
    {
      id: 6,
      title: "Customer Success Manager",
      department: "Customer Success",
      location: "Remote (Global)",
      type: "Full-time",
      description: "Help accounting professionals maximize value from CA GPT's AI capabilities"
    }
  ];

  const benefits = [
    {
      icon: Globe,
      title: "Remote-First",
      description: "Work from anywhere in our 6 supported markets"
    },
    {
      icon: Heart,
      title: "Health & Wellness",
      description: "Comprehensive health coverage for you and your family"
    },
    {
      icon: Zap,
      title: "Learning Budget",
      description: "$3,000/year for courses, conferences, and books"
    },
    {
      icon: Users,
      title: "Team Retreats",
      description: "Bi-annual in-person gatherings in amazing locations"
    },
    {
      icon: TrendingUp,
      title: "Equity Compensation",
      description: "Meaningful stock options for all team members"
    },
    {
      icon: Clock,
      title: "Flexible Hours",
      description: "Async-first culture with core overlap hours"
    }
  ];

  return (
    <div className="min-h-screen">
      <LandingNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              Build the Future of Accounting Intelligence
            </h1>
            <p className="text-xl text-muted-foreground">
              Join a team of engineers, accountants, and AI researchers transforming how millions of 
              professionals handle tax, audit, and financial analysis.
            </p>
            <div className="flex gap-4">
              <Button size="lg" data-testid="button-view-positions">
                View Open Positions
              </Button>
              <Link href="/">
                <Button size="lg" variant="outline" data-testid="button-learn-more">
                  Learn About CA GPT
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why CA GPT */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why CA GPT?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We're building technology that directly impacts millions of businesses and professionals worldwide
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <Card className="p-8 space-y-4">
              <h3 className="text-2xl font-semibold">Mission-Driven Impact</h3>
              <p className="text-muted-foreground">
                Accounting isn't just numbers—it's the foundation of every business decision. Your work at 
                CA GPT directly helps accountants save time, reduce errors, and provide better strategic advice 
                to their clients.
              </p>
            </Card>

            <Card className="p-8 space-y-4">
              <h3 className="text-2xl font-semibold">Cutting-Edge Technology</h3>
              <p className="text-muted-foreground">
                Work with the latest AI models (Claude, Gemini, GPT-4), advanced financial algorithms, and 
                real-time processing systems. We're pushing the boundaries of what's possible with AI in 
                professional services.
              </p>
            </Card>

            <Card className="p-8 space-y-4">
              <h3 className="text-2xl font-semibold">Domain Expertise</h3>
              <p className="text-muted-foreground">
                Collaborate with experienced accountants, tax professionals, and auditors who understand the 
                real-world challenges you're solving. Our team brings deep accounting knowledge alongside 
                technical excellence.
              </p>
            </Card>

            <Card className="p-8 space-y-4">
              <h3 className="text-2xl font-semibold">Global Reach</h3>
              <p className="text-muted-foreground">
                We operate across 6 markets (USA, Canada, India, UAE, Indonesia, Turkey) with plans for rapid 
                expansion. Build systems that handle diverse tax codes, currencies, and compliance requirements.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Benefits & Perks</h2>
            <p className="text-lg text-muted-foreground">
              We invest in our team's growth, health, and happiness
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card key={index} className="p-6 space-y-3">
                  <Icon className="w-8 h-8 text-primary" />
                  <h3 className="font-semibold text-lg">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Open Positions</h2>
            <p className="text-lg text-muted-foreground">
              Join our remote-first team and help build the future of accounting
            </p>
          </div>

          <div className="space-y-6">
            {positions.map((position) => (
              <Card key={position.id} className="p-6 hover-elevate" data-testid={`card-position-${position.id}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{position.title}</h3>
                      <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {position.department}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{position.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{position.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{position.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button data-testid={`button-apply-${position.id}`}>
                      <Briefcase className="mr-2 w-4 h-4" />
                      Apply Now
                    </Button>
                    <Button variant="outline" data-testid={`button-learn-more-${position.id}`}>
                      Learn More
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-4xl font-bold">Don't See a Perfect Fit?</h2>
          <p className="text-lg text-muted-foreground">
            We're always looking for exceptional talent. Send us your resume and tell us how you'd like 
            to contribute to CA GPT's mission.
          </p>
          <Button size="lg" data-testid="button-general-application">
            Submit General Application
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
