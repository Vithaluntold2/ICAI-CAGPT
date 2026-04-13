import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Shield, AlertTriangle, Scale } from "lucide-react";
// Tekkacel branding removed

export default function TermsOfService() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      <main className="relative pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-chart-2/10 -z-10" />
        
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Legal</Badge>
            <h1 className="text-5xl font-bold mb-4" data-testid="heading-terms-of-service">
              Terms of Service
            </h1>
            <p className="text-lg text-foreground/70">
              Last updated: November 19, 2025
            </p>
          </div>

          <div className="space-y-8">
            {/* Introduction */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-primary" />
                  <CardTitle>1. Agreement to Terms</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  By accessing or using CA GPT ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
                  If you disagree with any part of these terms, you may not access the Service.
                </p>
                <p>
                  These Terms apply to all visitors, users, and others who access or use the Service, including but not limited to 
                  Free, Plus, Professional, and Enterprise subscribers.
                </p>
              </CardContent>
            </Card>

            {/* Service Description */}
            <Card>
              <CardHeader>
                <CardTitle>2. Service Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  CA GPT is a cloud-based accounting superintelligence platform that provides:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>AI-powered tax and compliance analysis across multiple jurisdictions</li>
                  <li>Document intelligence and forensic analysis capabilities</li>
                  <li>Regulatory scenario simulation and what-if analysis</li>
                  <li>Client deliverable composition and professional document generation</li>
                  <li>Multi-model AI routing with intelligent failover</li>
                  <li>Integration with third-party accounting, tax, and payroll software</li>
                </ul>
                <p className="mt-4">
                  The Service is provided "as is" and "as available" without warranties of any kind, either express or implied.
                </p>
              </CardContent>
            </Card>

            {/* User Accounts */}
            <Card>
              <CardHeader>
                <CardTitle>3. User Accounts and Registration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">3.1 Account Creation</p>
                  <p className="text-sm text-foreground/70">
                    You must provide accurate, complete, and current information during registration. You are responsible for 
                    maintaining the confidentiality of your account credentials and for all activities under your account.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">3.2 Account Eligibility</p>
                  <p className="text-sm text-foreground/70">
                    You must be at least 18 years old to use the Service. By creating an account, you represent that you are 
                    of legal age to form a binding contract.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">3.3 Account Security</p>
                  <p className="text-sm text-foreground/70">
                    You must notify us immediately of any unauthorized access to your account. We are not liable for any loss 
                    or damage arising from your failure to maintain account security.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Acceptable Use */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                  <CardTitle className="text-destructive">4. Acceptable Use Policy</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>You agree NOT to use the Service to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                  <li>Violate any applicable laws, regulations, or third-party rights</li>
                  <li>Upload, transmit, or distribute any malicious code, viruses, or harmful content</li>
                  <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                  <li>Engage in any activity that interferes with or disrupts the Service</li>
                  <li>Use the Service for any fraudulent, illegal, or unauthorized purpose</li>
                  <li>Resell, redistribute, or sublicense the Service without explicit authorization</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                  <li>Remove, obscure, or alter any proprietary notices or branding</li>
                  <li>Use automated systems (bots, scrapers) without prior written consent</li>
                  <li>Abuse our support resources or submit false reports</li>
                </ul>
                <p className="mt-4 text-sm">
                  Violation of this Acceptable Use Policy may result in immediate account suspension or termination without refund.
                </p>
              </CardContent>
            </Card>

            {/* Subscription Terms */}
            <Card>
              <CardHeader>
                <CardTitle>5. Subscription and Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">5.1 Subscription Plans</p>
                  <p className="text-sm text-foreground/70">
                    Access tiers and usage limits are determined by your account configuration and organization policy.
                    Contact your administrator for plan details.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">5.2 Billing and Payments</p>
                  <p className="text-sm text-foreground/70">
                    Billing and payment administration are handled through approved organizational channels.
                    Any paid access terms are governed by your enterprise agreement.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">5.3 Automatic Renewal</p>
                  <p className="text-sm text-foreground/70">
                    Subscriptions automatically renew at the end of each billing period unless canceled before the renewal date. 
                    You will be charged the then-current rate for your plan.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">5.4 Cancellation</p>
                  <p className="text-sm text-foreground/70">
                    You may cancel your subscription at any time from your account settings. Cancellation takes effect at the 
                    end of the current billing period. No pro-rated refunds are provided for partial billing periods.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">5.5 Price Changes</p>
                  <p className="text-sm text-foreground/70">
                    Commercial terms may be updated by prior notice under the applicable service agreement.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Intellectual Property */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-primary" />
                  <CardTitle>6. Intellectual Property Rights</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">6.1 Service Ownership</p>
                  <p className="text-sm text-foreground/70">
                    The Service, including all content, features, functionality, software, and design, is owned by CA GPT 
                    and is protected by international copyright, trademark, patent, and other intellectual property laws.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">6.2 User Content</p>
                  <p className="text-sm text-foreground/70">
                    You retain ownership of all content you upload, submit, or create through the Service ("User Content"). 
                    You grant us a worldwide, royalty-free license to use, store, and process your User Content solely to 
                    provide the Service to you.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">6.3 AI-Generated Content</p>
                  <p className="text-sm text-foreground/70">
                    Content generated by our AI models in response to your queries ("AI Content") is provided for your use. 
                    However, AI Content may contain errors or inaccuracies and should be reviewed before professional use.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Data and Privacy */}
            <Card>
              <CardHeader>
                <CardTitle>7. Data Protection and Privacy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Our collection and use of personal information is governed by our Privacy Policy. By using the Service, you 
                  consent to our Privacy Policy and agree to its terms.
                </p>
                <div>
                  <p className="font-semibold mb-2">7.1 Data Security</p>
                  <p className="text-sm text-foreground/70">
                    We implement industry-standard security measures to protect your data, including AES-256 encryption for 
                    sensitive information, HTTPS for all connections, and regular security audits.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">7.2 Data Retention</p>
                  <p className="text-sm text-foreground/70">
                    We retain your User Content for as long as your account is active or as needed to provide services. 
                    You may delete your content at any time from your account settings.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Service Level Agreement */}
            <Card>
              <CardHeader>
                <CardTitle>8. Service Level Agreement (SLA)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">8.1 Uptime Commitment</p>
                  <p className="text-sm text-foreground/70">
                    We strive to maintain 99.9% uptime for the Service, excluding scheduled maintenance windows announced 
                    at least 24 hours in advance.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">8.2 Support Response Times</p>
                  <ul className="text-sm text-foreground/70 space-y-1 ml-4">
                    <li>• Free Plan: Community support, best-effort response</li>
                    <li>• Plus Plan: Email support, 24-hour response time</li>
                    <li>• Professional Plan: Priority support, 4-6 hour response time</li>
                    <li>• Enterprise Plan: Dedicated support, 1-hour response time, 24/7 availability</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2">8.3 No Warranty</p>
                  <p className="text-sm text-foreground/70">
                    The Service is provided "as is" without any warranty. We do not guarantee uninterrupted, error-free operation.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Limitation of Liability */}
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Scale className="w-6 h-6 text-destructive" />
                  <CardTitle className="text-destructive">9. Limitation of Liability</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL CA GPT BE LIABLE FOR:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                  <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                  <li>Loss of profits, revenue, data, or business opportunities</li>
                  <li>Errors or inaccuracies in AI-generated content or analysis</li>
                  <li>Professional decisions made based on Service outputs</li>
                  <li>Unauthorized access to or alteration of your transmissions or data</li>
                </ul>
                <p className="text-sm mt-4">
                  Our total liability for any claims arising from these Terms or your use of the Service shall not exceed 
                  the amount you paid to us in the 12 months preceding the claim.
                </p>
              </CardContent>
            </Card>

            {/* Professional Disclaimer */}
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">10. Professional Advice Disclaimer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">
                  IMPORTANT: CA GPT is a tool to assist accounting and tax professionals. It does NOT provide professional 
                  accounting, tax, legal, or financial advice.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                  <li>AI-generated analysis should be reviewed by qualified professionals before use</li>
                  <li>We are not responsible for professional decisions made based on Service outputs</li>
                  <li>Always consult with licensed accountants, tax advisors, or attorneys for professional matters</li>
                  <li>The Service does not replace professional judgment or expertise</li>
                </ul>
              </CardContent>
            </Card>

            {/* Termination */}
            <Card>
              <CardHeader>
                <CardTitle>11. Termination</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">11.1 Termination by You</p>
                  <p className="text-sm text-foreground/70">
                    You may terminate your account at any time by contacting support or using the account deletion feature 
                    in your settings.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">11.2 Termination by Us</p>
                  <p className="text-sm text-foreground/70">
                    We may suspend or terminate your account immediately, without prior notice, for violation of these Terms, 
                    fraudulent activity, or any conduct we reasonably believe is harmful to the Service or other users.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">11.3 Effect of Termination</p>
                  <p className="text-sm text-foreground/70">
                    Upon termination, your access to the Service will cease immediately. We may delete your User Content 
                    after a 30-day grace period. Provisions that by their nature should survive termination will remain in effect.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Governing Law */}
            <Card>
              <CardHeader>
                <CardTitle>12. Governing Law and Dispute Resolution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">12.1 Governing Law</p>
                  <p className="text-sm text-foreground/70">
                    These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction], without 
                    regard to its conflict of law provisions.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2">12.2 Dispute Resolution</p>
                  <p className="text-sm text-foreground/70">
                    Any disputes arising from these Terms or the Service shall first be attempted to be resolved through 
                    good-faith negotiation. If unresolved within 30 days, disputes may be submitted to binding arbitration.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Changes to Terms */}
            <Card>
              <CardHeader>
                <CardTitle>13. Changes to Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  We reserve the right to modify these Terms at any time. We will notify users of material changes via 
                  email or through the Service at least 30 days before the effective date.
                </p>
                <p>
                  Your continued use of the Service after the effective date constitutes acceptance of the modified Terms. 
                  If you do not agree to the changes, you must stop using the Service.
                </p>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card>
              <CardHeader>
                <CardTitle>14. Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  For questions about these Terms of Service, please contact us through the support section in the application.
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
