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

## Web app

Upload a PDF in the browser and the app will:

- extract text
- generate a 3-module course
- validate lessons
- save the course for replay and sharing

You can also upload an already-generated course JSON.

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

## Notes

- PDF extraction uses MuPDF OCR.
- Course generation uses Together-hosted models.
- Benchmark scripts live in `scripts/`.
