import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { benchmarkRuns } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const asPct = (n: number | null) => (n == null ? undefined : `${n}%`);

/**
 * Benchmark runs for the /evals dashboard, served from the Neon benchmark_runs
 * table (synced by scripts/load-benchmarks-to-db.ts and auto-synced by eval-all.ts).
 * Shapes each row to what the page expects, plus the new trust/speed/quality dims.
 */
export async function GET() {
  const rows = await db.select().from(benchmarkRuns).orderBy(desc(benchmarkRuns.ranAt));

  const benchmarks = rows.map((r) => {
    const perFile = (r.perFile as Array<{ file: string; total: number; success: number; firstPass: number; rate: number | null }>) ?? [];
    const successfulLessons = perFile.reduce((s, p) => s + (p.success ?? 0), 0)
      || (r.structuralPct != null && r.totalLessons != null ? Math.round((r.structuralPct / 100) * r.totalLessons) : 0);

    return {
      file: r.sourceFile,
      tag: r.tag,
      timestamp: r.ranAt instanceof Date ? r.ranAt.toISOString() : String(r.ranAt),
      generationModel: r.generationModel ?? undefined,
      judgeModel: r.judgeModel ?? undefined,
      iterations: r.iterations ?? undefined,
      totalTimeMs: r.totalTimeMs ?? undefined,
      // new, flat dims surfaced by the dashboard
      genMsPerLesson: r.genMsPerLesson ?? undefined,
      costUsd: r.costUsd ?? undefined,
      costPerLesson: r.costPerLesson ?? undefined,
      inputTokens: r.inputTokens ?? undefined,
      outputTokens: r.outputTokens ?? undefined,
      fileset: r.fileset ?? undefined,
      judgeStatus: r.judgeStatus,
      correctnessPct: r.correctnessPct ?? undefined,
      groundedPct: r.groundedPct ?? undefined,
      sufficientPct: r.sufficientPct ?? undefined,
      lexicalDupRate: r.lexicalDupRate ?? undefined,
      semanticDupRate: r.semanticDupRate ?? undefined,
      giveawayRate: r.giveawayRate ?? undefined,
      recallRatio: r.recallRatio ?? undefined,
      totalQuestions: r.totalQuestions ?? undefined,
      perFile,
      aggregate: {
        structural: {
          totalLessons: r.totalLessons ?? 0,
          successfulLessons,
          successRate: asPct(r.structuralPct) ?? "N/A",
          firstPassRate: asPct(r.firstPassPct) ?? "N/A",
        },
        ...(r.judgeStatus === "real"
          ? {
              correctness: { accuracy: asPct(r.correctnessPct) ?? "N/A" },
              grounding: { fullyGrounded: asPct(r.groundedPct) ?? "N/A" },
              sufficiency: { rate: asPct(r.sufficientPct) ?? "N/A" },
            }
          : {}),
        duplicates: { duplicationRate: asPct(r.lexicalDupRate) ?? "N/A" },
      },
    };
  });

  return NextResponse.json(benchmarks);
}
