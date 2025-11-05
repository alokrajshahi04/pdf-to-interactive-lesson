from flask import Flask, jsonify, request
import fitz  # PyMuPDF
import base64
import io

app = Flask(__name__)

# Max file size: 50MB
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

@app.route('/')
def hello():
    return jsonify({
        "message": "Hello from Flask on Railway!",
        "status": "success"
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

@app.route('/pdf-info', methods=['POST'])
def pdf_info():
    """Get PDF page count and metadata"""
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400
    
    try:
        pdf_bytes = file.read()
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        page_count = len(pdf_document)
        metadata = pdf_document.metadata
        
        pdf_document.close()
        
        return jsonify({
            "success": True,
            "pageCount": page_count,
            "title": metadata.get("title", ""),
            "author": metadata.get("author", "")
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/pdf-page-to-image', methods=['POST'])
def pdf_page_to_image():
    """Convert a single PDF page to PNG image, return as base64"""
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400
    
    # Get page number (1-indexed)
    page_num = request.form.get('page', '1')
    try:
        page_num = int(page_num)
        if page_num < 1:
            return jsonify({"error": "Page number must be >= 1"}), 400
    except ValueError:
        return jsonify({"error": "Invalid page number"}), 400
    
    try:
        # Read PDF from upload
        pdf_bytes = file.read()
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Check if page exists
        if page_num > len(pdf_document):
            pdf_document.close()
            return jsonify({
                "error": f"Page {page_num} does not exist. PDF has {len(pdf_document)} pages."
            }), 400
        
        # Get the page (0-indexed in PyMuPDF)
        page = pdf_document[page_num - 1]
        
        # Render page to pixmap (image)
        # zoom=2 gives 144 DPI (good for OCR)
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PNG bytes
        png_bytes = pix.tobytes("png")
        
        # Encode to base64
        base64_image = base64.b64encode(png_bytes).decode('utf-8')
        
        pdf_document.close()
        
        return jsonify({
            "success": True,
            "page": page_num,
            "data": base64_image,
            "width": pix.width,
            "height": pix.height
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)

