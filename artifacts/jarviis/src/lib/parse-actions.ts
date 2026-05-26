export type JarvisAction =
  | { type: "open";   url: string   }
  | { type: "search"; query: string }
  | { type: "mode";   mode: string  };

export type SmartMode =
  | "focus" | "coding" | "study" | "movie"
  | "gaming" | "sleep" | "work" | null;

const ACTION_RE = /\[JARVIS:(open|search|mode):([^\]]+)\]/g;

/** Strip action tags from text and return parsed actions */
export function parseAndStrip(text: string): { clean: string; actions: JarvisAction[] } {
  const actions: JarvisAction[] = [];
  const clean = text
    .replace(ACTION_RE, (_, type: string, value: string) => {
      const v = value.trim();
      if      (type === "open")   actions.push({ type: "open",   url:   v });
      else if (type === "search") actions.push({ type: "search", query: v });
      else if (type === "mode")   actions.push({ type: "mode",   mode:  v.toLowerCase() });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")  // collapse extra blank lines left behind
    .trim();
  return { clean, actions };
}

/** Execute open / search actions immediately (browser side-effects) */
export function executeActions(actions: JarvisAction[]): SmartMode | null {
  let newMode: SmartMode | null = null;
  for (const a of actions) {
    if (a.type === "open") {
      window.open(a.url, "_blank", "noopener,noreferrer");
    } else if (a.type === "search") {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(a.query)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (a.type === "mode") {
      newMode = a.mode as SmartMode;
    }
  }
  return newMode;
}

export const MODE_META: Record<
  Exclude<SmartMode, null>,
  { label: string; color: string; hud: string; desc: string }
> = {
  focus:  { label: "FOCUS",  color: "#00D4FF", hud: "text-cyan-300",   desc: "Distraction-free. All systems silent." },
  coding: { label: "CODING", color: "#A855F7", hud: "text-purple-400",  desc: "Dev environment ready. VS Code opened." },
  study:  { label: "STUDY",  color: "#F59E0B", hud: "text-yellow-400",  desc: "Study mode active. Stay sharp." },
  movie:  { label: "MOVIE",  color: "#EF4444", hud: "text-red-400",     desc: "Lights down. Netflix opened." },
  gaming: { label: "GAMING", color: "#F97316", hud: "text-orange-400",  desc: "Game on. Performance mode." },
  sleep:  { label: "SLEEP",  color: "#3B82F6", hud: "text-blue-400",    desc: "Sleep mode. Rest well, sir." },
  work:   { label: "WORK",   color: "#10B981", hud: "text-emerald-400", desc: "Work mode. Let's execute." },
};
