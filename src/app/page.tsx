"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Icons ─────────────────────────────────────────────────────────────────────
type IconProps = { className?: string; style?: React.CSSProperties };

function AnchorIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="8" x2="12" y2="22" />
      <path d="M5 15H2a10 10 0 0 0 20 0h-3" />
    </svg>
  );
}
function PlusIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function TrashIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
}
function CopyIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}
function CheckIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function DownloadIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function SpinnerIcon({ className, style }: IconProps) {
  return (
    <svg className={cn("animate-spin", className)} style={style} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function ShieldIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function ZapIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
}
function ArticleIcon({ className, style }: IconProps) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "idle" | "generating" | "humanizing" | "done" | "error";

interface GenerateResult {
  article: string;
  rawArticle: string;
  word_count: number;
  processing_time_ms: number;
  steps: { name: string; output: string }[];
  ai_score: number;
  score_breakdown: { label: string; value: string }[];
}

function scoreColor(score: number) {
  if (score <= 25) return { text: "#34d399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" };
  if (score <= 50) return { text: "#fbbf24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" };
  return { text: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)" };
}

// ── Lightweight markdown renderer ─────────────────────────────────────────────
function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const raw of lines) {
    let line = raw
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

    if (/^### /.test(line)) { if (inList) { result.push("</ul>"); inList = false; } result.push(`<h3>${line.slice(4)}</h3>`); }
    else if (/^## /.test(line)) { if (inList) { result.push("</ul>"); inList = false; } result.push(`<h2>${line.slice(3)}</h2>`); }
    else if (/^# /.test(line)) { if (inList) { result.push("</ul>"); inList = false; } result.push(`<h1>${line.slice(2)}</h1>`); }
    else if (/^[-*] /.test(line)) { if (!inList) { result.push("<ul>"); inList = true; } result.push(`<li>${line.slice(2)}</li>`); }
    else if (/^\d+\. /.test(line)) { if (!inList) { result.push("<ul>"); inList = true; } result.push(`<li>${line.replace(/^\d+\. /, "")}</li>`); }
    else if (/^> /.test(line)) { if (inList) { result.push("</ul>"); inList = false; } result.push(`<blockquote>${line.slice(2)}</blockquote>`); }
    else if (line.trim() === "---") { if (inList) { result.push("</ul>"); inList = false; } result.push("<hr/>"); }
    else if (line.trim() === "") { if (inList) { result.push("</ul>"); inList = false; } result.push(""); }
    else { if (inList) { result.push("</ul>"); inList = false; } result.push(`<p>${line}</p>`); }
  }
  if (inList) result.push("</ul>");
  return result.join("\n");
}

// ── SelectField ───────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: "#0d1526", borderColor: "#1e2d45", color: "#cbd5e1" }}
        className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#0d1526" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Progress Steps ────────────────────────────────────────────────────────────
function ProgressSteps({ step }: { step: Step }) {
  const steps = [
    { id: "generating", label: "Generating Article", sub: "Claude AI is researching and writing..." },
    { id: "humanizing", label: "Humanizing Content", sub: "Multi-pass anti-detector rewrite running..." },
    { id: "done", label: "Complete", sub: "Your article is ready" },
  ];
  const activeIdx = step === "generating" ? 0 : step === "humanizing" ? 1 : step === "done" ? 2 : -1;

  return (
    <div className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const isDone = activeIdx > i;
        const isActive = i === activeIdx;
        return (
          <div key={s.id} style={{
            borderColor: isActive ? "rgba(37,99,235,0.4)" : isDone ? "rgba(16,185,129,0.3)" : "#1e2d45",
            background: isActive ? "rgba(37,99,235,0.06)" : isDone ? "rgba(16,185,129,0.04)" : "rgba(13,21,38,0.5)"
          }} className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300">
            <div style={{
              background: isActive ? "rgba(37,99,235,0.2)" : isDone ? "rgba(16,185,129,0.2)" : "#1a2236",
              borderColor: isActive ? "rgba(37,99,235,0.5)" : isDone ? "rgba(16,185,129,0.5)" : "#1e2d45"
            }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border">
              {isActive ? <SpinnerIcon className="w-3.5 h-3.5 text-blue-400" /> :
               isDone ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> :
               <span className="text-xs text-slate-600">{i + 1}</span>}
            </div>
            <div>
              <p className={cn("text-sm font-medium", isActive ? "text-blue-300" : isDone ? "text-emerald-300" : "text-slate-600")}>{s.label}</p>
              {(isActive || isDone) && <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function AnchorApp() {
  const [keyword, setKeyword] = useState("");
  const [references, setReferences] = useState<string[]>([""]);
  const [length, setLength] = useState("medium");
  const [style, setStyle] = useState("blog");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("professional");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const addReference = () => setReferences((r) => [...r, ""]);
  const updateReference = (i: number, v: string) => setReferences((r) => r.map((x, j) => (j === i ? v : x)));
  const removeReference = (i: number) => setReferences((r) => r.filter((_, j) => j !== i));

  const generate = useCallback(async () => {
    if (!keyword.trim()) return;
    setStep("generating");
    setError("");
    setResult(null);

    try {
      const refs = references.filter((r) => r.trim());
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, references: refs, length, style, audience, tone }),
      });

      // Switch UI to humanizing while server processes
      setStep("humanizing");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResult(data);
      setStep("done");
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("error");
    }
  }, [keyword, references, length, style, audience, tone]);

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.article);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result.article], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${keyword.slice(0, 40).replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = step === "generating" || step === "humanizing";

  return (
    <div className="min-h-screen flex" style={{ background: "#0a0e1a" }}>
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 border-r flex flex-col" style={{ background: "#090d18", borderColor: "#1e2d45" }}>
        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: "#1e2d45" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2563eb" }}>
              <AnchorIcon className="text-white" style={{ width: "18px", height: "18px" }} />
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Anchor</span>
          </div>
          <p className="text-xs mt-2 leading-relaxed" style={{ color: "#64748b" }}>Human-grade content, every time.</p>
        </div>

        {/* Capabilities */}
        <div className="p-4 border-b" style={{ borderColor: "#1e2d45" }}>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>Capabilities</p>
          <div className="flex flex-col gap-2">
            {[
              { icon: <ZapIcon className="w-3.5 h-3.5" />, label: "AI Article Generation" },
              { icon: <ShieldIcon className="w-3.5 h-3.5" />, label: "Anti-detector humanizer" },
              { icon: <ArticleIcon className="w-3.5 h-3.5" />, label: "5 Writing Styles" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5" style={{ color: "#94a3b8" }}>
                <span style={{ color: "#60a5fa" }}>{item.icon}</span>
                <span className="text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="p-4 flex-1">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>How it works</p>
          <div className="flex flex-col gap-3">
            {[
              { n: "1", label: "Enter keyword", sub: "Your topic or target keyword" },
              { n: "2", label: "Add references", sub: "Paste articles for context" },
              { n: "3", label: "Generate", sub: "AI writes the researched draft" },
              { n: "4", label: "Humanize", sub: "Multi-pass anti-detector rewrite" },
            ].map((item) => (
              <div key={item.n} className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border" style={{ background: "#1a2236", borderColor: "#1e2d45" }}>
                  <span className="text-[10px]" style={{ color: "#64748b" }}>{item.n}</span>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "#cbd5e1" }}>{item.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#64748b" }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline badge */}
        <div className="p-4 border-t" style={{ borderColor: "#1e2d45" }}>
          <div className="rounded-lg p-3 border" style={{ background: "#0d1526", borderColor: "#1e2d45" }}>
            <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "#64748b" }}>Humanization Pipeline</p>
            <div className="flex items-center gap-1 flex-wrap">
              {["Swap", "Burst", "Voice", "Score"].map((lang, i, arr) => (
                <span key={`${lang}-${i}`} className="flex items-center gap-1">
                  <span className="text-[11px] font-mono font-bold" style={{ color: "#60a5fa" }}>{lang}</span>
                  {i < arr.length - 1 && <span className="text-[10px]" style={{ color: "#334155" }}>→</span>}
                </span>
              ))}
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: "#475569" }}>Perplexity + burstiness rewriting</p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-auto">
        {/* Header */}
        <header className="border-b px-8 py-4 shrink-0" style={{ background: "#090d18", borderColor: "#1e2d45" }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-white">New Article</h1>
              <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>Generate and humanize content in one click</p>
            </div>
            {result && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#94a3b8" }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#10b981" }}></span>
                {result.word_count.toLocaleString()} words · {Math.round(result.processing_time_ms / 1000)}s
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 px-8 py-6">
          <div className="max-w-3xl mx-auto flex flex-col gap-5">

            {/* ── Input Card ── */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: "#111827", borderColor: "#1e2d45" }}>
              <div className="p-6 border-b" style={{ borderColor: "#1e2d45" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "#e2e8f0" }}>Article Settings</h2>

                {/* Keyword */}
                <div className="flex flex-col gap-1.5 mb-5">
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#94a3b8" }}>Target Keyword *</label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && generate()}
                    placeholder="e.g. best practices for remote work in 2025"
                    style={{ background: "#0d1526", borderColor: "#1e2d45", color: "#e2e8f0" }}
                    className="border rounded-lg px-4 py-3 text-sm placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* Options grid */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <SelectField label="Article Length" value={length} onChange={setLength} options={[
                    { value: "short", label: "Short (800–1000 words)" },
                    { value: "medium", label: "Medium (1500–2000 words)" },
                    { value: "long", label: "Long (2500–3500 words)" },
                  ]} />
                  <SelectField label="Writing Style" value={style} onChange={setStyle} options={[
                    { value: "blog", label: "Blog Post" },
                    { value: "news", label: "News Article" },
                    { value: "thought-leadership", label: "Thought Leadership" },
                    { value: "how-to", label: "How-To Guide" },
                    { value: "listicle", label: "Listicle" },
                  ]} />
                  <SelectField label="Tone" value={tone} onChange={setTone} options={[
                    { value: "professional", label: "Professional" },
                    { value: "casual", label: "Casual & Friendly" },
                    { value: "authoritative", label: "Authoritative" },
                    { value: "conversational", label: "Conversational" },
                  ]} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#94a3b8" }}>Target Audience</label>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="e.g. marketing professionals"
                      style={{ background: "#0d1526", borderColor: "#1e2d45", color: "#e2e8f0" }}
                      className="border rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* References */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#94a3b8" }}>Reference Articles (optional)</label>
                    <button onClick={addReference} className="flex items-center gap-1 text-xs transition-colors hover:opacity-80" style={{ color: "#60a5fa" }}>
                      <PlusIcon className="w-3.5 h-3.5" /> Add reference
                    </button>
                  </div>
                  {references.map((ref, i) => (
                    <div key={i} className="flex gap-2">
                      <textarea
                        value={ref}
                        onChange={(e) => updateReference(i, e.target.value)}
                        placeholder={`Paste article text or URL #${i + 1}...`}
                        rows={3}
                        style={{ background: "#0d1526", borderColor: "#1e2d45", color: "#e2e8f0" }}
                        className="flex-1 border rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none transition-colors resize-none"
                      />
                      {references.length > 1 && (
                        <button onClick={() => removeReference(i)} className="self-start p-2 mt-1 transition-colors hover:opacity-80" style={{ color: "#475569" }}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div className="px-6 py-4">
                <button
                  onClick={generate}
                  disabled={isLoading || !keyword.trim()}
                  style={{
                    background: isLoading || !keyword.trim() ? "#1a2236" : "#2563eb",
                    color: isLoading || !keyword.trim() ? "#475569" : "white",
                    cursor: isLoading || !keyword.trim() ? "not-allowed" : "pointer",
                  }}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <SpinnerIcon className="w-4 h-4" />
                      {step === "generating" ? "Generating article..." : "Humanizing content..."}
                    </>
                  ) : (
                    <>
                      <AnchorIcon className="w-4 h-4" />
                      Generate & Humanize Article
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── Progress ── */}
            {isLoading && (
              <div className="rounded-2xl border p-6" style={{ background: "#111827", borderColor: "#1e2d45" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "#cbd5e1" }}>Processing Pipeline</h3>
                <ProgressSteps step={step} />
              </div>
            )}

            {/* ── Error ── */}
            {step === "error" && error && (
              <div className="rounded-2xl border p-5" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "#f87171" }}>Generation Failed</p>
                <p className="text-sm" style={{ color: "rgba(252,165,165,0.7)" }}>{error}</p>
                <button onClick={() => setStep("idle")} className="mt-3 text-xs underline hover:opacity-80 transition-opacity" style={{ color: "#f87171" }}>Try again</button>
              </div>
            )}

            {/* ── Result ── */}
            {result && step === "done" && (
              <div ref={outputRef} className="rounded-2xl border overflow-hidden fade-in" style={{ background: "#111827", borderColor: "#1e2d45" }}>
                {/* Output header */}
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#1e2d45" }}>
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#10b981" }}></span>
                    <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>Article Ready</span>
                    <div className="flex items-center gap-2.5 text-xs" style={{ color: "#64748b" }}>
                      <span>{result.word_count.toLocaleString()} words</span>
                      <span>·</span>
                      <span>{Math.ceil(result.word_count / 200)} min read</span>
                      <span>·</span>
                      <span className="font-medium" style={{ color: scoreColor(result.ai_score).text }}>~{result.ai_score}% AI estimate</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="px-3 py-1.5 rounded-lg text-xs transition-colors border hover:opacity-80"
                      style={{ color: "#94a3b8", borderColor: "#1e2d45" }}
                    >
                      {showRaw ? "Show Humanized" : "Show Raw AI"}
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border hover:opacity-80"
                      style={{ color: "#cbd5e1", borderColor: "#1e2d45" }}
                    >
                      {copied ? <CheckIcon className="w-3.5 h-3.5" style={{ color: "#34d399" }} /> : <CopyIcon className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={downloadTxt}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border hover:opacity-80"
                      style={{ color: "#cbd5e1", borderColor: "#1e2d45" }}
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                </div>

                {/* Score panel */}
                <div className="px-6 pt-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ background: scoreColor(result.ai_score).bg, borderColor: scoreColor(result.ai_score).border }}>
                      <ShieldIcon className="w-3.5 h-3.5" style={{ color: scoreColor(result.ai_score).text }} />
                      <span className="text-xs font-semibold" style={{ color: scoreColor(result.ai_score).text }}>
                        ~{result.ai_score}% AI · {100 - result.ai_score}% human (estimated)
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-full border" style={{ background: "#1a2236", borderColor: "#1e2d45" }}>
                      <span className="text-xs" style={{ color: "#64748b" }}>{Math.round(result.processing_time_ms / 1000)}s total</span>
                    </div>
                  </div>
                  {/* Honest breakdown */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {result.score_breakdown.map((b) => (
                      <div key={b.label} className="rounded-lg px-3 py-2 border" style={{ background: "#0d1526", borderColor: "#1e2d45" }}>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>{b.label}</p>
                        <p className="text-xs font-medium mt-0.5" style={{ color: "#cbd5e1" }}>{b.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#475569" }}>
                    This is Anchor&apos;s own estimate based on sentence variety, word choice, and tells. Always verify with your target detector (GPTZero, Originality.ai) before publishing — no tool can guarantee a score.
                  </p>
                </div>

                {/* Article */}
                <div className="p-6">
                  <div
                    className="article-output"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(showRaw ? result.rawArticle : result.article) }}
                  />
                </div>

                {/* Pipeline steps */}
                <details className="border-t" style={{ borderColor: "#1e2d45" }}>
                  <summary className="px-6 py-3 text-xs cursor-pointer flex items-center gap-2 select-none list-none hover:opacity-80 transition-opacity" style={{ color: "#64748b" }}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                    View transformation pipeline steps
                  </summary>
                  <div className="px-6 pb-4 flex flex-col gap-3">
                    {result.steps.map((s) => (
                      <div key={s.name} className="rounded-lg p-3 border" style={{ background: "#0d1526", borderColor: "#1e2d45" }}>
                        <p className="text-xs font-mono font-semibold mb-2" style={{ color: "#60a5fa" }}>{s.name}</p>
                        <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{s.output.slice(0, 280)}…</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* ── Empty state ── */}
            {step === "idle" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border" style={{ background: "#111827", borderColor: "#1e2d45" }}>
                  <AnchorIcon className="w-6 h-6" style={{ color: "#3b82f6" }} />
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: "#cbd5e1" }}>Ready to create</h3>
                <p className="text-sm leading-relaxed max-w-xs" style={{ color: "#64748b" }}>
                  Enter a keyword, add optional references, and Anchor will write and humanize a full article for you.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
