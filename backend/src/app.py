import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from firebase_admin import credentials, firestore, storage
from flask import Flask, jsonify, render_template, request
from algorithms.recommender import build_advanced_matrix, get_hybrid_recommendations

load_dotenv()

cred_path = os.environ.get("FIREBASE_CREDENTIALS")
elevenlabs_api_path = os.environ.get("ELEVEN_LABS_API_KEY")

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_path)

_frontend = Path(__file__).resolve().parent.parent.parent / "frontend"
app = Flask(__name__, template_folder=_frontend)


@app.route("/")
def index():
    return render_template("index.html")


VOICE_IDS = {"male": "s3TPKV1kjDlVtZbl4Ksh", "female": "d3MFdIuCfbAIwiu7jC4a"}

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


@app.route("/generate-animal-speech", methods=["POST"])
def generate_animal_speech():
    data = request.get_json()
    text = data.get("text")
    gender = data.get("gender")
    animal_id = data.get("animal_id")

    if not text or not gender:
        return jsonify({"status": "error", "message": "Missing text or gender"})

    if gender not in VOICE_IDS:
        return jsonify({"status": "error", "message": "Invalid gender"}), 400

    audio_ref = db.collection("animal_speech").document(f"{animal_id}_{gender}")
    doc = audio_ref.get()

    if doc.exists():
        return jsonify({"status": "success", "audio_url": doc.get("audio_url")})

    try:
        audio = elevenlabs_client.text_to_speech.convert(
            text=text, voice_id=VOICE_IDS[gender], model_id="eleven_monolingual_v1"
        )

        bucket = storage.bucket()
        blob = bucket.blob(f"animal_speech/{animal_id}_{gender}.mp3")
        blob.upload_from_string(audio, content_type="audio/mpeg")

        audio_ref.set(
            {
                "audio_url": blob.public_url,
                "text": text,
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )

        return jsonify({"status": "success", "audio_url": blob.public_url})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/recommend", methods=["GET"])
def recommend():
    try:
        target_id = request.args.get("shelter_id", type=int)

        interactions_ref = db.collection("interactions")
        docs = interactions_ref.stream()

        raw_data = []
        for doc in docs:
            data = doc.to_dict()
            raw_data.append({
                "foster_id": data.get("foster_id"),
                "shelter_id": data.get("shelter_id"),
                "follow": data.get("follow"),
                "star": data.get("star"),
                "lowest_age": data.get("lowest_age"),
                "quantity_anim": data.get("quantity_anim")
            })

        matrix = build_advanced_matrix(raw_data)
        recommendations = get_hybrid_recommendations(target_id, matrix)

        enriched_results = []
        for s_id, score in recommendations.items():
            shelter_doc = db.collection("shelters").document(str(s_id)).get()

            if shelter_doc.exists:
                info = shelter_doc.to_dict()
                enriched_results.append({
                    "shelter_id": int(s_id),
                    "name": info.get("name"),
                    "image_url": info.get("image_url"),
                    "similarity": round(float(score), 2)
                })

        return jsonify(enriched_results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=8080)
