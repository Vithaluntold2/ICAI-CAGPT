import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      <div className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: November 11, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Agreement to Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using CA GPT's accounting superintelligence platform ("Service"), you agree to be 
              bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you 
              may not access the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Service Description</h2>
            <p className="text-muted-foreground">
              CA GPT provides AI-powered accounting intelligence including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Regulatory Scenario Simulator for tax and audit modeling</li>
              <li>Client Deliverable Composer for document generation</li>
              <li>Forensic Document Intelligence for anomaly detection</li>
              <li>Multi-provider AI routing (Claude, Gemini, Perplexity, Azure OpenAI)</li>
              <li>Integrations with QuickBooks, Xero, Zoho Books, ADP</li>
              <li>Real-time chat with document analysis and export capabilities</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Subscription Plans</h2>
            
            <h3 className="text-2xl font-semibold mt-6">Available Tiers</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Access:</strong> Feature access and limits are determined by account policy</li>
              <li><strong>Usage:</strong> Query and document limits may vary by organization configuration</li>
              <li><strong>Enterprise:</strong> Multi-user administration is available for eligible deployments</li>
            </ul>

            <h3 className="text-2xl font-semibold mt-6">Billing</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Billing terms are governed by your workspace or enterprise agreement</li>
              <li>Payment processing is handled through approved billing channels where enabled</li>
              <li>Service renewals and changes follow contractual notice terms</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Usage Quotas and Limits</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Query limits reset monthly on subscription anniversary</li>
              <li>Exceeded quotas result in service suspension until upgrade or renewal</li>
              <li>Document uploads limited by plan (5-50 per month)</li>
              <li>File size limit: 10MB per upload</li>
              <li>Virus scanning performed on all uploaded files</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">User Responsibilities</h2>
            <p className="text-muted-foreground">You agree to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Provide accurate, current information during registration</li>
              <li>Maintain the security of your account credentials</li>
              <li>Use the Service only for lawful purposes</li>
              <li>Not attempt to circumvent usage limits or security measures</li>
              <li>Not share your account with unauthorized users</li>
              <li>Verify all AI-generated content before making financial decisions</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Professional Advice Disclaimer</h2>
            <p className="text-muted-foreground">
              <strong>IMPORTANT:</strong> CA GPT provides AI-powered analysis and calculations but does not 
              replace professional accounting, tax, or legal advice. You should:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Consult qualified professionals before making significant financial decisions</li>
              <li>Verify all calculations and recommendations independently</li>
              <li>Understand that AI models may occasionally produce errors</li>
              <li>Review jurisdiction-specific regulations with licensed professionals</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Intellectual Property</h2>
            <p className="text-muted-foreground">
              CA GPT and its original content, features, and functionality are owned by CA GPT 
              You retain ownership of data you upload, but grant us license to process it for Service delivery.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Cancellation and Refunds</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>You may cancel your subscription at any time from Settings</li>
              <li>Access continues until the end of your current billing period</li>
              <li>No refunds for partial months or unused queries</li>
              <li>Annual subscriptions are non-refundable after 14 days</li>
              <li>Enterprise plans have custom cancellation terms</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Account Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to terminate or suspend your account for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Violation of these Terms</li>
              <li>Fraudulent payment activity</li>
              <li>Abuse of Service resources</li>
              <li>Repeated quota violations</li>
              <li>Security threats or malicious behavior</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Data Deletion</h2>
            <p className="text-muted-foreground">
              You may delete your account at any time via Settings. Upon deletion:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Personal data is permanently removed within 30 days</li>
              <li>Uploaded documents are deleted immediately</li>
              <li>Conversation history is retained for 90 days (legal compliance)</li>
              <li>Payment records retained for 7 years (tax requirements)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Limitation of Liability</h2>
            <p className="text-muted-foreground">
              CA GPT shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
              resulting from your use of the Service, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Financial losses from AI recommendations</li>
              <li>Tax penalties from incorrect calculations</li>
              <li>Service interruptions or data loss</li>
              <li>Third-party integration failures</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
              in which CA GPT is registered, without regard to conflict of law provisions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will notify users of material changes 
              via email or Service notification. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Contact Information</h2>
            <p className="text-muted-foreground">
              Questions about these Terms? Contact us:
            </p>
            <ul className="list-none space-y-2 text-muted-foreground ml-4">
              <li>Email: legal@cagpt.icai.org</li>
              <li>Support: support@cagpt.icai.org</li>
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
