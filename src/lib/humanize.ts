// Anchor Humanization Engine v2
// Multi-pass anti-detector humanizer built on real perplexity/burstiness techniques.
// Replaces the old translation-chain (which produced broken English AND failed detectors).
//
// Pipeline:
//   1. Lexical pre-pass  — regex swap of AI "tell" words (raises perplexity)
//   2. Humanize pass 1   — aggressive structural rewrite (burstiness, voice, anti-patterns)
//   3. Humanize pass 2   — polish + intro rewrite + final tell-cleanup
//   4. Score             — honest heuristic AI-likelihood estimate

interface HumanizeStep { name: string; output: string; }
export interface HumanizeResult {
  result: string;
  steps: HumanizeStep[];
  processing_time_ms: number;
  ai_score: number;        // 0-100, lower = more human
  score_breakdown: { label: string; value: string }[];
}

// ── AI "tell" word lists (from the humanization playbook) ──────────────────────
const TELL_REPLACEMENTS: Record<string, string> = {
  "delve into": "dig into", "delve": "dig into", "delving": "digging into",
  "leverage": "use", "leveraging": "using", "leverages": "uses",
  "utilize": "use", "utilizing": "using", "utilizes": "uses", "utilization": "use",
  "facilitate": "help", "facilitates": "helps", "facilitating": "helping",
  "underscore": "highlight", "underscores": "highlights", "underscoring": "highlighting",
  "streamline": "simplify", "streamlines": "simplifies", "streamlined": "simplified",
  "harness": "tap into", "harnessing": "tapping into",
  "pivotal": "key", "robust": "solid", "seamless": "smooth", "seamlessly": "smoothly",
  "realm": "area", "tapestry": "mix", "intricate": "complex", "meticulous": "careful",
  "meticulously": "carefully", "cornerstone": "foundation", "testament": "sign",
  "showcase": "show", "showcases": "shows", "showcasing": "showing",
  "in order to": "to", "due to the fact that": "because",
  "it is important to note that": "", "it's important to note that": "",
  "it is worth noting that": "", "it's worth noting that": "",
  "in today's world": "", "in today's digital landscape": "", "in the realm of": "in",
  "when it comes to": "with", "at the end of the day": "ultimately",
  "plays a crucial role": "matters", "plays a vital role": "matters",
};

// Transition words to thin out (the #1 detector tell)
const FORMAL_TRANSITIONS = [
  "moreover", "furthermore", "additionally", "consequently", "subsequently",
  "nevertheless", "notably", "importantly", "interestingly",
];

function lexicalPrePass(text: string): { output: string; swaps: number } {
  let out = text;
  let swaps = 0;
  for (const [bad, good] of Object.entries(TELL_REPLACEMENTS)) {
    const re = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, (m) => {
      swaps++;
      if (good === "") return "";
      // preserve capitalization of first letter
      return m[0] === m[0].toUpperCase() ? good.charAt(0).toUpperCase() + good.slice(1) : good;
    });
  }
  // tidy up spaces/punctuation left by deletions — WITHOUT collapsing newlines
  out = out
    .replace(/[ \t]{2,}/g, " ")          // collapse runs of spaces/tabs only
    .replace(/[ \t]+([.,;:])/g, "$1")    // remove space before punctuation
    .replace(/([.,;:])\1+/g, "$1")       // dedupe doubled punctuation
    .replace(/[ \t]+\n/g, "\n")          // trim trailing spaces on lines
    .replace(/\n{3,}/g, "\n\n");         // cap blank lines at one
  return { output: out, swaps };
}

// ── Groq call with retry ───────────────────────────────────────────────────────
async function callGroq(model: string, system: string, user: string, maxTok: number, temp: number, retries = 4): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set. Get your free key at console.groq.com");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: temp,
        max_tokens: maxTok,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }
    const errText = await res.text();
    if (res.status === 429 && attempt < retries) {
      const m = errText.match(/try again in ([\d.]+)s/i);
      const wait = m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : (attempt + 1) * 6000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Groq API error: ${errText}`);
  }
  throw new Error("Groq rate limit: max retries exceeded");
}

const SMART = "llama-3.3-70b-versatile";

// ── Humanization prompts ───────────────────────────────────────────────────────
const HUMANIZE_SYSTEM = `You are a human editor who rewrites AI-generated text so it reads exactly like a real person wrote it — and so it defeats AI detectors (GPTZero, QuillBot, Originality.ai, Turnitin).

AI detectors flag two things: LOW perplexity (predictable word choices) and LOW burstiness (sentences all the same length). Your job is to raise both while keeping every fact intact.

HARD RULES — follow all of them:

1. BURSTINESS. Wildly vary sentence length. Mix very short punchy sentences (3-5 words) with longer flowing ones (25+ words). Use the occasional one-word sentence. Allow deliberate fragments. Right.
2. START some sentences with "And", "But", "So", "Still", or "Here's the thing".
3. CONTRACTIONS everywhere: don't, won't, it's, they're, you'll, I've.
4. KILL these AI tell-words completely: delve, leverage, utilize, facilitate, underscore, streamline, robust, seamless, pivotal, realm, tapestry, intricate, meticulous, cornerstone, testament, showcase, foster, harness, navigate, landscape, vibrant, holistic, multifaceted.
5. LIMIT formal transitions (moreover, furthermore, additionally, consequently, thus, notably). Use at most one per few paragraphs. Prefer casual connectors: "also", "plus", "so", "but", "and honestly".
6. DELETE filler framing: "it's important to note", "it's worth noting", "plays a crucial role", "in today's world", "when it comes to".
7. NO em-dashes (—). Use periods, commas, or parentheses instead. Use straight quotes, not curly.
8. ELIMINATE these AI structures: "not X, but Y" parallel negation; rule-of-three lists (tricolons); rhetorical-question-then-answer; "serves as / features / boasts" (just say "is"/"has"); identical-length list items.
9. ACTIVE voice. Cut passive constructions.
10. ADD a human touch: a mild opinion ("which is honestly wild"), a concrete specific example, occasional first-person ("I've seen", "in my experience"). Leave one or two thoughts slightly unresolved instead of wrapping everything neatly.
11. Headings in sentence case, not Title Case.
12. Keep ALL facts, names, numbers, and the markdown structure (# headings, lists). Do not invent facts. Do not add meta-commentary. Output ONLY the rewritten article.`;

const POLISH_SYSTEM = `You are a sharp human copy editor doing a final pass. The text below has been humanized once. Now:

- Rewrite the FIRST paragraph from scratch so it has zero AI-opener feel (no "In today's", no "Imagine", no rhetorical question). Make it open like a real writer would — a specific statement, a small story, or a blunt claim.
- Hunt down any remaining AI tell-words (delve, leverage, utilize, robust, seamless, etc.) and replace them with plain words.
- Make sure sentence lengths still vary a lot (some very short, some long).
- Remove any em-dashes. Keep contractions.
- Keep every fact and all markdown structure.
- Output ONLY the final article, no commentary.`;

// ── Honest AI-likelihood scorer (heuristic) ────────────────────────────────────
function scoreAILikelihood(text: string): { score: number; breakdown: { label: string; value: string }[] } {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const words = text.toLowerCase().match(/\b[\w']+\b/g) ?? [];
  const wordCount = Math.max(words.length, 1);

  // 1. Sentence-length variance (burstiness). Higher variance = more human.
  const lengths = sentences.map((s) => (s.match(/\b\w+\b/g) ?? []).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(lengths.length, 1);
  const stdev = Math.sqrt(variance);
  // human stdev typically > 7; AI often < 4
  const burstinessPenalty = Math.max(0, 35 - Math.min(stdev, 12) * 2.9); // 0 (good) .. ~35 (bad)

  // 2. AI tell-word density
  const allTells = [...Object.keys(TELL_REPLACEMENTS), "foster", "navigate", "vibrant",
    "holistic", "multifaceted", "comprehensive", "crucial", "essential", "elevate", "empower"];
  let tellHits = 0;
  for (const t of allTells) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    tellHits += (text.match(re) || []).length;
  }
  const tellDensity = (tellHits / wordCount) * 1000; // hits per 1000 words
  const tellPenalty = Math.min(30, tellDensity * 6);

  // 3. Formal transition density
  let transHits = 0;
  for (const t of FORMAL_TRANSITIONS) {
    transHits += (text.match(new RegExp(`\\b${t}\\b`, "gi")) || []).length;
  }
  const transPenalty = Math.min(20, (transHits / wordCount) * 1000 * 8);

  // 4. Contraction presence (humans use them; absence is a tell)
  const contractions = (text.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/gi) || []).length;
  const contractionRate = (contractions / wordCount) * 1000;
  const contractionPenalty = contractionRate < 5 ? 12 : contractionRate < 12 ? 5 : 0;

  // 5. Em-dash / curly quote tells
  const emDashes = (text.match(/—/g) || []).length;
  const punctPenalty = Math.min(8, emDashes * 2);

  let score = burstinessPenalty + tellPenalty + transPenalty + contractionPenalty + punctPenalty;
  score = Math.max(2, Math.min(98, Math.round(score)));

  return {
    score,
    breakdown: [
      { label: "Sentence variety", value: stdev > 7 ? "High (human-like)" : stdev > 4.5 ? "Medium" : "Low" },
      { label: "AI tell-words", value: `${tellHits} found` },
      { label: "Formal transitions", value: `${transHits} found` },
      { label: "Contractions", value: contractionRate >= 12 ? "Natural" : contractionRate >= 5 ? "Some" : "Few" },
    ],
  };
}

// ── Chunking for long articles ─────────────────────────────────────────────────
function chunkText(text: string, maxChars = 4000): string[] {
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + p).length > maxChars && cur) { chunks.push(cur.trim()); cur = p; }
    else cur += (cur ? "\n\n" : "") + p;
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

export async function humanizeText(text: string): Promise<HumanizeResult> {
  const start = Date.now();
  const steps: HumanizeStep[] = [];

  // Pass 0: lexical pre-pass
  const { output: preCleaned, swaps } = lexicalPrePass(text);
  steps.push({ name: `Lexical pre-pass (${swaps} AI words swapped)`, output: preCleaned });

  // Pass 1: aggressive humanization (chunked for long articles)
  const chunks = chunkText(preCleaned, 4000);
  const pass1Parts: string[] = [];
  for (const chunk of chunks) {
    const out = await callGroq(SMART, HUMANIZE_SYSTEM, `Rewrite this to read as genuinely human-written:\n\n${chunk}`, 8000, 0.95);
    pass1Parts.push(out);
  }
  const pass1 = pass1Parts.join("\n\n");
  steps.push({ name: "Humanize pass 1 (burstiness + voice)", output: pass1 });

  // Pass 2: polish + intro rewrite (single pass over whole text, or first chunk if huge)
  const pass2 = await callGroq(SMART, POLISH_SYSTEM, `Final human polish:\n\n${pass1}`, 8000, 0.85);
  steps.push({ name: "Humanize pass 2 (intro rewrite + cleanup)", output: pass2 });

  // Final lexical cleanup — catch any tell-words the model reintroduced
  let current = lexicalPrePass(pass2).output;
  let { score, breakdown } = scoreAILikelihood(current);

  // Iterative hardening: keep rewriting until the score is low or we hit the cap.
  // Each round targets the specific weak signals the scorer flags.
  // Tunable via env so you can trade quality vs. token budget without code changes.
  // More rounds = lower score but more tokens used (matters on Groq's free daily cap).
  const TARGET = Number(process.env.HUMANIZE_TARGET_SCORE ?? 14);  // stop once score <= this
  const MAX_ROUNDS = Number(process.env.HUMANIZE_MAX_ROUNDS ?? 2); // extra hardening passes
  let best = current;
  let bestScore = score;

  for (let round = 1; round <= MAX_ROUNDS && bestScore > TARGET; round++) {
    const weak = scoreAILikelihood(best);
    const focus = weak.breakdown
      .filter((b) => /Low|Medium|[1-9]\d* found|Few|Some/.test(b.value))
      .map((b) => `${b.label}: ${b.value}`)
      .join("; ") || "general predictability";

    const harder = await callGroq(
      SMART,
      HUMANIZE_SYSTEM,
      `This text still reads slightly AI-generated (detector weak spots: ${focus}).
Rewrite it AGAIN and push harder:
- Make sentence lengths swing wildly — put a 3-word sentence right next to a 30-word one.
- Delete every remaining tell-word and every "X, Y, and Z" three-item list.
- Add one genuine human aside, opinion, or tiny specific detail.
- Keep all facts, names, numbers, and markdown headings intact.
Output ONLY the rewritten article:\n\n${best}`,
      8000,
      1.0
    );
    const cleaned = lexicalPrePass(harder).output;
    const res = scoreAILikelihood(cleaned);
    steps.push({ name: `Hardening round ${round} → ${res.score}% est.`, output: cleaned });

    // keep whichever version scores best (rewrites occasionally regress)
    if (res.score < bestScore) {
      best = cleaned;
      bestScore = res.score;
      breakdown = res.breakdown;
    }
  }

  return {
    result: best,
    steps,
    processing_time_ms: Date.now() - start,
    ai_score: bestScore,
    score_breakdown: breakdown,
  };
}
