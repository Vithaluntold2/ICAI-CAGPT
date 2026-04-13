import { useState, useEffect, useRef } from 'react';

interface OrchestrationStep {
  id: string;
  phase: 'analyzing' | 'selecting' | 'consulting' | 'validating' | 'synthesizing' | 'complete';
  message: string;
  agentsInvolved?: number;
  timestamp: Date;
  metadata?: any;
}

interface UseAIThinkingOptions {
  sessionId: string;
  enabled?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface AIThinkingState {
  isThinking: boolean;
  currentStep: OrchestrationStep | null;
  completedSteps: OrchestrationStep[];
  totalAgents: number;
  progress: number;
  error: string | null;
}

export const useAIThinking = (options: UseAIThinkingOptions) => {
  const { sessionId, enabled = true, onComplete, onError } = options;
  
  const [state, setState] = useState<AIThinkingState>({
    isThinking: false,
    currentStep: null,
    completedSteps: [],
    totalAgents: 0,
    progress: 0,
    error: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Connect to WebSocket
  const connect = () => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/orchestration?sessionId=${sessionId}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('AI Thinking WebSocket connected');
        reconnectAttempts.current = 0;
        setState(prev => ({ ...prev, error: null }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'orchestration_step') {
            handleOrchestrationStep(data.step);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('AI Thinking WebSocket disconnected:', event.code);
        
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('AI Thinking WebSocket error:', error);
        const errorMessage = 'Connection to AI thinking process failed';
        setState(prev => ({ ...prev, error: errorMessage }));
        onError?.(errorMessage);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      const errorMessage = 'Failed to connect to AI thinking process';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  };

  // Handle orchestration step updates
  const handleOrchestrationStep = (step: OrchestrationStep) => {
    setState(prev => {
      const newState = { ...prev };
      
      // If this is the start of thinking
      if (step.phase === 'analyzing' && step.id === 'start') {
        newState.isThinking = true;
        newState.currentStep = step;
        newState.completedSteps = [];
        newState.totalAgents = 0;
        newState.progress = 0;
        newState.error = null;
        return newState;
      }

      // If this is completion
      if (step.phase === 'complete') {
        newState.isThinking = false;
        newState.currentStep = null;
        newState.completedSteps = [...prev.completedSteps, step];
        newState.progress = 100;
        
        if (step.agentsInvolved) {
          newState.totalAgents = step.agentsInvolved;
        }
        
        // Call completion callback
        setTimeout(() => onComplete?.(), 500);
        return newState;
      }

      // Regular step update
      if (prev.currentStep) {
        newState.completedSteps = [...prev.completedSteps, prev.currentStep];
      }
      
      newState.currentStep = step;
      
      if (step.agentsInvolved) {
        newState.totalAgents = Math.max(prev.totalAgents, step.agentsInvolved);
      }
      
      // Calculate progress (assuming 7 total steps)
      newState.progress = Math.min((newState.completedSteps.length / 7) * 100, 95);
      
      return newState;
    });
  };

  // Start thinking process
  const startThinking = () => {
    setState(prev => ({
      ...prev,
      isThinking: true,
      currentStep: null,
      completedSteps: [],
      totalAgents: 0,
      progress: 0,
      error: null
    }));
  };

  // Stop thinking process
  const stopThinking = () => {
    setState(prev => ({
      ...prev,
      isThinking: false,
      currentStep: null,
      progress: 100
    }));
  };

  // Reset state
  const reset = () => {
    setState({
      isThinking: false,
      currentStep: null,
      completedSteps: [],
      totalAgents: 0,
      progress: 0,
      error: null
    });
  };

  // Connect on mount and when enabled changes
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startThinking,
    stopThinking,
    reset,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
};