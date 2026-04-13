import { useState, useCallback, useRef, useEffect } from 'react';

interface ChatMessage {
  type: 'start' | 'chunk' | 'end' | 'error';
  conversationId?: string;
  messageId?: string;
  content?: string;
  error?: string;
  metadata?: any;
}

interface UseSSEReturn {
  sendMessage: (message: {
    query: string;
    conversationId?: string | null;
    userId: string;
    userTier: string;
    profileId?: string | null;
    chatMode?: string;
    documentAttachment?: {
      filename: string;
      type: string;
      data: string;
    };
  }) => void;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  conversationId: string | null;
  metadata: any | null;
  cancelStream: () => void;
}

export function useSSE(): UseSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (message: {
    query: string;
    conversationId?: string | null;
    userId: string;
    userTier: string;
    profileId?: string | null;
    chatMode?: string;
    documentAttachment?: {
      filename: string;
      type: string;
      data: string;
    };
  }) => {
    try {
      // Cancel any existing stream
      cancelStream();

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsStreaming(true);
      setStreamingContent('');
      setError(null);
      setMetadata(null);

      // Make POST request to SSE endpoint
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message.query,
          conversationId: message.conversationId,
          profileId: message.profileId,
          chatMode: message.chatMode,
          documentAttachment: message.documentAttachment,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[SSE] Stream complete');
          break;
        }

        // Decode the chunk
        buffer += decoder.decode(value, { stream: true });

        // Split by double newline (SSE message delimiter)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        // Process each complete SSE message
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            try {
              const event: ChatMessage = JSON.parse(data);

              switch (event.type) {
                case 'start':
                  console.log('[SSE] Stream started:', event.conversationId);
                  if (event.conversationId) {
                    setConversationId(event.conversationId);
                  }
                  break;

                case 'chunk':
                  if (event.content) {
                    setStreamingContent(prev => prev + event.content);
                  }
                  break;

                case 'end':
                  console.log('[SSE] Stream ended');
                  setIsStreaming(false);
                  if (event.metadata) {
                    setMetadata(event.metadata);
                  }
                  break;

                case 'error':
                  console.error('[SSE] Error:', event.error);
                  setError(event.error || 'An error occurred');
                  setIsStreaming(false);
                  break;
              }
            } catch (parseError) {
              console.error('[SSE] Failed to parse message:', data, parseError);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[SSE] Stream cancelled');
      } else {
        console.error('[SSE] Stream error:', err);
        setError(err.message || 'Connection error');
      }
      setIsStreaming(false);
    } finally {
      abortControllerRef.current = null;
    }
  }, [cancelStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, [cancelStream]);

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    error,
    conversationId,
    metadata,
    cancelStream,
  };
}
