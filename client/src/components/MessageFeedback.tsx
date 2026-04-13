import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  X,
  Check,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MessageFeedbackProps {
  messageId: string;
  conversationId: string;
  onFeedbackSubmitted?: () => void;
}

export default function MessageFeedback({ 
  messageId, 
  conversationId,
  onFeedbackSubmitted 
}: MessageFeedbackProps) {
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const submitFeedback = async (thumbsValue: 'up' | 'down', additionalText?: string) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          conversationId,
          thumbs: thumbsValue,
          feedbackText: additionalText || undefined,
          rating: thumbsValue === 'up' ? 5 : 2, // Convert thumbs to rating
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
      setShowDetail(false);
      onFeedbackSubmitted?.();
      
      toast({
        title: "Thank you!",
        description: "Your feedback helps CA GPT improve.",
      });
    } catch (error) {
      console.error('Feedback error:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsClick = (value: 'up' | 'down') => {
    setThumbs(value);
    if (value === 'up') {
      // Quick positive feedback - submit immediately
      submitFeedback(value);
    } else {
      // Negative feedback - show detail form
      setShowDetail(true);
    }
  };

  const handleDetailSubmit = () => {
    if (thumbs) {
      submitFeedback(thumbs, feedbackText);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-green-500" />
        <span>Feedback received</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Quick thumbs buttons */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${thumbs === 'up' ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground hover:text-green-500'}`}
        onClick={() => handleThumbsClick('up')}
        disabled={isSubmitting}
      >
        {isSubmitting && thumbs === 'up' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="h-3.5 w-3.5" />
        )}
      </Button>
      
      <Popover open={showDetail} onOpenChange={setShowDetail}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 p-0 ${thumbs === 'down' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:text-red-500'}`}
            onClick={() => handleThumbsClick('down')}
            disabled={isSubmitting}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">What could be improved?</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowDetail(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <Textarea
              placeholder="Please share what was incorrect or unhelpful..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetail(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDetailSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                )}
                Submit
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
