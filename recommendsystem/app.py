from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from recommender import build_advanced_matrix, get_hybrid_recommendations

app = Flask(__name__)

CORS(app)