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

    scaler = MinMaxScaler()
    df[['norm_age', 'norm_quantity']] = scaler.fit_transform(df[['lowest_age', 'quantity_anim']])

    df['total_score'] = (
            (df['follow'] * WEIGHT_CONFIG['follow_score']) +
            (df['star'] * WEIGHT_CONFIG['star_multiplier']) +
            df['norm_age'] +
            df['norm_quantity']
    )
    return df.pivot_table(index='foster_id', columns='shelter_id', values='total_score').fillna(0)

def get_hybrid_recommendations(target_id, feature_matrix):

    if target_id not in feature_matrix.columns:
        return pd.Series(dtype='float64')

    item_sim = cosine_similarity(feature_matrix.T)
    sim_df = pd.DataFrame(item_sim, index=feature_matrix.columns, columns=feature_matrix.columns)

    return sim_df[target_id].sort_values(ascending=False).iloc[1:]


if __name__ == "__main__":
    mock_data = [
        {'foster_id': 101, 'shelter_id': 1, 'follow': 1, 'star': 4.5, 'lowest_age': 1, 'quantity_anim': 45},
        {'foster_id': 102, 'shelter_id': 1, 'follow': 1, 'star': 5.0, 'lowest_age': 1, 'quantity_anim': 45},
        {'foster_id': 102, 'shelter_id': 2, 'follow': 0, 'star': 3.0, 'lowest_age': 0, 'quantity_anim': 12}
    ]

    matrix = build_advanced_matrix(mock_data)
    print("Matrix built successfully!")


    recommendations = get_hybrid_recommendations(1, matrix)
    print("Recommendations for Shelter ID 1:")
    print(recommendations)