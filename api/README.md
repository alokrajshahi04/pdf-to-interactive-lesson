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

## Test the API

```bash
# Health check
curl http://localhost:8000/health

# Get PDF info
curl -X POST http://localhost:8000/pdf-info \
  -F "file=@/path/to/your/document.pdf"

# Convert single page to image
curl -X POST http://localhost:8000/pdf-page-to-image \
  -F "file=@/path/to/your/document.pdf" \
  -F "page=1"
```

## API Endpoints

### `POST /pdf-info`
Get PDF page count and metadata

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (PDF file)

**Response:**
```json
{
  "success": true,
  "pageCount": 15,
  "title": "Introduction to Transformers",
  "author": "Vaswani et al."
}
```

### `POST /pdf-page-to-image`
Convert a single PDF page to PNG image (base64 encoded)

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (PDF file)
- Field: `page` (page number, 1-indexed)

**Response:**
```json
{
  "success": true,
  "page": 1,
  "data": "iVBORw0KGgoAAAANSUhEUgAA...",
  "width": 1240,
  "height": 1754
}
```

**Why single page?**
- Smaller payloads (~500KB vs 7.5MB for 15 pages)
- Call concurrently in Next.js for parallel processing
- Better error handling per page
- Faster perceived performance

## Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Set root directory to `api`
4. Railway auto-deploys!
5. Copy your Railway URL and add to Vercel env: `RAILWAY_API_URL=https://your-app.railway.app`
