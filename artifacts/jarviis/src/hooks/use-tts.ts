import { useCallback, useRef } from "react";

export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const getVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer deep male voices in order
    const preferred = [
      "Google UK English Male",
      "Microsoft George - English (United Kingdom)",
      "Alex",
      "Google US English",
      "Microsoft David - English (United States)",
    ];
    for (const name of preferred) {
      const v = voices.find((v) => v.name === name);
      if (v) return v;
    }
    // Fallback: any male-sounding English voice
    return voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null;
  };

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.75;   // deep
    utterance.rate = 0.88;    // slightly slower — commanding
    utterance.volume = 1;

    const voice = getVoice();
    if (voice) utterance.voice = voice;

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, stop };
}
