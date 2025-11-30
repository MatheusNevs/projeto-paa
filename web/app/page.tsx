'use client';

import React, { useState, useRef, useEffect } from 'react';
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
      // Fazer requisição para API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: trimmedInput,
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
    <div className="flex flex-col h-screen bg-linear-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🐍 Python Code Generator</h1>
            <p className="text-blue-100 text-sm mt-1">Powered by Llama-3.1-8B + LoRA</p>
          </div>
          <div className="text-right text-sm text-blue-100">
            <div>RTX 5060 Ti</div>
            <div>CUDA 12.4</div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-3">
              {msg.role === 'assistant' ? (
                <CodeBlock
                  code={msg.content}
                  language="python"
                  inferenceTimeMs={msg.inferenceTime}
                />
              ) : (
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-lg max-w-xl">
                    {msg.content}
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
        <div className="bg-red-500 text-white p-3 mx-4 rounded mb-2">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva o código que você quer gerar..."
              disabled={loading}
              className="flex-1 bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Gerando...' : 'Enviar'}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">
            💡 Ex: "Crie uma função que calcula a sequência de Fibonacci"
          </p>
        </div>
      </div>
    </div>
  );
}
