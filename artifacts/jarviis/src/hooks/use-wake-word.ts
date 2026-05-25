import { useEffect, useRef, useState, useCallback } from "react";

export type WakeWordState = "standby" | "activated" | "listening" | "off";

interface UseWakeWordOptions {
  onCommand: (transcript: string) => void;
  wakeWords?: string[];
}

const WAKE_WORDS = ["jarvis", "jarviis", "hey jarvis", "hey jarviis", "ok jarvis", "jarvis,"];

export function useWakeWord({ onCommand, wakeWords = WAKE_WORDS }: UseWakeWordOptions) {
  const [wakeState, setWakeState] = useState<WakeWordState>("standby");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [supported, setSupported] = useState(true);

  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const wakeStateRef     = useRef<WakeWordState>("standby");
  const restartTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandBufferRef = useRef("");
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef       = useRef(true);

  const setWakeStateSynced = useCallback((s: WakeWordState) => {
    wakeStateRef.current = s;
    if (mountedRef.current) setWakeState(s);
  }, []);

  const startRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !mountedRef.current || wakeStateRef.current === "off") return;
    try { rec.start(); } catch { /* already running */ }
  }, []);

  const scheduleRestart = useCallback((delay = 200) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(startRecognition, delay);
  }, [startRecognition]);

  // Exposed: force into activated state (used by clap detector)
  const forceActivate = useCallback(() => {
    if (wakeStateRef.current === "off") return;
    setWakeStateSynced("activated");
    commandBufferRef.current = "";
    setLiveTranscript("");
  }, [setWakeStateSynced]);

  useEffect(() => {
    mountedRef.current = true;
    const SpeechAPI = (window as Window).SpeechRecognition || (window as Window).webkitSpeechRecognition;
    if (!SpeechAPI) { setSupported(false); return; }

    const rec = new SpeechAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "hi-IN"; // Indian English + Hindi — handles Hinglish
    rec.maxAlternatives = 3;
    recognitionRef.current = rec;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (!mountedRef.current) return;

      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.toLowerCase().trim();
        if (event.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      const fullText = (final || interim).trim();

      if (wakeStateRef.current === "standby") {
        // Check all alternatives for wake word
        let detected = false;
        outer: for (let i = event.resultIndex; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            const alt = event.results[i][j].transcript.toLowerCase().trim();
            if (wakeWords.some(w => alt.includes(w))) { detected = true; break outer; }
          }
        }
        if (detected) {
          setWakeStateSynced("activated");
          commandBufferRef.current = "";
          setLiveTranscript("");
          // If command spoken after wake word in same breath
          const afterWake = wakeWords.reduce((t, w) => t.replace(w, ""), fullText).trim();
          if (afterWake.length > 2) {
            commandBufferRef.current = afterWake;
            setLiveTranscript(afterWake);
          }
        }
      } else if (wakeStateRef.current === "activated" || wakeStateRef.current === "listening") {
        setWakeStateSynced("listening");
        commandBufferRef.current = fullText;
        setLiveTranscript(fullText);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (event.results[event.results.length - 1].isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length > 1) onCommand(cmd);
            commandBufferRef.current = "";
            setLiveTranscript("");
            setWakeStateSynced("standby");
          }, 800);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!mountedRef.current) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSupported(false); setWakeStateSynced("off"); return;
      }
      if (event.error === "aborted") return;
      scheduleRestart(800);
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      if (wakeStateRef.current !== "off") scheduleRestart(100);
    };

    startRecognition();

    return () => {
      mountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try { rec.abort(); } catch { /* ignore */ }
    };
  }, []);

  const turnOff = useCallback(() => {
    setWakeStateSynced("off");
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    setLiveTranscript("");
  }, [setWakeStateSynced]);

  const turnOn = useCallback(() => {
    setWakeStateSynced("standby");
    startRecognition();
  }, [setWakeStateSynced, startRecognition]);

  return { wakeState, liveTranscript, supported, turnOff, turnOn, forceActivate };
}
