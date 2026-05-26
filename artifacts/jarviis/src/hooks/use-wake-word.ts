import { useEffect, useRef, useState, useCallback } from "react";

export type WakeWordState = "standby" | "activated" | "listening" | "off" | "denied";

interface UseWakeWordOptions {
  onCommand: (transcript: string) => void;
  wakeWords?: string[];
}

const WAKE_WORDS = ["jarvis", "jarviis", "hey jarvis", "ok jarvis"];

export function useWakeWord({ onCommand, wakeWords = WAKE_WORDS }: UseWakeWordOptions) {
  const [wakeState, setWakeState]       = useState<WakeWordState>("standby");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [supported, setSupported]       = useState(true);

  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const wakeStateRef     = useRef<WakeWordState>("standby");
  const restartTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandBufferRef = useRef("");
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef       = useRef(true);

  const setWS = useCallback((s: WakeWordState) => {
    wakeStateRef.current = s;
    if (mountedRef.current) setWakeState(s);
  }, []);

  const startRec = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !mountedRef.current) return;
    if (wakeStateRef.current === "off" || wakeStateRef.current === "denied") return;
    try { rec.start(); } catch { /* already running */ }
  }, []);

  const scheduleRestart = useCallback((ms = 150) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(startRec, ms);
  }, [startRec]);

  const forceActivate = useCallback(() => {
    // If denied — try restarting recognition to re-trigger browser permission prompt
    if (wakeStateRef.current === "denied") {
      setWS("standby");
      setTimeout(startRec, 100);
      return;
    }
    if (wakeStateRef.current === "off") return;
    setWS("activated");
    commandBufferRef.current = "";
    setLiveTranscript("");
    // Restart recognition in case it stalled
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    setTimeout(startRec, 100);
  }, [setWS, startRec]);

  useEffect(() => {
    mountedRef.current = true;

    const SpeechAPI =
      (window as Window).SpeechRecognition ||
      (window as Window).webkitSpeechRecognition;

    if (!SpeechAPI) {
      setSupported(false);
      setWS("off");
      return;
    }

    const rec = new SpeechAPI();
    rec.continuous      = true;
    rec.interimResults  = true;
    // en-IN = Indian English — catches "JARVIS" perfectly + Hinglish commands
    rec.lang            = "en-IN";
    rec.maxAlternatives = 3;
    recognitionRef.current = rec;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (!mountedRef.current) return;

      let interim = "";
      let final   = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.toLowerCase().trim();
        if (event.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      const fullText = (final || interim).trim();

      if (wakeStateRef.current === "standby") {
        let detected = false;
        outer: for (let i = event.resultIndex; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            const alt = event.results[i][j].transcript.toLowerCase();
            if (wakeWords.some(w => alt.includes(w))) { detected = true; break outer; }
          }
        }
        if (detected) {
          setWS("activated");
          commandBufferRef.current = "";
          setLiveTranscript("");
          const afterWake = wakeWords.reduce((t, w) => t.replace(w, ""), fullText).trim();
          if (afterWake.length > 2) {
            commandBufferRef.current = afterWake;
            setLiveTranscript(afterWake);
          }
        }
      } else if (wakeStateRef.current === "activated" || wakeStateRef.current === "listening") {
        setWS("listening");
        commandBufferRef.current = fullText;
        setLiveTranscript(fullText);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (event.results[event.results.length - 1].isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length > 1) onCommand(cmd);
            commandBufferRef.current = "";
            setLiveTranscript("");
            setWS("standby");
          }, 900);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!mountedRef.current) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSupported(false);
        setWS("denied");
        return;
      }
      if (event.error === "aborted") return;
      scheduleRestart(800);
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      if (wakeStateRef.current !== "off" && wakeStateRef.current !== "denied") {
        scheduleRestart(100);
      }
    };

    // Start immediately — SpeechRecognition shows its own mic permission popup
    setWS("standby");
    startRec();

    return () => {
      mountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (silenceTimerRef.current)  clearTimeout(silenceTimerRef.current);
      try { rec.abort(); } catch { /* ignore */ }
    };
  }, []);

  return { wakeState, liveTranscript, supported, forceActivate };
}
