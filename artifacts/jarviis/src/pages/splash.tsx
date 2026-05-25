import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Orb } from "@/components/orb";
import { ParticleBackground } from "@/components/particle-background";
import { Button } from "@/components/ui/button";

const diagnostics = [
  "Neural Systems Online",
  "Voice Core Active",
  "Memory Systems Connected",
  "Automation Modules Ready"
];

export default function Splash() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<"black" | "orb" | "diagnostics" | "ready">("black");
  const [diagnosticIndex, setDiagnosticIndex] = useState(-1);
  const [shownDiagnostics, setShownDiagnostics] = useState<string[]>([]);

  useEffect(() => {
    const sequence = async () => {
      await new Promise(r => setTimeout(r, 600));
      setPhase("orb");
      await new Promise(r => setTimeout(r, 800));
      setPhase("diagnostics");

      for (let i = 0; i < diagnostics.length; i++) {
        await new Promise(r => setTimeout(r, 400));
        setDiagnosticIndex(i);
        setShownDiagnostics(prev => [...prev, diagnostics[i]]);
      }

      await new Promise(r => setTimeout(r, 600));
      setPhase("ready");
    };
    sequence();
  }, []);

  return (
    <div className="min-h-screen bg-[#030508] text-cyan-50 flex flex-col items-center justify-center relative overflow-hidden font-sans select-none">
      <ParticleBackground />

      <AnimatePresence>
        {phase === "black" && (
          <motion.div
            key="black-overlay"
            className="fixed inset-0 bg-black z-50"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center justify-center z-10 w-full max-w-md px-6 gap-8">

        {/* Orb */}
        <AnimatePresence>
          {(phase === "orb" || phase === "diagnostics" || phase === "ready") && (
            <motion.div
              key="orb-container"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Orb size="lg" state="idle" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diagnostics */}
        <AnimatePresence>
          {(phase === "diagnostics" || phase === "ready") && (
            <motion.div
              key="diagnostics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-24 flex flex-col items-center justify-start gap-1.5"
            >
              {shownDiagnostics.map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs text-cyan-400 font-mono tracking-widest uppercase"
                >
                  <span className="text-cyan-600 mr-2">✓</span>{text}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ready State */}
        <AnimatePresence>
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="flex flex-col items-center w-full gap-4"
            >
              <div className="text-center mb-4">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-cyan-500 tracking-[0.25em] text-xs font-mono mb-3 uppercase"
                >
                  JARVIIS INITIALIZING
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, letterSpacing: "0.1em" }}
                  animate={{ opacity: 1, letterSpacing: "0.35em" }}
                  transition={{ duration: 1.2, delay: 0.3 }}
                  className="text-5xl font-light text-white glow-cyan"
                >
                  JARVIIS
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-cyan-400 text-[10px] tracking-widest font-mono flex items-center justify-center gap-2 mt-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  ONLINE
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="w-full space-y-3"
              >
                <Button
                  data-testid="button-continue-email"
                  className="w-full glass hover:bg-white/10 text-white border border-cyan-500/30 transition-all duration-300 tracking-widest"
                  size="lg"
                  onClick={() => setLocation("/onboarding/auth")}
                >
                  Continue with Email
                </Button>
                <Button
                  data-testid="button-continue-number"
                  variant="ghost"
                  className="w-full text-cyan-300/60 hover:text-cyan-200 hover:bg-white/5 transition-all duration-300 tracking-widest border border-transparent"
                  size="lg"
                  onClick={() => setLocation("/onboarding/auth")}
                >
                  Continue with Number
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-cyan-700/40 text-xs tracking-widest uppercase mt-4"
              >
                An AI made for students
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
