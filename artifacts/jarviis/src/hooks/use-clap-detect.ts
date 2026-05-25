import { useEffect, useRef, useState, useCallback } from "react";

export type ClapState = "inactive" | "ready" | "clap1" | "activated";

interface UseClapDetectOptions {
  onDoubleClap: () => void;
  threshold?: number;      // 0–1, amplitude spike threshold (default 0.22)
  doubleClapWindow?: number; // ms between two claps (default 750)
}

export function useClapDetect({
  onDoubleClap,
  threshold = 0.22,
  doubleClapWindow = 750,
}: UseClapDetectOptions) {
  const [clapState, setClapState] = useState<ClapState>("inactive");
  const [supported, setSupported] = useState(true);

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number>(0);
  const mountedRef   = useRef(true);

  const lastClapRef  = useRef<number>(0);
  const prevRmsRef   = useRef<number>(0);
  const cooldownRef  = useRef(false);

  const clapStateRef = useRef<ClapState>("inactive");
  const setClapStateSynced = useCallback((s: ClapState) => {
    clapStateRef.current = s;
    if (mountedRef.current) setClapState(s);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.1; // low smoothing = fast response
        source.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Float32Array(analyser.fftSize);

        const loop = () => {
          if (!mountedRef.current) return;
          rafRef.current = requestAnimationFrame(loop);

          analyser.getFloatTimeDomainData(buf);

          // RMS amplitude
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);

          // Clap = sudden spike from quiet
          const isSpike = rms > threshold && prevRmsRef.current < threshold * 0.5;

          if (isSpike && !cooldownRef.current) {
            cooldownRef.current = true;
            setTimeout(() => { cooldownRef.current = false; }, 120); // debounce 120ms

            const now = Date.now();
            const gap = now - lastClapRef.current;

            if (gap < doubleClapWindow && lastClapRef.current > 0) {
              // Double clap!
              lastClapRef.current = 0;
              setClapStateSynced("activated");
              onDoubleClap();
              // Reset back to ready after 1.5s
              setTimeout(() => {
                if (mountedRef.current) setClapStateSynced("ready");
              }, 1500);
            } else {
              // First clap
              lastClapRef.current = now;
              setClapStateSynced("clap1");
              // Reset to ready if second clap doesn't come
              setTimeout(() => {
                if (mountedRef.current && clapStateRef.current === "clap1") {
                  setClapStateSynced("ready");
                }
              }, doubleClapWindow + 50);
            }
          }

          prevRmsRef.current = rms;
        };

        setClapStateSynced("ready");
        loop();
      } catch {
        if (mountedRef.current) setSupported(false);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  return { clapState, supported };
}
