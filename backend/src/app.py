import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabsClient
from firebase_admin import credentials, firestore
from flask import Flask, jsonify, render_template, request

load_dotenv()

cred_path = os.environ.get("FIREBASE_CREDENTIALS")
elevenlabs_api_path = os.environ.get("ELEVEN_LABS_API_KEY")

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
elevenlabs_client = ElevenLabsClient(api_key=elevenlabs_api_path)

_frontend = Path(__file__).resolve().parent.parent.parent / "frontend"
app = Flask(__name__, template_folder=_frontend)


@app.route("/")
def index():
    return render_template("index.html")


_ip = "2a09:bac2:6289:123c::1d1:d2"  # TODO: search for user ip regularly later


@app.route("/find-shelters", methods=["POST"])
def find_shelters():
    data = request.get_json()
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    print(f"Received coordinates: Latitude: {latitude}, Longitude: {longitude}")

    return jsonify(
        {
            "status": "success",
            "message": f"Coordinates received: {latitude}, {longitude}",
        }
    )
