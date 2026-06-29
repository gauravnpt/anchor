// Article generation via Groq (free tier) using Llama 3.3 70B

export interface ArticleOptions {
  keyword: string;
  references: string[];
  length: "short" | "medium" | "long";
  style: "blog" | "news" | "thought-leadership" | "how-to" | "listicle";
  audience: string;
  tone: "professional" | "casual" | "authoritative" | "conversational";
}

const LENGTH_WORDS = {
  short: "800-1000",
  medium: "1500-2000",
  long: "2500-3500",
};

const STYLE_DESC = {
  blog: "engaging blog post",
  news: "news-style article",
  "thought-leadership": "thought leadership piece",
  "how-to": "how-to guide",
  listicle: "listicle (numbered list article)",
};

async function callGroq(systemPrompt: string, userMessage: string, maxTokens = 8192): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set. Get your free key at console.groq.com");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateArticle(options: ArticleOptions): Promise<string> {
  const { keyword, references, length, style, audience, tone } = options;

  const refsBlock =
    references.length > 0
      ? `\n\nREFERENCE MATERIAL (use these for facts, context, and insights):\n${references.map((r, i) => `[REF ${i + 1}]:\n${r}`).join("\n\n---\n\n")}`
      : "";

  const userMessage = `Write a comprehensive, well-researched ${STYLE_DESC[style]} about: "${keyword}"

TARGET AUDIENCE: ${audience || "general readers"}
TONE: ${tone}
LENGTH: ${LENGTH_WORDS[length]} words
${refsBlock}

WRITING REQUIREMENTS:
- Write in a natural, human voice — varied sentence lengths, occasional colloquialisms where appropriate
- Include a compelling headline (H1)
- Use proper subheadings (H2, H3) to structure the content
- Include relevant statistics, examples, and expert insights
- Write flowing paragraphs — avoid bullet-point overuse
- Add a strong introduction that hooks the reader
- Include a conclusion with a clear takeaway or call-to-action
- Naturally weave in the keyword and related terms throughout
- Make it genuinely useful and informative

FORMAT: Use markdown formatting (# for H1, ## for H2, ### for H3, **bold** for emphasis)

Write the complete article now:`;

  return callGroq(
    `You are a real human writer with 15 years of experience — not an AI. Write detailed, factual, genuinely useful articles.

Write like a person, not a template. That means: vary sentence length a lot (some short, some long), use contractions (don't, it's, you'll), start the odd sentence with "And" or "But", and let a little personality and opinion show. Avoid corporate AI filler words completely: never use delve, leverage, utilize, robust, seamless, pivotal, realm, tapestry, intricate, foster, harness, navigate, landscape, vibrant, holistic, multifaceted, "it's important to note", or "in today's world". Don't overuse formal transitions like "moreover" or "furthermore". No em-dashes. Use straight quotes. Headings in sentence case.`,
    userMessage,
    8000
  );
}

export { callGroq };
