import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Zap, Globe2, CheckCircle2 } from "lucide-react";
// Tekkacel branding removed

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      <main className="relative pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-chart-2/10 -z-10" />
        
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Legal</Badge>
            <h1 className="text-5xl font-bold mb-4" data-testid="heading-shipping-policy">
              Shipping & Delivery Policy
            </h1>
            <p className="text-lg text-foreground/70">
              Last updated: November 19, 2025
            </p>
          </div>

          <div className="space-y-8">
            {/* Digital Service Notice */}
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Cloud className="w-6 h-6 text-primary" />
                  <CardTitle>100% Digital Service</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg">
                  CA GPT is a <strong>cloud-based software service</strong>. We do not ship physical products or tangible goods.
                </p>
                <p>
                  All features, services, and deliverables are provided digitally through our web-based platform and are 
                  accessible immediately upon account creation and subscription activation.
                </p>
              </CardContent>
            </Card>

            {/* Instant Access */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-primary" />
                  <CardTitle>Immediate Digital Delivery</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Upon account creation or subscription purchase, you receive:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Instant Platform Access</p>
                      <p className="text-sm text-foreground/70">
                        Immediate access to the CA GPT platform via web browser from any device
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Subscription Features</p>
                      <p className="text-sm text-foreground/70">
                        All features included in your plan tier are activated immediately
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Account Credentials</p>
                      <p className="text-sm text-foreground/70">
                        Email confirmation with login credentials sent within seconds
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Documentation Access</p>
                      <p className="text-sm text-foreground/70">
                        Complete access to user guides, API documentation, and support resources
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Global Availability */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Globe2 className="w-6 h-6 text-primary" />
                  <CardTitle>Global Availability</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  As a cloud-based service, CA GPT is available worldwide with no geographic restrictions or delivery delays.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="font-semibold mb-2">Supported Regions</p>
                    <ul className="text-sm text-foreground/70 space-y-1">
                      <li>• United States</li>
                      <li>• Canada</li>
                      <li>• India</li>
                      <li>• United Arab Emirates</li>
                      <li>• Indonesia</li>
                      <li>• Turkey</li>
                      <li>• All other countries</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Access Requirements</p>
                    <ul className="text-sm text-foreground/70 space-y-1">
                      <li>• Internet connection</li>
                      <li>• Modern web browser</li>
                      <li>• Valid email address</li>
                      <li>• Payment method (for paid plans)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Activation */}
            <Card>
              <CardHeader>
                <CardTitle>Account Activation Process</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>The typical account activation timeline:</p>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold">Sign Up (0 seconds)</p>
                      <p className="text-sm text-foreground/70">Complete registration form with email and password</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold">Email Verification (1-2 minutes)</p>
                      <p className="text-sm text-foreground/70">Verify email address via confirmation link</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      3
                    </div>
                    <div>
                      <p className="font-semibold">Payment Processing (Paid Plans Only) (1-3 minutes)</p>
                      <p className="text-sm text-foreground/70">Complete payment for paid subscription tiers</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      4
                    </div>
                    <div>
                      <p className="font-semibold">Instant Access (0 seconds)</p>
                      <p className="text-sm text-foreground/70">Full platform access immediately after payment confirmation</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deliverables */}
            <Card>
              <CardHeader>
                <CardTitle>What You Receive</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Your CA GPT subscription includes the following digital deliverables:</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-semibold mb-2">Platform Access</p>
                    <p className="text-sm text-foreground/70">
                      Web-based interface accessible from any device with internet connection
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-semibold mb-2">Cloud Storage</p>
                    <p className="text-sm text-foreground/70">
                      Secure cloud storage for conversations, documents, and analysis results
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-semibold mb-2">AI Models</p>
                    <p className="text-sm text-foreground/70">
                      Access to multiple AI models with intelligent routing and failover
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-semibold mb-2">Export Capabilities</p>
                    <p className="text-sm text-foreground/70">
                      Generate and download documents in 6 formats (TXT, CSV, DOCX, PDF, PPTX, XLSX)
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-semibold mb-2">Support Services</p>
                    <p className="text-sm text-foreground/70">
                      Email and in-app support based on subscription tier
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-semibold mb-2">API Access</p>
                    <p className="text-sm text-foreground/70">
                      Programmatic access (Professional and Enterprise plans only)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Issues */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Issues & Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  In the rare case that you experience issues accessing your account or services:
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold">Check Email</p>
                    <p className="text-sm text-foreground/70">
                      Verify that our confirmation email hasn't been filtered to spam/junk folders
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Clear Cache</p>
                    <p className="text-sm text-foreground/70">
                      Try clearing browser cache or using an incognito/private browsing window
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Contact Support</p>
                    <p className="text-sm text-foreground/70">
                      Contact us through the application for immediate assistance
                    </p>
                  </div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg mt-4">
                  <p className="text-sm font-semibold mb-2">Service Level Agreement (SLA):</p>
                  <p className="text-sm text-foreground/70">
                    We commit to resolving any access or delivery issues within 4-6 hours during business days. 
                    For urgent issues, priority support is available for Professional and Enterprise subscribers.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* No Physical Shipping */}
            <Card className="border-muted">
              <CardHeader>
                <CardTitle>Physical Product Disclaimer</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  <strong>Important:</strong> CA GPT does not offer, sell, or ship any physical products, merchandise, or tangible goods. 
                  All services are provided digitally through our cloud platform.
                </p>
                <p className="mt-4 text-sm text-foreground/70">
                  If you receive any communication claiming to ship physical CA GPT products, please report it through the application
                  as it may be fraudulent.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

      </main>
      
      <Footer />
    </div>
  );
}
