'use client';

import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

type Props = {
  code: string;
  language?: string;
  inferenceTimeMs?: number;
};

export default function CodeBlock({ code, language = 'python', inferenceTimeMs }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignora erro
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-xs text-slate-300 font-mono font-semibold">
            {language}
          </span>
          {inferenceTimeMs != null && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-blue-400 font-medium">
                ⚡ {inferenceTimeMs}ms
              </span>
            </>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-100 font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <span>✓</span>
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="text-sm">
        <SyntaxHighlighter
          language={language}
          style={atomOneDark}
          customStyle={{ 
            margin: 0, 
            padding: '16px 20px', 
            background: 'rgba(15, 23, 42, 0.6)',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            fontFamily: 'var(--font-jetbrains-mono), monospace'
          }}
          wrapLongLines
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
