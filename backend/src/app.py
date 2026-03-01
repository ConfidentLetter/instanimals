import os

from dotenv import load_dotenv
load_dotenv()

import firebase_admin
from firebase_admin import credentials, firestore

from pathlib import Path

from flask import Flask, jsonify, request, render_template

cred_path = os.environ.get('FIREBASE_CREDENTIALS')

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

_frontend = Path(__file__).resolve().parent.parent.parent / 'frontend'
app = Flask(__name__, template_folder=_frontend)

@app.route('/')
def index():
    return render_template('index.html')



_ip = "2a09:bac2:6289:123c::1d1:d2" # temp for now. ill change it when we have a way to get the user's ip

@app.route('/find-shelters', methods=['POST'])
def receive_coords():
    data = request.get_json()
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    print(f"Received coordinates: Latitude: {latitude}, Longitude: {longitude}")

    return jsonify({
            "status": "success",
            "message": f"python got coords {latitude}, {longitude}"
        })