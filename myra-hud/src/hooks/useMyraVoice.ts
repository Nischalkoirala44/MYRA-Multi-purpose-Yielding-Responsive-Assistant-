"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface CommandResponse {
  action: string;
  target: string;
  result: string;
}

// Helper: Strips markdown code blocks and inline code ticks before TTS runs
const cleanTextForSpeech = (rawText: string): string => {
  if (!rawText) return "";

  // 1. Strip standard Markdown fenced code blocks: ```language ... ```
  let textWithoutCode = rawText.replace(/```[\s\S]*?```/g, "").trim();

  // 2. Strip inline code backticks: `code`
  textWithoutCode = textWithoutCode.replace(/`([^`]+)`/g, "$1").trim();

  // 3. Fallback message if the response contained ONLY a code block with no introductory sentence
  return textWithoutCode || "Here is the code snippet requested.";
};

export function useMyraVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API availability
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      // Handle final recognized input
      if (event.results[0].isFinal) {
        sendToMyraCore(currentTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  // Text-to-Speech Output Handler
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    // Filter text so code blocks are removed before speaking
    const spokenText = cleanTextForSpeech(text);

    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Optional: Select a specific voice profile if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.name.includes("Google") || v.name.includes("Natural") || v.lang === "en-US"
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
  }, []);

  // API Bridge to C# Backend
  const sendToMyraCore = async (inputSpeech: string) => {
    if (!inputSpeech.trim()) return;

    setIsProcessing(true);
    try {
      const response = await fetch("http://localhost:5000/api/assistant/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputSpeech }),
      });

      const data: CommandResponse = await response.json();
      setLastResponse(data);

      // Provide verbal feedback for standard responses
      if (data.action === "CHAT" && data.target) {
        speak(data.target);
      } else if (data.action === "OPEN_APP") {
        speak(`Opening ${data.target}`);
      }
    } catch (err) {
      console.error("Failed to connect to MYRA Core Engine:", err);
      speak("Core execution failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return {
    isListening,
    isProcessing,
    transcript,
    lastResponse,
    startListening,
    stopListening,
    speak,
  };
}