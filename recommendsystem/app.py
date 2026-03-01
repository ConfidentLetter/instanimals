from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from recommender import build_advanced_matrix, get_hybrid_recommendations

app = Flask(__name__)

CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Interaction(db.Model):

    id = db.Column(db.Integer, primary_key=True)
    foster_id = db.Column(db.Integer)
    shelter_id = db.Column(db.Integer)
    follow = db.Column(db.Integer)
    star = db.Column(db.Float)
    lowest_age = db.Column(db.Integer)
    quantity_anim = db.Column(db.Integer)

    class Interaction(db.Model):

        id = db.Column(db.Integer, primary_key=True)
        foster_id = db.Column(db.Integer)
        shelter_id = db.Column(db.Integer)
        follow = db.Column(db.Integer)
        star = db.Column(db.Float)
        lowest_age = db.Column(db.Integer)
        quantity_anim = db.Column(db.Integer)

class ShelterInfo(db.Model):

    id = db.Column(db.Integer, primary_key=True, name="shelter_id")
    name = db.Column(db.String(100))
    image_url = db.Column(db.String(255))

    @app.route('/api/recommend', methods=['GET'])
    def recommend(self):

        try:

            target_id = request.args.get('shelter_id', type=int)


            records = Interaction.query.all()
            raw_data = [{
                'foster_id': r.foster_id, 'shelter_id': r.shelter_id,
                'follow': r.follow, 'star': r.star,
                'lowest_age': r.lowest_age, 'quantity_anim': r.quantity_anim
            } for r in records]


            matrix = build_advanced_matrix(raw_data)
            recommendations = get_hybrid_recommendations(target_id, matrix)


            enriched_results = []
            for s_id, score in recommendations.items():
                info = ShelterInfo.query.get(int(s_id))
                if info:
                    enriched_results.append({
                        "shelter_id": int(s_id),
                        "name": info.name,
                        "image_url": info.image_url,
                        "similarity": round(float(score), 2)
                    })
        except Exception as e:
            return jsonify({"error": str(e)}), 500