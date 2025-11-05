# Python API Endpoints

This directory contains Python serverless functions for Vercel.

## Local Development with uv

### Install uv (if not already installed)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Test locally

```bash
# Install dependencies (when we add them later)
uv sync

# Test the endpoint locally with Python
cd api
python3 -m http.server 8000
```

Then visit: `http://localhost:8000/hello.py`

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

