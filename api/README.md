# Python API

Flask API endpoints for Vercel.

## Run Locally

```bash
source .venv/bin/activate
cd api && python index.py
```

Test: `curl http://127.0.0.1:5000/` or `curl http://127.0.0.1:5000/hello`

## Deploy

Vercel auto-detects Python files. Just push:
```bash
git push
```

Endpoint: `https://your-app.vercel.app/api` or `https://your-app.vercel.app/api/hello`

