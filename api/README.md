# Flask API for Railway

Python Flask API with PyMuPDF for PDF processing.

## Local Development

```bash
cd api
uv venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows
uv pip install -e .
python app.py
```

Visit: http://localhost:8000

## Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Set root directory to `api`
4. Railway auto-deploys!
