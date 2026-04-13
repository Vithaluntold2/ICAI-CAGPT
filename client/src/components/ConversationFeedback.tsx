import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Conversation } from '@/../../shared/schema';

interface ConversationFeedbackProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationFeedback({ conversation, open, onOpenChange }: ConversationFeedbackProps) {
  const { toast } = useToast();
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [resolved, setResolved] = useState<boolean>(false);
  const [userFeedback, setUserFeedback] = useState<string>('');
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  // Reset state when conversation changes or dialog opens
  useEffect(() => {
    if (open && conversation) {
      // Load existing feedback for this conversation
      setQualityScore(conversation.qualityScore || 0);
      setResolved(conversation.resolved || false);
      setUserFeedback(conversation.userFeedback || '');
      setHoveredStar(0);
    } else if (open && !conversation) {
      // Clear state when dialog opens but no conversation loaded (prevents stale data)
      setQualityScore(0);
      setResolved(false);
      setUserFeedback('');
      setHoveredStar(0);
    } else if (!open) {
      // Reset to defaults when dialog closes
      setQualityScore(0);
      setResolved(false);
      setUserFeedback('');
      setHoveredStar(0);
    }
  }, [conversation, open]);

  const updateFeedbackMutation = useMutation({
    mutationFn: async (data: { qualityScore?: number; resolved?: boolean; userFeedback?: string }) => {
      if (!conversation?.id) throw new Error('No conversation selected');
      
      return await apiRequest('PATCH', `/api/conversations/${conversation.id}/feedback`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for helping us improve CA GPT!',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Failed to submit feedback',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = () => {
    // Pre-submit validation: ensure conversation is loaded
    if (!conversation) {
      toast({
        title: 'No conversation selected',
        description: 'Please select a conversation first',
        variant: 'destructive',
      });
      return;
    }

    const data: { qualityScore?: number; resolved?: boolean; userFeedback?: string } = {};
    
    if (qualityScore > 0) data.qualityScore = qualityScore;
    if (resolved !== conversation.resolved) data.resolved = resolved;
    if (userFeedback.trim() && userFeedback !== conversation.userFeedback) {
      data.userFeedback = userFeedback.trim();
    }

    if (Object.keys(data).length === 0) {
      toast({
        title: 'No changes',
        description: 'Please rate the conversation or provide feedback',
      });
      return;
    }

    updateFeedbackMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-conversation-feedback">
        <DialogHeader>
          <DialogTitle>Rate this conversation</DialogTitle>
          <DialogDescription>
            Help us improve CA GPT by sharing your experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Quality Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setQualityScore(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="transition-transform hover:scale-110"
                  data-testid={`button-star-${star}`}
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredStar || qualityScore)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
            {qualityScore > 0 && (
              <p className="text-xs text-muted-foreground">
                {qualityScore === 1 && 'Poor'}
                {qualityScore === 2 && 'Fair'}
                {qualityScore === 3 && 'Good'}
                {qualityScore === 4 && 'Very Good'}
                {qualityScore === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Resolved Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="resolved"
              checked={resolved}
              onCheckedChange={(checked) => setResolved(checked === true)}
              data-testid="checkbox-resolved"
            />
            <Label
              htmlFor="resolved"
              className="text-sm font-normal cursor-pointer"
            >
              This conversation resolved my question/issue
            </Label>
          </div>

          {/* Optional Text Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Feedback (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Share any specific thoughts, suggestions, or issues..."
              value={userFeedback}
              onChange={(e) => setUserFeedback(e.target.value)}
              className="min-h-[100px]"
              maxLength={1000}
              data-testid="textarea-user-feedback"
            />
            <p className="text-xs text-muted-foreground text-right">
              {userFeedback.length}/1000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={updateFeedbackMutation.isPending}
            data-testid="button-cancel-feedback"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateFeedbackMutation.isPending}
            data-testid="button-submit-feedback"
          >
            {updateFeedbackMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
