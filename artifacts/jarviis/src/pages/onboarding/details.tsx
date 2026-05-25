import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ParticleBackground } from "@/components/particle-background";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const questions = [
  {
    id: "name",
    prompt: "What's your name?",
    placeholder: "Enter your full name",
    type: "text",
  },
  {
    id: "dob",
    prompt: "When were you born?",
    placeholder: "DD / MM / YYYY",
    type: "date",
  },
  {
    id: "occupation",
    prompt: "What do you do?",
    placeholder: "Student, Engineer, Designer…",
    type: "text",
  },
  {
    id: "institution",
    prompt: "Where do you study or work?",
    placeholder: "Your college, university or company",
    type: "text",
  },
];

export default function Details() {
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    name: "",
    dob: "",
    occupation: "",
    institution: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQ = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleNext = () => {
    if (!answers[currentQ.id]) return;
    if (!isLast) {
      setCurrentIndex((c) => c + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      localStorage.setItem("jarviis_user_name", answers.name);
      setLocation("/chat");
    }
  };

  return (
    <div className="min-h-screen bg-[#030508] text-cyan-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <ParticleBackground />

      <div className="w-full max-w-lg px-6 z-10">
        {/* Step indicator */}
        <div className="flex justify-between items-center mb-8 px-1">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-mono transition-all duration-500 ${
                  i < currentIndex
                    ? "bg-cyan-500 border-cyan-500 text-black"
                    : i === currentIndex
                    ? "border-cyan-400 text-cyan-400"
                    : "border-cyan-900/50 text-cyan-900"
                }`}
              >
                {i < currentIndex ? "✓" : i + 1}
              </div>
              {i < questions.length - 1 && (
                <div
                  className={`h-px w-16 sm:w-24 transition-all duration-700 ${
                    i < currentIndex ? "bg-cyan-500" : "bg-cyan-900/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="glass p-10 rounded-3xl shadow-2xl shadow-cyan-900/20 min-h-[280px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="space-y-6"
            >
              <div>
                <p className="text-cyan-500/60 text-xs tracking-widest font-mono uppercase mb-2">
                  Step {currentIndex + 1} of {questions.length}
                </p>
                <h2 className="text-3xl font-light text-white">
                  {currentQ.prompt}
                </h2>
              </div>

              <Input
                ref={inputRef}
                autoFocus
                type={currentQ.type}
                value={answers[currentQ.id]}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [currentQ.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                placeholder={currentQ.placeholder}
                className="bg-transparent border-0 border-b-2 border-cyan-800/60 rounded-none px-0 text-xl focus-visible:ring-0 focus-visible:border-cyan-400 placeholder:text-cyan-900/70 transition-colors duration-300"
              />

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="ghost"
                  className="text-cyan-700 hover:text-cyan-400 hover:bg-transparent text-xs tracking-widest px-0"
                  onClick={() =>
                    currentIndex === 0
                      ? setLocation("/onboarding/auth")
                      : setCurrentIndex((c) => c - 1)
                  }
                >
                  ← BACK
                </Button>
                <Button
                  className="bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-100 border border-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 px-8"
                  size="lg"
                  disabled={!answers[currentQ.id]}
                  onClick={handleNext}
                >
                  <span className="tracking-widest">
                    {isLast ? "LET'S GO →" : "NEXT →"}
                  </span>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
