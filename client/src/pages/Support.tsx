import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { MessageCircle, Book, Mail, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Support() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent",
      description: "We'll get back to you within 24 hours."
    });
    setEmail("");
    setSubject("");
    setMessage("");
  };

  return (
    <div className="min-h-screen">
      <LandingNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              How Can We Help?
            </h1>
            <p className="text-xl text-muted-foreground">
              Get answers to your questions and expert support from our team
            </p>
          </div>
        </div>
      </section>

      {/* Support Options */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <Card className="p-6 space-y-4 hover-elevate">
              <MessageCircle className="w-10 h-10 text-primary" />
              <h3 className="font-semibold text-lg">Live Chat</h3>
              <p className="text-sm text-muted-foreground">
                Chat with our support team in real-time
              </p>
              <Button variant="outline" className="w-full" data-testid="button-start-chat">
                Start Chat
              </Button>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <Book className="w-10 h-10 text-primary" />
              <h3 className="font-semibold text-lg">Documentation</h3>
              <p className="text-sm text-muted-foreground">
                Browse guides and tutorials
              </p>
              <Link href="/docs">
                <Button variant="outline" className="w-full" data-testid="button-view-docs">
                  View Docs
                </Button>
              </Link>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <Mail className="w-10 h-10 text-primary" />
              <h3 className="font-semibold text-lg">Email Support</h3>
              <p className="text-sm text-muted-foreground">
                Get help via email within 24 hours
              </p>
              <Button variant="outline" className="w-full" data-testid="button-email-support">
                support@cagpt.icai.org
              </Button>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <HelpCircle className="w-10 h-10 text-primary" />
              <h3 className="font-semibold text-lg">Help Center</h3>
              <p className="text-sm text-muted-foreground">
                Find answers in our knowledge base
              </p>
              <Button variant="outline" className="w-full" data-testid="button-help-center">
                Browse FAQs
              </Button>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium">
                    Subject
                  </label>
                  <Input
                    id="subject"
                    placeholder="How can we help?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    data-testid="input-contact-subject"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue or question..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={6}
                    data-testid="input-contact-message"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="button-send-message">
                  Send Message
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-2">What subscription plans do you offer?</h3>
              <p className="text-muted-foreground">
                Plan access and usage limits are managed directly in your account settings and by your organization admin.
                Contact support for plan enablement and quota updates.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-2">Which accounting software integrations are supported?</h3>
              <p className="text-muted-foreground">
                CA GPT integrates with QuickBooks Online, Xero, Zoho Books, and ADP Workforce Now via OAuth 2.0.
                We also support secure file uploads for Drake Tax, TurboTax, and H&R Block.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-2">What countries and tax jurisdictions are supported?</h3>
              <p className="text-muted-foreground">
                CA GPT currently supports 6 markets: USA, Canada, India, UAE, Indonesia, and Turkey, with comprehensive
                tax code knowledge and compliance features for each jurisdiction.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-2">How does document analysis work?</h3>
              <p className="text-muted-foreground">
                We use Azure Document Intelligence for structured data extraction with automatic fallback to text-based
                parsing. Documents are encrypted with AES-256-GCM and scanned for viruses before processing.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-2">Is my data secure?</h3>
              <p className="text-muted-foreground">
                Yes. We use bcrypt password hashing, AES-256-GCM encryption for sensitive data, HTTPS-only connections,
                and comprehensive security headers. See our{" "}
                <Link href="/privacy" className="text-primary hover:underline">privacy policy</Link> for details.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-2">Can I cancel my subscription anytime?</h3>
              <p className="text-muted-foreground">
                Yes. You can cancel your subscription at any time from your settings page. You'll retain access
                until the end of your current billing period.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
