import React, { useState } from 'react';
import { Send, Brain } from 'lucide-react';
import { AIThinkingIndicator } from '../components/AIThinkingIndicator';
import { useAIThinking } from '../hooks/useAIThinking';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: boolean;
}

const ChatWithAIThinking: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const {
    isThinking,
    currentStep,
    completedSteps,
    totalAgents,
    progress,
    startThinking,
    stopThinking,
    isConnected
  } = useAIThinking({
    sessionId,
    enabled: true,
    onComplete: () => {
      console.log('AI thinking process completed');
    },
    onError: (error) => {
      console.error('AI thinking error:', error);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Start the thinking process
    startThinking();

    try {
      // Call your AI orchestrator API
      const response = await fetch('/api/chat/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          sessionId,
          userId: 'user123', // Would come from auth
          showThinking: true
        })
      });

      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        type: 'assistant',
        content: data.synthesizedResponse || data.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      stopThinking();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">CA GPT Chat</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Brain className="w-4 h-4" />
            <span>103 AI Agents</span>
            {isConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected to AI thinking process" />
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Welcome to CA GPT</p>
            <p>Ask me anything about finance, tax, accounting, or business advisory.</p>
            <p className="text-sm mt-2">I'll consult with multiple AI experts to give you comprehensive answers.</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-rai-600 text-white'
                  : 'bg-white text-gray-900 shadow-sm border border-gray-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className={`text-xs mt-1 ${
                message.type === 'user' ? 'text-rai-100' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* AI Thinking Indicator */}
        {(isThinking || isLoading) && (
          <AIThinkingIndicator
            isActive={isThinking || isLoading}
            query={messages[messages.length - 1]?.content}
            onComplete={() => {
              console.log('Thinking indicator completed');
            }}
          />
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me about finance, tax, accounting, or business..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rai-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-2 bg-rai-600 text-white rounded-lg hover:bg-rai-700 focus:outline-none focus:ring-2 focus:ring-rai-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <Brain className="w-4 h-4 animate-pulse" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{isLoading ? 'Thinking...' : 'Send'}</span>
          </button>
        </form>
        
        {isThinking && (
          <div className="mt-2 text-sm text-gray-600 flex items-center space-x-2">
            <Brain className="w-4 h-4 animate-pulse text-rai-600" />
            <span>
              AI is consulting {totalAgents > 0 ? `${totalAgents} specialized agents` : 'multiple experts'}...
            </span>
            <span className="text-rai-600 font-medium">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWithAIThinking;