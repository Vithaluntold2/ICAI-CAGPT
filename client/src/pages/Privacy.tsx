import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      <div className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: November 11, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Introduction</h2>
            <p className="text-muted-foreground">
              CA GPT ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains 
              how we collect, use, disclose, and safeguard your information when you use our accounting 
              superintelligence platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Information We Collect</h2>
            
            <h3 className="text-2xl font-semibold mt-6">Personal Information</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Name and email address</li>
              <li>Password (encrypted with bcrypt, minimum 6 characters)</li>
              <li>Payment information (processed securely via Razorpay)</li>
              <li>Profile information (business, personal, family contexts)</li>
            </ul>

            <h3 className="text-2xl font-semibold mt-6">Financial Data</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Tax documents and financial statements you upload</li>
              <li>Accounting software integration data (QuickBooks, Xero, Zoho, ADP)</li>
              <li>Chat conversations and query history</li>
              <li>Calculations, scenarios, and analysis results</li>
            </ul>

            <h3 className="text-2xl font-semibold mt-6">Technical Information</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>IP address and browser information</li>
              <li>Session data and authentication tokens</li>
              <li>Usage statistics and query metrics</li>
              <li>Document processing metadata</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Provide AI-powered tax, audit, and financial analysis services</li>
              <li>Process payments and manage subscriptions</li>
              <li>Improve our multi-model AI routing and response quality</li>
              <li>Send service updates and billing notifications</li>
              <li>Ensure platform security and prevent fraud</li>
              <li>Comply with legal and regulatory requirements</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Data Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Encryption:</strong> AES-256-GCM for sensitive data at rest, TLS 1.3 for data in transit</li>
              <li><strong>Password Security:</strong> Bcrypt hashing with salt</li>
              <li><strong>File Security:</strong> Per-file encryption, key wrapping, SHA-256 checksums, virus scanning</li>
              <li><strong>Session Management:</strong> Secure HTTP-only cookies with SameSite protection</li>
              <li><strong>Infrastructure:</strong> Helmet middleware, rate limiting, trust proxy configuration</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Third-Party Services</h2>
            <p className="text-muted-foreground">
              We use the following third-party services that may collect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>AI Providers:</strong> Anthropic Claude, Google Gemini, Perplexity AI, Azure OpenAI</li>
              <li><strong>Payment Processing:</strong> Approved enterprise billing providers (where applicable)</li>
              <li><strong>Document Analysis:</strong> Azure Document Intelligence</li>
              <li><strong>Database:</strong> PostgreSQL (Supabase-backed)</li>
              <li><strong>Accounting Integrations:</strong> QuickBooks, Xero, Zoho Books, ADP</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data as follows:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Active account data: Retained while your account is active</li>
              <li>Conversation history: 90 days after account deletion</li>
              <li>Payment records: 7 years for tax and compliance purposes</li>
              <li>Uploaded documents: Deleted immediately upon account deletion</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Your Rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and data (GDPR compliance via /api/gdpr/delete-account)</li>
              <li>Export your data in machine-readable formats</li>
              <li>Opt out of marketing communications</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">International Data Transfers</h2>
            <p className="text-muted-foreground">
              CA GPT operates globally across 6 markets (USA, Canada, India, UAE, Indonesia, Turkey). Your data 
              may be transferred to and processed in countries other than your own. We ensure appropriate 
              safeguards are in place to protect your data in accordance with this Privacy Policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Children's Privacy</h2>
            <p className="text-muted-foreground">
              CA GPT is not intended for users under 18 years of age. We do not knowingly collect data from children.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl font-semibold">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <ul className="list-none space-y-2 text-muted-foreground ml-4">
              <li>Email: privacy@cagpt.icai.org</li>
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
