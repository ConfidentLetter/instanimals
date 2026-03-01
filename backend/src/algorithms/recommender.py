import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import auth, credentials, firestore
from flask import Flask, jsonify, render_template, request, send_from_directory

# --------------------------
# Firebase Admin init
# --------------------------
cred_path = os.environ.get("FIREBASE_CREDENTIALS")
if not cred_path:
    raise RuntimeError(
        "Missing FIREBASE_CREDENTIALS env var (path to service account json)."
    )

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

# --------------------------
# Flask init (MUST be before any @app.route)
# --------------------------
_frontend = Path(__file__).resolve().parent.parent.parent / "frontend"
app = Flask(__name__, template_folder=_frontend)


@app.get("/")
def index():
    return send_from_directory(_frontend, "index.html")


@app.get("/<path:filename>")
def serve_frontend_file(filename):
    if filename.startswith("api/"):
        return jsonify({"ok": False, "error": "not found"}), 404
    return send_from_directory(_frontend, filename)


# --------------------------
# Algo helpers
# --------------------------
def _ts_to_dt(ts):
    try:
        return (
            ts.replace(tzinfo=timezone.utc)
            if getattr(ts, "tzinfo", None) is None
            else ts
        )
    except Exception:
        return None


def _days_since(ts) -> float:
    dt = _ts_to_dt(ts)
    if not dt:
        return 0.0
    return max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0)


def _get(p: dict, key: str, default=None):
    v = p.get(key, default)
    return default if v is None else v


def compute_urgency(pet: dict) -> float:
    days = _days_since(pet.get("createdAt"))
    energy = float(_get(pet, "energy", 3))
    medical = bool(_get(pet, "medicalNeeds", False))
    views7d = float(_get(pet, "views7d", 0))

    score = (
        days * 2.0
        + (3.0 if energy >= 4 else 0.0)
        + (6.0 if medical else 0.0)
        - math.log(1.0 + views7d) * 2.0
    )
    return score


def build_why_urgent(pet: dict) -> dict:
    days = _days_since(pet.get("createdAt"))
    energy = int(_get(pet, "energy", 3))
    medical = bool(_get(pet, "medicalNeeds", False))
    views7d = float(_get(pet, "views7d", 0))

    reasons = []
    if medical:
        reasons.append("Medical needs")
    if energy >= 4:
        reasons.append("High energy")
    if days >= 7:
        reasons.append(f"Long stay ({int(days)}d)")
    if views7d <= 1:
        reasons.append("Low visibility")

    if not reasons:
        reasons.append("Needs exposure")

    return {"daysInShelter": round(days, 1), "whyUrgent": reasons[:3]}


def similarity(a: dict, b: dict) -> float:
    s = 0.0
    if _get(a, "species", "") == _get(b, "species", ""):
        s += 3.0
    if _get(a, "breed", "") == _get(b, "breed", ""):
        s += 6.0
    if _get(a, "size", "") == _get(b, "size", ""):
        s += 1.0
    return s


def diversify_rank(candidates: list, k: int = 12) -> list:
    if not candidates:
        return []
    picked = [candidates[0]]
    remaining = candidates[1:]
    while remaining and len(picked) < k:
        best = None
        best_score = None
        for c in remaining:
            sim = min(similarity(c, p) for p in picked)
            if best is None or sim < best_score:
                best = c
                best_score = sim
        picked.append(best)
        remaining.remove(best)
    return picked


def compute_match(pet: dict, user: dict) -> dict:
    reasons = []
    warnings = []
    score = 50

    energy = int(_get(pet, "energy", 3))
    medical = bool(_get(pet, "medicalNeeds", False))
    size = _get(pet, "size", "medium")

    has_yard = str(_get(user, "hasYard", "unknown")).lower()
    hours = float(_get(user, "hoursPerWeek", 5))
    exp = int(_get(user, "experienceLevel", 1))
    prefers_size = str(_get(user, "prefersSize", "any")).lower()

    if energy >= 4 and hours < 6:
        score -= 18
        warnings.append("High-energy pet but your available hours/week is low.")
    elif energy >= 4 and hours >= 10:
        score += 10
        reasons.append("Your schedule fits a high-energy pet.")
    elif energy <= 2 and hours >= 10:
        score += 4
        reasons.append("You have plenty of time for a calmer pet too.")

    if energy >= 4 and has_yard == "yes":
        score += 6
        reasons.append("A yard helps with high-energy pets.")
    if energy >= 4 and has_yard == "no":
        score -= 6
        warnings.append("No yard—high-energy pets may need more walks/training time.")

    if medical and exp <= 1:
        score -= 14
        warnings.append(
            "Pet may need medical care; consider more experience or support."
        )
    if medical and exp >= 2:
        score += 6
        reasons.append("Your experience level helps with medical needs.")
    if not medical:
        score += 2
        reasons.append("No special medical needs reported.")

    if prefers_size and prefers_size != "any":
        if prefers_size == str(size).lower():
            score += 8
            reasons.append(f"Matches your preferred size ({size}).")
        else:
            score -= 4
            warnings.append(f"Doesn't match your preferred size ({prefers_size}).")

    score = int(max(0, min(100, score)))
    return {"score": score, "reasons": reasons[:3], "warnings": warnings[:3]}


def _pet_public_fields(p: dict) -> dict:
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "species": p.get("species"),
        "breed": p.get("breed"),
        "ageMonths": p.get("ageMonths"),
        "size": p.get("size"),
        "energy": p.get("energy"),
        "medicalNeeds": p.get("medicalNeeds"),
        "status": p.get("status"),
        "coverImageUrl": p.get("coverImageUrl"),
        "locationCity": p.get("locationCity"),
        "createdAt": p.get("createdAt"),
        "views7d": p.get("views7d", 0),
    }


def register_algo_routes(app: Flask):
    @app.get("/api/pets/urgent")
    def api_urgent_pets():
        limit = int(request.args.get("limit", "12"))
        limit = max(1, min(50, limit))

        snaps = (
            db.collection("pets").where("status", "==", "adoptable").limit(100).stream()
        )
        items = []
        for s in snaps:
            d = s.to_dict() or {}
            d["id"] = s.id
            d["_urgency"] = compute_urgency(d)
            items.append(d)

        items.sort(key=lambda x: x["_urgency"], reverse=True)
        out = []
        for d in items[:limit]:
            o = _pet_public_fields(d)
            o["urgencyScore"] = round(float(d["_urgency"]), 2)
            why = build_why_urgent(d)
            o["daysInShelter"] = why["daysInShelter"]
            o["whyUrgent"] = why["whyUrgent"]

            out.append(o)

        return jsonify({"ok": True, "items": out})

    @app.get("/api/pets/explore")
    def api_explore_pets():
        limit = int(request.args.get("limit", "12"))
        limit = max(1, min(50, limit))

        snaps = (
            db.collection("pets").where("status", "==", "adoptable").limit(120).stream()
        )
        pool = []
        for s in snaps:
            d = s.to_dict() or {}
            d["id"] = s.id
            d["_urgency"] = compute_urgency(d)
            pool.append(d)

        pool.sort(key=lambda x: x["_urgency"], reverse=True)
        diversified = diversify_rank(pool, k=limit)

        out = []
        for d in diversified:
            o = _pet_public_fields(d)
            o["urgencyScore"] = round(float(d["_urgency"]), 2)
            out.append(o)

        return jsonify({"ok": True, "items": out})

    @app.get("/api/pets/<pet_id>/match")
    def api_pet_match(pet_id: str):
        snap = db.collection("pets").document(pet_id).get()
        if not snap.exists:
            return jsonify({"ok": False, "error": "pet not found"}), 404

        pet = snap.to_dict() or {}
        pet["id"] = snap.id

        user = {
            "hasYard": request.args.get("hasYard", "unknown"),
            "hoursPerWeek": request.args.get("hoursPerWeek", "5"),
            "experienceLevel": request.args.get("experienceLevel", "1"),
            "prefersSize": request.args.get("prefersSize", "any"),
        }

        result = compute_match(pet, user)
        return jsonify({"ok": True, "petId": pet_id, **result})


# register algo routes now that app exists
register_algo_routes(app)


# --------------------------
# Helpers
# --------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ok(data: Dict[str, Any], status: int = 200):
    return jsonify({"ok": True, **data}), status


def fail(message: str, status: int = 400, extra: Optional[Dict[str, Any]] = None):
    payload = {"ok": False, "error": message}
    if extra:
        payload.update(extra)
    return jsonify(payload), status


def get_bearer_token() -> Optional[str]:
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        return None
    return h.split(" ", 1)[1].strip()


def require_user() -> Tuple[str, Dict[str, Any]]:
    token = get_bearer_token()
    if not token:
        raise PermissionError("Missing Authorization: Bearer <Firebase ID token>")
    decoded = auth.verify_id_token(token)
    return decoded["uid"], decoded


def get_role(uid: str) -> str:
    shelter_doc = db.collection("shelters").document(uid).get()
    if shelter_doc.exists:
        return "shelter"
    user_doc = db.collection("users").document(uid).get()
    if user_doc.exists:
        return "user"
    return "user"


def require_role(expected: str) -> str:
    uid, _ = require_user()
    role = get_role(uid)
    if role != expected:
        raise PermissionError(
            f"Forbidden: requires role={expected}, but you are role={role}"
        )
    return uid


def doc_to_dict(doc_snap):
    d = doc_snap.to_dict() or {}
    d["id"] = doc_snap.id
    return d


def int_or_none(x):
    try:
        return int(x)
    except Exception:
        return None


def clamp(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))


# --------------------------
# Health
# --------------------------
@app.get("/api/healthz")
def health():
    return ok({"time": now_iso()})


# --------------------------
# Shelters
# --------------------------
@app.get("/api/shelters")
def list_shelters():
    limit = clamp(int_or_none(request.args.get("limit")) or 20, 1, 50)
    snaps = db.collection("shelters").limit(limit).stream()
    items = [{"id": s.id, **(s.to_dict() or {})} for s in snaps]
    return ok({"items": items})


# --------------------------
# Pets (public read)
# --------------------------
@app.get("/api/pets")
def search_pets():
    limit = clamp(int_or_none(request.args.get("limit")) or 20, 1, 50)
    breed = request.args.get("breed")
    status = request.args.get("status")
    city = request.args.get("city")
    shelter_id = request.args.get("shelterId")

    q = db.collection("pets")
    if shelter_id:
        q = q.where("shelterId", "==", shelter_id)
    if status:
        q = q.where("status", "==", status)
    if city:
        q = q.where("locationCity", "==", city)
    if breed:
        q = q.where("breed", "==", breed)

    q = q.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(limit)
    snaps = q.stream()
    items = [{"id": s.id, **(s.to_dict() or {})} for s in snaps]
    return ok({"items": items})


@app.get("/api/pets/<pet_id>")
def get_pet(pet_id: str):
    snap = db.collection("pets").document(pet_id).get()
    if not snap.exists:
        return fail("pet not found", 404)
    return ok({"pet": doc_to_dict(snap)})


# --------------------------
# Pets (shelter write)
# --------------------------
@app.post("/api/pets")
def create_pet():
    try:
        shelter_uid = require_role("shelter")
        body = request.get_json(force=True) or {}

        required = ["name", "breed", "ageMonths", "size", "sex"]
        for k in required:
            if k not in body or str(body.get(k)).strip() == "":
                return fail(f"missing field: {k}", 400)

        pet = {
            "shelterId": shelter_uid,
            "name": str(body["name"]).strip(),
            "breed": str(body["breed"]).strip(),
            "ageMonths": int(body["ageMonths"]),
            "size": str(body["size"]).strip(),
            "sex": str(body["sex"]).strip(),
            "status": str(body.get("status", "adoptable")).strip(),
            "locationCity": (
                str(body.get("locationCity")).strip()
                if body.get("locationCity")
                else None
            ),
            "coverImageUrl": (
                str(body.get("coverImageUrl")).strip()
                if body.get("coverImageUrl")
                else None
            ),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        ref = db.collection("pets").document()
        ref.set(pet)
        return ok({"petId": ref.id}, 201)
    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("create_pet failed", 500, {"detail": str(e)})


@app.patch("/api/pets/<pet_id>")
def update_pet(pet_id: str):
    try:
        shelter_uid = require_role("shelter")
        ref = db.collection("pets").document(pet_id)
        snap = ref.get()
        if not snap.exists:
            return fail("pet not found", 404)
        pet = snap.to_dict() or {}
        if pet.get("shelterId") != shelter_uid:
            return fail("forbidden: not your pet", 403)

        body = request.get_json(force=True) or {}
        allowed = {
            "name",
            "breed",
            "ageMonths",
            "size",
            "sex",
            "status",
            "locationCity",
            "coverImageUrl",
        }
        patch = {k: body[k] for k in body.keys() if k in allowed}
        if "ageMonths" in patch:
            patch["ageMonths"] = int(patch["ageMonths"])
        patch["updatedAt"] = firestore.SERVER_TIMESTAMP

        ref.set(patch, merge=True)
        return ok({"petId": pet_id, "updated": list(patch.keys())})
    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("update_pet failed", 500, {"detail": str(e)})


@app.get("/api/shelter/pets")
def shelter_my_pets():
    try:
        shelter_uid = require_role("shelter")
        limit = clamp(int_or_none(request.args.get("limit")) or 50, 1, 50)
        q = (
            db.collection("pets")
            .where("shelterId", "==", shelter_uid)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        snaps = q.stream()
        items = [{"id": s.id, **(s.to_dict() or {})} for s in snaps]
        return ok({"items": items})
    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("shelter_my_pets failed", 500, {"detail": str(e)})


# --------------------------
# Posts
# --------------------------
@app.get("/api/posts")
def feed_posts():
    limit = clamp(int_or_none(request.args.get("limit")) or 20, 1, 50)
    pet_id = request.args.get("petId")
    shelter_id = request.args.get("shelterId")

    q = db.collection("posts")
    if pet_id:
        q = q.where("petId", "==", pet_id)
    if shelter_id:
        q = q.where("shelterId", "==", shelter_id)

    q = q.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(limit)
    snaps = q.stream()
    items = [{"id": s.id, **(s.to_dict() or {})} for s in snaps]
    return ok({"items": items})


@app.post("/api/posts")
def create_post():
    try:
        shelter_uid = require_role("shelter")
        body = request.get_json(force=True) or {}

        pet_id = str(body.get("petId", "")).strip()
        caption = str(body.get("caption", "")).strip()
        if not pet_id or not caption:
            return fail("missing petId or caption", 400)

        pet_snap = db.collection("pets").document(pet_id).get()
        if not pet_snap.exists:
            return fail("pet not found", 404)
        pet = pet_snap.to_dict() or {}
        if pet.get("shelterId") != shelter_uid:
            return fail("forbidden: not your pet", 403)

        tags = body.get("tags", [])
        if not isinstance(tags, list):
            tags = []
        image_urls = body.get("imageUrls", [])
        if not isinstance(image_urls, list):
            image_urls = []

        post = {
            "shelterId": shelter_uid,
            "petId": pet_id,
            "caption": caption,
            "tags": [str(x) for x in tags],
            "imageUrls": [str(x) for x in image_urls],
            "createdAt": firestore.SERVER_TIMESTAMP,
        }

        ref = db.collection("posts").document()
        ref.set(post)
        return ok({"postId": ref.id}, 201)
    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("create_post failed", 500, {"detail": str(e)})


# --------------------------
# Applications (User -> Pet)  [DOUBLE WRITE]
# --------------------------
@app.post("/api/pets/<pet_id>/apply")
def apply_for_pet(pet_id: str):
    try:
        user_uid = require_role("user")
        body = request.get_json(force=True) or {}

        pet_ref = db.collection("pets").document(pet_id)
        pet_snap = pet_ref.get()
        if not pet_snap.exists:
            return fail("pet not found", 404)

        pet = pet_snap.to_dict() or {}
        shelter_id = pet.get("shelterId")
        if not shelter_id:
            return fail("pet missing shelterId", 500)

        if pet.get("status") not in (None, "adoptable"):
            return fail(
                "pet not accepting new applications",
                409,
                {"petStatus": pet.get("status")},
            )

        app_id = str(body.get("appId", "")).strip()
        if not app_id:
            app_id = "app_" + str(int(datetime.now().timestamp()))

        step1 = body.get("step1", body) if isinstance(body.get("step1"), dict) else {}
        summary = {
            "name": (
                f"{step1.get('firstName', '')} {step1.get('lastName', '')}".strip()
                if step1
                else ""
            ),
            "city": step1.get("city") if step1 else "",
            "email": step1.get("email") if step1 else "",
            "phone": step1.get("phone") if step1 else "",
        }

        user_app_ref = (
            db.collection("users")
            .document(user_uid)
            .collection("applications")
            .document(app_id)
        )
        pet_inbox_ref = (
            db.collection("pets")
            .document(pet_id)
            .collection("applications")
            .document(app_id)
        )

        payload_user = {
            "petId": pet_id,
            "shelterId": shelter_id,
            "userId": user_uid,
            "status": "submitted",
            "currentStep": 5,
            "step1": body.get("step1"),
            "step2": body.get("step2"),
            "step3": body.get("step3"),
            "step4": body.get("step4"),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "submittedAt": firestore.SERVER_TIMESTAMP,
        }

        payload_inbox = {
            "petId": pet_id,
            "shelterId": shelter_id,
            "userId": user_uid,
            "status": "submitted",
            "summary": summary,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        batch = db.batch()
        batch.set(user_app_ref, payload_user, merge=True)
        batch.set(pet_inbox_ref, payload_inbox, merge=True)
        batch.commit()

        return ok({"appId": app_id, "petId": pet_id, "shelterId": shelter_id}, 201)

    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("apply_for_pet failed", 500, {"detail": str(e)})


# --------------------------
# Shelter inbox: list applications for a pet
# --------------------------
@app.get("/api/pets/<pet_id>/applications")
def list_pet_applications(pet_id: str):
    try:
        shelter_uid = require_role("shelter")

        pet_snap = db.collection("pets").document(pet_id).get()
        if not pet_snap.exists:
            return fail("pet not found", 404)
        pet = pet_snap.to_dict() or {}
        if pet.get("shelterId") != shelter_uid:
            return fail("forbidden: not your pet", 403)

        limit = clamp(int_or_none(request.args.get("limit")) or 50, 1, 50)
        q = (
            db.collection("pets")
            .document(pet_id)
            .collection("applications")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        snaps = q.stream()
        items = [{"id": s.id, **(s.to_dict() or {})} for s in snaps]
        return ok({"items": items})

    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("list_pet_applications failed", 500, {"detail": str(e)})


@app.patch("/api/pets/<pet_id>/applications/<app_id>")
def review_application(pet_id: str, app_id: str):
    try:
        shelter_uid = require_role("shelter")
        body = request.get_json(force=True) or {}
        new_status = str(body.get("status", "")).strip()
        if new_status not in ("reviewing", "approved", "rejected"):
            return fail("invalid status", 400)

        pet_ref = db.collection("pets").document(pet_id)
        pet_snap = pet_ref.get()
        if not pet_snap.exists:
            return fail("pet not found", 404)
        pet = pet_snap.to_dict() or {}
        if pet.get("shelterId") != shelter_uid:
            return fail("forbidden: not your pet", 403)

        inbox_ref = pet_ref.collection("applications").document(app_id)
        inbox_snap = inbox_ref.get()
        if not inbox_snap.exists:
            return fail("application not found", 404)
        inbox = inbox_snap.to_dict() or {}
        user_id = inbox.get("userId")
        if not user_id:
            return fail("application missing userId", 500)

        user_app_ref = (
            db.collection("users")
            .document(user_id)
            .collection("applications")
            .document(app_id)
        )

        batch = db.batch()
        batch.set(
            inbox_ref,
            {"status": new_status, "updatedAt": firestore.SERVER_TIMESTAMP},
            merge=True,
        )
        batch.set(
            user_app_ref,
            {"status": new_status, "updatedAt": firestore.SERVER_TIMESTAMP},
            merge=True,
        )

        if new_status == "approved":
            batch.set(
                pet_ref,
                {"status": "pending", "updatedAt": firestore.SERVER_TIMESTAMP},
                merge=True,
            )

        batch.commit()
        return ok({"petId": pet_id, "appId": app_id, "status": new_status})

    except PermissionError as e:
        return fail(str(e), 401)
    except Exception as e:
        return fail("review_application failed", 500, {"detail": str(e)})


# --------------------------
# Legacy debug endpoint
# --------------------------
@app.post("/find-shelters")
def receive_coords():
    data = request.get_json(force=True) or {}
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    print(f"Received coordinates: Latitude: {latitude}, Longitude: {longitude}")
    return ok({"message": f"python got coords {latitude}, {longitude}"})
