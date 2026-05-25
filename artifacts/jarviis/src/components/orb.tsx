import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface OrbProps {
  state?: OrbState;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const stateColors: Record<OrbState, { core: string; glow: string; ring: string }> = {
  idle:      { core: "from-cyan-600 to-cyan-300",   glow: "rgba(0,212,255,0.35)",  ring: "rgba(0,212,255,0.25)" },
  listening: { core: "from-red-500 to-orange-300",  glow: "rgba(255,80,80,0.5)",   ring: "rgba(255,80,80,0.35)" },
  thinking:  { core: "from-violet-600 to-cyan-400", glow: "rgba(120,80,255,0.5)",  ring: "rgba(120,80,255,0.3)" },
  speaking:  { core: "from-cyan-400 to-white",      glow: "rgba(0,212,255,0.65)",  ring: "rgba(0,212,255,0.45)" },
};

export function Orb({ state = "idle", className, size = "md" }: OrbProps) {
  const dim = { sm: 56, md: 140, lg: 200 }[size];
  const colors = stateColors[state];

  return (
    <div
      className={cn("relative flex items-center justify-center flex-shrink-0", className)}
      style={{ width: dim, height: dim }}
    >
      {/* Outermost slow ring */}
      <motion.div
        className="absolute rounded-full border"
        style={{
          inset: -16,
          borderColor: colors.ring,
          borderWidth: 1,
          opacity: 0.4,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />

      {/* Arc ring 1 — tilted, two sides visible */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -4,
          borderWidth: 1,
          borderStyle: "solid",
          borderTopColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: colors.ring,
          borderLeftColor: colors.ring,
          opacity: state === "idle" ? 0.5 : 0.9,
        }}
        animate={{ rotate: -360 }}
        transition={{
          duration: state === "thinking" ? 1.2 : 5,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Arc ring 2 — perpendicular, two sides visible */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: 6,
          borderWidth: 1,
          borderStyle: "solid",
          borderTopColor: colors.ring,
          borderRightColor: colors.ring,
          borderBottomColor: "transparent",
          borderLeftColor: "transparent",
          opacity: state === "idle" ? 0.3 : 0.7,
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: state === "thinking" ? 0.9 : 7,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Outer glow pulse */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`, filter: "blur(16px)" }}
        animate={
          state === "speaking"
            ? { scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }
            : state === "listening"
            ? { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }
            : { scale: [1, 1.1, 1], opacity: [0.5, 0.9, 0.5] }
        }
        transition={{ duration: state === "speaking" ? 0.6 : 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Core sphere */}
      <motion.div
        className={cn("absolute rounded-full bg-gradient-to-tr", colors.core)}
        style={{ inset: 14, boxShadow: `0 0 40px ${colors.glow}, 0 0 80px ${colors.glow}` }}
        animate={
          state === "speaking"
            ? { scale: [1, 1.18, 0.92, 1.12, 1] }
            : state === "thinking"
            ? { scale: [0.95, 1.05, 0.95] }
            : { scale: [1, 1.06, 1] }
        }
        transition={{
          duration: state === "speaking" ? 0.7 : state === "thinking" ? 1.5 : 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Center highlight */}
      <div
        className="absolute rounded-full bg-white/40"
        style={{ inset: "35%", filter: "blur(4px)" }}
      />

      {/* Tick marks on outer ring */}
      {[0, 90, 180, 270].map((deg) => (
        <div
          key={deg}
          className="absolute"
          style={{
            width: 4,
            height: 4,
            top: "50%",
            left: "50%",
            transform: `rotate(${deg}deg) translateY(-${dim / 2 + 18}px)`,
            marginTop: -2,
            marginLeft: -2,
          }}
        >
          <div
            style={{
              width: 4,
              height: 1,
              background: colors.ring,
              opacity: 0.6,
            }}
          />
        </div>
      ))}
    </div>
  );
}
