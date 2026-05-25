import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Orb } from "@/components/orb";
import { ParticleBackground } from "@/components/particle-background";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send } from "lucide-react";
import { useWakeWord } from "@/hooks/use-wake-word";
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

export default function Chat() {
  const [userName, setUserName] = useState("Guest");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [orbState, setOrbState] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const createConv = useCreateOpenaiConversation();

  // Keep ref in sync so wake word callback always sees latest id
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // ── Send message ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const convId = conversationIdRef.current;
      if (!text.trim() || !convId) return;

      const userMsg = text.trim();
      setInput("");

      const newMsgId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        { id: newMsgId, role: "user", content: userMsg },
      ]);
      setOrbState("thinking");

      const assistantMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "" },
      ]);

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

        if (!response.body) throw new Error("No response body");
        setOrbState("speaking");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.content) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + data.content }
                          : m
                      )
                    );
                  }
                } catch {
                  /* partial chunk */
                }
              }
            }
          }
        }

        queryClient.invalidateQueries({
          queryKey: getListOpenaiMessagesQueryKey(convId),
        });
      } catch (err) {
        console.error("send failed", err);
      } finally {
        setOrbState("idle");
      }
    },
    [queryClient]
  );

  // ── Wake word hook ────────────────────────────────────────────
  const { wakeState, liveTranscript, supported, turnOff, turnOn } =
    useWakeWord({
      onCommand: sendMessage,
    });

  // Mirror wake state → orb state
  useEffect(() => {
    if (wakeState === "activated" || wakeState === "listening") {
      setOrbState("listening");
    } else if (orbState === "listening") {
      // only reset if nothing else is in progress
      setOrbState("idle");
    }
  }, [wakeState]);

  // Fill input box with live voice transcript
  useEffect(() => {
    if (liveTranscript) setInput(liveTranscript);
  }, [liveTranscript]);

  // ── Init conversation ─────────────────────────────────────────
  useEffect(() => {
    const name = localStorage.getItem("jarviis_user_name");
    if (name) setUserName(name);

    const init = async () => {
      const stored = localStorage.getItem("jarviis_conversation_id");
      if (stored) {
        setConversationId(Number(stored));
      } else {
        const conv = await createConv.mutateAsync({
          data: { title: "JARVIIS Session" },
        });
        setConversationId(conv.id);
        localStorage.setItem("jarviis_conversation_id", String(conv.id));
      }
    };
    init();
  }, []);

  // ── Load history ──────────────────────────────────────────────
  const { data: history } = useListOpenaiMessages(conversationId!, {
    query: {
      enabled: !!conversationId,
      queryKey: getListOpenaiMessagesQueryKey(conversationId!),
    },
  });

  useEffect(() => {
    if (history) {
      setMessages(
        history.map((m) => ({
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

  const handleSend = () => sendMessage(input);

  const isListening = wakeState === "activated" || wakeState === "listening";
  const isProcessing = orbState === "thinking" || orbState === "speaking";

  return (
    <div className="h-screen w-full bg-[#030508] text-cyan-50 flex flex-col relative overflow-hidden font-sans">
      <ParticleBackground />

      {/* Header */}
      <div className="pt-8 pb-4 px-6 flex flex-col items-center z-10">
        <Orb state={orbState} size="sm" />
        <div className="mt-4 flex flex-col items-center">
          <h1 className="text-xl font-light tracking-[0.3em] text-white glow-cyan">
            JARVIIS
          </h1>
          <div className="text-cyan-400 text-[10px] tracking-widest font-mono flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ONLINE
          </div>
        </div>
      </div>

      {/* Empty state greeting */}
      {messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0"
        >
          <h2 className="text-3xl font-light text-cyan-100 tracking-wide">
            {getGreeting()}, {userName}.
          </h2>
          <p className="text-cyan-600/60 mt-2 tracking-widest text-sm uppercase">
            How can I assist you today?
          </p>
          <motion.p
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-cyan-700/50 mt-4 text-xs tracking-widest font-mono"
          >
            {supported ? 'Say "JARVIS" to begin' : "Type a message below"}
          </motion.p>
        </motion.div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-20 lg:px-40 pb-40 z-10 no-scrollbar">
        <div className="max-w-3xl mx-auto flex flex-col gap-6 pt-4">
          {messages.map((m) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start gap-4"
              }`}
            >
              {m.role === "assistant" && (
                <div className="mt-1 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 glow-cyan animate-pulse" />
                  </div>
                </div>
              )}
              <div
                className={`px-5 py-4 rounded-2xl max-w-[85%] leading-relaxed ${
                  m.role === "user"
                    ? "bg-cyan-950/40 border border-cyan-800/50 rounded-tr-sm text-cyan-50"
                    : "glass rounded-tl-sm text-cyan-100"
                }`}
              >
                {m.content || (
                  <span className="opacity-30 text-sm animate-pulse">
                    thinking…
                  </span>
                )}
                {m.role === "assistant" &&
                  orbState === "speaking" &&
                  m.id === messages[messages.length - 1].id && (
                    <div className="mt-3 flex gap-1 items-end h-4 opacity-50">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-cyan-400 rounded-full"
                          animate={{ height: ["20%", "100%", "20%"] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
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

      {/* Bottom input bar */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#030508] via-[#030508]/90 to-transparent z-20">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">

          {/* Status bar */}
          <div className="flex items-center justify-between px-2 min-h-[18px]">
            <AnimatePresence mode="wait">
              {isListening ? (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-[10px] font-mono tracking-widest"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  <span className="text-red-400 uppercase">
                    {wakeState === "activated" ? "Wake word detected — listening…" : "Listening for command…"}
                  </span>
                </motion.div>
              ) : wakeState === "standby" && supported ? (
                <motion.div
                  key="standby"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-cyan-600/50"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600/50" />
                  WAKE WORD: ON — say "JARVIS"
                </motion.div>
              ) : wakeState === "off" ? (
                <motion.div
                  key="off"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-cyan-900"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-900" />
                  WAKE WORD: OFF
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Toggle wake word on/off */}
            {supported && (
              <button
                onClick={wakeState === "off" ? turnOn : turnOff}
                className="text-[10px] font-mono tracking-widest text-cyan-700 hover:text-cyan-400 transition-colors ml-auto"
              >
                {wakeState === "off" ? "ENABLE WAKE WORD" : "DISABLE"}
              </button>
            )}
          </div>

          {/* Input row */}
          <div className="glass rounded-full flex items-center p-2 pl-5 gap-2">
            {/* Mic indicator — visual only, wake word is always-on */}
            <div
              className={`flex-shrink-0 transition-all duration-300 ${
                isListening
                  ? "text-red-400 scale-110"
                  : supported
                  ? "text-cyan-600"
                  : "text-cyan-900"
              }`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </div>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSend()
              }
              placeholder={
                isListening
                  ? "Listening…"
                  : supported
                  ? 'Say "JARVIS" or type here…'
                  : "Type a message…"
              }
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-cyan-50 placeholder:text-cyan-800"
            />

            <Button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className="rounded-full bg-cyan-900/50 hover:bg-cyan-800/80 text-cyan-300 border border-cyan-500/30 flex-shrink-0"
            >
              <Send
                size={18}
                className={input.trim() && !isProcessing ? "glow-cyan" : "opacity-40"}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
