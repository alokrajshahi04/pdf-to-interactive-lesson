"use client";

import { Fragment, useEffect, useState } from "react";
import { scoreRun, scoreCommon } from "@/lib/benchmark-score";
import { cn } from "@/lib/utils";
import {
  Activity, Search, ChevronRight, ChevronDown, ArrowUp, ArrowDown,
  Layers, Cpu, ShieldCheck, Trophy, Clock, Gauge,
} from "lucide-react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";

type PerFileStats = { file: string; total: number; success: number; firstPass: number; rate: number | null };

type Benchmark = {
  file: string;
  tag: string;
  timestamp: string;
  generationModel?: string;
  model?: string;
  judgeModel?: string;
  iterations?: number;
  batchSize?: number;
  totalTimeMs?: number;
  dimensions?: string[];
  judgeStatus?: "real" | "fake-100%" | "no-judge" | "none";
  genMsPerLesson?: number;
  correctnessPct?: number;
  groundedPct?: number;
  sufficientPct?: number;
  lexicalDupRate?: number;
  semanticDupRate?: number;
  giveawayRate?: number;
  recallRatio?: number;
  totalQuestions?: number;
  costUsd?: number;
  costPerLesson?: number;
  fileset?: string;
  perFile: PerFileStats[];
  summary?: { avgFirstPassRate: number; avgFinalSuccessRate: number; avgTotalTime: number };
  aggregate?: {
    structural?: { totalLessons: number; successfulLessons: number; successRate: string; firstPassRate: string };
    correctness?: { accuracy: string };
    grounding?: { fullyGrounded: string };
    sufficiency?: { rate: string };
    duplicates?: { duplicationRate: string };
  };
};

// ── helpers ──────────────────────────────────────────────
function parseRate(s: string | undefined): number | null {
  if (!s || s === "N/A") return null;
  const m = s.match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}
function formatDuration(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
function getSuccessRate(b: Benchmark): number | null {
  if (b.aggregate?.structural) return parseRate(b.aggregate.structural.successRate);
  if (b.summary) return b.summary.avgFinalSuccessRate * 100;
  return null;
}
function getModel(b: Benchmark): string {
  return b.generationModel ?? b.model ?? "unknown";
}
function shortModel(m: string): string {
  return m.replace(/^.*\//, "");
}
function scoreOf(b: Benchmark) {
  const real = b.judgeStatus === "real";
  return scoreRun({
    structuralPct: getSuccessRate(b),
    correctnessPct: real ? b.correctnessPct : null,
    groundedPct: real ? b.groundedPct : null,
    sufficientPct: real ? b.sufficientPct : null,
    semanticDupRate: b.semanticDupRate,
    giveawayRate: b.giveawayRate,
    recallRatio: b.recallRatio,
  });
}
function shortPdfName(name: string): string {
  return name.replace(/\.pdf$/i, "").replace(/\.ocr$/i, "").replace(/\.md$/i, "").replace(/_ /g, "").slice(0, 40);
}
const pctStr = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);

const PDF_PALETTE = [
  "#fb7372", "#51b9f3", "#2cbf76", "#ffc33e", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d97706",
];

// ── small primitives ─────────────────────────────────────
function JudgeBadge({ status }: { status?: Benchmark["judgeStatus"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    real: { label: "real", cls: "bg-correct-bg text-correct-fg" },
    "fake-100%": { label: "fake", cls: "bg-incorrect-bg text-incorrect-fg" },
    "no-judge": { label: "no-judge", cls: "bg-surface-muted text-muted-foreground" },
    none: { label: "none", cls: "bg-surface-muted text-muted-foreground/70" },
  };
  const s = map[status ?? "none"] ?? map.none;
  return <span className={cn("inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium font-mono", s.cls)}>{s.label}</span>;
}

function rateColor(v: number): string {
  return v >= 95 ? "bg-bar-good" : v >= 80 ? "bg-bar-warn" : "bg-bar-bad";
}
function RateBar({ value }: { value: number }) {
  return (
    <div className="relative h-5 w-full min-w-[120px] overflow-hidden rounded-md bg-bar-track">
      <div className={cn("h-full rounded-md transition-all", rateColor(value))} style={{ width: `${Math.min(value, 100)}%` }} />
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-medium text-foreground/80">{value.toFixed(0)}%</span>
    </div>
  );
}

function ScoreCell({ b }: { b: Benchmark }) {
  const s = scoreOf(b);
  if (s.score == null) return <span className="text-muted-foreground">—</span>;
  const cov = Math.round(s.coverage * 100);
  return (
    <span title={`${cov}% dimension coverage`} className="inline-flex items-baseline gap-1">
      <span className={cn("font-mono text-sm font-semibold tabular-nums", cov >= 75 ? "text-foreground" : "text-muted-foreground")}>{s.score}</span>
      <span className="font-mono text-[10px] text-muted-foreground/70">{cov}%</span>
    </span>
  );
}

function StatTile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border-thin border-border bg-surface-subtle p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="font-mono text-2xl font-semibold tabular-nums text-foreground leading-none">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── compare panel ────────────────────────────────────────
type Agg = {
  n: number; realN: number; iters: number[];
  structural: number | null; correctness: number | null; grounded: number | null; sufficient: number | null;
  semanticDup: number | null; giveaway: number | null; recall: number | null;
  msPerLesson: number | null; costPerLesson: number | null;
};
function aggregate(runs: Benchmark[]): Agg {
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const real = runs.filter((r) => r.judgeStatus === "real");
  return {
    n: runs.length, realN: real.length,
    iters: [...new Set(runs.map((r) => r.iterations ?? 0))].sort((a, b) => a - b),
    structural: mean(runs.map((r) => getSuccessRate(r))),
    correctness: mean(real.map((r) => r.correctnessPct)),
    grounded: mean(real.map((r) => r.groundedPct)),
    sufficient: mean(real.map((r) => r.sufficientPct)),
    semanticDup: mean(runs.map((r) => r.semanticDupRate)),
    giveaway: mean(runs.map((r) => r.giveawayRate)),
    recall: mean(runs.map((r) => r.recallRatio)),
    msPerLesson: mean(runs.map((r) => r.genMsPerLesson)),
    costPerLesson: mean(runs.map((r) => r.costPerLesson)),
  };
}

function ComparePanel({ benchmarks }: { benchmarks: Benchmark[] }) {
  const withFs = benchmarks.filter((b) => b.fileset);
  const models = [...new Set(withFs.map(getModel))].sort();
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  if (models.length < 2) return null;
  // Default to current model (latest run) vs the model it replaced, mirroring the CLI default.
  const byRecent = [...withFs].sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
  const currentModel = getModel(byRecent[0]);
  const prevModel = byRecent.find((r) => getModel(r) !== currentModel);
  const selB = b || currentModel;
  const selA = a || (prevModel ? getModel(prevModel) : models.find((m) => m !== selB)) || "";

  const aRuns = withFs.filter((x) => getModel(x) === selA);
  const bRuns = withFs.filter((x) => getModel(x) === selB);
  const populated = (rs: Benchmark[], f: string) => rs.filter((r) => r.fileset === f && getSuccessRate(r) != null).length;
  const shared = [...new Set(aRuns.map((r) => r.fileset!))]
    .filter((fs) => bRuns.some((r) => r.fileset === fs))
    .sort((f1, f2) => Math.min(populated(aRuns, f2), populated(bRuns, f2)) - Math.min(populated(aRuns, f1), populated(bRuns, f1))
      || populated(aRuns, f2) + populated(bRuns, f2) - (populated(aRuns, f1) + populated(bRuns, f1)));
  const fs = shared[0];
  const A = fs ? aggregate(aRuns.filter((r) => r.fileset === fs)) : null;
  const B = fs ? aggregate(bRuns.filter((r) => r.fileset === fs)) : null;

  const rows: { label: string; a: number | null; b: number | null; unit: string; betterHigh: boolean; dec?: number }[] = A && B ? [
    { label: "Structural", a: A.structural, b: B.structural, unit: "%", betterHigh: true },
    { label: "Correctness", a: A.correctness, b: B.correctness, unit: "%", betterHigh: true },
    { label: "Grounded", a: A.grounded, b: B.grounded, unit: "%", betterHigh: true },
    { label: "Sufficient", a: A.sufficient, b: B.sufficient, unit: "%", betterHigh: true },
    { label: "Semantic-dup", a: A.semanticDup, b: B.semanticDup, unit: "%", betterHigh: false },
    { label: "Give-away", a: A.giveaway, b: B.giveaway, unit: "%", betterHigh: false },
    { label: "Recall ratio", a: A.recall, b: B.recall, unit: "%", betterHigh: false },
    { label: "Speed (ms/lesson)", a: A.msPerLesson, b: B.msPerLesson, unit: "", betterHigh: false },
    { label: "Cost ($/lesson)", a: A.costPerLesson, b: B.costPerLesson, unit: "", betterHigh: false, dec: 5 },
  ] : [];

  const ModelSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-thin border-border bg-white px-2.5 py-1.5 font-mono text-sm text-foreground outline-none focus-visible:border-foreground">
      {models.map((m) => <option key={m} value={m}>{shortModel(m)}</option>)}
    </select>
  );
  const fmt = (n: number | null, u: string, d = 0) => (n == null ? "—" : `${n.toFixed(d)}${u}`);

  const map = (g: Agg) => ({ structuralPct: g.structural, correctnessPct: g.correctness, groundedPct: g.grounded, sufficientPct: g.sufficient, semanticDupRate: g.semanticDup, giveawayRate: g.giveaway, recallRatio: g.recall });
  const scores = A && B ? scoreCommon(map(A), map(B)) : null;
  const scoreDelta = scores && scores.a.score != null && scores.b.score != null ? scores.b.score - scores.a.score : null;

  return (
    <section className="animate-fadeInUp rounded-2xl border-thin border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Compare models</h2>
          <p className="text-xs text-muted-foreground">Apples-to-apples — aligned by shared PDF set</p>
        </div>
        <div className="flex items-center gap-2">
          <ModelSelect value={selA} onChange={setA} />
          <span className="text-xs text-muted-foreground">vs</span>
          <ModelSelect value={selB} onChange={setB} />
        </div>
      </div>

      {!fs ? (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">No shared PDF set between these two models — not directly comparable.</p>
      ) : (
        <>
          {scores && (
            <div className="mb-4 flex items-stretch gap-3">
              {([[selA, scores.a], [selB, scores.b]] as const).map(([m, s], i) => (
                <div key={i} className="flex-1 rounded-xl border-thin border-border bg-surface-subtle p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Trophy className="size-3" /> {shortModel(m)}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">{s.score ?? "—"}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{Math.round(s.coverage * 100)}% cov</span>
                    {i === 1 && scoreDelta != null && (
                      <span className={cn("ml-auto inline-flex items-center gap-0.5 font-mono text-xs", scoreDelta > 0 ? "text-correct" : scoreDelta < 0 ? "text-incorrect" : "text-muted-foreground")}>
                        {scoreDelta > 0 ? <ArrowUp className="size-3" /> : scoreDelta < 0 ? <ArrowDown className="size-3" /> : null}
                        {scoreDelta >= 0 ? "+" : ""}{scoreDelta}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mb-2 text-xs text-muted-foreground">
            {fs.split("|").length} PDFs · {shortModel(selA)} {A!.n} runs (iters {A!.iters.join("/")}, {A!.realN} judged) · {shortModel(selB)} {B!.n} runs (iters {B!.iters.join("/")}, {B!.realN} judged)
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-4 font-medium">Metric</th>
                <th className="py-1.5 pr-4 font-medium font-mono normal-case">{shortModel(selA)}</th>
                <th className="py-1.5 pr-4 font-medium font-mono normal-case">{shortModel(selB)}</th>
                <th className="py-1.5 pr-4 font-medium">Δ</th>
                <th className="py-1.5 font-medium">Better</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                let delta = "—", winner = "", wcls = "text-muted-foreground/60";
                if (r.a != null && r.b != null) {
                  const d = r.b - r.a;
                  delta = `${d >= 0 ? "+" : ""}${d.toFixed(r.dec ?? 0)}${r.unit}`;
                  if (Math.abs(d) < (r.dec ? 1e-9 : 0.5)) winner = "tie";
                  else { winner = shortModel((d > 0) === r.betterHigh ? selB : selA); wcls = "text-correct"; }
                }
                return (
                  <tr key={r.label} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-4 text-muted-foreground">{r.label}</td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums">{fmt(r.a, r.unit, r.dec ?? 0)}</td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums">{fmt(r.b, r.unit, r.dec ?? 0)}</td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums text-muted-foreground">{delta}</td>
                    <td className={cn("py-1.5 font-mono text-xs", wcls)}>{winner}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground/80">Overall scored over shared dims only. Lower is better for semantic-dup, give-away, recall, speed, cost. Cost appears on evals run after token tracking was added.</p>
        </>
      )}
    </section>
  );
}

// ── page ─────────────────────────────────────────────────
type SortKey = "date" | "model" | "successRate" | "tag" | "score";
type SortDir = "asc" | "desc";

export default function EvalsPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minLessons, setMinLessons] = useState(50);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/benchmarks").then((r) => r.json()).then((data) => { setBenchmarks(data); setLoading(false); });
  }, []);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="animate-fadeIn font-mono text-sm text-muted-foreground">Loading benchmarks…</div>
      </div>
    );

  const models = [...new Set(benchmarks.map(getModel))].sort();
  const filtered = benchmarks
    .filter((b) => {
      const rate = getSuccessRate(b);
      const totalLessons = b.aggregate?.structural?.totalLessons ?? 0;
      if (rate === null && totalLessons === 0) return false;
      if (filter && !b.tag?.toLowerCase().includes(filter.toLowerCase())) return false;
      if (modelFilter !== "all" && getModel(b) !== modelFilter) return false;
      if (minLessons > 0 && totalLessons > 0 && totalLessons < minLessons) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "date": return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        case "model": return dir * getModel(a).localeCompare(getModel(b));
        case "successRate": return dir * ((getSuccessRate(a) ?? 0) - (getSuccessRate(b) ?? 0));
        case "score": return dir * ((scoreOf(a).score ?? -1) - (scoreOf(b).score ?? -1));
        case "tag": return dir * (a.tag ?? "").localeCompare(b.tag ?? "");
      }
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const Arrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "asc" ? <ArrowUp className="ml-0.5 inline size-3" /> : <ArrowDown className="ml-0.5 inline size-3" />) : null;

  // KPI stats
  const realRuns = benchmarks.filter((b) => b.judgeStatus === "real");
  const scored = benchmarks.map((b) => ({ b, s: scoreOf(b) })).filter((x) => x.s.score != null && x.s.coverage >= 0.7);
  const best = scored.sort((x, y) => (y.s.score ?? 0) - (x.s.score ?? 0))[0];
  const latest = [...benchmarks].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const TH = ({ label, k, className }: { label: string; k?: SortKey; className?: string }) => (
    <th
      className={cn("px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground", k && "cursor-pointer select-none hover:text-foreground", className)}
      onClick={k ? () => toggleSort(k) : undefined}
    >
      {label}{k && <Arrow k={k} />}
    </th>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="animate-fadeInUp mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Eval Dashboard</h1>
            <p className="text-sm text-muted-foreground">{benchmarks.length} benchmark runs · {filtered.length} shown</p>
          </div>
        </div>

        {/* KPI row */}
        <div className="animate-fadeInUp mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile icon={Layers} label="Runs" value={String(benchmarks.length)} />
          <StatTile icon={Cpu} label="Models" value={String(models.length)} />
          <StatTile icon={ShieldCheck} label="Real-judged" value={String(realRuns.length)} sub={`${Math.round((realRuns.length / benchmarks.length) * 100)}% of runs`} />
          <StatTile icon={Trophy} label="Best score" value={best ? String(best.s.score) : "—"} sub={best ? shortModel(getModel(best.b)) : undefined} />
          <StatTile icon={Clock} label="Latest" value={latest ? new Date(latest.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"} sub={latest ? shortModel(getModel(latest)) : undefined} />
        </div>

        <div className="mb-6"><ComparePanel benchmarks={benchmarks} /></div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" placeholder="Filter by tag…" value={filter} onChange={(e) => setFilter(e.target.value)}
              className="w-52 rounded-lg border-thin border-border bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus-visible:border-foreground"
            />
          </div>
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}
            className="rounded-lg border-thin border-border bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-foreground">
            <option value="all">All models</option>
            {models.map((m) => <option key={m} value={m}>{shortModel(m)}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Min lessons
            <input type="number" value={minLessons} onChange={(e) => setMinLessons(parseInt(e.target.value) || 0)}
              className="w-16 rounded-lg border-thin border-border bg-white px-2 py-1.5 text-sm outline-none focus-visible:border-foreground" />
          </label>
        </div>

        <ModelTradeoffChart benchmarks={benchmarks} />

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-2xl border-thin border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left">
                <th className="w-8 px-4 py-2.5" />
                <TH label="Date" k="date" />
                <TH label="Tag" k="tag" />
                <TH label="Model" k="model" />
                <TH label="Iters" />
                <TH label="Overall" k="score" />
                <TH label="Success" k="successRate" className="min-w-[140px]" />
                <TH label="Judge" />
                <TH label="Speed" />
                <TH label="Cost" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const rate = getSuccessRate(b);
                const date = new Date(b.timestamp);
                const totalLessons = b.aggregate?.structural?.totalLessons ?? 0;
                const successLessons = b.aggregate?.structural?.successfulLessons ?? 0;
                const isExpanded = expandedRow === b.file;
                const real = b.judgeStatus === "real";
                return (
                  <Fragment key={b.file}>
                    <tr className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface-subtle"
                      onClick={() => setExpandedRow(isExpanded ? null : b.file)}>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {b.perFile.length > 0 ? (isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        <span className="ml-1 text-muted-foreground/60">{date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded-md bg-surface-muted px-2 py-0.5 font-mono text-xs text-foreground">{b.tag}</span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground">{shortModel(getModel(b))}</td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-muted-foreground">{b.iterations ?? "—"}</td>
                      <td className="px-4 py-2.5"><ScoreCell b={b} /></td>
                      <td className="px-4 py-2.5">{rate != null ? <RateBar value={rate} /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5"><JudgeBadge status={b.judgeStatus} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground" title="avg gen time / lesson">
                        {b.genMsPerLesson ? `${(b.genMsPerLesson / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {b.costPerLesson != null ? `$${b.costPerLesson.toFixed(4)}` : "—"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-subtle">
                        <td colSpan={10} className="px-8 py-5">
                          <div className="grid grid-cols-1 gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                            {/* dimensions — only those with data */}
                            <div>
                              <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Dimensions</div>
                              {(() => {
                                const dims = ([
                                  ["Correctness", real ? b.correctnessPct : null, true],
                                  ["Grounded", real ? b.groundedPct : null, true],
                                  ["Sufficient", real ? b.sufficientPct : null, true],
                                  ["Semantic-dup", b.semanticDupRate ?? null, false],
                                  ["Give-away", b.giveawayRate ?? null, false],
                                  ["Recall", b.recallRatio ?? null, false],
                                  ["Lexical-dup", b.lexicalDupRate ?? null, false],
                                ] as const).filter(([, v]) => v != null);
                                if (!dims.length) return <p className="text-xs text-muted-foreground/70">No judged or audit dimensions for this run.</p>;
                                return (
                                  <div className="flex flex-wrap gap-x-7 gap-y-2.5">
                                    {dims.map(([label, val, higherGood]) => (
                                      <div key={label} className="flex items-baseline gap-1.5">
                                        <span className="text-xs text-muted-foreground">{label}</span>
                                        <span className={cn("font-mono text-sm font-semibold tabular-nums",
                                          higherGood ? (val! >= 95 ? "text-bar-good" : "text-foreground")
                                            : (val! <= 25 ? "text-bar-good" : val! >= 70 ? "text-bar-warn" : "text-foreground"))}>
                                          {pctStr(val)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                {totalLessons > 0 && <span>Lessons <span className="font-mono tabular-nums text-foreground/80">{successLessons}/{totalLessons}</span></span>}
                                {b.totalQuestions != null && <span>Questions <span className="font-mono tabular-nums text-foreground/80">{b.totalQuestions}</span></span>}
                                {b.totalTimeMs && <span>Duration <span className="font-mono tabular-nums text-foreground/80">{formatDuration(b.totalTimeMs)}</span></span>}
                                {b.judgeStatus === "real" && b.judgeModel && <span>Judge <span className="font-mono text-foreground/80">{shortModel(b.judgeModel)}</span></span>}
                              </div>
                            </div>
                            {/* per-PDF success */}
                            {b.perFile.length > 0 && (
                              <div>
                                <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Per-PDF success</div>
                                <div className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-10">
                                  {b.perFile.map((pf) => (
                                    <div key={pf.file} className="flex items-center gap-3 text-xs">
                                      <span className="truncate font-mono text-muted-foreground" title={pf.file}>{shortPdfName(pf.file)}</span>
                                      <span className="ml-auto font-mono tabular-nums text-muted-foreground/60">{pf.success}/{pf.total}</span>
                                      {pf.rate !== null && (
                                        <span className={cn("w-8 text-right font-mono tabular-nums font-semibold",
                                          pf.rate >= 0.95 ? "text-bar-good" : pf.rate >= 0.8 ? "text-bar-warn" : "text-bar-bad")}>
                                          {(pf.rate * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Model tradeoff: a quality metric vs an efficiency metric, on one PDF set ──
// `good` = the threshold for the "optimal zone": quality metrics want >= good,
// efficiency metrics (lowerBetter) want <= good. Tweak here to move the sweet spot.
const TREND_METRICS: { key: string; label: string; get: (b: Benchmark) => number | null; pct?: boolean; lowerBetter?: boolean; good?: number; axis: (v: number) => string }[] = [
  { key: "score", label: "Overall score", get: (b) => scoreOf(b).score, pct: true, good: 90, axis: (v) => `${v}` },
  { key: "structural", label: "Structural", get: getSuccessRate, pct: true, good: 95, axis: (v) => `${v}%` },
  { key: "correctness", label: "Correctness", get: (b) => (b.judgeStatus === "real" ? b.correctnessPct ?? null : null), pct: true, good: 95, axis: (v) => `${v}%` },
  { key: "grounded", label: "Grounded", get: (b) => (b.judgeStatus === "real" ? b.groundedPct ?? null : null), pct: true, good: 92, axis: (v) => `${v}%` },
  { key: "sufficient", label: "Sufficient", get: (b) => (b.judgeStatus === "real" ? b.sufficientPct ?? null : null), pct: true, good: 95, axis: (v) => `${v}%` },
  { key: "semanticDup", label: "Semantic-dup", get: (b) => b.semanticDupRate ?? null, pct: true, lowerBetter: true, axis: (v) => `${v}%` },
  { key: "giveaway", label: "Give-away", get: (b) => b.giveawayRate ?? null, pct: true, lowerBetter: true, axis: (v) => `${v}%` },
  { key: "recall", label: "Recall ratio", get: (b) => b.recallRatio ?? null, pct: true, lowerBetter: true, axis: (v) => `${v}%` },
  { key: "speed", label: "Speed (ms/lesson)", get: (b) => b.genMsPerLesson ?? null, lowerBetter: true, good: 10000, axis: (v) => `${(v / 1000).toFixed(1)}s` },
  { key: "cost", label: "Cost ($/lesson)", get: (b) => b.costPerLesson ?? null, lowerBetter: true, good: 0.01, axis: (v) => `$${v.toFixed(4)}` },
];

function filesetLabel(fs: string, runs: number): string {
  const n = fs.split("|").length;
  return `${n} PDF${n === 1 ? "" : "s"} · ${runs} run${runs === 1 ? "" : "s"}`;
}

const Y_METRICS = TREND_METRICS.filter((m) => ["score", "structural", "correctness", "grounded", "sufficient"].includes(m.key));
const X_METRICS = TREND_METRICS.filter((m) => ["speed", "cost"].includes(m.key));

type TradeoffPoint = { x: number; y: number; model: string; color: string; n: number; cov: number; runs: number; iters: number[] };

function ModelTradeoffChart({ benchmarks }: { benchmarks: Benchmark[] }) {
  const withFs = benchmarks.filter((b) => b.fileset);
  const fsCount: Record<string, number> = {};
  withFs.forEach((b) => { fsCount[b.fileset!] = (fsCount[b.fileset!] ?? 0) + 1; });
  // Default to the set with the most distinct models that have a scoreable run.
  const fsStat = (f: string) => {
    const rs = withFs.filter((b) => b.fileset === f && scoreOf(b).score != null);
    return { models: new Set(rs.map(getModel)).size, scoreable: rs.length, total: fsCount[f] };
  };
  const filesets = Object.keys(fsCount)
    .filter((f) => fsStat(f).scoreable > 0) // hide PDF sets with no plottable data
    .sort((a, b) => {
      const A = fsStat(a), B = fsStat(b);
      return B.models - A.models || B.scoreable - A.scoreable || B.total - A.total;
    });
  const [fileset, setFileset] = useState("");
  const [yKey, setYKey] = useState("score");
  const [xKey, setXKey] = useState("speed");
  if (!filesets.length) return null;
  const fs = fileset || filesets[0];
  const yM = Y_METRICS.find((m) => m.key === yKey)!;
  const xM = X_METRICS.find((m) => m.key === xKey)!;
  const runs = withFs.filter((b) => b.fileset === fs);
  const models = [...new Set(runs.map(getModel))].sort();

  const mean = (xs: (number | null)[]) => { const v = xs.filter((n): n is number => n != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const points: TradeoffPoint[] = models.map((m, i) => {
    const rs = runs.filter((r) => getModel(r) === m);
    const y = mean(rs.map((r) => yM.get(r)));
    const x = mean(rs.map((r) => xM.get(r)));
    if (x == null || y == null) return null;
    return {
      x: yM.pct ? x : x, y: yM.pct ? Math.round(y) : y, model: shortModel(m), color: PDF_PALETTE[i % PDF_PALETTE.length],
      n: rs.reduce((s, r) => s + (r.totalQuestions ?? 0), 0),
      cov: Math.round(mean(rs.map((r) => scoreOf(r).coverage * 100)) ?? 0),
      runs: rs.length, iters: [...new Set(rs.map((r) => r.iterations ?? 0))].sort((a, b) => a - b),
    };
  }).filter((p): p is TradeoffPoint => p != null);

  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xMax = points.length ? Math.max(...xs) * 1.18 : 1;
  let yMin = 0, yMax = 100;
  if (ys.length) { yMin = Math.max(0, Math.floor((Math.min(...ys) - 6) / 5) * 5); yMax = Math.min(100, Math.ceil((Math.max(...ys) + 6) / 5) * 5); }
  const maxN = Math.max(1, ...points.map((p) => p.n));
  const yTarget = yM.good ?? null;
  const xTarget = xM.good ?? null;

  // De-overlap labels: vertically stagger points whose Y values cluster together
  // (width-independent — only uses the known Y domain). Clustered labels get a
  // pixel offset + leader line back to their dot.
  const labelDy: Record<string, number> = {};
  const yRange = (yMax - yMin) || 1;
  const topDown = [...points].sort((a, b) => b.y - a.y);
  for (let ci = 0; ci < topDown.length;) {
    let cj = ci;
    while (cj + 1 < topDown.length && Math.abs(topDown[cj + 1].y - topDown[cj].y) < yRange * 0.06) cj++;
    const cluster = topDown.slice(ci, cj + 1);
    if (cluster.length > 1) cluster.forEach((p, k) => { labelDy[p.model] = (k - (cluster.length - 1) / 2) * 14; });
    ci = cj + 1;
  }
  const labelName = (m: string) => (m.length > 15 ? m.slice(0, 14) + "…" : m);

  const Select = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-thin border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:border-foreground">
      {children}
    </select>
  );

  const dot = (props: any) => {
    const p: TradeoffPoint = props.payload;
    const r = 4 + 7 * Math.sqrt((p.n || 1) / maxN);
    const op = p.cov >= 75 ? 0.95 : p.cov >= 40 ? 0.6 : 0.35;
    const off = labelDy[p.model] ?? 0;
    const lx = props.cx + r + 5;
    const ly = props.cy + 3 + off;
    return (
      <g>
        {off !== 0 && <line x1={props.cx + r} y1={props.cy} x2={lx - 2} y2={ly - 3} stroke={p.color} strokeOpacity={0.45} strokeWidth={1} />}
        <circle cx={props.cx} cy={props.cy} r={r} fill={p.color} fillOpacity={op} stroke={p.color} strokeOpacity={0.9} />
        <text x={lx} y={ly} fontSize={10.5} fill="#171717" className="font-mono">{labelName(p.model)}</text>
      </g>
    );
  };

  return (
    <div className="animate-fadeInUp rounded-2xl border-thin border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Gauge className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{yM.label} vs {xM.label.replace(/ \(.*\)/, "")} — model tradeoff</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            One point per model on the same PDF set.{" "}
            {xTarget != null && yTarget != null
              ? <>Green zone = optimal ({yM.label} ≥ {yM.axis(yTarget)} &amp; {xM.label.replace(/ \(.*\)/, "")} ≤ {xM.axis(xTarget)}).</>
              : "Top-left = better."}{" "}
            Dot size = sample size · faded = low coverage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={yKey} onChange={setYKey}>{Y_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</Select>
          <span className="text-xs text-muted-foreground">vs</span>
          <Select value={xKey} onChange={setXKey}>{X_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</Select>
          <Select value={fs} onChange={setFileset}>{filesets.map((f) => <option key={f} value={f}>{filesetLabel(f, fsCount[f])}</option>)}</Select>
        </div>
      </div>
      {points.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
          No models have both “{yM.label}” and “{xM.label}” on this PDF set yet{xKey === "cost" ? " — cost is captured only on newer runs." : "."}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 10, right: 120, bottom: 28, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ededed" />
            <XAxis dataKey="x" type="number" domain={[0, xMax]} tickFormatter={xM.axis} fontSize={11} stroke="#737373"
              label={{ value: `${xM.label} · ← faster`, position: "insideBottom", offset: -14, fontSize: 11, fill: "#737373" }} />
            <YAxis dataKey="y" type="number" domain={[yMin, yMax]} tickFormatter={yM.axis} fontSize={11} stroke="#737373" width={48} />
            {xTarget != null && yTarget != null && (
              <ReferenceArea x1={0} x2={Math.min(xTarget, xMax)} y1={yTarget} y2={yMax}
                fill="#22c55e" fillOpacity={0.08} stroke="#22c55e" strokeOpacity={0.3} strokeDasharray="4 4" ifOverflow="hidden"
                label={{ value: "optimal", position: "insideTopLeft", fontSize: 10, fill: "#15a04f", offset: 8 }} />
            )}
            <Tooltip content={(props) => <TradeoffTooltip {...(props as any)} yM={yM} xM={xM} />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={points} shape={dot} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function TradeoffTooltip({ active, payload, yM, xM }: { active?: boolean; payload?: Array<{ payload: TradeoffPoint }>; yM: typeof TREND_METRICS[number]; xM: typeof TREND_METRICS[number] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border-thin border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-mono font-medium text-foreground">{p.model}</p>
      <p className="mt-0.5 font-mono text-muted-foreground">{yM.label}: {yM.axis(p.y)}{yM.key === "score" ? ` · ${p.cov}% cov` : ""}</p>
      <p className="font-mono text-muted-foreground">{xM.label}: {xM.axis(p.x)}</p>
      <p className="font-mono text-muted-foreground/70">{p.runs} run{p.runs === 1 ? "" : "s"} · iters {p.iters.join("/")} · {p.n} Q</p>
    </div>
  );
}
