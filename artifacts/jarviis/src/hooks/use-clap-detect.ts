import { useEffect, useRef, useState, useCallback } from "react";

export type ClapState = "inactive" | "ready" | "clap1" | "activated";

interface UseClapDetectOptions {
  enabled: boolean;
  stream: MediaStream | null; // reuse already-granted stream
  onDoubleClap: () => void;
  threshold?: number;
  doubleClapWindow?: number;
}

export function useClapDetect({
  enabled,
  stream,
  onDoubleClap,
  threshold = 0.2,
  doubleClapWindow = 700,
}: UseClapDetectOptions) {
  const [clapState, setClapState] = useState<ClapState>("inactive");

  const audioCtxRef   = useRef<AudioContext | null>(null);
  const rafRef        = useRef<number>(0);
  const mountedRef    = useRef(true);
  const lastClapRef   = useRef(0);
  const prevRmsRef    = useRef(0);
  const cooldownRef   = useRef(false);
  const clapStateRef  = useRef<ClapState>("inactive");

  const setCS = useCallback((s: ClapState) => {
    clapStateRef.current = s;
    if (mountedRef.current) setClapState(s);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !stream) {
      setCS("inactive");
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    } catch {
      return;
    }

    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.05;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);

    const loop = () => {
      if (!mountedRef.current) return;
      rafRef.current = requestAnimationFrame(loop);

      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      // Spike: loud now, quiet before → clap
      const isSpike = rms > threshold && prevRmsRef.current < threshold * 0.4;

      if (isSpike && !cooldownRef.current) {
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, 100);

        const now = Date.now();
        const gap = now - lastClapRef.current;

        if (gap < doubleClapWindow && lastClapRef.current > 0) {
          lastClapRef.current = 0;
          setCS("activated");
          onDoubleClap();
          setTimeout(() => {
            if (mountedRef.current) setCS("ready");
          }, 1200);
        } else {
          lastClapRef.current = now;
          setCS("clap1");
          setTimeout(() => {
            if (mountedRef.current && clapStateRef.current === "clap1")
              setCS("ready");
          }, doubleClapWindow + 50);
        }
      }

      prevRmsRef.current = rms;
    };

    setCS("ready");
    loop();

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      ctx.close();
    };
  }, [enabled, stream]);

  return { clapState };
}
