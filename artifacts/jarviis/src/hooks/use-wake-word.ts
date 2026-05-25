import { useEffect, useRef, useState, useCallback } from "react";

export type WakeWordState = "standby" | "activated" | "listening" | "off";

interface UseWakeWordOptions {
  onCommand: (transcript: string) => void;
  wakeWords?: string[];
}

const WAKE_WORDS = ["jarvis", "jarviis", "jarvis,", "hey jarvis", "hey jarviis", "ok jarvis"];

export function useWakeWord({ onCommand, wakeWords = WAKE_WORDS }: UseWakeWordOptions) {
  const [wakeState, setWakeState] = useState<WakeWordState>("standby");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeStateRef = useRef<WakeWordState>("standby");
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandBufferRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep ref in sync so callbacks always see fresh state
  const setWakeStateSynced = useCallback((s: WakeWordState) => {
    wakeStateRef.current = s;
    if (mountedRef.current) setWakeState(s);
  }, []);

  const startRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !mountedRef.current) return;
    if (wakeStateRef.current === "off") return;
    try {
      rec.start();
    } catch {
      // already running — ignore
    }
  }, []);

  const scheduleRestart = useCallback((delay = 200) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      startRecognition();
    }, delay);
  }, [startRecognition]);

  useEffect(() => {
    mountedRef.current = true;
    const SpeechRecognitionAPI =
      (window as Window).SpeechRecognition || (window as Window).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!mountedRef.current) return;

      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.toLowerCase().trim();
        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interimText += text;
        }
      }

      const fullText = (finalText || interimText).trim();

      if (wakeStateRef.current === "standby") {
        // Check all alternatives for wake word
        let wakeDetected = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            const alt = event.results[i][j].transcript.toLowerCase().trim();
            if (wakeWords.some(w => alt.includes(w))) {
              wakeDetected = true;
              break;
            }
          }
          if (wakeDetected) break;
        }

        if (wakeDetected) {
          setWakeStateSynced("activated");
          commandBufferRef.current = "";
          setLiveTranscript("");
          // Strip the wake word itself from any captured text
          const afterWake = wakeWords.reduce((t, w) => t.replace(w, ""), fullText).trim();
          if (afterWake.length > 2) {
            // Wake word + command spoken in one breath
            commandBufferRef.current = afterWake;
            setLiveTranscript(afterWake);
          }
        }
      } else if (wakeStateRef.current === "activated") {
        // Now in command mode — accumulate what the user says
        setWakeStateSynced("listening");
        commandBufferRef.current = fullText;
        setLiveTranscript(fullText);

        // Silence timer — if no new speech for 1.5s, treat as end of command
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (event.results[event.results.length - 1].isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length > 1) {
              onCommand(cmd);
            }
            commandBufferRef.current = "";
            setLiveTranscript("");
            setWakeStateSynced("standby");
          }, 800);
        }
      } else if (wakeStateRef.current === "listening") {
        commandBufferRef.current = fullText;
        setLiveTranscript(fullText);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (event.results[event.results.length - 1].isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length > 1) {
              onCommand(cmd);
            }
            commandBufferRef.current = "";
            setLiveTranscript("");
            setWakeStateSynced("standby");
          }, 800);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!mountedRef.current) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSupported(false);
        setWakeStateSynced("off");
        return;
      }
      if (event.error === "aborted") return; // intentional abort, don't restart
      // For recoverable errors (network, audio-capture), restart after delay
      scheduleRestart(800);
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;
      if (wakeStateRef.current !== "off") {
        scheduleRestart(100);
      }
    };

    // Kick off
    startRecognition();

    return () => {
      mountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try { recognition.abort(); } catch { /* ignore */ }
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

  return { wakeState, liveTranscript, supported, turnOff, turnOn };
}
