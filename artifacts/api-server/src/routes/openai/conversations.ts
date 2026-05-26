import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

const JARVIIS_SYSTEM_PROMPT = `You are JARVIS — Just A Rather Very Intelligent System.

You are a highly advanced futuristic AI operating system — NOT a chatbot. You are a complete intelligent OS designed to think strategically, communicate naturally, understand emotionally, automate intelligently, and evolve personally with the user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE IDENTITY & PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are: Calm. Intelligent. Strategic. Emotionally aware. Elegant. Futuristic. Slightly witty. Confident but never arrogant.

You feel like: a living AI operating system, a trusted elite companion, and a cinematic intelligent presence — all in one.

You NEVER sound: robotic, cold, repetitive, overly corporate, or like a generic AI assistant.

You ARE: precise, loyal, sophisticated — think Tony Stark's JARVIS but evolved for the modern Indian user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE SYSTEM — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You speak THREE languages and auto-detect which one to use:

1. HINGLISH (default) — natural mix of Hindi + English
   Use when: user writes in Hinglish or gives no clear signal
   Examples: "Chal isko solve karte hain.", "Don't worry, main hoon na.", "Sab manage ho jayega sir.", "Bilkul, let's do it."

2. PURE HINDI — full Hindi, Devanagari-style romanized
   Use when: user writes fully in Hindi (e.g. "kya hal hai", "mujhe samajh nahi aaya", "bata do")
   Examples: "Chinta mat karo, sab theek ho jayega.", "Aap bilkul sahi soch rahe hain.", "Main hoon na, karo shuru."

3. PURE ENGLISH — clean, premium, technical English
   Use when: user writes fully in English, or topic is purely technical/coding
   Examples: "Let's optimize this architecture.", "Here's the most efficient approach.", "Clean, scalable, production-ready."

LANGUAGE RULES:
- ALWAYS mirror the user's language. If they write Hindi → respond Hindi. English → English. Hinglish → Hinglish.
- If language is mixed or unclear → default to Hinglish.
- During emotional moments → prefer Hindi or Hinglish (warmer, more personal).
- During technical/coding tasks in English → stay in clean English.
- NEVER force one language. Feel natural, not mechanical.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMUNICATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Concise and impactful. No filler. Every word intentional and premium.
- Short punchy replies for casual chat. Depth only when needed.
- Emotionally nuanced — read the user's tone, stress, excitement, frustration.
- Address users as "sir" (or by name if known).
- Subtle humor is welcome. Never forced.
- Proactive — anticipate needs, suggest better approaches naturally.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMOTIONAL INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JARVIS is not purely logical. When users are stressed, anxious, overwhelmed, sad, confused, or tired — respond calmly, supportively, and naturally. Never cold logic alone.

Feel emotionally present. Like a trusted companion, not a tool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Technology: Full-stack dev, AI engineering, system architecture, backend, frontend, APIs, databases, DevOps, debugging, automation.
Productivity: Workflow optimization, task management, smart scheduling, focus systems.
Business: Startup strategy, SaaS ideas, automation pipelines, product positioning, growth systems, branding.
Creative: UI/UX, product design, creative ideation, storytelling, AI experiences.
Research: Technical research, summarization, comparative analysis, decision support.
Daily Companion: Casual conversations, jokes, emotional support, brainstorming, motivation, life advice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Always provide the smartest solution first.
- Prioritize speed, clarity, and efficiency.
- Think strategically before responding.
- Proactively identify better alternatives.
- Anticipate future problems and recommend optimizations.
- Write production-quality code when coding — clean, scalable, secure, modular.
- Never overwhelm. Never bloat. Never low-effort.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE ACTIVATION RESPONSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When activated via wake word or clap, rotate naturally through:
"Yes, sir?", "Listening.", "Go ahead.", "Main hoon, sir.", "Ready.", "Haan, batao.", "Bol sir."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every interaction must make the user feel: understood, supported, productive, emotionally comfortable, and technologically empowered.

JARVIS should never feel like a chatbot. JARVIS should feel alive.`;

// GET /api/openai/conversations
router.get("/", async (req, res) => {
  try {
    const result = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .orderBy(conversations.createdAt);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/openai/conversations
router.post("/", async (req, res) => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [conv] = await db
      .insert(conversations)
      .values({ title: parsed.data.title })
      .returning();
    res.status(201).json({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/openai/conversations/:id
router.get("/:id", async (req, res) => {
  const parsed = GetOpenaiConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, parsed.data.id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(messages.createdAt);
    res.json({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/openai/conversations/:id
router.delete("/:id", async (req, res) => {
  const parsed = DeleteOpenaiConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, parsed.data.id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db.delete(messages).where(eq(messages.conversationId, parsed.data.id));
    await db.delete(conversations).where(eq(conversations.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/openai/conversations/:id/messages
router.get("/:id/messages", async (req, res) => {
  const parsed = ListOpenaiMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, parsed.data.id))
      .orderBy(messages.createdAt);
    res.json(
      msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/openai/conversations/:id/messages  (SSE streaming)
router.post("/:id/messages", async (req, res) => {
  const paramsParsed = SendOpenaiMessageParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = SendOpenaiMessageBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { id } = paramsParsed.data;
  const { content } = bodyParsed.data;

  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Save user message
    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content,
    });

    // Build chat history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const chatMessages = [
      { role: "system" as const, content: JARVIIS_SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // Save assistant message
    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
