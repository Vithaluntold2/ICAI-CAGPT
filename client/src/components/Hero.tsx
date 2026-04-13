import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowRight, Sparkles, Bot, FileSearch, BarChart3, Shield } from "lucide-react";
import chatDashboardImg from "@assets/generated_images/Chat_interface_dashboard_screenshot_b7283c51.png";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20 lg:py-24 bg-background">
      
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8 text-center lg:text-left">
            {/* Brand Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-[#003087]">CA GPT Platform</span>
            </div>
            
            {/* Headline - Orbitron Display Font */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight">
              <span className="text-foreground">ICAI's AI-Powered</span>
              <br />
              <span className="bg-gradient-to-r from-[#003087] via-[#0055b3] to-[#003087] bg-clip-text text-transparent">
                CA GPT Platform
              </span>
              <br />
              <span className="text-foreground">for Chartered Accountants</span>
            </h1>
            
            {/* Brand Slogan - Exo 2 Body Font */}
            <div className="space-y-4">
              <p className="font-body text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                Real-time expert guidance for CA firms and Chartered Accountants.
                Powered by ICAI-aligned AI — for audit, tax, compliance, and advisory workflows.
              </p>
            </div>
            
            {/* Feature Pills */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <Badge variant="secondary" className="px-4 py-2 gap-2 bg-primary/10 border-primary/20 text-primary hover:bg-primary/15">
                <Bot className="w-4 h-4" />
                Multi-LLM AI
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 gap-2 bg-accent/30 border-accent text-primary hover:bg-accent/40">
                <FileSearch className="w-4 h-4" />
                Document Intel
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 gap-2 bg-primary/10 border-primary/20 text-primary hover:bg-primary/15">
                <BarChart3 className="w-4 h-4" />
                Live Analytics
              </Badge>
            </div>
            
            {/* CTAs */}
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2">
              <Link href="/auth">
                <Button 
                  size="lg" 
                  className="gap-2 h-14 px-8 text-base font-semibold bg-primary hover:bg-secondary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                  data-testid="button-start-trial"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/chat">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="h-14 px-8 text-base font-semibold border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all duration-300"
                  data-testid="button-see-demo"
                >
                  Explore Demo
                </Button>
              </Link>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex items-center gap-6 pt-4 justify-center lg:justify-start text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>AES-256 Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>No Credit Card Required</span>
              </div>
            </div>
          </div>
          
          {/* Right Column - Platform Preview */}
          <div className="relative lg:ml-8">
            {/* Main Dashboard Card */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-primary/20 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 transition-all duration-500 hover:shadow-3xl hover:shadow-primary/20 hover:-translate-y-1">
              <img 
                src={chatDashboardImg} 
                alt="CA GPT 3-pane interface with conversations, chat, and output pane" 
                className="w-full h-auto"
              />
              
              {/* Feature Labels */}
              <div className="absolute top-4 left-4 bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <p className="text-xs font-semibold text-white">Sessions</p>
              </div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent/95 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <p className="text-xs font-semibold text-primary">AI Chat</p>
              </div>
              <div className="absolute top-4 right-4 bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <p className="text-xs font-semibold text-white">Output</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
