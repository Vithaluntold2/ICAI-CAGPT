import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { Code, Terminal, Key, Zap } from "lucide-react";

export default function API() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              CA GPT API Documentation
            </h1>
            <p className="text-xl text-muted-foreground">
              Integrate CA GPT's accounting superintelligence into your applications with our RESTful API
            </p>
            <Link href="/auth">
              <Button size="lg" data-testid="button-get-api-key">
                Get API Key
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold">Quick Start</h2>
              <p className="text-lg text-muted-foreground">
                Get started with CA GPT API in minutes. Authentication uses session-based cookies for security.
              </p>
              <div className="space-y-4">
                <Card className="p-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-semibold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Create Account</h3>
                    <p className="text-sm text-muted-foreground">Sign up for a CA GPT account and choose your plan</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Authenticate</h3>
                    <p className="text-sm text-muted-foreground">POST to /api/login with credentials</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Make Requests</h3>
                    <p className="text-sm text-muted-foreground">Use authenticated session for all API calls</p>
                  </div>
                </Card>
              </div>
            </div>
            <div>
              <Card className="p-6 bg-muted/50">
                <div className="flex items-center gap-2 mb-4">
                  <Terminal className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Example Request</span>
                </div>
                <pre className="text-sm overflow-x-auto"><code className="text-muted-foreground">{`// Authentication
fetch('https://cagpt.icai.org/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'your@email.com',
    password: 'your-password'
  }),
  credentials: 'include'
});

// Chat query
fetch('https://cagpt.icai.org/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'conv_123',
    message: 'Calculate Q4 2024 tax liability',
    mode: 'calculation'
  }),
  credentials: 'include'
});`}</code></pre>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Core Endpoints */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-12">Core Endpoints</h2>
          
          <div className="space-y-6">
            {/* Authentication */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">Authentication</h3>
                    <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-mono rounded">POST</span>
                  </div>
                  <code className="text-sm text-muted-foreground">/api/login</code>
                  <p className="mt-2 text-muted-foreground">
                    Authenticate user and create session cookie
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Request Body:</p>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto"><code>{`{
  "email": "user@example.com",
  "password": "password123"
}`}</code></pre>
                  </div>
                </div>
              </div>
            </Card>

            {/* Chat */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">Chat Query</h3>
                    <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-mono rounded">POST</span>
                  </div>
                  <code className="text-sm text-muted-foreground">/api/chat</code>
                  <p className="mt-2 text-muted-foreground">
                    Send accounting query with multi-model AI routing
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Request Body:</p>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto"><code>{`{
  "conversationId": "conv_123",
  "message": "Calculate depreciation",
  "mode": "calculation",
  "profileId": 1,
  "attachments": []
}`}</code></pre>
                    <p className="text-sm font-medium mt-4">Modes:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code>standard</code> - General accounting queries</li>
                      <li>• <code>calculation</code> - Financial calculations with formulas</li>
                      <li>• <code>deep-research</code> - Multi-source research with citations</li>
                      <li>• <code>checklist</code> - Compliance checklists</li>
                      <li>• <code>workflow</code> - Process workflows with diagrams</li>
                      <li>• <code>audit-plan</code> - Audit planning documents</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            {/* Conversations */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Code className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">Conversations</h3>
                    <span className="px-2 py-1 bg-rai-500/10 text-rai-500 text-xs font-mono rounded">GET</span>
                  </div>
                  <code className="text-sm text-muted-foreground">/api/conversations</code>
                  <p className="mt-2 text-muted-foreground">
                    Retrieve conversation history with filtering by profile
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Query Parameters:</p>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto"><code>{`?profileId=1`}</code></pre>
                  </div>
                </div>
              </div>
            </Card>

            {/* File Upload */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Terminal className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">File Upload</h3>
                    <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-mono rounded">POST</span>
                  </div>
                  <code className="text-sm text-muted-foreground">/api/upload</code>
                  <p className="mt-2 text-muted-foreground">
                    Upload tax documents for Azure Document Intelligence analysis
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Features:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• AES-256-GCM encryption per file</li>
                      <li>• SHA-256 checksums for integrity</li>
                      <li>• Virus scanning before processing</li>
                      <li>• 10MB file size limit</li>
                      <li>• Supports PDF, DOCX, XLSX, PNG, JPG</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            {/* Subscriptions */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">Subscription Management</h3>
                    <span className="px-2 py-1 bg-rai-500/10 text-rai-500 text-xs font-mono rounded">GET</span>
                  </div>
                  <code className="text-sm text-muted-foreground">/api/user/subscription</code>
                  <p className="mt-2 text-muted-foreground">
                    Get current subscription status, usage quotas, and billing details
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-8">Rate Limits & Quotas</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Query Limits</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Free: 500 queries/month</li>
                <li>• Pay-as-you-go: 100 queries per $20</li>
                <li>• Plus: 2,500 queries/month</li>
                <li>• Professional: Unlimited</li>
                <li>• Enterprise: Unlimited + multi-user</li>
              </ul>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Document Upload Limits</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Free: 5 documents/month</li>
                <li>• Plus: 25 documents/month</li>
                <li>• Professional: 50 documents/month</li>
                <li>• Enterprise: 100 documents/month</li>
                <li>• Max file size: 10MB</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-4xl font-bold">Start Building with CA GPT API</h2>
          <p className="text-lg text-muted-foreground">
            Integrate accounting superintelligence into your applications today
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" data-testid="button-create-account">
                Create Account
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" data-testid="button-view-full-docs">
                View Full Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
