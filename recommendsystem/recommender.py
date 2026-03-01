import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

WEIGHT_CONFIG = {
    'follow_score': 5.0,
    'star_multiplier': 1.2
}

def build_advanced_matrix(raw_records):
    """
    Converts raw database records into a normalized feature matrix.
    """
    if not raw_records:
        return pd.DataFrame()

    df = pd.DataFrame(raw_records)