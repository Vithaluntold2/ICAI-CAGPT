import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lock, Share2, AlertCircle, Loader2, Bot, User } from "lucide-react";
import cagptLogoUrl from "@assets/icai-ca-india-logo.png";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface SharedConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  ownerName?: string;
}

export default function SharedConversation() {
  const [, params] = useRoute("/shared/:token");
  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedConversation = async () => {
      if (!params?.token) {
        setError("Invalid share link");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/shared/${params.token}`, {
          credentials: 'include'
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError("This conversation is no longer shared or doesn't exist");
          } else if (res.status === 403) {
            setError("You don't have access to view this conversation");
          } else {
            setError("Failed to load shared conversation");
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        setConversation(data);
      } catch (err) {
        console.error('Error fetching shared conversation:', err);
        setError("Failed to load shared conversation");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedConversation();
  }, [params?.token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to Access</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.href = "/"}>
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={cagptLogoUrl} alt="CA GPT" className="h-8 w-8" />
              <div>
                <h1 className="text-lg font-semibold">{conversation.title}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Share2 className="h-3 w-3" />
                  Shared Conversation (Read-Only)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Read-Only Access</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-6">
          {conversation.messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              This conversation has no messages yet.
            </div>
          ) : (
            <div className="space-y-6">
              {conversation.messages.map((msg, index) => (
                <div key={msg.id}>
                  <div className={`flex gap-3 ${msg.role === 'assistant' ? 'bg-muted/30 -mx-4 px-4 py-4 rounded-lg' : ''}`}>
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className={msg.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                        {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {msg.role === 'assistant' ? 'CA GPT' : 'User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            // Prevent code blocks from overflowing
                            code: ({ node, inline, ...props }) => (
                              inline ? 
                                <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props} /> :
                                <code className="block bg-muted p-2 rounded overflow-x-auto text-sm" {...props} />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  {index < conversation.messages.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              This is a read-only view of a shared conversation. 
              <Button variant="link" className="h-auto p-0 ml-2" onClick={() => window.location.href = "/"}>
                Create your own
              </Button>
            </p>
            <p className="text-xs">
              Shared on {new Date(conversation.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
