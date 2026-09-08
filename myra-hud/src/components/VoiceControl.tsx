"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useMyraVoice } from "@/hooks/useMyraVoice";

export default function VoiceControl() {
  const {
    isListening,
    isProcessing,
    transcript,
    lastResponse,
    startListening,
    stopListening,
  } = useMyraVoice();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 w-full max-w-4xl mx-auto">
      {/* Microphone Toggle Button */}
      <button
        onClick={isListening ? stopListening : startListening}
        className={`px-6 py-3 rounded-full font-bold transition-all shadow-lg ${
          isListening
            ? "bg-red-500 hover:bg-red-600 animate-pulse text-white"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {isListening ? "Listening..." : "Activate MYRA"}
      </button>

      {/* Live Transcript Output */}
      <div className="text-sm font-mono text-gray-300 min-h-[24px]">
        {transcript || (isListening ? "Say something..." : "Click button and speak")}
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <span className="text-xs text-purple-400 font-semibold animate-pulse">
          Routing intent via local Ollama...
        </span>
      )}

      {/* Last Execution Output */}
      {lastResponse && (
        <div className="w-full p-4 bg-gray-950/80 border border-purple-500/30 rounded-xl text-left text-sm backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-2 mb-3 text-xs font-mono">
            <span className="text-purple-400 font-bold">Action: {lastResponse.action}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">Result: {lastResponse.result}</span>
          </div>

          {/* Formatted Markdown Content with Styled Code Blocks */}
          <div className="prose prose-invert max-w-none text-gray-200">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : "";
                  const codeString = String(children).replace(/\n$/, "");
                  const uniqueId = `${language}-${codeString.length}-${Math.random()}`;

                  return !inline && match ? (
                    <div className="relative my-4 rounded-xl overflow-hidden border border-gray-800 bg-[#0d0d0d] shadow-lg">
                      {/* Code Block Toolbar Header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-gray-800 text-xs text-gray-400 font-mono">
                        <span className="font-semibold text-purple-400 uppercase">{language}</span>
                        <button
                          onClick={() => handleCopy(codeString, uniqueId)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors text-xs font-sans"
                        >
                          {copiedId === uniqueId ? (
                            <span className="text-emerald-400 font-medium">Copied!</span>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>

                      {/* Code Syntax Highlight */}
                      <SyntaxHighlighter
                        style={atomDark}
                        language={language}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: "1.25rem",
                          background: "transparent",
                          fontSize: "0.875rem",
                          lineHeight: "1.5"
                        }}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="bg-gray-800 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {lastResponse.target}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}