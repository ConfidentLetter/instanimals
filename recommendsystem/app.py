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
    """Stores user likes, stars, and pet details | 存储用户点赞、评分及宠物详情"""
    id = db.Column(db.Integer, primary_key=True)
    foster_id = db.Column(db.Integer)
    shelter_id = db.Column(db.Integer)
    follow = db.Column(db.Integer)
    star = db.Column(db.Float)
    lowest_age = db.Column(db.Integer)
    quantity_anim = db.Column(db.Integer)