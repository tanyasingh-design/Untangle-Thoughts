import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  ChevronRight, 
  RefreshCw,
  Lightbulb,
  Heart
} from 'lucide-react';
import { ChatMessage, FramingSession } from '../types/metacognitive';

interface AssistantChatDockProps {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeNodeId: number;
  onJumpToNode: (nodeId: number) => void;
}

export const AssistantChatDock: React.FC<AssistantChatDockProps> = ({
  session,
  onUpdateSession,
  isOpen,
  onToggleOpen,
  activeNodeId,
  onJumpToNode,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      role: 'assistant',
      content: `Hi there! I'm your calm thinking assistant. 

Whenever you have a worry, we take it step-by-step together on the canvas so you don't have to carry it all in your head. 

Feel free to write on the mind map directly, or ask me anything here if you ever feel stuck!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      nodeReference: 1,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      nodeReference: activeNodeId,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/metacognitive/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentStep: activeNodeId,
          currentState: {
            rawWorryText: session.rawWorryText,
            context: session.context,
          },
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        nodeReference: activeNodeId,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.warn('Chat fallback:', err);
      const fallbackMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I'm here with you. Look at Step ${activeNodeId} on the canvas — let's just take the single simplest step right in front of us.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        nodeReference: activeNodeId,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: "How can I tell if this is a fact or just a worry?", text: "Can you help me see whether this thought is a real fact right now or just my mind predicting the future?" },
    { label: "Give me an encouraging reminder", text: "Can you give me a calm, grounded reminder about what I'm feeling right now?" },
    { label: "Help me break this into simple actions", text: "What is one small, simple action I can take on this today?" },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button shadow-xl text-xs font-semibold cursor-pointer"
        title="Open Friendly Assistant"
      >
        <Sparkles size={15} />
        <span>Friendly Assistant</span>
      </button>
    );
  }

  return (
    <div className="w-80 lg:w-96 h-screen border-l border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col z-30 shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="p-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--accent-black)] text-white flex items-center justify-center font-bold text-xs">
            <Sparkles size={13} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[var(--text-primary)]">
              Thinking Assistant
            </h3>
            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
              Supporting Step {activeNodeId}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleOpen}
          className="p-1 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
          title="Minimize Assistant"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[var(--text-tertiary)]">
                <span>{isUser ? 'You' : 'Assistant'}</span>
                <span>·</span>
                <span>{m.timestamp}</span>
              </div>

              <div
                className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                  isUser
                    ? 'bg-[var(--accent-black)] text-[var(--accent-white)] rounded-br-xs'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] p-2 bg-[var(--bg-surface)] rounded-xl w-fit">
            <RefreshCw size={12} className="animate-spin" />
            <span>Thinking of a simple way forward...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] mb-1 font-semibold">
          <Lightbulb size={11} />
          <span>Quick Help:</span>
        </div>
        <div className="flex flex-col gap-1">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.text)}
              className="text-left text-[11px] px-2.5 py-1.5 bg-white border border-[var(--border-subtle)] hover:bg-zinc-100 rounded-lg text-zinc-700 transition-colors truncate cursor-pointer font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input */}
      <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything or share how you're feeling..."
            className="flex-1 px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:border-zinc-800"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button disabled:opacity-40 cursor-pointer"
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
};
