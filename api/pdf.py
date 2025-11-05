from http.server import BaseHTTPRequestHandler
import json
import base64

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            
            # Read the PDF data
            pdf_data = self.rfile.read(content_length)
            
            if not pdf_data:
                self.send_error(400, "No PDF data received")
                return
            
            # Import PyMuPDF
            import fitz  # PyMuPDF
            
            # Open PDF from bytes
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            
            # Get page count
            page_count = len(doc)
            
            # Convert first page to image as proof of concept
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scale for quality
            img_data = pix.tobytes("png")
            
            # Encode to base64 for JSON response
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
            # Close document
            doc.close()
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "success": True,
                "message": "PDF processed successfully!",
                "pageCount": page_count,
                "firstPageImage": f"data:image/png;base64,{img_base64}",
                "imageSize": len(img_data)
            }
            
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            error_response = {
                "success": False,
                "error": str(e)
            }
            
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "message": "PDF processing endpoint. POST a PDF file to this endpoint.",
            "usage": "POST binary PDF data to /api/pdf"
        }
        
        self.wfile.write(json.dumps(response).encode('utf-8'))

