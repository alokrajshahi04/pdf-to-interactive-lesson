# PDF to Interactive Lesson Generator

An AI-powered tool that converts PDFs and markdown documents into structured, interactive course lessons with automatic validation and quality assurance.

## Features

- 📄 **PDF & Markdown Support**: Extract content from PDFs or markdown files (max 100 pages)
- 🤖 **AI-Powered Generation**: Uses DeepSeek-V3.1 to create course structures and lessons
- ✅ **Two-Tier Validation**:
  - Fast deterministic structure validation (schema, types, required fields)
  - LLM-based content validation (factual accuracy, question quality)
- 🔧 **Automatic Retry**: Failed lessons are automatically fixed and re-validated (default: 3 attempts)
- 📊 **Multiple Question Types**: short-answer, true-false, multiple-choice, drag-drop, and flow-diagram
- 📝 **JSON Output**: Generates structured JSON files for easy integration
- 🔗 **Course Sharing**: Share courses via links with automatic database storage (powered by Neon PostgreSQL)
- ⚡ **JSON Upload**: Skip PDF processing - upload pre-generated course JSON files directly for instant course creation

## Quick Start

```bash
# One-time setup (installs all dependencies)
pnpm setup

# Copy environment variables and add your API keys
cp .env.example .env.local

# Set up database (required for sharing)
pnpm db:push

# Start both servers
pnpm dev
# - Next.js: http://localhost:3000
# - Flask API: http://localhost:8000
```

Or run individually:
- `pnpm dev:next` - Just Next.js
- `pnpm dev:api` - Just Flask API

### Instant Course Upload

Already have a course JSON file? Skip the PDF processing entirely:

1. Go to http://localhost:3000
2. Click "Upload a PDF or JSON" or drag-and-drop your `.json` file
3. Course is instantly saved to database and ready to share

This is perfect for:
- Re-uploading previously generated courses
- Migrating courses between environments
- Sharing course JSON files with team members
- Testing and development

#### Expected JSON Format

The JSON file should follow this structure:

```json
{
  "title": "Course Title",
  "modules": [
    {
      "title": "Module Title",
      "lessons": [
        {
          "success": true,
          "data": {
            "title": "Lesson Title",
            "content": "Lesson content...",
            "info": "Key takeaway...",
            "question": "Question text?",
            "questionType": "multiple-choice",
            "choices": ["A", "B", "C", "D"],
            "answer": 1
          }
        }
      ]
    }
  ]
}
```

See `lib/demo/transformer-course.json` for a complete example.

## CLI Usage

### Generate a Full Course

```bash
course generate data/document.pdf
```

### Generate Only Course Modules

```bash
course modules data/document.pdf
```

### CLI Options

```
Options:
  --output <path>            Save output to specific path
  --save-text <path>         Save extracted text to file (PDFs only)
  --save-text-auto           Save text next to PDF as .md file
  --no-validate              Disable all validation
  --no-validate-structure    Disable structure validation only
  --no-validate-content      Disable content validation only (saves time/cost)
  --no-retry                 Disable automatic retry/fix of failed lessons
  --max-retries <num>        Maximum retry attempts (default: 3)
  --runs <num>               Run generation n times (for testing)
  --verbose                  Show detailed validation errors
```

### Examples

```bash
# Basic usage
course generate data/document.pdf

# Generate and cache OCR text for faster re-runs
course generate data/document.pdf --save-text-auto

# Use cached text (much faster)
course generate data/document.md

# Disable validation for faster generation
course generate data/document.pdf --no-validate

# Disable retry mechanism
course generate data/document.pdf --no-retry

# Increase retry attempts for better quality
course generate data/document.pdf --max-retries 5

# Custom output path
course generate data/document.pdf --output course.json

# From URL
course modules https://example.com/doc.pdf

# Show detailed validation errors
course generate data/document.pdf --verbose
```

## Output Structure

The generated JSON follows this structure:

```json
{
  "title": "Course Title",
  "modules": [
    {
      "title": "Module Title",
      "lessons": [
        {
          "success": true,
          "data": {
            "title": "Successful Lesson",
            "content": "Educational content...",
            "info": "Key takeaway...",
            "question": "Test question?",
            "questionType": "multiple-choice",
            "choices": ["Option A", "Option B", "Option C", "Option D"],
            "answer": 1,
            "fixHistory": [
              {
                "attempt": 0,
                "validationType": "content",
                "reason": "Content validation failed",
                "details": ["The question was ambiguous..."],
                "lesson": {
                  /* original failed version */
                }
              }
            ]
          }
        },
        {
          "success": false,
          "data": {
            /* partial/invalid lesson data */
          },
          "error": {
            "validationType": "content",
            "reason": "Failed to fix lesson after 3 attempts",
            "details": ["Final error messages..."],
            "attempts": 3,
            "fixHistory": [
              {
                "attempt": 0,
                "validationType": "content",
                "reason": "Content validation failed",
                "details": ["Original error..."],
                "lesson": {
                  /* original failed lesson */
                }
              },
              {
                "attempt": 1,
                "validationType": "content",
                "reason": "Content validation failed",
                "details": ["Still incorrect..."],
                "lesson": {
                  /* lesson after first fix attempt */
                }
              }
            ]
          }
        },
        {
          "success": true,
          "data": {
            "title": "Another Lesson",
            "questionType": "short-answer",
            "answer": "The answer..."
          }
        }
      ]
    }
  ]
}
```

### Lesson Structure

Each lesson in the `lessons` array has a `success` flag indicating whether it passed validation:

**Successful Lessons** (`success: true`):

- **data**: Contains the complete lesson object with all fields
- **fixHistory** (optional): Only present if the lesson was fixed after initial failures
  - Tracks all validation failures before it succeeded
  - Each entry includes the lesson snapshot at that attempt
  - Provides a complete debugging trail of what changed

**Failed Lessons** (`success: false`):

- **data**: Contains partial/invalid lesson data
- **error**: Object containing all error metadata
  - **validationType**: Whether it failed "structure" or "content" validation
  - **reason**: Summary of why it failed
  - **details**: Specific error messages
  - **attempts** (optional): Number of fix attempts made (when retry is enabled)
  - **fixHistory** (optional): Complete history of all fix attempts
    - Each entry includes the lesson snapshot at that attempt
    - Shows how the lesson evolved even though it ultimately failed

### Key Benefits

**Unified Structure:**

- ✅ All lessons in one array, preserving order
- ✅ Easy to filter: `lessons.filter(l => l.success)` for successful lessons
- ✅ Simple mental model: check `success` flag to determine status
- ✅ Complete history available for both successes and failures

**Debugging Power:**

- Compare lesson snapshots across attempts to see what changed
- Understand patterns in what the LLM tried to fix
- Determine if more retries would help or if manual intervention is needed
- See the complete evolution from initial failure to final state

Example: A lesson with `success: true` and 2 attempts in `fixHistory` means it initially failed (attempt 0), was regenerated and failed again (attempt 1), then succeeded on attempt 2. Each `fixHistory` entry includes the lesson snapshot, allowing you to diff versions.

## Validation System

### Structure Validation (Fast)

- Validates schema and required fields
- Checks data types and formats
- Validates question-type specific requirements
- Runs deterministically without AI calls

### Content Validation (Comprehensive)

- Verifies factual accuracy against source material
- Checks question quality and clarity
- Validates answer correctness
- Ensures choices are distinct and plausible (for multiple-choice)
- Uses AI for semantic understanding

### Automatic Retry System

When a lesson fails validation:

1. The system analyzes the failure reasons
2. Asks the LLM to regenerate the lesson with corrections
3. Re-validates the fixed lesson
4. Repeats up to `maxRetries` times (default: 3)
5. Successfully fixed lessons are added back to the course
6. Permanently failed lessons are reported in the `failures` array

## Question Types

### Short Answer

```json
{
  "questionType": "short-answer",
  "question": "What is...?",
  "answer": "The answer is..."
}
```

### True/False

```json
{
  "questionType": "true-false",
  "question": "Statement to evaluate",
  "answer": true
}
```

### Multiple Choice

```json
{
  "questionType": "multiple-choice",
  "question": "What is...?",
  "choices": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 2
}
```

Note: For multiple-choice, `answer` is the 0-based index of the correct choice. Choices can be strings or numbers.

## Development

### Run Tests

```bash
# Test structure validation
bun run lib/validate-lesson-structure.test.ts

# Test content validation
bun run lib/create-lesson.test.ts
```

### Project Structure

```
bin/
  course.ts                       - CLI interface (arg parsing, display, file I/O)
  _course                         - Zsh completion script

lib/
  create-course.ts                - Course generation orchestration (modules + lessons)
  create-lesson.ts                - Lesson generation and validation
  fix-lesson.ts                   - Automatic lesson fixing/retry logic
  validate-lesson-structure.ts    - Deterministic structure validation
  ocr.ts                          - PDF text extraction
  types.ts                        - Shared TypeScript interfaces
  utils/
    together.ts                   - Together AI client and model configuration
    xml.ts                        - XML parsing utilities
```

### Architecture

The codebase follows a clean separation of concerns:

- **`create-course.ts`**: Core business logic for course generation

  - `createModules()` - Generate course structure (modules only)
  - `createCourse()` - Generate complete course (modules + lessons)
  - Can be called programmatically from anywhere (CLI, Next.js app, etc.)

- **`bin/course.ts`**: User interface layer

  - Argument parsing and validation
  - Display formatting with ora spinners
  - File I/O operations
  - Calls business logic functions from `create-course.ts`

- **`create-lesson.ts`**: Lesson generation with validation

  - `createLessons()` - Generate lessons for a module
  - `validateLesson()` - LLM-based content validation
  - Integrates structure and content validation

- **`fix-lesson.ts`**: Automatic quality improvement

  - `fixLesson()` - Retry failed lessons with LLM feedback
  - Tracks full history of fix attempts

- **`utils/ai-client.ts`**: Centralized AI configuration
  - Shared Together AI client instance
  - Default model configuration (`DEFAULT_MODEL`)
  - Single source of truth for API credentials

This architecture allows easy reuse of course generation logic across different interfaces (CLI, web app, API, etc.).

### Programmatic Usage

You can use the course generation functions directly in your code:

```typescript
import { createCourse, createModules } from "./lib/create-course";

// Generate a complete course
const course = await createCourse({
  content: markdownContent,
  validateStructure: true,
  validateContent: true,
  retryFailures: true,
  maxRetries: 3,
});

// Or just generate modules
const modules = await createModules({ content: markdownContent });
```

This makes it easy to integrate course generation into:

- Web applications (Next.js, React, etc.)
- REST APIs
- Serverless functions
- Background jobs
- Testing frameworks

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

### Required Variables

**`TOGETHER_API_KEY`** - Together AI API key for course generation
- Get your API key from [Together AI](https://www.together.ai/)
- Required for both CLI and web interface

**`BLOB_READ_WRITE_TOKEN`** - Vercel Blob storage token
- Required for the web interface to upload and store PDFs
- Get this from Vercel Dashboard → Storage → Blob → Connect
- Not required for CLI usage

**`DATABASE_URL`** - Neon PostgreSQL database connection string
- Required for course sharing functionality
- Get this from [Neon](https://neon.tech/) after creating a project
- Format: `postgresql://user:password@host/database?sslmode=require`
- See [Neon Database Setup](#neon-database-setup) below for detailed instructions

### Optional Variables

**`RAILWAY_API_URL`** - Railway API URL for PDF conversion
- If not set, uses local PDF.js (may have issues with some PDFs)
- Deploy the Flask API from `/api` to Railway and set this URL
- Example: `https://your-app.railway.app`

## Neon Database Setup

This application uses Neon PostgreSQL for storing and sharing courses.

### Step 1: Create a Neon Project

1. Go to [Neon](https://neon.tech/) and sign up for a free account
2. Create a new project
3. Copy the connection string from the dashboard

### Step 2: Configure Environment Variables

Add the connection string to your `.env.local`:

```bash
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

### Step 3: Run Database Migrations

Push the schema to your Neon database:

```bash
pnpm db:push
```

This will create the `courses` table with the following schema:
- `id` (UUID) - Unique course identifier
- `slug` (text) - URL-friendly course identifier
- `title` (text) - Course title
- `course_data` (jsonb) - Complete course content
- `is_public` (boolean) - Visibility flag
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

### Step 4: Verify Connection

Check that your database is connected:

```bash
curl http://localhost:3000/api/health
```

You should see a response indicating the database is connected.

### Database Commands

```bash
# Push schema changes to database (recommended for development)
pnpm db:push

# Generate migrations from schema
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

## Notes

- Validation and retry are **enabled by default** for best quality
- Failed lessons are filtered out from the final output but reported in the `failures` array
- Use `--no-retry` if you want faster generation without quality improvements
- Use `--no-validate-content` to save API costs during development
- PDFs are processed using OCR for text extraction (max 100 pages supported)
- Large PDFs may take several minutes to process

## Next.js Web Interface

This project also includes a Next.js web interface (work in progress).

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to access the web interface.

## License

MIT
