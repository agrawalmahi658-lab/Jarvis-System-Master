import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Orb } from "@/components/orb";
import { ParticleBackground } from "@/components/particle-background";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send } from "lucide-react";
import { 
  useCreateOpenaiConversation, 
  useListOpenaiMessages, 
  getListOpenaiMessagesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Chat() {
  const [userName, setUserName] = useState("Guest");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [orbState, setOrbState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const createConv = useCreateOpenaiConversation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const name = localStorage.getItem("jarviis_user_name");
    if (name) setUserName(name);

    const initConversation = async () => {
      let storedId = localStorage.getItem("jarviis_conversation_id");
      if (storedId) {
        setConversationId(Number(storedId));
      } else {
        const conv = await createConv.mutateAsync({ data: { title: "JARVIIS Session" } });
        setConversationId(conv.id);
        localStorage.setItem("jarviis_conversation_id", String(conv.id));
      }
    };
    initConversation();
  }, []);

  const { data: history } = useListOpenaiMessages(conversationId!, {
    query: {
      enabled: !!conversationId,
      queryKey: getListOpenaiMessagesQueryKey(conversationId!)
    }
  });

  useEffect(() => {
    if (history) {
      setMessages(history.map(m => ({ id: String(m.id), role: m.role as any, content: m.content })));
    }
  }, [history]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId) return;

    const userMsg = input.trim();
    setInput("");
    
    const newMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: newMsgId, role: "user", content: userMsg }]);
    setOrbState("thinking");

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      const BASE = import.meta.env.BASE_URL;
      const response = await fetch(`${BASE}api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
      });

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
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  setMessages(prev => 
                    prev.map(m => 
                      m.id === assistantMsgId ? { ...m, content: m.content + data.content } : m
                    )
                  );
                }
              } catch (e) {
                // ignore parse error on partial chunks
              }
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(conversationId) });
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setOrbState("idle");
    }
  };

  return (
    <div className="h-screen w-full bg-[#030508] text-cyan-50 flex flex-col relative overflow-hidden font-sans">
      <ParticleBackground />

      {/* Top Header */}
      <div className="pt-8 pb-4 px-6 flex flex-col items-center justify-center z-10">
        <Orb state={orbState} size="sm" />
        <div className="mt-4 flex flex-col items-center">
          <h1 className="text-xl font-light tracking-[0.3em] text-white glow-cyan">JARVIIS</h1>
          <div className="text-cyan-400 text-[10px] tracking-widest font-mono flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ONLINE
          </div>
        </div>
      </div>

      {/* Greeting */}
      {messages.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0"
        >
          <h2 className="text-3xl font-light text-cyan-100 tracking-wide">Good Evening, {userName}.</h2>
          <p className="text-cyan-600/60 mt-2 tracking-widest text-sm uppercase">How can I assist you today?</p>
        </motion.div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-20 lg:px-40 pb-32 z-10 no-scrollbar">
        <div className="max-w-3xl mx-auto flex flex-col gap-6 pt-4">
          {messages.map((m) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={m.id} 
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start gap-4"}`}
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
                {m.content}
                
                {m.role === "assistant" && orbState === "speaking" && m.id === messages[messages.length - 1].id && (
                  <div className="mt-3 flex gap-1 items-center h-4 opacity-50">
                    {[1, 2, 3, 4, 5].map(i => (
                      <motion.div 
                        key={i}
                        className="w-1 bg-cyan-400 rounded-full"
                        animate={{ height: ["20%", "100%", "20%"] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
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

      {/* Bottom Input Area */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#030508] via-[#030508]/90 to-transparent z-20">
        <div className="max-w-3xl mx-auto relative">
          <div className="absolute -top-8 left-2 flex items-center gap-2 text-cyan-500/70 text-[10px] tracking-widest font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50" />
            WAKE WORD: ON
          </div>
          
          <div className="glass rounded-full flex items-center p-2 pl-4">
            <button className="text-cyan-500 hover:text-cyan-300 transition-colors">
              <Mic size={20} />
            </button>
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a command..."
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-cyan-50 placeholder:text-cyan-800"
            />
            <Button 
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="rounded-full bg-cyan-900/50 hover:bg-cyan-800/80 text-cyan-300 border border-cyan-500/30"
            >
              <Send size={18} className={input.trim() ? "glow-cyan" : ""} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
