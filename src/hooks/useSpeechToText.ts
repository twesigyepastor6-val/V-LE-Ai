import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as WindowWithSpeech;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

interface UseSpeechToTextOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

export function useSpeechToText({
  onTranscript,
  onError,
}: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  const isSupported = getSpeechRecognitionCtor() !== null;

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        // Ignore already-stopped errors
      }
    }
    setIsListening(false);
  }, []);

  const start = useCallback((existingText: string) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.("Voice input is not supported in this browser");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }

    baseTextRef.current = existingText;
    finalTranscriptRef.current = "";

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscriptRef.current += piece;
        } else {
          interim += piece;
        }
      }

      const spoken = `${finalTranscriptRef.current}${interim}`.trimStart();
      const base = baseTextRef.current;
      if (!spoken) return;

      const needsSpace =
        base.length > 0 && !/[\s\n]$/.test(base);
      const combined = `${base}${needsSpace ? " " : ""}${spoken}`;
      onTranscriptRef.current(combined);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === "aborted") {
        setIsListening(false);
        recognitionRef.current = null;
        return;
      }

      const messages: Record<string, string> = {
        "not-allowed": "Microphone permission was denied",
        "service-not-allowed": "Microphone permission was denied",
        "audio-capture": "No microphone was found",
        "no-speech": "No speech detected",
        network: "Voice recognition network error",
      };

      onErrorRef.current?.(
        messages[event.error] ?? "Could not transcribe voice input"
      );
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      onErrorRef.current?.("Could not start voice input");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore unmount cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    start,
    stop,
  };
}
