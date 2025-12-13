from flask import Flask
import os

app = Flask(__name__)

@app.route("/")
def hello():
    return f"Hello from my DevOps homelab 👋<br>Version: {os.getenv('APP_VERSION', 'dev')}"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
