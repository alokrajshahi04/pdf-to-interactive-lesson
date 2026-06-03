# PDF to Interactive Lesson

Turn a PDF into a small interactive course with generated lessons, quizzes, and flow-ordering questions.

The app has two parts:

- a Next.js web app for upload, generation, and course playback
- a CLI for generation and benchmarking

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm db:push
pnpm dev
```

Open `http://localhost:3000`.

## Required env

From `.env.example`:

- `TOGETHER_API_KEY`
- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_APP_URL`

## Web app

Upload a PDF in the browser and the app will:

- extract text
- generate a 3-module course
- validate lessons
- save the course for replay and sharing

## CLI

```bash
pnpm course generate data/document.pdf
pnpm course modules data/document.pdf
pnpm course benchmark data/document.md --runs 5
```

Useful flags:

- `--model <name>`
- `--output <path>`
- `--save-text-auto`
- `--no-validate`
- `--no-retry`
- `--max-retries <n>`
- `--verbose`

## Architecture

How a PDF becomes a course.

```
                      PDF
                       │
                       ▼
              ┌────────────────┐
              │  OCR (MuPDF)   │   ~100ms, local
              └────────┬───────┘
                       │ text
                       ▼
            ┌─────────────────────┐
            │ generateModule-     │   1 LLM call
            │   Structure         │   → 3 module titles
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │ assignFlowsToModules│   1 LLM call
            │                     │   → 3 distinct processes,
            └──────────┬──────────┘     one per module
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
  ┌────────┐      ┌────────┐      ┌────────┐
  │ Mod 1  │      │ Mod 2  │      │ Mod 3  │   3 modules
  │ (par.) │      │ (par.) │      │ (par.) │   running
  └───┬────┘      └───┬────┘      └───┬────┘   concurrently
      │               │               │         (Promise.all)
      └───────────────┼───────────────┘
                      │ lessons[]
                      ▼
            ┌─────────────────────┐
            │   dedupRepair       │   regen any near-dupes;
            │   (regen → drop)    │   drop the survivors
            └──────────┬──────────┘
                       │
                       ▼
                     Course
```

Each module does its own work in parallel:

```
  ┌─ Mod N ──────────────────────────────────────┐
  │  generateText(standardLessons)   ──┐         │   1 LLM call
  │                                    ├── join  │   (3 lessons)
  │  generateFlowLessonCombined(...)   ──┘       │   1 LLM call
  │       (knows its assigned process)           │   (flow lesson)
  └──────────────────────────────────────────────┘
```

### Pipeline steps

1. **OCR.** Local MuPDF text extraction — free, ~100 ms.
2. **`generateModuleStructure`.** One LLM call returns 3 module titles.
3. **`assignFlowsToModules`.** One LLM call returns 3 *distinct* sequential processes from the source — one per module. Eliminates cross-module flow-diagram collisions by construction. Returns `null` for a module if the source has no suitable distinct process; that module skips its flow lesson rather than fabricating one.
4. **Parallel module generation.** All 3 modules run in `Promise.all`. Each module makes 2 LLM calls concurrently: 3 standard lessons (short-answer + true-false + multiple-choice) in one call, plus 1 combined flow-diagram lesson — detection and ordering question in one call (was 2 separate calls before).
5. **`dedupRepair`.** Jaccard-similarity detection (≥0.5) across all questions. For each duplicate group: keep one, regenerate the rest serially with `previousQuestions` context. Any that survive regen get marked `success: false` with `validationType: "duplicate"` — consumers filter these out at render time.

### Design decisions

- **Parallel modules over sequential** sacrifices the previous "module N sees questions from modules 1..N-1" deduplication chain. We get it back via the distinct-flow assignment (eliminates flow dupes) plus the dedup-repair pass (handles standard-lesson dupes).
- **Combined flow** (one call for both detect + question) trades a tiny bit of prompt complexity for one fewer round-trip per module.
- **Dropping the per-lesson LLM-judge validator** removed ~25% of total latency. The new model and grounding-aware prompts produce equal or better quality without it.
- **Hybrid dedup (regen → drop)** trades ~1.6 lessons on worst-case PDFs for zero visible duplicates and higher quality on what ships.

### Numbers

5-iter average across all 6 PDFs in `data/pdfs/`, claude-judged:

| | Old (M2.7, sequential) | New (gpt-oss-120b, parallel) |
|---|---|---|
| Time / course | ~400s | **~50s** (~8.7×) |
| Cost / course | ~$0.03 | **~$0.012** (~2.5×) |
| Correctness | 92% | **100%** |
| Grounded | 85% | **100%** |
| Duplicates | 2 / course | **0 / course** |

Full benchmark breakdown in [`docs/course-generation-speedup.md`](docs/course-generation-speedup.md).

### Code map

- `lib/create-course.ts` — public entry. Thin wrapper around `lib/pipeline`.
- `lib/pipeline/index.ts` — `generateCourse`, the orchestrator above.
- `lib/pipeline/assign-flows.ts` — distinct-process assignment.
- `lib/pipeline/combined-flow.ts` — single-call flow generator.
- `lib/pipeline/dedup-repair.ts` — Jaccard dedup + regen + drop.
- `lib/create-lesson.ts` — per-module lesson generation (standard + flow).
- `scripts/bench/` — model shootout + cost / variance instrumentation.
- `scripts/eval-all.ts` — full quality eval with `--judge=claude` for `claude -p` subscription auth.

## Notes

- PDF extraction uses MuPDF OCR.
- Course generation uses Together-hosted models.
- Benchmark scripts live in `scripts/bench/`.
