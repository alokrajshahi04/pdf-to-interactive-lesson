# Python API Endpoints

This directory contains Python serverless functions for Vercel.

## Local Development

### Test locally with Vercel CLI

Python serverless functions need to run in the Vercel environment to work properly. You can't test them with `python3 -m http.server` as that just serves static files.

**Option 1: Use Vercel Dev (Recommended)**

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Run local dev server
vercel dev

# Or specify a port
vercel dev --listen 3001
```

Then test: `http://localhost:3000/api/hello`

**Option 2: Deploy to Vercel Preview**

The easiest way is to just push and test on Vercel:

```bash
git add .
git commit -m "Add Python endpoint"
git push
```

Then test the preview URL that Vercel generates.

## Testing on Vercel

Once deployed, the endpoint will be available at:
- `https://your-app.vercel.app/api/hello` (GET)
- `https://your-app.vercel.app/api/hello` (POST)

### Test with curl

```bash
# GET request
curl https://your-app.vercel.app/api/hello

# POST request
curl -X POST https://your-app.vercel.app/api/hello \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Adding Dependencies

Add dependencies to `pyproject.toml`:

```toml
[project]
dependencies = [
    "pymupdf>=1.23.0",
]
```

Then run:
```bash
uv sync
```

Vercel will automatically install dependencies from `pyproject.toml` during deployment.

