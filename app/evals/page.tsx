"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

type PerFileStats = {
  file: string;
  total: number;
  success: number;
  firstPass: number;
  rate: number | null;
};

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
  perFile: PerFileStats[];
  summary?: {
    avgFirstPassRate: number;
    avgFinalSuccessRate: number;
    avgTotalTime: number;
  };
  aggregate?: {
    structural?: {
      totalLessons: number;
      successfulLessons: number;
      successRate: string;
      firstPassRate: string;
    };
    correctness?: { totalGraded: number; correct: number; accuracy: string };
    grounding?: { totalGraded: number; fullyGrounded: string };
    sufficiency?: { totalGraded: number; sufficient: number; rate: string };
    duplicates?: { duplicationRate: string };
  };
};

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

function shortPdfName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/\.ocr$/i, "")
    .replace(/\.md$/i, "")
    .replace(/_ /g, "")
    .slice(0, 40);
}

const PDF_PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d97706",
];

function Bar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  const pct = Math.min(value, 100);
  return (
    <div className="w-full bg-gray-100 rounded h-5 relative">
      <div className={`${color} h-full rounded transition-all`} style={{ width: `${pct}%` }} />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-gray-700">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

type SortKey = "date" | "model" | "successRate" | "tag";
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
    fetch("/api/benchmarks")
      .then((r) => r.json())
      .then((data) => { setBenchmarks(data); setLoading(false); });
  }, []);

  if (loading)
    return <div className="p-8 font-mono text-gray-500">Loading benchmarks...</div>;

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
        case "tag": return dir * (a.tag ?? "").localeCompare(b.tag ?? "");
      }
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Eval Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">
          {benchmarks.length} benchmarks &middot; {filtered.length} shown
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Filter by tag..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
          />
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="all">All models</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            Min lessons:
            <input
              type="number"
              value={minLessons}
              onChange={(e) => setMinLessons(parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            />
          </label>
        </div>

        <PerPdfChart benchmarks={filtered} />

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 cursor-pointer hover:text-gray-900" onClick={() => toggleSort("date")}>Date{arrow("date")}</th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-900" onClick={() => toggleSort("tag")}>Tag{arrow("tag")}</th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-900" onClick={() => toggleSort("model")}>Model{arrow("model")}</th>
                <th className="px-4 py-3">Iters</th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-900 min-w-[180px]" onClick={() => toggleSort("successRate")}>Success Rate{arrow("successRate")}</th>
                <th className="px-4 py-3">Lessons</th>
                <th className="px-4 py-3">PDFs</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const rate = getSuccessRate(b);
                const date = new Date(b.timestamp);
                const totalLessons = b.aggregate?.structural?.totalLessons ?? 0;
                const successLessons = b.aggregate?.structural?.successfulLessons ?? 0;
                const isExpanded = expandedRow === b.file;
                return (
                  <>
                    <tr
                      key={b.file}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : b.file)}
                    >
                      <td className="px-4 py-2.5 text-gray-400">
                        {b.perFile.length > 0 ? (isExpanded ? "\u25BC" : "\u25B6") : ""}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-500 whitespace-nowrap">
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        <span className="text-gray-400 ml-1">
                          {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">{b.tag}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-600 max-w-[200px] truncate">{getModel(b)}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{b.iterations ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {rate != null ? (
                          <Bar value={rate} color={rate >= 95 ? "bg-green-500" : rate >= 80 ? "bg-yellow-500" : "bg-red-500"} />
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center">
                        {totalLessons > 0 ? `${successLessons}/${totalLessons}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center">{b.perFile.length || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-500 text-center">
                        {b.totalTimeMs ? formatDuration(b.totalTimeMs) : "—"}
                      </td>
                    </tr>
                    {isExpanded && b.perFile.length > 0 && (
                      <tr key={`${b.file}-detail`} className="bg-gray-50">
                        <td colSpan={9} className="px-8 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {b.perFile.map((pf) => (
                              <div key={pf.file} className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-gray-500 truncate max-w-[200px]" title={pf.file}>
                                  {shortPdfName(pf.file)}
                                </span>
                                <span className="font-mono text-gray-700 whitespace-nowrap">
                                  {pf.success}/{pf.total}
                                </span>
                                {pf.rate !== null && (
                                  <span className={`font-mono font-medium ${pf.rate >= 0.95 ? "text-green-600" : pf.rate >= 0.8 ? "text-yellow-600" : "text-red-600"}`}>
                                    {(pf.rate * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Per-PDF Scatter Chart (recharts) ─────────────────────────

type PdfPoint = {
  date: number;
  rate: number;
  total: number;
  success: number;
  pdf: string;
  model: string;
  tag: string;
  label: string;
};

function PerPdfChart({ benchmarks }: { benchmarks: Benchmark[] }) {
  const pointsByPdf: Record<string, PdfPoint[]> = {};

  for (const b of benchmarks) {
    for (const pf of b.perFile) {
      if (pf.rate === null || !Number.isFinite(pf.rate) || pf.total === 0) continue;
      const pdf = pf.file;
      if (!pointsByPdf[pdf]) pointsByPdf[pdf] = [];
      pointsByPdf[pdf].push({
        date: new Date(b.timestamp).getTime(),
        rate: parseFloat((pf.rate * 100).toFixed(1)),
        total: pf.total,
        success: pf.success,
        pdf,
        model: getModel(b),
        tag: b.tag,
        label: shortPdfName(pdf),
      });
    }
  }

  const pdfNames = Object.keys(pointsByPdf).sort();
  if (pdfNames.length === 0) return null;

  const pdfColors: Record<string, string> = {};
  pdfNames.forEach((pdf, i) => { pdfColors[pdf] = PDF_PALETTE[i % PDF_PALETTE.length]; });

  // Find domain
  const allPoints = pdfNames.flatMap((p) => pointsByPdf[p]);
  const rates = allPoints.map((p) => p.rate);
  const yMin = Math.max(0, Math.floor((Math.min(...rates) - 5) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((Math.max(...rates) + 5) / 5) * 5);

  const maxTotal = Math.max(...allPoints.map((p) => p.total));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-1">
        Structural Success Rate by PDF Over Time
      </h2>
      <p className="text-xs text-gray-400 mb-4">Dot size = sample size (more lessons per PDF = bigger dot)</p>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts) =>
              new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            fontSize={11}
            stroke="#9ca3af"
          />
          <YAxis
            dataKey="rate"
            type="number"
            domain={[yMin, yMax]}
            tickFormatter={(v) => `${v}%`}
            fontSize={11}
            stroke="#9ca3af"
            width={45}
          />
          <ZAxis
            dataKey="total"
            type="number"
            range={[40, 400]}
            domain={[0, maxTotal]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span className="text-xs text-gray-600">{shortPdfName(value)}</span>}
          />
          {pdfNames.map((pdf) => (
            <Scatter
              key={pdf}
              name={pdf}
              data={pointsByPdf[pdf]}
              fill={pdfColors[pdf]}
              opacity={0.8}
              line={{ stroke: pdfColors[pdf], strokeWidth: 1.5, opacity: 0.25 }}
              lineType="joint"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PdfPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-900">{shortPdfName(p.pdf)}</p>
      <p className="text-gray-600 mt-0.5">
        {p.rate}% ({p.success}/{p.total} lessons)
      </p>
      <p className="text-gray-500">
        {p.model.split("/").pop()} &middot; {p.tag}
      </p>
      <p className="text-gray-400">
        {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}
