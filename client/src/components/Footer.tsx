import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import logoImg from "@assets/icai-ca-india-logo.png";
import { useState } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Footer() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubscribe = () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to subscribe."
      });
      return;
    }
    
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address."
      });
      return;
    }
    
    // Success - in production this would call an API
    toast({
      title: "Subscribed Successfully!",
      description: "Thank you for subscribing. You'll receive our latest updates at " + email
    });
    setEmail("");
  };

  return (
    <footer className="border-t border-primary/10 bg-background">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="CA GPT" className="h-12 w-auto" />
              <span className="font-display text-2xl font-bold text-[#003087]">CA GPT</span>
            </div>
            <p className="font-body text-sm text-foreground/70 max-w-sm leading-relaxed">
              Your AI platform for Chartered Accountants, built on ICAI's knowledge base.
              Trusted by CA firms for audit, tax, compliance, and advisory workflows.
            </p>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Subscribe to updates
              </p>
              <div className="flex gap-2 max-w-md">
                <Input 
                  type="email" 
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-background/50 border-primary/20 focus:border-primary/50 focus:ring-primary/20"
                  data-testid="input-newsletter-email"
                />
                <Button 
                  onClick={handleSubscribe}
                  className="bg-primary hover:bg-secondary text-primary-foreground gap-2"
                  data-testid="button-newsletter-subscribe"
                >
                  <Send className="w-4 h-4" />
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-display font-bold mb-5 text-foreground">Product</h4>
            <ul className="space-y-3 text-sm text-foreground/70">
              <li><Link href="/features" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-features">Features</Link></li>
                            <li><Link href="/api" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-api">API</Link></li>
              <li><Link href="/docs" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-integrations">Integrations</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-bold mb-5 text-foreground">Resources</h4>
            <ul className="space-y-3 text-sm text-foreground/70">
              <li><Link href="/docs" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-docs">Documentation</Link></li>
              <li><Link href="/docs" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-guides">Guides</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-blog">Blog</Link></li>
              <li><Link href="/support" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-support">Support</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-bold mb-5 text-foreground">Company</h4>
            <ul className="space-y-3 text-sm text-foreground/70">
              <li><Link href="/support" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-support-company">Support</Link></li>
              <li><Link href="/docs" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-docs-company">Documentation</Link></li>
              <li><Link href="/api" className="hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-api-company">API Access</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-10 border-t border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground/80 flex items-center gap-2 flex-wrap">
              <span>&copy; 2025 CA GPT. All rights reserved.</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
