import { readdir, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dir = path.join(process.cwd(), "data/benchmarks-slim");
  const files = await readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  const benchmarks = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf-8");
      try {
        return { file, ...JSON.parse(raw) };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json(benchmarks.filter(Boolean));
}
