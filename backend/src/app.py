#


import html
import json
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urljoin, urlparse

import firebase_admin
import google.genai as genai
import requests as http_requests
import typing_extensions as typing
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from firebase_admin import credentials, firestore, storage
from flask import (
    Flask,
    Response,
    jsonify,
    render_template,
    request,
    send_from_directory,
)
from google.genai import types as genai_types

# from algorithms.recommender import build_advanced_matrix, get_hybrid_recommendations

load_dotenv()

cred_path = os.environ.get("FIREBASE_CREDENTIALS")
elevenlabs_api_path = os.environ.get("ELEVEN_LABS_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

_gemini_client = genai.Client(api_key=GEMINI_API_KEY)


class ShelterRecord(typing.TypedDict):
    shelter_id: int
    lowest_age: int
    quantity_anim: int
    image_url: str


def extract_shelter_data_from_text(raw_website_text: str, shelter_id: int):
    prompt = f"""
You are a data extraction assistant analyzing raw website text from a local animal shelter.
Find all the available dogs.
Calculate the lowest age among the dogs found and return it as an integer in months for 'lowest_age'.
Count the total number of dogs found for 'quantity_anim'.
Find one valid image URL of a dog and return it for 'image_url'.
Use {shelter_id} for the shelter_id.
"""
    try:
        result = _gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{prompt}\n\nRAW TEXT:\n{raw_website_text}",
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[ShelterRecord],
            ),
        )
        return json.loads(result.text)
    except Exception:
        return []


if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_path)

_frontend = Path(__file__).resolve().parent.parent.parent / "frontend"
app = Flask(
    __name__,
    template_folder=_frontend,
)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path):
    if path:
        file_path = _frontend / path
        if file_path.is_file():
            return send_from_directory(_frontend, path)
    return render_template("index.html")


VOICE_IDS = {
    "male": "pNInz6obpgDQGcFmaJgB",
    "female": "21m00Tcm4TlvDq8ikWAM",
}  # Adam / Rachel


@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    username = data.get("username")

    if not email or not password or not username:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    existing = db.collection("userIdentification").where("email", "==", email).get()
    if existing:
        return jsonify(
            {
                "status": "error",
                "message": "There is already an account associated with this email!",
            }
        ), 409

    handle = f"{username}-{uuid.uuid4().hex[:8]}"
    db.collection("userIdentification").add(
        {"email": email, "password": password, "username": username, "handle": handle}
    )

    return jsonify({"status": "success", "username": username, "handle": handle})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"status": "error", "message": "Missing email or password"}), 400

    results = (
        db.collection("userIdentification")
        .where("email", "==", email)
        .where("password", "==", password)
        .get()
    )
    if not results:
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

    user = results[0].to_dict()
    return jsonify(
        {
            "status": "success",
            "username": user.get("username"),
            "handle": user.get("handle", user.get("username")),
        }
    )


_SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def _strip_html(raw):
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return re.sub(r"\s{2,}", " ", text).strip()


def _fetch_soup(url, timeout=8):
    resp = http_requests.get(
        url, headers=_SCRAPE_HEADERS, timeout=timeout, allow_redirects=True
    )
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def _candidate_adopt_urls(base_url, home_soup):
    base_domain = urlparse(base_url).netloc
    found, seen = [], {base_url}
    kw = ["adopt", "available", "animal", "pet", "dog", "cat", "foster", "listing"]
    for a in home_soup.find_all("a", href=True):
        combined = (a["href"] + " " + a.get_text()).lower()
        if any(k in combined for k in kw):
            full = urljoin(base_url, a["href"])
            if urlparse(full).netloc == base_domain and full not in seen:
                seen.add(full)
                found.append(full)
    for path in [
        "/adopt",
        "/adoptable-pets",
        "/available-animals",
        "/animals",
        "/pets",
        "/dogs",
        "/cats",
    ]:
        full = urljoin(base_url, path)
        if full not in seen:
            found.append(full)
    return found[:6]


def _scrape_shelter_text(website):
    """Fetch shelter homepage + candidate adoption pages, return combined plain body text."""
    texts = []
    try:
        home = _fetch_soup(website)
    except Exception:
        return ""

    def _body_text(soup):
        body = soup.find("body")
        if not body:
            return ""
        for tag in body.find_all(["script", "style", "noscript"]):
            tag.decompose()
        return re.sub(r"\s{2,}", " ", body.get_text(separator=" ", strip=True)).strip()

    texts.append(_body_text(home)[:3000])

    for url in _candidate_adopt_urls(website, home)[:3]:
        try:
            texts.append(_body_text(_fetch_soup(url))[:3000])
        except Exception:
            continue

    return " ".join(texts)[:8000]


def _overpass_shelters(lat, lon, radius):
    q = f'[out:json][timeout:25];(node["amenity"="animal_shelter"](around:{radius},{lat},{lon});way["amenity"="animal_shelter"](around:{radius},{lat},{lon}););out center tags;'
    resp = http_requests.post(
        "https://overpass-api.de/api/interpreter", data=q, timeout=20
    )
    return resp.json().get("elements", [])


def get_user_location(request_obj):
    ip = request_obj.headers.get("X-Forwarded-For", request_obj.remote_addr)
    if "," in ip:
        ip = ip.split(",")[0].strip()
    try:
        res = http_requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
        geo = res.json()
        if geo.get("status") == "success":
            return geo.get("lat"), geo.get("lon"), geo.get("city", "Nearby")
    except Exception:
        pass
    return 37.338, -121.886, "San José"


@app.route("/api/nearby-posts", methods=["GET"])
def nearby_posts():
    lat, lon, city = get_user_location(request)

    q = f'[out:json][timeout:25];(node["amenity"="animal_shelter"](around:30000,{lat},{lon});way["amenity"="animal_shelter"](around:30000,{lat},{lon}););out center tags;'
    try:
        overpass_res = http_requests.post(
            "https://overpass-api.de/api/interpreter", data=q, timeout=20
        )
        elements = overpass_res.json().get("elements", [])

        result = []
        for i, s in enumerate(elements[:10]):
            tags = s.get("tags", {})
            name = tags.get("name", "Local Animal Shelter")
            result.append(
                {
                    "id": i + 1,
                    "poster": name,
                    "isShelter": True,
                    "website": tags.get("website", ""),
                    "text": f"{name} is an animal shelter near {city}. Visit us to find your next companion!",
                    "media": "",
                    "likes": 0,
                    "location": city,
                    "comments": [],
                }
            )

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


_DEMO_ANIMALS = [
    {
        "id": "demo-1",
        "name": "Buddy",
        "age": "2 years",
        "description": "Buddy is a playful and energetic Aussie who loves fetch and belly rubs. Great with kids and other dogs!",
        "size": "Large",
        "gender": "Male",
        "image": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80",
        "breeds": "Australian Shephard",
        "shelter": "Local Shelter",
        "urgency": "critical",
    },
    {
        "id": "demo-2",
        "name": "Luna",
        "age": "3 years",
        "description": "Luna is a gentle tabby who loves cozy blankets and quiet afternoons. She's calm, affectionate, and perfect for apartment living.",
        "size": "Small",
        "gender": "Female",
        "image": "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=800&q=80",
        "breeds": "Tabby",
        "shelter": "Local Shelter",
        "urgency": "high",
    },
    {
        "id": "demo-3",
        "name": "Max",
        "age": "5 years",
        "description": "Max is a loyal and calm rescue who has been through a lot but still loves people. He does best as an only pet in a quiet home.",
        "size": "Mid-sized",
        "gender": "Male",
        "image": "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=800&q=80",
        "breeds": "Labrador Mix",
        "shelter": "Local Shelter",
        "urgency": "critical",
    },
    {
        "id": "demo-4",
        "name": "Cleo",
        "age": "1 year",
        "description": "Cleo is a curious and playful kitten who loves to explore every corner of the house. Fully vaccinated and ready for her forever home!",
        "size": "Small",
        "gender": "Female",
        "image": "https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=800&q=80",
        "breeds": "Domestic Medium-Hair",
        "shelter": "Local Shelter",
        "urgency": "medium",
    },
    {
        "id": "demo-5",
        "name": "Rocky",
        "age": "4 years",
        "description": "Rocky is an adventurous pup who loves hiking and outdoor activities. He's house-trained, knows basic commands, and is great on a leash.",
        "size": "Large",
        "gender": "Male",
        "image": "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80",
        "breeds": "Golden Retriever",
        "shelter": "Local Shelter",
        "urgency": "low",
    },
]


def _months_to_age_str(months):
    if months is None:
        return None
    months = int(months)
    if months < 12:
        return f"{months} month{'s' if months != 1 else ''}"
    years = months // 12
    rem = months % 12
    label = f"{years} year{'s' if years != 1 else ''}"
    if rem:
        label += f" {rem} month{'s' if rem != 1 else ''}"
    return label


@app.route("/api/adoptable-animals", methods=["GET"])
def adoptable_animals():
    return jsonify(_DEMO_ANIMALS)


@app.route("/api/foster-interest", methods=["POST"])
def foster_interest():
    data = request.get_json() or {}
    db.collection("fosterInterest").add(
        {
            **data,
            "submittedAt": firestore.SERVER_TIMESTAMP,
            "status": "pending",
        }
    )
    return jsonify({"ok": True, "message": "Application received!"})


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
    data = request.get_json() or {}
    text = data.get("text")
    gender = (data.get("gender") or "male").lower()

    if not text:
        return jsonify({"error": "Missing text"}), 400
    if gender not in VOICE_IDS:
        gender = "male"

    print(f"[TTS] gender={gender} voice={VOICE_IDS[gender]} text={text[:60]!r}")
    try:
        audio_chunks = elevenlabs_client.text_to_speech.convert(
            text=text, voice_id=VOICE_IDS[gender], model_id="eleven_turbo_v2_5"
        )
        audio_bytes = b"".join(audio_chunks)
        print(f"[TTS] success, {len(audio_bytes)} bytes")
        return Response(audio_bytes, mimetype="audio/mpeg")
    except Exception as e:
        print(f"[TTS] ERROR: {e}")
        return jsonify({"error": str(e)}), 500


# @app.route("/api/recommend", methods=["GET"])
# def recommend():
#     try:
#         target_id = request.args.get("shelter_id", type=int)

#         interactions_ref = db.collection("interactions")
#         docs = interactions_ref.stream()

#         raw_data = []
#         for doc in docs:
#             data = doc.to_dict()
#             raw_data.append({
#                 "foster_id": data.get("foster_id"),
#                 "shelter_id": data.get("shelter_id"),
#                 "follow": data.get("follow"),
#                 "star": data.get("star"),
#                 "lowest_age": data.get("lowest_age"),
#                 "quantity_anim": data.get("quantity_anim")
#             })

#         matrix = build_advanced_matrix(raw_data)
#         recommendations = get_hybrid_recommendations(target_id, matrix)

#         enriched_results = []
#         for s_id, score in recommendations.items():
#             shelter_doc = db.collection("shelters").document(str(s_id)).get()

#             if shelter_doc.exists:
#                 info = shelter_doc.to_dict()
#                 enriched_results.append({
#                     "shelter_id": int(s_id),
#                     "name": info.get("name"),
#                     "image_url": info.get("image_url"),
#                     "similarity": round(float(score), 2)
#                 })

#         return jsonify(enriched_results)
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=8080)
