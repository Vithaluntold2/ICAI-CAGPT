/**
 * SSE Chat Hook for Real-time Streaming
 * ChatGPT-like streaming in React for CA GPT
 */

import { useState, useRef, useCallback } from 'react';

export interface StreamingMessage {
  id?: string;
  content: string;
  role: 'user' | 'assistant';
  streaming: boolean;
  metadata?: any;
  timestamp?: string;
}

export interface SSESendOptions {
  conversationId?: string;
  profileId?: string;
  chatMode?: string;
  documentAttachment?: {
    data: string;
    type: string;
    filename: string;
  };
}

export function useSSEChat() {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(async (
    query: string, 
    options?: SSESendOptions
  ) => {
    if (isStreaming) return null; // Prevent multiple simultaneous requests

    // Add user message immediately
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: StreamingMessage = {
      content: query,
      role: 'user',
      streaming: false,
      timestamp
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    // Create assistant message placeholder
    const assistantMessage: StreamingMessage = {
      content: '',
      role: 'assistant',
      streaming: true,
      timestamp
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Build query parameters for SSE
      const params = new URLSearchParams();
      params.append('query', query);
      
      if (options?.conversationId) params.append('conversationId', options.conversationId);
      if (options?.chatMode) params.append('chatMode', options.chatMode);
      if (options?.documentAttachment) {
        params.append('documentAttachment', JSON.stringify(options.documentAttachment));
      }

      // Create EventSource connection
      const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
      eventSourceRef.current = eventSource;

      let conversationId: string | undefined;
      let messageId: string | undefined;

      return new Promise((resolve, reject) => {
        eventSource.onopen = () => {
          console.log('[SSE] Connection opened');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (event.type || data.event) {
              case 'start':
                conversationId = data.conversationId;
                messageId = data.messageId;
                break;
                
              case 'chunk':
                // Update assistant message with new chunk
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  
                  if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
                    lastMessage.content += data.content;
                  }
                  
                  return newMessages;
                });
                break;
                
              case 'progress':
                // Optional: Show progress indicator
                console.log('[SSE] Progress:', data.length, 'chars');
                break;
                
              case 'complete':
                // Mark as completed and add metadata
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.streaming = false;
                    lastMessage.id = data.messageId;
                    lastMessage.metadata = data.metadata;
                  }
                  
                  return newMessages;
                });
                break;
                
              case 'done':
                setIsStreaming(false);
                eventSource.close();
                resolve({ conversationId, messageId });
                break;
                
              case 'error':
                throw new Error(data.error);
            }
          } catch (error) {
            console.error('[SSE] Error parsing event:', event.data, error);
          }
        };

        // Handle specific event types
        eventSource.addEventListener('start', (event) => {
          const data = JSON.parse(event.data);
          conversationId = data.conversationId;
          messageId = data.messageId;
        });

        eventSource.addEventListener('chunk', (event) => {
          const data = JSON.parse(event.data);
          
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
              lastMessage.content += data.content;
            }
            
            return newMessages;
          });
        });

        eventSource.addEventListener('complete', (event) => {
          const data = JSON.parse(event.data);
          
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.streaming = false;
              lastMessage.id = data.messageId;
              lastMessage.metadata = data.metadata;
            }
            
            return newMessages;
          });
        });

        eventSource.addEventListener('done', () => {
          setIsStreaming(false);
          eventSource.close();
          resolve({ conversationId, messageId });
        });

        eventSource.addEventListener('error', (event) => {
          const data = JSON.parse((event as any).data);
          console.error('[SSE] Error:', data.error);
          
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
              lastMessage.content = `Error: ${data.error}`;
              lastMessage.streaming = false;
            }
            
            return newMessages;
          });
          
          setIsStreaming(false);
          eventSource.close();
          reject(new Error(data.error));
        });

        eventSource.onerror = () => {
          console.error('[SSE] Connection error');
          setIsStreaming(false);
          eventSource.close();
          reject(new Error('Connection error'));
        };
      });

    } catch (error) {
      console.error('[SSE] Failed to start streaming:', error);
      
      // Update assistant message with error
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
          lastMessage.content = 'Failed to get response. Please try again.';
          lastMessage.streaming = false;
        }
        
        return newMessages;
      });
      
      setIsStreaming(false);
      throw error;
    }
  }, [isStreaming]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const setMessagesFromHistory = useCallback((historyMessages: any[]) => {
    const formattedMessages = historyMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.role as 'user' | 'assistant',
      streaming: false,
      timestamp: new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      metadata: msg.metadata
    }));
    setMessages(formattedMessages);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    setMessagesFromHistory,
    clearMessages
  };
}