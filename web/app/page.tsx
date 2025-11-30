'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import CodeBlock from '@/components/CodeBlock';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
  inferenceTime?: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Olá! 👋 Sou seu assistente Python. Digite uma instrução e vou gerar código Python para você!',
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    // Placeholder da resposta
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '⏳ Gerando código...',
      timestamp: new Date(),
      loading: true,
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // Preparar histórico de mensagens (excluindo loading e mensagem inicial)
      const messageHistory = messages
        .filter(msg => !msg.loading && msg.id !== '0')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Adicionar mensagem atual do usuário
      messageHistory.push({
        role: 'user',
        content: trimmedInput
      });

      // Limitar às últimas 10 mensagens (5 pares de pergunta/resposta)
      const recentHistory = messageHistory.slice(-10);

      // Fazer requisição para API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: recentHistory,
          max_tokens: 512,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro na geração de código');
      }

      // Remover loading message
      setMessages((prev) => prev.filter((m) => !m.loading));

      // Adicionar resposta
      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: data.code,
        timestamp: new Date(),
        inferenceTime: data.inference_time_ms,
      };

      setMessages((prev) => [...prev, assistantMessage]);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);

      // Remover loading message
      setMessages((prev) => prev.filter((m) => !m.loading));

      // Adicionar mensagem de erro
      const errorMessage: Message = {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `❌ Erro: ${errorMsg}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="relative bg-slate-900/30 backdrop-blur-sm border-b border-slate-800">
        <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
        <div className="relative max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <span className="text-xl font-bold text-blue-400 font-mono">{'{ }'}</span>
              </div>
              <div className="h-8 w-px bg-slate-700"></div>
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white font-mono">
                <span className="text-blue-400">python</span>
                <span className="text-slate-500 mx-2">/</span>
                <span className="text-slate-300">code-generator</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs font-medium text-green-300">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-fadeIn">
              {msg.role === 'assistant' ? (
                <div className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <span className="text-white text-sm">🤖</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    {msg.content.includes('```') ? (
                      // Renderizar com split de código
                      (() => {
                        const parts = msg.content.split('```');
                        return parts.map((part, idx) => {
                          // Índices pares são texto, ímpares são código
                          const isCode = idx % 2 === 1;
                          
                          if (!part.trim()) return null;
                          
                          if (isCode) {
                            // Remover o identificador de linguagem se existir (python, js, etc)
                            const code = part.replace(/^\w+\s*\n/, '').trim();
                            return (
                              <CodeBlock
                                key={idx}
                                code={code}
                                language="python"
                                inferenceTimeMs={idx === 1 ? msg.inferenceTime : undefined}
                              />
                            );
                          } else {
                            return (
                              <div key={idx} className="bg-slate-800/50 backdrop-blur-sm text-slate-100 px-5 py-4 rounded-xl border border-slate-700/50 shadow-lg">
                                <div className="markdown-content text-base">
                                  <ReactMarkdown>
                                    {part.trim()}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            );
                          }
                        });
                      })()
                    ) : (
                      // Sem código, apenas texto
                      <div className="bg-slate-800/50 backdrop-blur-sm text-slate-100 px-5 py-4 rounded-xl border border-slate-700/50 shadow-lg">
                        <div className="markdown-content text-base">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-3">
                  <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-5 py-3 rounded-xl max-w-2xl shadow-lg border border-blue-500/30">
                    <p className="text-base leading-relaxed">{msg.content}</p>
                  </div>
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <span className="text-white text-sm">👤</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mb-4 animate-slideDown">
          <div className="max-w-5xl mx-auto bg-red-500/10 border border-red-500/30 backdrop-blur-sm text-red-300 px-5 py-3 rounded-xl flex items-center gap-3 shadow-lg">
            <span className="text-xl">⚠️</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-t border-slate-700/50 shadow-2xl p-6">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Descreva o código que você quer gerar..."
                disabled={loading}
                className="w-full bg-slate-800/80 text-white placeholder-slate-400 border border-slate-600/50 rounded-xl px-5 py-4 pr-12 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all shadow-lg"
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold px-8 py-4 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Enviar</span>
                </>
              )}
            </button>
          </form>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>💡</span>
              <span>Ex: "Crie uma função que calcula a sequência de Fibonacci" ou "Faça um web scraper"</span>
            </div>
            {messages.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>{Math.max(0, messages.filter(m => !m.loading && m.id !== '0').length)} mensagens no contexto</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
