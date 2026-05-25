import { useCallback, useEffect, useRef } from "react";

export function useTTS() {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Voices load async — cache them once ready
  useEffect(() => {
    const load = () => {
      voicesRef.current = window.speechSynthesis?.getVoices() ?? [];
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const getHindiVoice = (): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;

    // 1. Prefer actual Hindi voices
    const hindiNames = [
      "Google हिन्दी",
      "Microsoft Hemant - Hindi (India)",
      "Microsoft Kalpana - Hindi (India)",
      "Lekha",       // macOS Hindi
      "Samiksha",
    ];
    for (const name of hindiNames) {
      const v = voices.find(v => v.name === name);
      if (v) return v;
    }

    // 2. Any hi-IN voice
    const hiIN = voices.find(v => v.lang === "hi-IN" || v.lang.startsWith("hi"));
    if (hiIN) return hiIN;

    // 3. Fallback to a deep English voice (still better than default)
    const englishDeep = [
      "Google UK English Male",
      "Microsoft George - English (United Kingdom)",
      "Alex",
      "Google US English",
      "Microsoft David - English (United States)",
    ];
    for (const name of englishDeep) {
      const v = voices.find(v => v.name === name);
      if (v) return v;
    }

    return voices.find(v => v.lang.startsWith("en")) ?? voices[0] ?? null;
  };

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";   // enables Hindi phonology — Hinglish works well here
    utterance.pitch = 0.8;
    utterance.rate = 0.9;
    utterance.volume = 1;

    const voice = getHindiVoice();
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, stop };
}
