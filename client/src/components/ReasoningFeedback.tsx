import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MessageCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Quote, 
  Send,
  X,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReasoningFeedbackProps {
  messageContent: string;
  messageId?: string;
  onSubmitFeedback?: (feedback: {
    quotedText: string;
    feedbackType: 'positive' | 'negative' | 'clarification';
    comment: string;
  }) => void;
}

export default function ReasoningFeedback({ 
  messageContent, 
  messageId,
  onSubmitFeedback 
}: ReasoningFeedbackProps) {
  const [selectedText, setSelectedText] = useState("");
  const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | 'clarification'>('positive');
  const [comment, setComment] = useState("");
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const { toast } = useToast();

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 10) {
      setSelectedText(text);
      setShowFeedbackForm(true);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedText || !comment) {
      toast({
        title: "Missing Information",
        description: "Please select text and provide a comment.",
        variant: "destructive"
      });
      return;
    }

    try {
      await onSubmitFeedback?.({
        quotedText: selectedText,
        feedbackType,
        comment
      });
      
      toast({
        title: "Feedback Submitted",
        description: "Thank you for helping CA GPT improve!",
        variant: "default"
      });
      
      // Reset form
      setSelectedText("");
      setComment("");
      setShowFeedbackForm(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    }
  };

  const feedbackTypeOptions = [
    {
      type: 'positive' as const,
      label: 'Good Reasoning',
      icon: ThumbsUp,
      description: 'This reasoning was helpful and well-explained'
    },
    {
      type: 'negative' as const,
      label: 'Poor Reasoning',
      icon: ThumbsDown,
      description: 'This reasoning was unclear or incorrect'
    },
    {
      type: 'clarification' as const,
      label: 'Need Clarification',
      icon: AlertCircle,
      description: 'This reasoning needs more explanation'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <Quote className="h-4 w-4" />
          <span className="font-medium">Provide Feedback on CA GPT's Reasoning</span>
        </div>
        <p>
          Select any text from CA GPT's reasoning above to provide feedback. 
          Your input helps improve AI decision-making.
        </p>
      </div>

      {/* Main Content with Selection Handler */}
      <div 
        className="prose prose-sm dark:prose-invert max-w-none p-4 bg-background border rounded-lg cursor-text"
        onMouseUp={handleTextSelection}
        style={{ userSelect: 'text' }}
      >
        {messageContent.split('\n').map((line, index) => (
          <p key={index} className="leading-relaxed">
            {line || '\u00A0'}
          </p>
        ))}
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Feedback on Selected Text
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFeedbackForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Selected Text */}
            <div>
              <label className="text-sm font-medium">Selected Text:</label>
              <div className="mt-1 p-3 bg-muted rounded-lg border-l-4 border-primary">
                <p className="text-sm italic">"{selectedText}"</p>
              </div>
            </div>

            {/* Feedback Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Feedback Type:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {feedbackTypeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = feedbackType === option.type;
                  return (
                    <Button
                      key={option.type}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFeedbackType(option.type)}
                      className="h-auto p-3 flex flex-col items-center gap-2 text-center"
                    >
                      <Icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs opacity-75">{option.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Your Comment: 
                <span className="text-muted-foreground font-normal">
                  (What was {feedbackType === 'positive' ? 'good' : 'unclear'} about this reasoning?)
                </span>
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  feedbackType === 'positive' 
                    ? "What made this reasoning particularly helpful or clear?"
                    : feedbackType === 'negative'
                    ? "What was wrong or unclear about this reasoning?"
                    : "What additional information would help clarify this reasoning?"
                }
                className="min-h-[100px]"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowFeedbackForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitFeedback} className="gap-2">
                <Send className="h-4 w-4" />
                Submit Feedback
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}