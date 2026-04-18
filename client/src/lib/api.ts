// API functions for CA GPT

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionTier: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string | null;
  calculationResults?: any;
  metadata?: any;
  createdAt: string;
}

export interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: string;
  };
  metadata: {
    modelUsed: string;
    classification: any;
    calculationResults?: any;
    tokensUsed: number;
    processingTimeMs: number;
  };
}

export const authApi = {
  register: async (data: { email: string; password: string; name: string }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errorData.error || errorData.message || 'Registration failed');
    }
    return await res.json() as { user: User };
  },
  
  login: async (data: { email: string; password: string; mfaToken?: string }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errorData.error || errorData.message || 'Login failed');
    }
    return await res.json() as { user: User };
  },
  
  logout: async () => {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Logout failed');
    return await res.json();
  },
  
  me: async () => {
    const res = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Not authenticated');
    return await res.json() as { user: User };
  },
};

export const conversationApi = {
  getAll: async () => {
    const res = await fetch('/api/conversations', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json() as { conversations: Conversation[] };
  },
  
  getMessages: async (conversationId: string) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return await res.json() as { messages: Message[] };
  },
};

export const chatApi = {
  // SSE Streaming version
  streamMessage: async (
    data: {
      conversationId?: string;
      query: string;
      profileId?: string | null;
      chatMode?: string;
      documentAttachment?: {
        data: string;
        type: string;
        filename: string;
      };
      selection?: {
        artifactIds: string[];
        highlightedText?: string;
      };
    },
    callbacks: {
      onStart?: (conversationId: string) => void;
      onThinking?: (phase: string, detail: string) => void;
      onChunk?: (content: string) => void;
      onEnd?: (metadata: any, messageId?: string) => void;
      onError?: (error: string) => void;
    }
  ) => {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: data.query,
        conversationId: data.conversationId,
        profileId: data.profileId,
        chatMode: data.chatMode,
        documentAttachment: data.documentAttachment,
        selection: data.selection,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let currentConversationId: string | undefined;

    console.log('[chatApi] Starting SSE stream reading...');

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('[chatApi] Stream reading complete');
        break;
      }

      const text = decoder.decode(value, { stream: true });
      console.log('[chatApi] Raw SSE data received:', text.substring(0, 200));
      buffer += text;

      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          console.log('[chatApi] Parsing SSE event:', data.substring(0, 100));
          
          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'start':
                if (event.conversationId) {
                  currentConversationId = event.conversationId;
                  callbacks.onStart?.(event.conversationId);
                }
                break;

              case 'thinking':
                callbacks.onThinking?.(event.phase, event.detail);
                break;

              case 'chunk':
                if (event.content) {
                  fullContent += event.content;
                  callbacks.onChunk?.(event.content);
                }
                break;

              case 'end':
                callbacks.onEnd?.(event.metadata, event.messageId);
                break;

              case 'error':
                callbacks.onError?.(event.error || 'An error occurred');
                break;
            }
          } catch (parseError) {
            console.error('[chatApi] Failed to parse SSE message:', parseError);
          }
        }
      }
    }

    return {
      conversationId: currentConversationId,
      content: fullContent,
    };
  },

  // Legacy non-streaming version (kept for compatibility)
  sendMessage: async (data: { 
    conversationId?: string; 
    message: string; 
    profileId?: string | null;
    chatMode?: string;
    documentAttachment?: {
      data: string;
      type: string;
      filename: string;
    };
  }) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || 'Failed to send message');
    }
    return await res.json() as ChatResponse;
  },
};

export const usageApi = {
  get: async () => {
    const res = await fetch('/api/usage', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch usage');
    return await res.json() as { usage: { queriesUsed: number; documentsAnalyzed: number; tokensUsed: number } };
  },
};
