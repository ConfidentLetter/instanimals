from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from recommender import build_advanced_matrix, get_hybrid_recommendations

app = Flask(__name__)


CORS(app)


cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()



@app.route('/api/recommend', methods=['GET'])
def recommend():
    """Fetch data from Firestore and run recommendation logic """
    try:

        target_id = request.args.get('shelter_id', type=int)


        interactions_ref = db.collection('interactions')
        docs = interactions_ref.stream()

        raw_data = []
        for doc in docs:
            data = doc.to_dict()
            raw_data.append({
                'foster_id': data.get('foster_id'),
                'shelter_id': data.get('shelter_id'),
                'follow': data.get('follow'),
                'star': data.get('star'),
                'lowest_age': data.get('lowest_age'),
                'quantity_anim': data.get('quantity_anim')
            })


        matrix = build_advanced_matrix(raw_data)
        recommendations = get_hybrid_recommendations(target_id, matrix)


        enriched_results = []
        for s_id, score in recommendations.items():

            shelter_doc = db.collection('shelters').document(str(s_id)).get()

            if shelter_doc.exists:
                info = shelter_doc.to_dict()
                enriched_results.append({
                    "shelter_id": int(s_id),
                    "name": info.get('name'),
                    "image_url": info.get('image_url'),
                    "similarity": round(float(score), 2)
                })

        return jsonify(enriched_results)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # The server will run on http://localhost:5000
    app.run(debug=True, port=5000)