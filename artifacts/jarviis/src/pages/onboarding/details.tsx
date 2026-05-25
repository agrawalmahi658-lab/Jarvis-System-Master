import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ParticleBackground } from "@/components/particle-background";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const questions = [
  { id: "name", prompt: "Naam kya hai?" },
  { id: "dob", prompt: "Kab paida hue the?" },
  { id: "occupation", prompt: "Kya karte ho abhi?" },
  { id: "institution", prompt: "Kahan padhte/kaam karte ho?" }
];

export default function Details() {
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    name: "", dob: "", occupation: "", institution: ""
  });

  const currentQ = questions[currentIndex];

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(curr => curr + 1);
    } else {
      localStorage.setItem("jarviis_user_name", answers.name);
      setLocation("/chat");
    }
  };

  return (
    <div className="min-h-screen bg-[#030508] text-cyan-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <ParticleBackground />
      
      <div className="w-full max-w-lg px-6 z-10">
        <div className="glass p-10 rounded-3xl shadow-2xl shadow-cyan-900/20 min-h-[300px] flex flex-col justify-center relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-light text-cyan-50 glow-cyan">
                {currentQ.prompt}
              </h2>
              
              <Input
                autoFocus
                value={answers[currentQ.id]}
                onChange={e => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && answers[currentQ.id] && handleNext()}
                className="bg-transparent border-b-2 border-0 border-cyan-800 rounded-none px-0 text-2xl focus-visible:ring-0 focus-visible:border-cyan-400"
              />

              <div className="flex justify-end pt-4">
                <Button 
                  className="bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-100 border border-cyan-500/30"
                  size="lg"
                  disabled={!answers[currentQ.id]}
                  onClick={handleNext}
                >
                  <span className="tracking-widest">
                    {currentIndex === questions.length - 1 ? "LET'S GO" : "NEXT"}
                  </span>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
          
          <div className="absolute bottom-6 left-10 flex gap-2">
            {questions.map((q, i) => (
              <div 
                key={q.id}
                className={`h-1 rounded-full transition-all duration-500 ${i <= currentIndex ? "w-8 bg-cyan-400" : "w-2 bg-cyan-900/50"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
