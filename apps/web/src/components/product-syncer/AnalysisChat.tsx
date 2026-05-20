'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnalysisResult } from '@/app/api/product-syncer/analyze/route';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnalysisChatProps {
  sfConnectionId: string;
  sfObject: string;
  nsConnectionId: string;
  nsObject: string;
  onClose: () => void;
  onAnalysisResult: (result: AnalysisResult) => void;
}

async function sendMessage(
  messages: ChatMessage[],
  sfConnectionId: string,
  sfObject: string,
  nsConnectionId: string,
  nsObject: string
): Promise<{ reply: string; analysisResult: AnalysisResult | null }> {
  const res = await fetch('/api/product-syncer/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, sfConnectionId, sfObject, nsConnectionId, nsObject }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Analysis request failed');
  }
  return res.json();
}

export function AnalysisChat({ sfConnectionId, sfObject, nsConnectionId, nsObject, onClose, onAnalysisResult }: AnalysisChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Auto-start the analysis on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startMsg: ChatMessage = {
      role: 'user',
      content: 'Start the product sync analysis. Fetch the schemas from both systems and suggest the best field pairs for matching.',
    };
    setMessages([startMsg]);
    setIsLoading(true);

    sendMessage([startMsg], sfConnectionId, sfObject, nsConnectionId, nsObject)
      .then(({ reply, analysisResult }) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        if (analysisResult) onAnalysisResult(analysisResult);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setIsLoading(false));
  }, [sfConnectionId, sfObject, nsConnectionId, nsObject, onAnalysisResult]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const { reply, analysisResult } = await sendMessage(next, sfConnectionId, sfObject, nsConnectionId, nsObject);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (analysisResult) onAnalysisResult(analysisResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, sfConnectionId, sfObject, nsConnectionId, nsObject, onAnalysisResult]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <Bot className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-slate-700">AI Sync Analyst</span>
        <span className="text-xs text-slate-400 ml-1">Gemini</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7 text-slate-400 hover:text-slate-600"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {messages.filter((m) => m.role === 'assistant' || messages.indexOf(m) > 0).map((msg, i) => (
          msg.role === 'user' && i === 0 ? null : (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                </div>
              )}
            </div>
          )
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="bg-slate-100 rounded-lg px-3 py-2.5 flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Analyzing…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-200 px-3 py-2.5 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply to the agent… (Enter to send)"
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 bg-slate-50"
          />
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
