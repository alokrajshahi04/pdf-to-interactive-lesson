from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/')
@app.route('/hello', methods=['GET', 'POST'])
def hello():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else {}
        return jsonify({
            "message": "Hello from Python POST!",
            "received": data,
            "status": "success"
        })
    
    return jsonify({
        "message": "Hello from Python on Vercel!",
        "status": "success",
        "runtime": "flask"
    })

# For local development
if __name__ == '__main__':
    app.run(debug=True, port=5000)

