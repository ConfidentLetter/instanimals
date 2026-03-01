import math
import os
from datetime import datetime, timezone

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore
from flask import jsonify, request

load_dotenv()

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


def register_algo_routes(app):
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
