import { readdir, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FileResult = {
  file: string;
  totalLessons: number;
  successfulLessons: number;
  // old format fields
  finalSuccess?: number;
  finalFailed?: number;
  firstPassSuccess?: number;
};

function summarizePerFile(results: FileResult[]) {
  const byFile: Record<
    string,
    { total: number; success: number; firstPass: number }
  > = {};

  for (const r of results) {
    const name = r.file || "unknown";
    if (!byFile[name]) byFile[name] = { total: 0, success: 0, firstPass: 0 };

    // New format has totalLessons/successfulLessons, old has finalSuccess/finalFailed
    const total =
      r.totalLessons ?? (r.finalSuccess ?? 0) + (r.finalFailed ?? 0);
    const success = r.successfulLessons ?? r.finalSuccess ?? 0;

    byFile[name].total += total;
    byFile[name].success += success;
    byFile[name].firstPass += r.firstPassSuccess ?? 0;
  }

  return Object.entries(byFile).map(([file, stats]) => ({
    file,
    ...stats,
    rate: stats.total > 0 ? stats.success / stats.total : null,
  }));
}

export async function GET() {
  const dir = path.join(process.cwd(), "data/benchmarks");
  const files = await readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  const benchmarks = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf-8");
      try {
        const data = JSON.parse(raw);
        const perFile = data.results ? summarizePerFile(data.results) : [];
        return {
          file,
          tag: data.tag,
          timestamp: data.timestamp,
          generationModel: data.generationModel,
          model: data.model,
          judgeModel: data.judgeModel,
          iterations: data.iterations ?? data.runs,
          batchSize: data.batchSize,
          totalTimeMs: data.totalTimeMs,
          dimensions: data.dimensions,
          aggregate: data.aggregate,
          summary: data.summary,
          perFile,
        };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json(benchmarks.filter(Boolean));
}
