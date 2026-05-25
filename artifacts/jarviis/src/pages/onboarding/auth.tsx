import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ParticleBackground } from "@/components/particle-background";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");

  const handleContinue = () => {
    if (step === 1 && identifier) setStep(2);
    else if (step === 2 && code) setLocation("/onboarding/details");
  };

  return (
    <div className="min-h-screen bg-[#030508] text-cyan-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <ParticleBackground />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm px-6 z-10"
      >
        <div className="glass p-8 rounded-2xl flex flex-col gap-8 shadow-2xl shadow-cyan-900/20">
          <div className="space-y-2">
            <h2 className="text-2xl font-light tracking-wide text-white">
              {step === 1 ? "Identify yourself." : "Verify identity."}
            </h2>
            <p className="text-cyan-400/60 text-sm tracking-wide">
              {step === 1 ? "Enter your email or phone number to access the system." : "Enter the authorization code sent to you."}
            </p>
          </div>

          <div className="space-y-4">
            {step === 1 ? (
              <Input
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Email or Phone"
                className="bg-transparent border-b border-0 border-cyan-500/30 rounded-none px-0 text-lg focus-visible:ring-0 focus-visible:border-cyan-400 placeholder:text-cyan-700/50"
              />
            ) : (
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Authorization Code"
                className="bg-transparent border-b border-0 border-cyan-500/30 rounded-none px-0 text-lg focus-visible:ring-0 focus-visible:border-cyan-400 placeholder:text-cyan-700/50 tracking-[0.5em]"
                maxLength={6}
              />
            )}
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button 
              className="w-full bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-50 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300"
              size="lg"
              onClick={handleContinue}
              disabled={step === 1 ? !identifier : !code}
            >
              <span className="tracking-widest">CONTINUE</span>
            </Button>
            <Button 
              variant="ghost"
              className="w-full text-cyan-600 hover:text-cyan-400 hover:bg-transparent"
              onClick={() => step === 2 ? setStep(1) : setLocation("/")}
            >
              <span className="tracking-widest text-xs">BACK</span>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
