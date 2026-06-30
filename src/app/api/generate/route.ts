import { NextRequest, NextResponse } from "next/server";
import { generateArticle, ArticleOptions } from "@/lib/claude";
import { humanizeText } from "@/lib/humanize";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, references, length, style, audience, tone } = body;

    if (!keyword?.trim()) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const options: ArticleOptions = {
      keyword: keyword.trim(),
      references: references || [],
      length: length || "medium",
      style: style || "blog",
      audience: audience || "general readers",
      tone: tone || "professional",
    };

    // Step 1: Generate raw article with Claude
    const rawArticle = await generateArticle(options);

    // Step 2: Humanize the article
    const humanized = await humanizeText(rawArticle);

    return NextResponse.json({
      success: true,
      article: humanized.result,
      rawArticle,
      steps: humanized.steps,
      processing_time_ms: humanized.processing_time_ms,
      word_count: humanized.result.split(/\s+/).filter(Boolean).length,
      ai_score: humanized.ai_score,
      detector: humanized.detector,
      score_breakdown: humanized.score_breakdown,
    });
  } catch (err: unknown) {
    console.error("Generate error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
