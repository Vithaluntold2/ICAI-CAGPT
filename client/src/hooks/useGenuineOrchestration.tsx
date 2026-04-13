import { useState, useEffect, useRef } from 'react';

interface OrchestrationStep {
  timestamp: number;
  action: 'analyzing' | 'consulting' | 'deciding' | 'executing';
  agent?: string;
  reasoning: string;
  confidence: number;
}

export const useGenuineOrchestration = (wsUrl: string = 'ws://localhost:3001/orchestration') => {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<OrchestrationStep[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          setIsConnected(true);
        };
        
        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'orchestration-step') {
            setSteps(prev => [...prev, data.step]);
            setIsProcessing(true);
          } else if (data.type === 'orchestration-complete') {
            setIsProcessing(false);
          }
        };
        
        wsRef.current.onclose = () => {
          setIsConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        };
        
        wsRef.current.onerror = () => {
          setIsConnected(false);
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  const clearSteps = () => {
    setSteps([]);
    setIsProcessing(false);
  };

  return {
    isConnected,
    isProcessing,
    steps,
    clearSteps
  };
};