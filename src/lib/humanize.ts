// Humanization pipeline replicating lynote-ai/humanize-text
// EN → ZH (Groq 8B fast) → JA (Groq 8B fast) → FI (Google Translate) → EN (Google Translate) → Polish (Groq 70B)
// 100% FREE — uses Groq free tier + Google Translate free endpoint

interface HumanizeStep { name: string; output: string; }
export interface HumanizeResult { result: string; steps: HumanizeStep[]; processing_time_ms: number; }

// Retry wrapper for Groq rate limits
async function callGroqWithRetry(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  retries = 4
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set. Get your free key at console.groq.com");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 1.1,
        max_tokens: maxTokens,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    }

    const errText = await response.text();
    const errData = JSON.parse(errText).error ?? {};

    // Rate limit — extract wait time and retry
    if (response.status === 429 && attempt < retries) {
      const match = errData.message?.match(/try again in ([\d.]+)s/i);
      const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : (attempt + 1) * 6000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    throw new Error(`Groq API error: ${errText}`);
  }
  throw new Error("Groq rate limit: max retries exceeded");
}

// Fast model for translation rewrites (30,000 TPM limit)
function callFast(system: string, user: string, maxTok = 3000) {
  return callGroqWithRetry("llama-3.1-8b-instant", system, user, maxTok);
}

// High-quality model for final polish (12,000 TPM limit — only called once)
function callSmart(system: string, user: string, maxTok = 8000) {
  return callGroqWithRetry("llama-3.3-70b-versatile", system, user, maxTok);
}

async function googleTranslate(text: string, from: string, to: string): Promise<string> {
  // Split into smaller chunks to avoid URL length limits
  const MAX = 1800;
  if (text.length <= MAX) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Google Translate error: ${res.status}`);
    const data = await res.json();
    return data[0].map((s: [string]) => s[0] ?? "").join("");
  }

  // Chunk and translate
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > MAX && buf) { parts.push(buf); buf = s; }
    else buf += s;
  }
  if (buf) parts.push(buf);

  const translated = await Promise.all(parts.map((p) => googleTranslate(p, from, to)));
  return translated.join(" ");
}

function chunkText(text: string, maxChars = 1400): string[] {
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

async function processChunk(text: string): Promise<{ zh: string; ja: string; fi: string; en: string }> {
  // EN → ZH
  const zh = await callFast(
    "You are a professional Chinese writer. Rewrite the given English text in fluent, natural Simplified Chinese. Preserve ALL information and structure. Output ONLY the Chinese text, nothing else.",
    text,
    2000
  );

  // ZH → JA
  const ja = await callFast(
    "You are a professional Japanese writer. Rewrite the given Chinese text in fluent, natural Japanese. Preserve ALL information and structure. Output ONLY the Japanese text, nothing else.",
    zh,
    2000
  );

  // JA → FI (Google Translate — free, no rate limit)
  const fi = await googleTranslate(ja, "ja", "fi");

  // FI → EN (Google Translate — free, no rate limit)
  const en = await googleTranslate(fi, "fi", "en");

  return { zh, ja, fi, en };
}

export async function humanizeText(text: string): Promise<HumanizeResult> {
  const start = Date.now();
  const chunks = chunkText(text, 1400);
  const steps: HumanizeStep[] = [];

  let allZh = "", allJa = "", allFi = "", allEn = "";

  // Process chunks sequentially to avoid rate limits
  for (const chunk of chunks) {
    const { zh, ja, fi, en } = await processChunk(chunk);
    allZh += (allZh ? "\n\n" : "") + zh;
    allJa += (allJa ? "\n\n" : "") + ja;
    allFi += (allFi ? "\n\n" : "") + fi;
    allEn += (allEn ? "\n\n" : "") + en;
  }

  steps.push({ name: "EN→ZH (Llama 8B Rewrite)", output: allZh });
  steps.push({ name: "ZH→JA (Llama 8B Rewrite)", output: allJa });
  steps.push({ name: "JA→FI (Google Translate)", output: allFi });
  steps.push({ name: "FI→EN (Google Translate)", output: allEn });

  // Final polish with 70B model — called once, so well within limits
  const polished = await callSmart(
    "You are an expert English editor. The text below was passed through Chinese, Japanese, and Finnish translations and has translation artifacts. Rewrite it as perfectly natural, fluent English. Keep ALL information exactly as provided — no additions, no removals. Output only the final article.",
    `Restore this to natural English:\n\n${allEn}`,
    8000
  );

  steps.push({ name: "Final Polish (Llama 70B)", output: polished });

  return { result: polished, steps, processing_time_ms: Date.now() - start };
}
