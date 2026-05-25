import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface OrbProps {
  state?: OrbState;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Orb({ state = "idle", className, size = "md" }: OrbProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-32 h-32",
    lg: "w-48 h-48"
  };

  const variants = {
    idle: {
      scale: [1, 1.05, 1],
      opacity: [0.8, 1, 0.8],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    },
    listening: {
      scale: [1, 1.15, 1],
      opacity: [0.9, 1, 0.9],
      boxShadow: [
        "0 0 40px rgba(0, 212, 255, 0.3)",
        "0 0 80px rgba(0, 212, 255, 0.6)",
        "0 0 40px rgba(0, 212, 255, 0.3)"
      ],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
    },
    thinking: {
      scale: [1, 0.95, 1],
      rotate: [0, 180, 360],
      opacity: 0.9,
      transition: { duration: 2, repeat: Infinity, ease: "linear" }
    },
    speaking: {
      scale: [1, 1.2, 0.9, 1.1, 1],
      opacity: [0.8, 1, 0.9, 1, 0.8],
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
    }
  };

  return (
    <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-cyan-500/20 blur-2xl"
        variants={variants}
        initial="idle"
        animate={state}
      />
      
      {/* Middle Ring */}
      <motion.div
        className="absolute inset-2 rounded-full border border-cyan-400/30"
        animate={state === "thinking" ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Inner Core */}
      <motion.div
        className="absolute inset-4 rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-300 orb-glow"
        variants={variants}
        initial="idle"
        animate={state}
      />
      
      {/* Center Highlight */}
      <div className="absolute inset-1/3 rounded-full bg-white/50 blur-sm" />
    </div>
  );
}
