from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "message": "Hello from Python on Vercel!",
            "status": "success",
            "runtime": "python"
        }
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
        return
    
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "message": "Hello from Python POST!",
            "received": body,
            "status": "success"
        }
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
        return

