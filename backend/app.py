from flask import Flask, request, jsonify, send_from_directory
from compiler.engine import run_program, TinyBasicError, InputRequired

# Resolve the frontend directory relative to this file, not the terminal's
# current working directory. Serve /app.js and /styles.css at the site root.
frontend_dir = app_frontend_dir = __file__.rsplit("\\", 1)[0] + "\\..\\frontend" if "\\" in __file__ else __file__.rsplit("/", 1)[0] + "/../frontend"
app = Flask(__name__, static_folder=frontend_dir, static_url_path="")

@app.get("/")
def home():
    return send_from_directory(frontend_dir, "index.html")

@app.post("/api/run")
def run():
    data = request.get_json(silent=True) or {}
    try:
        result = run_program(data.get("code", ""), data.get("inputs", []))
        return jsonify(result)
    except InputRequired as exc:
        return jsonify({"status": "input_required", "variable": exc.variable,
                        "output": exc.output, "error": None})
    except TinyBasicError as exc:
        return jsonify({"status": "error", "output": [], "error": str(exc)}), 400

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
