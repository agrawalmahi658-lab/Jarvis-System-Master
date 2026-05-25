import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Orb } from "@/components/orb";
import { HudCorner } from "@/components/hud-corner";
import { ParticleBackground } from "@/components/particle-background";
import { Button } from "@/components/ui/button";

const bootLines = [
  "Initializing neural interface…",
  "Loading cognitive modules…",
  "Voice core active",
  "Memory systems connected",
  "Automation modules ready",
  "All systems nominal",
];

export default function Splash() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<"black" | "boot" | "orb" | "ready">("black");
  const [shownLines, setShownLines] = useState<string[]>([]);
  const [scanPct, setScanPct] = useState(0);

  useEffect(() => {
    const run = async () => {
      await delay(400);
      setPhase("boot");

      for (let i = 0; i < bootLines.length; i++) {
        await delay(320);
        setShownLines(prev => [...prev, bootLines[i]]);
        setScanPct(Math.round(((i + 1) / bootLines.length) * 100));
      }

      await delay(500);
      setPhase("orb");
      await delay(900);
      setPhase("ready");
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-[#020408] text-cyan-50 flex flex-col items-center justify-center relative overflow-hidden font-mono">
      <div className="hex-grid fixed inset-0 pointer-events-none z-0" />
      <ParticleBackground />

      {/* Scan sweep */}
      <motion.div
        className="fixed inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent pointer-events-none z-[1]"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      <AnimatePresence>
        {phase === "black" && (
          <motion.div key="black" className="fixed inset-0 bg-black z-50"
            exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full max-w-lg px-8 flex flex-col items-center gap-8">

        {/* Boot log */}
        <AnimatePresence>
          {(phase === "boot" || phase === "orb" || phase === "ready") && (
            <motion.div
              key="boot"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "ready" ? 0 : 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <div className="relative border border-cyan-500/20 bg-black/40 p-5 rounded-sm">
                <HudCorner position="tl" size={12} className="top-0 left-0" />
                <HudCorner position="tr" size={12} className="top-0 right-0" />
                <HudCorner position="bl" size={12} className="bottom-0 left-0" />
                <HudCorner position="br" size={12} className="bottom-0 right-0" />

                <div className="text-[9px] tracking-[0.4em] text-cyan-600 mb-3 uppercase">
                  J.A.R.V.I.S Boot Sequence
                </div>

                <div className="flex flex-col gap-1.5 min-h-[140px]">
                  {shownLines.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-[11px] tracking-wider"
                    >
                      <span className="text-cyan-500">›</span>
                      <span className={i === shownLines.length - 1 ? "text-cyan-300" : "text-cyan-700"}>{line}</span>
                      {i === shownLines.length - 1 && (
                        <motion.span
                          className="w-1.5 h-3 bg-cyan-400 inline-block"
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.7, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-px bg-cyan-950 relative">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-cyan-500"
                      style={{ width: `${scanPct}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-[9px] text-cyan-600 tracking-widest tabular-nums">{scanPct}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orb + Title */}
        <AnimatePresence>
          {(phase === "orb" || phase === "ready") && (
            <motion.div
              key="orb-section"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-5"
            >
              <div className="relative">
                <HudCorner position="tl" size={16} className="top-[-12px] left-[-12px]" />
                <HudCorner position="tr" size={16} className="top-[-12px] right-[-12px]" />
                <HudCorner position="bl" size={16} className="bottom-[-12px] left-[-12px]" />
                <HudCorner position="br" size={16} className="bottom-[-12px] right-[-12px]" />
                <Orb size="lg" state="idle" />
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div className="text-[9px] tracking-[0.5em] text-cyan-600 uppercase">Stark Industries A.I.</div>
                <motion.h1
                  className="text-6xl font-light tracking-[0.6em] text-white hud-glow"
                  initial={{ letterSpacing: "0.2em" }}
                  animate={{ letterSpacing: "0.6em" }}
                  transition={{ duration: 1.2 }}
                >
                  JARVIS
                </motion.h1>
                <div className="flex items-center gap-2 text-[10px] tracking-[0.35em] text-cyan-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  ONLINE
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA buttons */}
        <AnimatePresence>
          {phase === "ready" && (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="w-full flex flex-col gap-3"
            >
              <div className="relative border border-cyan-500/20 p-1 rounded-sm">
                <HudCorner position="tl" size={8} className="top-0 left-0" />
                <HudCorner position="br" size={8} className="bottom-0 right-0" />
                <Button
                  className="w-full bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-100 border border-cyan-500/30 hover:border-cyan-400/60 rounded-none tracking-[0.3em] uppercase font-mono text-sm h-12 transition-all duration-300"
                  onClick={() => setLocation("/onboarding/auth")}
                >
                  Initialize Access
                </Button>
              </div>

              <Button
                variant="ghost"
                className="text-cyan-700 hover:text-cyan-500 hover:bg-transparent tracking-[0.2em] uppercase text-xs font-mono"
                onClick={() => setLocation("/onboarding/auth")}
              >
                Continue as Guest →
              </Button>

              <p className="text-center text-[9px] tracking-[0.3em] text-cyan-900 uppercase mt-2">
                J.A.R.V.I.S — Just A Rather Very Intelligent System
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
