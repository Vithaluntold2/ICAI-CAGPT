import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Mail } from "lucide-react";
// Tekkacel branding removed

export default function RefundPolicy() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      <main className="relative pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-chart-2/10 -z-10" />
        
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Legal</Badge>
            <h1 className="text-5xl font-bold mb-4" data-testid="heading-refund-policy">
              Refund Policy
            </h1>
            <p className="text-lg text-foreground/70">
              Last updated: November 19, 2025
            </p>
          </div>

          <div className="space-y-8">
            {/* 14-Day Money-Back Guarantee */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  <CardTitle>14-Day Money-Back Guarantee</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  We stand behind the quality of CA GPT and offer a <strong>14-day money-back guarantee</strong> on all paid subscription plans (Plus, Professional, and Enterprise).
                </p>
                <p>
                  If you're not satisfied with your subscription for any reason, you can request a full refund within 14 days of your initial purchase.
                </p>
              </CardContent>
            </Card>

            {/* Eligibility Criteria */}
            <Card>
              <CardHeader>
                <CardTitle>Refund Eligibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">First-Time Subscribers</p>
                      <p className="text-sm text-foreground/70">
                        The money-back guarantee applies to first-time subscribers of each plan tier.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Within 14 Days</p>
                      <p className="text-sm text-foreground/70">
                        Refund requests must be submitted within 14 calendar days of the initial purchase date.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">No Abuse</p>
                      <p className="text-sm text-foreground/70">
                        Account must not have violated our Terms of Service or engaged in fraudulent activity.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Non-Refundable Items */}
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-destructive" />
                  <CardTitle className="text-destructive">Non-Refundable Items</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>The following are <strong>not eligible</strong> for refunds:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Pay-as-you-go Credits</p>
                      <p className="text-sm text-foreground/70">
                        Query credits purchased on a pay-as-you-go basis are non-refundable once purchased.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Renewal Charges</p>
                      <p className="text-sm text-foreground/70">
                        Automatic subscription renewals after the initial 14-day period are non-refundable. Cancel before your renewal date to avoid charges.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Partial Refunds</p>
                      <p className="text-sm text-foreground/70">
                        We do not offer pro-rated refunds for unused time on monthly or annual subscriptions.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Repeat Refunds</p>
                      <p className="text-sm text-foreground/70">
                        Users who have previously received a refund for the same plan tier are not eligible for additional refunds.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Refund Process */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-primary" />
                  <CardTitle>How to Request a Refund</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>To request a refund, follow these steps:</p>
                <ol className="list-decimal list-inside space-y-3 ml-2">
                  <li>
                    <strong>Contact Support:</strong> Contact our support team through the application with the subject line "Refund Request"
                  </li>
                  <li>
                    <strong>Provide Details:</strong> Include your account email, subscription plan, and reason for the refund request (optional but helpful)
                  </li>
                  <li>
                    <strong>Wait for Confirmation:</strong> Our team will review your request and respond within 1-2 business days
                  </li>
                  <li>
                    <strong>Receive Refund:</strong> If approved, refunds are processed within 5-10 business days to your original payment method
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Processing Time */}
            <Card>
              <CardHeader>
                <CardTitle>Refund Processing Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="font-semibold mb-2">Approval Time</p>
                    <p className="text-sm text-foreground/70">1-2 business days for review and approval</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Processing Time</p>
                    <p className="text-sm text-foreground/70">5-10 business days to original payment method</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Credit Card</p>
                    <p className="text-sm text-foreground/70">May take additional 3-5 days depending on your bank</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">International Payments</p>
                    <p className="text-sm text-foreground/70">May take up to 15 business days for international transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cancellation Policy */}
            <Card>
              <CardHeader>
                <CardTitle>Cancellation vs. Refund</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  You can <strong>cancel your subscription</strong> at any time from your account settings. Cancellation stops future billing but does not refund the current billing period.
                </p>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-2">Important:</p>
                  <p className="text-sm text-foreground/70">
                    If you cancel within the first 14 days and want a refund, you must explicitly request a refund through support. 
                    Cancellation alone does not trigger a refund.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Exceptions */}
            <Card>
              <CardHeader>
                <CardTitle>Exceptions and Special Cases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold">Service Outages</p>
                    <p className="text-sm text-foreground/70">
                      In case of extended service outages (&gt;48 hours), we may offer pro-rated refunds or account credits at our discretion.
                    </p>                  </div>
                  <div>
                    <p className="font-semibold">Enterprise Plans</p>
                    <p className="text-sm text-foreground/70">
                      Enterprise customers may have custom refund terms as specified in their contract.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Fraudulent Activity</p>
                    <p className="text-sm text-foreground/70">
                      Accounts terminated for fraudulent activity or Terms of Service violations forfeit all refund eligibility.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-primary" />
                  <CardTitle>Questions About Refunds?</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  If you have questions about our refund policy or need assistance with a refund request, our support team is here to help.
                </p>
                <p>
                  Contact us through the support section in the application.
                </p>
                <p className="mt-2 text-sm text-foreground/70">
                  Average response time: 4-6 hours (business days)
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
