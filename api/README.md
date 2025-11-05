# Python API

Python serverless functions for Vercel.

## Endpoints

- `/api/test` - Hello world test
- `/api/pdf` - PDF to images (PyMuPDF)

## Test PDF Endpoint

```bash
# Test with a PDF
curl -X POST https://your-app.vercel.app/api/pdf \
  --data-binary @path/to/file.pdf \
  -H "Content-Type: application/pdf"
```

## Deploy

```bash
git push
```

Vercel auto-detects Python files in `api/` directory.

