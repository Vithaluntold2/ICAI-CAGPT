import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LandingNav from "@/components/LandingNav";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, User, ArrowRight } from "lucide-react";
import { useState } from "react";

export default function Blog() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const handleReadArticle = (title: string) => {
    toast({
      title: "Article Coming Soon",
      description: `"${title}" - Full article will be available shortly. We're working on bringing you in-depth content.`
    });
  };

  const blogPosts = [
    {
      id: 1,
      title: "Introducing CA GPT: Accounting Superintelligence",
      excerpt: "Discover how multi-model AI routing and advanced financial algorithms transform tax, audit, and compliance work.",
      author: "CA GPT Team",
      date: "November 10, 2025",
      category: "Product",
      readTime: "5 min read"
    },
    {
      id: 2,
      title: "The Future of Tax Planning: AI-Powered Scenario Modeling",
      excerpt: "Learn how CA GPT's Regulatory Scenario Simulator enables what-if analysis across jurisdictions and time periods.",
      author: "Sarah Chen",
      date: "November 8, 2025",
      category: "Features",
      readTime: "7 min read"
    },
    {
      id: 3,
      title: "How We Built Real-Time Document Intelligence with Azure AI",
      excerpt: "Behind the scenes of CA GPT's forensic document analysis system powered by Azure Document Intelligence.",
      author: "Michael Rodriguez",
      date: "November 5, 2025",
      category: "Engineering",
      readTime: "10 min read"
    },
    {
      id: 4,
      title: "Multi-Model AI Routing: Choosing the Right Intelligence for Every Query",
      excerpt: "Explore our intelligent query triage system that routes questions to Claude, Gemini, Perplexity, or Azure OpenAI.",
      author: "Emily Watson",
      date: "November 1, 2025",
      category: "AI & ML",
      readTime: "8 min read"
    },
    {
      id: 5,
      title: "Security First: How CA GPT Protects Your Financial Data",
      excerpt: "Deep dive into our security architecture including AES-256-GCM encryption, virus scanning, and HTTPS-only connections.",
      author: "James Park",
      date: "October 28, 2025",
      category: "Security",
      readTime: "6 min read"
    },
    {
      id: 6,
      title: "Global Compliance: Navigating Tax Codes Across 6 Markets",
      excerpt: "How CA GPT provides jurisdiction-specific expertise for USA, Canada, India, UAE, Indonesia, and Turkey.",
      author: "Priya Sharma",
      date: "October 25, 2025",
      category: "Compliance",
      readTime: "9 min read"
    }
  ];

  return (
    <div className="min-h-screen">
      <LandingNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              CA GPT Blog
            </h1>
            <p className="text-xl text-muted-foreground">
              Insights on AI, accounting intelligence, and financial technology
            </p>
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-blog-search"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap gap-3 justify-center">
            {["All Posts", "Product", "Features", "Engineering", "AI & ML", "Security", "Compliance"].map((category) => (
              <Button
                key={category}
                variant={category === "All Posts" ? "default" : "outline"}
                size="sm"
                data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-8">
            <span className="text-sm font-semibold text-primary">Featured</span>
          </div>
          <Card className="overflow-hidden hover-elevate">
            <div className="grid md:grid-cols-2 gap-8 p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                    Product
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    November 10, 2025
                  </span>
                </div>
                <h2 className="text-4xl font-bold">
                  Introducing CA GPT: Accounting Superintelligence
                </h2>
                <p className="text-lg text-muted-foreground">
                  Discover how multi-model AI routing and advanced financial algorithms transform tax, 
                  audit, and compliance work. Learn about our three MVP capabilities and the vision behind 
                  building a platform that surpasses traditional accounting software.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>CA GPT Team</span>
                  </div>
                  <span className="text-sm text-muted-foreground">• 5 min read</span>
                </div>
                <Button 
                  data-testid="button-read-featured"
                  onClick={() => handleReadArticle("Introducing CA GPT: Accounting Superintelligence")}
                >
                  Read Article <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
              <div className="bg-gradient-to-br from-primary/20 to-pink-500/20 rounded-lg flex items-center justify-center min-h-[300px]">
                <span className="text-6xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
                  CA GPT
                </span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* All Posts */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-12">Recent Posts</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Card key={post.id} className="p-6 space-y-4 hover-elevate" data-testid={`card-blog-${post.id}`}>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date}
                  </span>
                </div>
                <h3 className="text-xl font-semibold line-clamp-2">{post.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{post.author}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{post.readTime}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full" 
                  data-testid={`button-read-${post.id}`}
                  onClick={() => handleReadArticle(post.title)}
                >
                  Read More <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <Card className="p-12 text-center space-y-6 bg-gradient-to-br from-primary/5 to-pink-500/5">
            <h2 className="text-3xl font-bold">Stay Updated</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get the latest insights on AI, accounting intelligence, and product updates delivered to your inbox
            </p>
            <div className="flex gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="your@email.com"
                data-testid="input-newsletter-email"
              />
              <Button 
                data-testid="button-newsletter-subscribe"
                onClick={() => toast({
                  title: "Subscribed!",
                  description: "Thank you for subscribing. You'll receive our latest updates soon."
                })}
              >
                Subscribe
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
