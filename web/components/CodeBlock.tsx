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
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800">
        <span className="text-xs text-slate-300 font-mono">
          {language}{inferenceTimeMs != null ? ` • ${inferenceTimeMs} ms` : ''}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="text-sm">
        <SyntaxHighlighter
          language={language}
          style={atomOneDark}
          customStyle={{ margin: 0, padding: '12px 16px', background: 'transparent' }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
