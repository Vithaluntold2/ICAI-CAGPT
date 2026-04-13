import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";
  
  return (
    <div className={cn("flex gap-4 mb-6", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="flex-shrink-0 border-2 border-primary/20">
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
            <Sparkles className="w-5 h-5 text-white" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn("flex flex-col gap-2 max-w-2xl", isUser && "items-end")}>
        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm font-semibold">CA GPT</span>
            {timestamp && <span className="text-xs text-muted-foreground">{timestamp}</span>}
          </div>
        )}
        
        <Card className={cn(
          "p-4",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-card"
        )}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </Card>
        
        {isUser && timestamp && (
          <span className="text-xs text-muted-foreground px-1">{timestamp}</span>
        )}
      </div>
      
      {isUser && (
        <Avatar className="flex-shrink-0">
          <AvatarFallback>
            <User className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
