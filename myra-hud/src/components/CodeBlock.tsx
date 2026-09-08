"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-2xl overflow-hidden border border-white/10 bg-[#0d0e15] shadow-xl">
      {/* Code Block Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/50 border-b border-white/10 text-xs font-mono">
        <span className="text-slate-400 capitalize">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition-colors p-1 rounded-md hover:bg-white/10"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-[11px]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Syntax Highlighting Container */}
      <SyntaxHighlighter
        language={language || "text"}
        style={atomDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.85rem",
          fontFamily: "var(--font-mono, monospace)",
        }}
        wrapLongLines={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}