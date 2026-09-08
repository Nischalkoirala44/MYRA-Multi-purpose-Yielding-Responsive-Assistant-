"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "../components/CodeBlock";

const BAR_COUNT = 36;
const RADIUS = 75;

type ModeType = "FLIRT" | "SYSTEMCONTROL" | "CODING";

const MODE_CONFIGS = {
  FLIRT: {
    label: "FLIRT MODE",
    badge: "LOCKED",
    model: "qwen2.5:3b",
    color: "from-pink-500 to-purple-600",
    glow: "rgba(236,72,153,0.25)",
    border: "border-pink-500/30",
    activeOrb: "from-pink-600 via-rose-500 to-purple-600 shadow-[0_0_50px_rgba(244,63,94,0.5)]",
    commands: ['"let\'s flirt"', '"deactivate system control"', '"hey let\'s talk"'],
  },
  SYSTEMCONTROL: {
    label: "SYSTEM CONTROL",
    badge: "UNLOCKED",
    model: "qwen2.5:3b",
    color: "from-amber-400 to-cyan-500",
    glow: "rgba(245,158,11,0.25)",
    border: "border-amber-500/30",
    activeOrb: "from-amber-500 via-orange-500 to-cyan-500 shadow-[0_0_50px_rgba(245,158,11,0.5)]",
    commands: ['"activate system control"'],
  },
  CODING: {
    label: "CODING MODE",
    badge: "DEV READY",
    model: "qwen2.5-coder:7b",
    color: "from-emerald-400 to-cyan-600",
    glow: "rgba(16,185,129,0.25)",
    border: "border-emerald-500/30",
    activeOrb: "from-emerald-500 via-teal-500 to-cyan-600 shadow-[0_0_50px_rgba(16,185,129,0.5)]",
    commands: ['"activate coding mode"', '"coding mode on"'],
  },
};

export default function MyraHud() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [myraResponse, setMyraResponse] = useState("Hello Nischal. Systems online...");
  const [currentMode, setCurrentMode] = useState<ModeType>("FLIRT");
  const [textInput, setTextInput] = useState("");

  const [barHeights, setBarHeights] = useState<number[]>(new Array(BAR_COUNT).fill(4));
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const isListeningRef = useRef(false);

  const activeConfig = MODE_CONFIGS[currentMode] || MODE_CONFIGS.FLIRT;

  const setListeningState = (listening: boolean) => {
    isListeningRef.current = listening;
    setIsListening(listening);
  };

  const cleanTextForSpeech = (text: string) => {
    return text
      .replace(/```[\s\S]*?```/g, "Code output generated.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_~#]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const speakAsMyra = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const spokenText = cleanTextForSpeech(text);
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const availableVoices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();

    const preferredFemaleNames = [
      "Microsoft Zira",
      "Microsoft Hazel",
      "Microsoft Eva",
      "Google US English",
      "Samantha",
      "Victoria",
      "Karen",
      "Fiona",
    ];

    let femaleVoice = availableVoices.find((v) =>
      preferredFemaleNames.some((name) => v.name.includes(name))
    );

    if (!femaleVoice) {
      femaleVoice = availableVoices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("woman") ||
            v.name.toLowerCase().includes("zira"))
      );
    }

    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.pitch = 1.2;
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const sendToBackend = useCallback(
    async (textToSend: string) => {
      if (!textToSend || textToSend.trim() === "") return;

      setMyraResponse("Processing command...");

      try {
        const response = await fetch("http://127.0.0.1:5000/api/assistant/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: textToSend }),
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        const outputMessage = data.result || data.target || "Command processed.";

        if (data.currentMode) {
          const rawMode = String(data.currentMode).toUpperCase().replace(/[^A-Z]/g, "");
          if (rawMode in MODE_CONFIGS) {
            setCurrentMode(rawMode as ModeType);
          }
        }

        setMyraResponse(outputMessage);
        speakAsMyra(outputMessage);
      } catch (err) {
        console.error("API Error:", err);
        const errorMsg = "Core connection offline.";
        setMyraResponse(errorMsg);
        speakAsMyra(errorMsg);
      }
    },
    [speakAsMyra]
  );

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (!isListeningRef.current) {
      setTranscript("");
      transcriptRef.current = "";
      try {
        recognitionRef.current.start();
        setListeningState(true);
      } catch (err) {
        console.error("Speech recognition start failed:", err);
      }
    } else {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Speech recognition stop failed:", err);
      }
      setListeningState(false);

      if (transcriptRef.current.trim()) {
        sendToBackend(transcriptRef.current);
      }
    }
  }, [sendToBackend]);

  useEffect(() => {
    let step = 0;
    const animateWaveform = () => {
      step += 0.07;
      if (isListening || isSpeaking) {
        const newHeights = Array.from({ length: BAR_COUNT }, (_, i) => {
          const noise = Math.sin(step + i * 0.35) * Math.cos(step * 0.6 + i * 0.15);
          const baseMultiplier = isListening ? 26 : 18;
          return Math.max(4, Math.abs(noise) * baseMultiplier + 4);
        });
        setBarHeights(newHeights);
      } else {
        setBarHeights(new Array(BAR_COUNT).fill(4));
      }
      animationFrameRef.current = requestAnimationFrame(animateWaveform);
    };

    animateWaveform();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isListening, isSpeaking]);

  useEffect(() => {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        transcriptRef.current = currentTranscript;
      };

      recognition.onend = () => setListeningState(false);
      recognition.onerror = () => setListeningState(false);
      recognitionRef.current = recognition;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (event.key === "Control") {
        event.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleListening]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendToBackend(textInput);
    setTextInput("");
  };

  return (
    <main className="min-h-screen bg-[#05050B] text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans select-none">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full blur-[180px] pointer-events-none transition-all duration-700 opacity-40"
        style={{ background: activeConfig.glow }}
      />

      <div className="relative z-10 w-full max-w-5xl bg-slate-950/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.9)]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between w-full mb-8 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="text-xs font-mono font-bold tracking-widest text-slate-200 uppercase">
              MYRA HUD
            </span>
            <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
              v2.5
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-slate-400 font-mono tracking-wide">
              {activeConfig.model}
            </span>
            <span
              className={`text-[10px] font-mono px-3 py-1 rounded-full bg-white/[0.03] border ${activeConfig.border} text-slate-300 font-medium tracking-wide`}
            >
              {activeConfig.badge}
            </span>
          </div>
        </div>

        {/* HUD Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Output & Controls */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            
            {/* Mode Selector */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                  System Mode
                </span>
                <span className="text-[10px] font-mono text-slate-500">Select profile</span>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full p-1.5 bg-black/50 border border-white/5 rounded-2xl">
                {(["CONVERSATIONAL", "SYSTEMCONTROL", "CODING"] as ModeType[]).map((modeKey) => {
                  const isSelected = currentMode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      onClick={() =>
                        sendToBackend(MODE_CONFIGS[modeKey].commands[0].replace(/"/g, ""))
                      }
                      className={`py-2 px-3 rounded-xl text-[11px] font-mono font-medium transition-all duration-300 ${
                        isSelected
                          ? `bg-gradient-to-r ${MODE_CONFIGS[modeKey].color} text-white shadow-lg`
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                      }`}
                    >
                      {modeKey === "SYSTEMCONTROL" ? "SYS CONTROL" : modeKey}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Terminal Screen with Formatted Code & Copy Buttons */}
            <div className="flex-1 min-h-[220px] max-h-[450px] overflow-y-auto p-5 rounded-2xl bg-black/40 border border-white/[0.08] backdrop-blur-md flex flex-col justify-between shadow-inner relative group scrollbar-thin scrollbar-thumb-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono text-slate-500 tracking-wider uppercase">
                  Myra Output Terminal ({currentMode})
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
              </div>

              <div className="text-sm md:text-base text-slate-200 font-light leading-relaxed my-2 prose prose-invert max-w-none select-text">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p({ children }) {
                      return <div className="mb-4 last:mb-0">{children}</div>;
                    },
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeText = String(children).replace(/\n$/, "");

                      const hasKeywords = /\b(class|public|function|const|let|var|def|import|return)\b/.test(codeText);
                      const isBlockCode = Boolean(match) || codeText.includes("\n") || hasKeywords;

                      if (isBlockCode) {
                        return (
                          <CodeBlock
                            language={match ? match[1] : "java"}
                            value={codeText}
                          />
                        );
                      }

                      return (
                        <code
                          className="bg-white/10 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {myraResponse.includes("public class") && !myraResponse.includes("```")
                    ? `\`\`\`java\n${myraResponse}\n\`\`\``
                    : myraResponse}
                </ReactMarkdown>
              </div>

              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mt-2" />
            </div>

            {/* Live Transcript Display */}
            {transcript && (
              <div className="p-3 rounded-xl bg-pink-950/20 border border-pink-500/20 backdrop-blur-sm">
                <p className="text-xs text-slate-300 italic font-mono flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-ping" />
                  Captured: "{transcript}"
                </p>
              </div>
            )}

            {/* Command Bar */}
            <div className="space-y-2">
              <form
                onSubmit={handleManualSubmit}
                className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-2xl p-1.5 focus-within:border-white/20 transition-all"
              >
                <input
                  type="text"
                  placeholder="Type a command..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-xl border transition-all ${
                    isListening
                      ? "bg-pink-500/20 border-pink-500/50 text-pink-300 animate-pulse"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
                  }`}
                  title="Toggle voice listening"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-mono text-slate-200 transition-all font-semibold"
                >
                  Send
                </button>
              </form>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
                <span className="flex items-center gap-1.5">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/10 rounded text-slate-300 text-[9px]">
                    Ctrl
                  </kbd>{" "}
                  to toggle voice input
                </span>
                <span className="text-slate-600">Local AI Core</span>
              </div>
            </div>

          </div>

          {/* Right Column: Audio Visualizer */}
          <div className="lg:col-span-5 flex flex-col items-center justify-between bg-black/30 border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
            
            <div className="relative flex items-center justify-center w-64 h-64 my-auto">
              <div className="absolute inset-0 rounded-full border border-white/[0.05] animate-spin-slow pointer-events-none" />

              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="waveGradientClean" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <g transform="translate(100, 100)">
                  {barHeights.map((height, i) => {
                    const angle = (i * 360) / BAR_COUNT;
                    const rad = (angle * Math.PI) / 180;

                    const x1 = +(Math.cos(rad) * RADIUS).toFixed(4);
                    const y1 = +(Math.sin(rad) * RADIUS).toFixed(4);
                    const x2 = +(Math.cos(rad) * (RADIUS + height)).toFixed(4);
                    const y2 = +(Math.sin(rad) * (RADIUS + height)).toFixed(4);

                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="url(#waveGradientClean)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="transition-all duration-75"
                        opacity={isListening || isSpeaking ? 0.9 : 0.2}
                      />
                    );
                  })}
                </g>
              </svg>

              {/* Status Orb */}
              <div
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-500 z-10 ${
                  isListening
                    ? activeConfig.activeOrb
                    : isSpeaking
                    ? "bg-gradient-to-tr from-cyan-500 via-fuchsia-500 to-pink-500 shadow-[0_0_50px_rgba(6,182,212,0.7)] animate-pulse"
                    : "bg-gradient-to-tr from-slate-900/90 via-slate-950 to-black border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
                }`}
              >
                <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase mb-0.5">
                  STATUS
                </span>
                <span className="text-xs font-mono font-bold tracking-wider text-white">
                  {isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : "STANDBY"}
                </span>
              </div>
            </div>

            {/* Quick Trigger Preset Buttons */}
            <div className="w-full mt-4 pt-4 border-t border-white/[0.05]">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Command Shortcuts
                </span>
                <span className="text-[10px] font-mono text-slate-500">Preset triggers</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["FLIRT", "SYSTEMCONTROL", "CODING"] as ModeType[]).map((modeKey) => {
                  const cfg = MODE_CONFIGS[modeKey];
                  const isActive = currentMode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      onClick={() => sendToBackend(cfg.commands[0].replace(/"/g, ""))}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isActive
                          ? `bg-white/[0.04] ${cfg.border}`
                          : "bg-white/[0.01] border-white/5 opacity-60 hover:opacity-100 hover:bg-white/[0.02]"
                      }`}
                    >
                      <p className="text-[9px] font-mono text-slate-400 mb-1">
                        {modeKey === "SYSTEMCONTROL" ? "SYS CONTROL" : modeKey}
                      </p>
                      <code className="text-[9px] font-mono text-slate-300 bg-white/5 px-1 py-0.5 rounded block truncate">
                        {cfg.commands[0]}
                      </code>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}