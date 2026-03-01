import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()


def seed_firebase_data():

    shelters = {
        "1": {"name": "DVC Happy Paws", "image_url": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e"},
        "2": {"name": "Contra Costa Pets", "image_url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba"},
        "3": {"name": "Instanimal Center", "image_url": "https://images.unsplash.com/photo-1548191265-cc70d3d45ba1"}
    }


    interactions = [
        {'foster_id': 101, 'shelter_id': 1, 'follow': 1, 'star': 4.5, 'lowest_age': 1, 'quantity_anim': 45},
        {'foster_id': 102, 'shelter_id': 1, 'follow': 1, 'star': 5.0, 'lowest_age': 1, 'quantity_anim': 45},
        {'foster_id': 102, 'shelter_id': 2, 'follow': 0, 'star': 3.0, 'lowest_age': 0, 'quantity_anim': 12}
    ]
