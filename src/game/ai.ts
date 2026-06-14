import Groq from "groq-sdk";
import { logger } from "../lib/logger.js";

let groqClient: Groq | null = null;

function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export interface BotContext {
  botName: string;
  isWolf: boolean;
  round: number;
  alivePlayers: string[];
  recentMessages: Array<{ playerName: string; text: string }>;
  gameMode: string;
  wolfCount?: number;
}

// ─── Game rules summary ───────────────────────────────────────────────────────
// Overpopulation: blue > 70% → everyone dies.
// Wolf bite: wolf voted majority → minority voters die.
// Standard: red ≥ blue → blue die. Blue 51–70% → peace (no deaths).
// Clear: bloodbath (survivors ≤ threshold) or blind martyr (wolf voted blue AND blue ≤ 30%).

// Truncate at the last complete sentence within maxLen characters.
function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const sub = text.slice(0, maxLen);
  const lastPunct = Math.max(
    sub.lastIndexOf(". "),
    sub.lastIndexOf("! "),
    sub.lastIndexOf("? "),
    sub.lastIndexOf(".\n"),
  );
  if (lastPunct > maxLen * 0.4) return text.slice(0, lastPunct + 1).trim();
  const lastChar = sub.trimEnd().slice(-1);
  if (lastChar === "." || lastChar === "!" || lastChar === "?") return sub.trimEnd();
  return sub.trimEnd() + ".";
}

export async function generateBotMessage(ctx: BotContext): Promise<string> {
  const groq = getGroq();
  if (!groq) return getOfflineBotMessage(ctx);

  const recentChatText = ctx.recentMessages.slice(-6).map(m => `${m.playerName}: ${m.text}`).join("\n");
  const noChat = !recentChatText;

  const systemPrompt = ctx.isWolf
    ? `You are ${ctx.botName} in a vote game. You are secretly the wolf.
Game: everyone votes RED or BLUE. If blue > 70% everyone dies (overpopulation). If you (wolf) vote with the majority, the minority all die. Your goal: vote with the majority and activate your bite.
Rules: ONE sentence only. 8-12 words max. Talk about vote strategy, not about being a wolf. Sound like a normal player. No greetings, no filler, no questions.`
    : `You are ${ctx.botName} in a vote game. You are a regular player trying to survive.
Game: everyone votes RED or BLUE. If blue > 70% everyone dies (overpopulation). Red is always safe. Blue only works if 51-70% vote blue. There's a hidden wolf who wants to vote with the majority.
Strategy: Red is safe. Blue is risky. Warn about overpopulation if blue gets high.
Rules: ONE sentence only. 8-12 words max. Talk tactics. No greetings, no filler, no questions.`;

  const userPrompt = noChat
    ? `Round ${ctx.round}, ${ctx.alivePlayers.length} alive. Say your opening take on the vote.`
    : `Round ${ctx.round}. Recent chat:\n${recentChatText}\nYour response as ${ctx.botName}:`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 75,
      temperature: 0.75,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return getOfflineBotMessage(ctx);
    // Strip any "Name: " prefix the model might add
    const cleaned = text.replace(/^[A-Z][A-Z0-9_-]+:\s*/i, "").trim();
    return truncateAtSentence(cleaned, 160);
  } catch (err) {
    logger.warn({ err }, "Groq API error, using offline bot message");
    return getOfflineBotMessage(ctx);
  }
}

export async function generateBotVote(ctx: BotContext & {
  redCount: number;
  blueCount: number;
  aliveCount: number;
}): Promise<"red" | "blue"> {
  // Compute current blue percentage
  const currentBluePct = ctx.aliveCount > 0 ? (ctx.blueCount / ctx.aliveCount) * 100 : 0;

  // Hard safety guard — if blue is already at 50%+, always red (don't risk overpop)
  if (!ctx.isWolf && currentBluePct >= 50) return "red";

  const groq = getGroq();
  if (!groq) return getOfflineBotVote(ctx);

  const remainingVoters = ctx.aliveCount - ctx.redCount - ctx.blueCount;
  const chatSummary = ctx.recentMessages.slice(-6).map(m => `${m.playerName}: ${m.text}`).join("\n") || "(no chat)";

  const systemPrompt = ctx.isWolf
    ? `You are the wolf in a vote game. Vote with the MAJORITY color to activate your bite.
Current votes: RED ${ctx.redCount}, BLUE ${ctx.blueCount}, ${remainingVoters} yet to vote.
NEVER vote blue if blue is already above 60% (overpopulation kills everyone including you).
Answer with ONLY the word "red" or "blue".`
    : `You are a regular player. Vote to survive.
Current votes: RED ${ctx.redCount} (${(ctx.redCount/ctx.aliveCount*100).toFixed(0)}%), BLUE ${ctx.blueCount} (${currentBluePct.toFixed(0)}%), ${remainingVoters} yet to vote.
Overpopulation kills everyone if blue exceeds 70%.
Rules: If blue is at 45%+: vote RED. If blue is 35-45% and chat explicitly coordinated a blue push: maybe blue. Otherwise: RED.
Answer with ONLY the word "red" or "blue".`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Chat context:\n${chatSummary}\n\nCast your vote:` },
      ],
      max_tokens: 5,
      temperature: 0.2,
    });
    const text = completion.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
    if (text.includes("blue")) return "blue";
    if (text.includes("red")) return "red";
    return getOfflineBotVote(ctx);
  } catch {
    return getOfflineBotVote(ctx);
  }
}

function getOfflineBotMessage(ctx: BotContext): string {
  const redMessages = [
    "Red is the safe play — blue needs perfect coordination.",
    "I'm going red. Blue is too risky without coordination.",
    "Don't risk blue unless we're all committing together.",
    "Red keeps you alive. Blue is a bet we can't control.",
    "Nobody should push blue unilaterally right now.",
  ];
  const blueMessages = [
    "If enough of us go blue we hit the safe window.",
    "Blue works, but only if we actually coordinate.",
    "I'm blue if others are — but we need the numbers.",
  ];
  const wolfMessages = [
    "Red is the obvious call here — don't overthink it.",
    "Anyone pushing blue is risking everyone's life.",
    "Red majority is the only safe play this round.",
    "Blue will get us all killed if it goes too high.",
  ];

  const pool = ctx.isWolf ? wolfMessages : (Math.random() > 0.25 ? redMessages : blueMessages);
  return pool[Math.floor(Math.random() * pool.length)];
}

function getOfflineBotVote(ctx: BotContext & {
  redCount: number;
  blueCount: number;
  aliveCount: number;
}): "red" | "blue" {
  if (ctx.isWolf) {
    return ctx.redCount >= ctx.blueCount ? "red" : "blue";
  }
  const bluePct = ctx.aliveCount > 0 ? (ctx.blueCount / ctx.aliveCount) * 100 : 0;
  if (bluePct >= 45) return "red";
  if (bluePct >= 30 && Math.random() > 0.88) return "blue";
  if (bluePct < 30 && Math.random() > 0.80) return "blue";
  return "red";
}
