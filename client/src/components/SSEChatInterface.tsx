/**
 * SSE Chat Client for Real-time Streaming
 * ChatGPT-like streaming in React for CA GPT
 */

import React, { useState, useRef, useCallback } from 'react';

interface StreamingMessage {
  id?: string;
  content: string;
  role: 'user' | 'assistant';
  streaming: boolean;
  metadata?: any;
}

interface SSEChatClientProps {
  onMessageUpdate?: (messages: StreamingMessage[]) => void;
}

export function useSSEChat() {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(async (
    query: string, 
    conversationId?: string,
    attachment?: File
  ) => {
    if (isStreaming) return; // Prevent multiple simultaneous requests

    // Add user message immediately
    const userMessage: StreamingMessage = {
      content: query,
      role: 'user',
      streaming: false
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    // Create assistant message placeholder
    const assistantMessage: StreamingMessage = {
      content: '',
      role: 'assistant',
      streaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Create SSE connection
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          conversationId,
          documentAttachment: attachment ? await fileToBase64(attachment) : null
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      // Use the response as SSE stream
      const eventSource = new EventSource(`/api/chat/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connection opened');
      };

      // Handle different event types
      eventSource.addEventListener('start', (event) => {
        const data = JSON.parse(event.data);
        console.log('[SSE] Stream started:', data);
      });

      eventSource.addEventListener('chunk', (event) => {
        const data = JSON.parse(event.data);
        
        // Update assistant message with new chunk
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
            lastMessage.content += data.content;
          }
          
          return newMessages;
        });
      });

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        // Optional: Show progress indicator
        console.log('[SSE] Progress:', data.length, 'chars');
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        
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
      });

      eventSource.addEventListener('done', () => {
        console.log('[SSE] Stream completed');
        setIsStreaming(false);
        eventSource.close();
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        console.error('[SSE] Error:', data.error);
        
        // Show error in assistant message
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
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        setIsStreaming(false);
        eventSource.close();
      };

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
    }
  }, [isStreaming]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming
  };
}

/**
 * SSE Chat Component
 */
export function SSEChatInterface() {
  const { messages, isStreaming, sendMessage, stopStreaming } = useSSEChat();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !isStreaming) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-rai-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              } ${message.streaming ? 'animate-pulse' : ''}`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.streaming && (
                <div className="mt-2 flex items-center text-sm opacity-60">
                  <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2"></div>
                  Typing...
                </div>
              )}
              {message.metadata && (
                <div className="mt-2 text-xs opacity-70">
                  Model: {message.metadata.modelUsed} | 
                  Tokens: {message.metadata.tokensUsed} |
                  Time: {message.metadata.processingTimeMs}ms
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-lg"
            disabled={isStreaming}
          />
          <button
            onClick={isStreaming ? stopStreaming : handleSend}
            className={`px-4 py-2 rounded-lg ${
              isStreaming 
                ? 'bg-red-500 text-white' 
                : 'bg-rai-500 text-white'
            }`}
          >
            {isStreaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}