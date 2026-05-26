import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Orb } from "@/components/orb";
import { HudCorner } from "@/components/hud-corner";
import { ParticleBackground } from "@/components/particle-background";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send } from "lucide-react";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useClapDetect } from "@/hooks/use-clap-detect";
import { useTTS } from "@/hooks/use-tts";
import {
  useCreateOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function useTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

export default function Chat() {
  const [userName, setUserName]       = useState("Guest");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [orbState, setOrbState]       = useState<"idle"|"listening"|"thinking"|"speaking">("idle");

  // ── Mic state ─────────────────────────────────────────────────
  const [micEnabled, setMicEnabled]   = useState(false);
  const [micStream,  setMicStream]    = useState<MediaStream | null>(null);
  const [micError,   setMicError]     = useState<string | null>(null);
  const [micLoading, setMicLoading]   = useState(false);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<number | null>(null);
  const queryClient       = useQueryClient();
  const createConv        = useCreateOpenaiConversation();
  const { speak, stop }   = useTTS();
  const now               = useTime();

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // ── Request mic permission ─────────────────────────────────────
  const enableMic = useCallback(async () => {
    setMicLoading(true);
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      setMicStream(stream);
      setMicEnabled(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("denied") || msg.includes("Permission") || msg.includes("NotAllowed")) {
        setMicError("Microphone blocked — allow in browser settings, then refresh.");
      } else {
        setMicError("Mic unavailable: " + msg);
      }
    } finally {
      setMicLoading(false);
    }
  }, []);

  // ── Auto-request mic on first load (browser shows its own popup) ─
  useEffect(() => {
    enableMic();
  }, []);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const convId = conversationIdRef.current;
    if (!text.trim() || !convId) return;

    stop();
    const userMsg = text.trim();
    setInput("");

    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: userMsg }]);
    setOrbState("thinking");

    const asstMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: asstMsgId, role: "assistant", content: "" }]);

    try {
      const BASE = import.meta.env.BASE_URL;
      const response = await fetch(
        `${BASE}api/openai/conversations/${convId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: userMsg }),
        }
      );
      if (!response.body) throw new Error("No body");

      setOrbState("speaking");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          for (const line of decoder.decode(value, { stream: true }).split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullResponse += data.content;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === asstMsgId
                        ? { ...m, content: m.content + data.content }
                        : m
                    )
                  );
                }
              } catch { /* partial */ }
            }
          }
        }
      }

      if (fullResponse.trim()) speak(fullResponse);

      queryClient.invalidateQueries({
        queryKey: getListOpenaiMessagesQueryKey(convId),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setOrbState("idle");
    }
  }, [queryClient, speak, stop]);

  // ── Wake word (only when mic enabled) ─────────────────────────
  const sendRef = useRef(sendMessage);
  useEffect(() => { sendRef.current = sendMessage; }, [sendMessage]);

  const { wakeState, liveTranscript, supported, forceActivate } = useWakeWord({
    enabled: micEnabled,
    onCommand: (t) => sendRef.current(t),
  });

  // ── Clap detection (reuses same stream) ───────────────────────
  const { clapState } = useClapDetect({
    enabled: micEnabled,
    stream: micStream,
    onDoubleClap: forceActivate,
  });

  // Mirror wake state → orb
  useEffect(() => {
    if (wakeState === "activated" || wakeState === "listening") {
      setOrbState("listening");
    }
  }, [wakeState]);

  // Show live transcript in input
  useEffect(() => {
    if (liveTranscript) setInput(liveTranscript);
  }, [liveTranscript]);

  // ── Init conversation ──────────────────────────────────────────
  useEffect(() => {
    const name =
      localStorage.getItem("jarvis_user_name") ||
      localStorage.getItem("jarviis_user_name");
    if (name) setUserName(name);

    (async () => {
      const stored =
        localStorage.getItem("jarvis_conversation_id") ||
        localStorage.getItem("jarviis_conversation_id");
      if (stored) {
        setConversationId(Number(stored));
      } else {
        const conv = await createConv.mutateAsync({
          data: { title: "JARVIS Session" },
        });
        setConversationId(conv.id);
        localStorage.setItem("jarvis_conversation_id", String(conv.id));
      }
    })();
  }, []);

  const { data: history } = useListOpenaiMessages(conversationId!, {
    query: {
      enabled: !!conversationId,
      queryKey: getListOpenaiMessagesQueryKey(conversationId!),
    },
  });

  useEffect(() => {
    if (history) {
      setMessages(
        history.map(m => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, [history]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isListening  = wakeState === "activated" || wakeState === "listening";
  const isProcessing = orbState === "thinking" || orbState === "speaking";

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const dateStr = now
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  return (
    <div className="h-screen w-full bg-[#020408] text-cyan-50 flex flex-col relative overflow-hidden font-mono select-none">
      <div className="hex-grid fixed inset-0 pointer-events-none z-0" />
      <ParticleBackground />

      {/* Scan line */}
      <motion.div
        className="fixed inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none z-[1]"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* ── Mic error banner (only if denied/blocked) ───────────── */}
      <AnimatePresence>
        {micError && (
          <motion.div
            key="mic-err"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-3 px-5 py-2 bg-red-950/90 border-b border-red-500/30 text-[10px] tracking-widest text-red-300 uppercase"
          >
            <span className="flex items-center gap-2">
              <MicOff size={12} />
              {micError}
            </span>
            <button
              onClick={enableMic}
              className="text-red-200 hover:text-white border border-red-500/40 px-3 py-1 hover:border-red-300 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}</AnimatePresence>

      {/* ── HUD Header ──────────────────────────────────────────── */}
      <div className="relative z-10 flex items-start justify-between px-6 pt-5 pb-3 border-b border-cyan-500/10">

        {/* Left panel */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <div className="text-[9px] tracking-[0.25em] text-cyan-600 uppercase">System Time</div>
          <div className="text-lg tracking-widest text-cyan-300 tabular-nums">{timeStr}</div>
          <div className="text-[9px] tracking-[0.2em] text-cyan-700">{dateStr}</div>
          <div className="mt-2 flex flex-col gap-0.5">
            <HudStat label="NEURAL CORE" value="ACTIVE" ok />
            <HudStat label="MEMORY"      value="SYNCED" ok />
            <HudStat
              label="VOICE"
              value={
                !micEnabled ? "DISABLED" :
                wakeState === "off" ? "OFF" :
                isListening ? "LISTENING" : "STANDBY"
              }
              ok={micEnabled && wakeState !== "off"}
            />
            <HudStat
              label="CLAP"
              value={
                clapState === "inactive" ? "OFF" :
                clapState === "clap1"    ? "1×…" :
                clapState === "activated"? "2×!" : "READY"
              }
              ok={clapState === "ready" || clapState === "clap1" || clapState === "activated"}
            />
          </div>
        </div>

        {/* Center orb */}
        <div className="flex flex-col items-center gap-3 flex-1">
          <div className="relative">
            <HudCorner position="tl" size={14} className="top-[-8px] left-[-8px]" />
            <HudCorner position="tr" size={14} className="top-[-8px] right-[-8px]" />
            <HudCorner position="bl" size={14} className="bottom-[-8px] left-[-8px]" />
            <HudCorner position="br" size={14} className="bottom-[-8px] right-[-8px]" />
            <Orb state={orbState} size="md" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="text-[9px] tracking-[0.4em] text-cyan-600 uppercase">Stark A.I.</div>
            <h1 className="text-2xl font-light tracking-[0.5em] text-white hud-glow">JARVIS</h1>
            <div className="flex items-center gap-2 text-[9px] tracking-[0.3em] text-cyan-400 uppercase">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                orbState === "idle"     ? "bg-cyan-400"   :
                orbState === "listening"? "bg-red-400"    :
                orbState === "thinking" ? "bg-violet-400" : "bg-cyan-300"
              }`} />
              {orbState === "idle"      ? "STANDBY"   :
               orbState === "listening" ? "LISTENING"  :
               orbState === "thinking"  ? "PROCESSING" : "RESPONDING"}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-1 min-w-[160px] items-end">
          <div className="text-[9px] tracking-[0.25em] text-cyan-600 uppercase">Neural Status</div>
          <div className="flex flex-col gap-0.5 items-end mt-1">
            <HudBar label="COGNITION" pct={94} />
            <HudBar label="RESPONSE"  pct={88} />
            <HudBar label="ACCURACY"  pct={97} />
          </div>
          <div className="mt-2 text-[9px] tracking-widest text-cyan-700">
            USER: <span className="text-cyan-400">{userName.toUpperCase()}</span>
          </div>
          {micEnabled && (
            <button
              onClick={() => {
                micStream?.getTracks().forEach(t => t.stop());
                setMicEnabled(false);
                setMicStream(null);
              }}
              className="text-[9px] tracking-widest text-cyan-900 hover:text-cyan-600 transition-colors mt-1 uppercase"
            >
              Disable Voice
            </button>
          )}
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      {messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 gap-3"
        >
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-3xl font-sans font-light text-cyan-100/80 tracking-wide"
          >
            {getGreeting()}, {userName}.
          </motion.p>
          <p className="text-[10px] tracking-[0.4em] text-cyan-600 uppercase">
            {micEnabled && supported
              ? 'Say "JARVIS" · Double clap · or type'
              : "Type a command below"}
          </p>
        </motion.div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-32 pb-40 z-10 no-scrollbar">
        <div className="max-w-3xl mx-auto flex flex-col gap-5 pt-5">
          {messages.map((m, idx) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start gap-3"}`}
            >
              {m.role === "assistant" && (
                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full border border-cyan-500/40 bg-cyan-950/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px #00D4FF" }} />
                </div>
              )}
              <div className={`relative px-5 py-3 max-w-[80%] leading-relaxed text-sm font-sans ${
                m.role === "user"
                  ? "hud-bubble-user rounded-2xl rounded-tr-none text-cyan-50"
                  : "hud-bubble-asst rounded-2xl rounded-tl-none text-cyan-100"
              }`}>
                {m.role === "assistant" && (
                  <>
                    <HudCorner position="tl" size={8} className="top-0 left-0" />
                    <HudCorner position="br" size={8} className="bottom-0 right-0" />
                  </>
                )}
                {m.content || (
                  <span className="flex gap-1 items-center">
                    {[0,1,2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
                      />
                    ))}
                  </span>
                )}
                {m.role === "assistant" && orbState === "speaking" && idx === messages.length - 1 && (
                  <div className="mt-2 flex gap-0.5 items-end h-3">
                    {[1,2,3,4,5,4,3].map((h, i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 bg-cyan-400 rounded-full"
                        animate={{ height: [`${h * 10}%`, "100%", `${h * 10}%`] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-[#020408] via-[#020408]/95 to-transparent px-6 pb-5 pt-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">

          {/* Status line */}
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.div key="ls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[9px] tracking-widest text-red-400 uppercase px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                {wakeState === "activated" ? "Wake word detected — speak now" : "Listening for command…"}
              </motion.div>
            ) : clapState === "clap1" ? (
              <motion.div key="c1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[9px] tracking-widest text-yellow-400 uppercase px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                One clap detected — clap again to activate
              </motion.div>
            ) : micEnabled && supported ? (
              <motion.div key="sb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[9px] tracking-widest text-cyan-700 uppercase px-1">
                <span className="w-1 h-1 rounded-full bg-cyan-700" />
                Say "JARVIS" or double clap to activate voice
              </motion.div>
            ) : !micEnabled ? (
              <motion.div key="nmic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[9px] tracking-widest text-cyan-800 uppercase px-1">
                <span className="w-1 h-1 rounded-full bg-cyan-900" />
                Voice disabled — type below or&nbsp;
                <button onClick={enableMic} className="text-cyan-600 hover:text-cyan-400 underline">enable</button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Input bar */}
          <div className="hud-input-bar rounded-sm flex items-center gap-3 px-4 py-2.5 relative">
            <HudCorner position="tl" size={10} className="top-0 left-0" />
            <HudCorner position="br" size={10} className="bottom-0 right-0" />

            <div className={`flex-shrink-0 transition-colors duration-300 ${
              isListening ? "text-red-400" : micEnabled ? "text-cyan-500" : "text-cyan-900"
            }`}>
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </div>

            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder={
                isListening ? "Listening…" :
                micEnabled && supported ? 'Say "JARVIS" · double clap · or type…' :
                "Type a command…"
              }
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-cyan-100 placeholder:text-cyan-900 font-sans text-sm"
            />

            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className="rounded-none bg-cyan-900/30 hover:bg-cyan-800/50 text-cyan-400 border border-cyan-500/30 w-8 h-8 flex-shrink-0"
            >
              <Send size={14} className={input.trim() && !isProcessing ? "text-cyan-300" : "text-cyan-900"} />
            </Button>
          </div>

          <div className="flex justify-between text-[8px] tracking-widest text-cyan-900 uppercase px-1">
            <span>J.A.R.V.I.S — Just A Rather Very Intelligent System</span>
            <span>v2.0 · STARK TECH</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HudStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[8px] tracking-widest uppercase">
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${ok ? "bg-cyan-400" : "bg-red-500"}`} />
      <span className="text-cyan-800">{label}</span>
      <span className={ok ? "text-cyan-400" : "text-red-400"}>{value}</span>
    </div>
  );
}

function HudBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-[8px] tracking-widest uppercase">
      <span className="text-cyan-800 w-20 text-right">{label}</span>
      <div className="w-20 h-px bg-cyan-950 relative">
        <div className="absolute inset-y-0 left-0 bg-cyan-500/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-cyan-600">{pct}%</span>
    </div>
  );
}
