'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';

type PendingAction = {
  tool: string;
  args: unknown;
  summary: string;
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pendingActions?: PendingAction[];
  provider?: string;
}

interface AIResourceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIResourceChat({ isOpen, onClose }: AIResourceChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI Resource Manager. I can help you with:\n\n• Check resource availability\n• View allocation forecasts\n• Find overallocated artists\n• Get show/shot information\n• Analyze department utilization\n\nWhat would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      if (typeof data?.provider === 'string') {
        setLastProvider(data.provider);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        pendingActions: Array.isArray(data?.pendingActions) ? (data.pendingActions as PendingAction[]) : undefined,
        provider: typeof data?.provider === 'string' ? data.provider : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      
      // Check for setup error
      if (error.message?.includes('OPENAI_API_KEY') || error.message?.includes('AI not configured')) {
        errorContent = `⚠️ AI Not Configured\n\nTo use the AI Resource Manager, set your OpenAI API key.\n\n- Add to your .env.local file:\n  OPENAI_API_KEY="your_key_here"\n\nThen restart the dev server.\n\nSee AI_SETUP_GUIDE.md for detailed instructions.`;
        toast.error('AI not configured - check setup guide');
      } else {
        toast.error('Failed to send message');
      }
      
      const errorMessage: Message = {
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const executePendingActions = async (messageIndex: number, pendingActions: PendingAction[]) => {
    if (!pendingActions?.length || isExecutingActions) return;

    // Prevent double-apply by clearing actions immediately on that message
    setMessages((prev) =>
      prev.map((m, idx) => (idx === messageIndex ? { ...m, pendingActions: undefined } : m))
    );

    setIsExecutingActions(true);
    try {
      const response = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: pendingActions.map((a) => ({ tool: a.tool, args: a.args })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to execute actions');
      }

      const data = await response.json().catch(() => ({}));

      const resultText = Array.isArray(data?.results)
        ? `✅ Applied action(s).\n\n${data.results
            .map((r: any, idx: number) => {
              const tool = r?.tool || 'action';
              const res = r?.result;
              if (res?.ok) {
                if (res.action === 'deleted') {
                  const range = res.startDate && res.endDate ? `${res.startDate} → ${res.endDate}` : '';
                  return `${idx + 1}. ${tool}: deleted ${res.deletedCount} allocation(s) ${range ? `(${range})` : ''}`;
                }

                if (res.action === 'deleted_shot') {
                  const shot = res.shotName || '';
                  const show = res.showName ? ` (show=${res.showName})` : '';
                  const range = res.startDate && res.endDate ? ` (${res.startDate} → ${res.endDate})` : '';
                  return `${idx + 1}. ${tool}: deleted ${res.deletedCount} allocation(s) for shot ${shot}${show}${range}`;
                }

                if (res.action === 'deleted_all') {
                  const range = res.startDate && res.endDate ? ` (${res.startDate} → ${res.endDate})` : '';
                  return `${idx + 1}. ${tool}: deleted ${res.deletedCount} allocation(s) across ALL employees${range}`;
                }

                if (res.action === 'deleted_show') {
                  const show = res.showName || '';
                  const range = res.startDate && res.endDate ? ` (${res.startDate} → ${res.endDate})` : '';
                  const award = typeof res.usedAwardSheet === 'boolean'
                    ? res.usedAwardSheet
                      ? ` (Award Sheet shots=${res.awardShotCount ?? ''})`
                      : ' (Award Sheet not used)'
                    : '';
                  return `${idx + 1}. ${tool}: deleted ${res.deletedCount} allocation(s) for show ${show}${range}${award}`;
                }

                if (res.action === 'weekend_policy_updated') {
                  const sat = res?.policy?.saturdayWorking === true ? 'ON' : res?.policy?.saturdayWorking === false ? 'OFF' : 'unchanged';
                  const sun = res?.policy?.sundayWorking === true ? 'ON' : res?.policy?.sundayWorking === false ? 'OFF' : 'unchanged';
                  return `${idx + 1}. ${tool}: weekend working policy updated (Saturday=${sat}, Sunday=${sun})`;
                }

                if (res.action === 'batch_assigned') {
                  const start = res.startDate || '';
                  const end = res.endDate || '';
                  const count = Array.isArray(res.plannedDates) ? res.plannedDates.length : '';
                  return `${idx + 1}. ${tool}: assigned ${count} working day(s) (${start} → ${end})`;
                }

                // single-day assign
                const emp = res.employeeId || '';
                const date = res.date || '';
                const show = res.showName || '';
                const shot = res.shotName || '';
                const md = typeof res.manDays === 'number' ? res.manDays : '';
                return `${idx + 1}. ${tool}: ${res.action} (${emp} ${date} ${show} ${shot} ${md} MD)`;
              }
              return `${idx + 1}. ${tool}: ${res?.error || 'failed'}`;
            })
            .join('\n')}`
        : '✅ Applied action(s).';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resultText,
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      console.error('Execute actions error:', error);
      toast.error(error?.message || 'Failed to apply actions');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Failed to apply actions: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsExecutingActions(false);
    }
  };

  const cancelPendingActions = (messageIndex: number) => {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === messageIndex ? { ...m, pendingActions: undefined } : m))
    );
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'Cancelled. No changes were made.',
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "Who is available tomorrow?",
    "Show overallocated resources this week",
    "What's the utilization for Animation?",
    "Get forecast for next 7 days"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">AI Resource Manager</h3>
              <p className="text-xs text-indigo-100">Powered by {lastProvider ? lastProvider.toUpperCase() : 'AI'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap break-words text-sm">{msg.content}</div>

                {msg.role === 'assistant' && msg.pendingActions && msg.pendingActions.length > 0 && (
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-600 mb-2">Pending actions (requires approval):</div>
                    <div className="space-y-1">
                      {msg.pendingActions.map((a, i) => (
                        <div key={i} className="text-xs text-gray-800 bg-white rounded px-2 py-1 border border-gray-200">
                          {a.summary}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => executePendingActions(idx, msg.pendingActions!)}
                        disabled={isLoading || isExecutingActions}
                        className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {isExecutingActions ? 'Applying…' : 'Approve & Apply'}
                      </button>
                      <button
                        onClick={() => cancelPendingActions(idx)}
                        disabled={isLoading || isExecutingActions}
                        className="px-3 py-1.5 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-indigo-200' : 'text-gray-500'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputMessage(prompt)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about resources..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim() || isLoading || isExecutingActions}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Send'
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Tip: Ask about availability, forecasts, or resource utilization
          </p>
        </div>
      </div>
    </div>
  );
}
