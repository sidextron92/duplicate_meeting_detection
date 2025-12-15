import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from geopy.distance import geodesic


def cluster_by_gps(df, radius_meters=10, min_samples=2):
    """
    Cluster retailers based on GPS proximity using DBSCAN.
    Deduplicates by buyerid first - treating same buyerid as one unique retailer.

    Args:
        df: pandas DataFrame with currentLatitude and currentLongitude columns
        radius_meters: clustering radius in meters (default 10m)
        min_samples: minimum number of points to form a cluster

    Returns:
        pandas DataFrame: Original dataframe with added cluster_id column
    """
    if len(df) == 0:
        df['cluster_id'] = -1
        return df

    df = df.copy()

    # Store original dataframe for later merge
    df_original = df.copy()

    # Deduplicate by buyerid - keep the most recent meeting for each buyer
    # Also count total meetings per buyer
    df['meeting_count'] = df.groupby('buyerid')['buyerid'].transform('count')

    # Sort by date and keep the latest meeting for each buyer
    df = df.sort_values('meetingDate', ascending=False)
    df_unique = df.drop_duplicates(subset=['buyerid'], keep='first').copy()

    # Extract coordinates from unique buyers
    coords = df_unique[['currentLatitude', 'currentLongitude']].values

    # Convert to radians for haversine metric
    coords_rad = np.radians(coords)

    # Convert radius from meters to radians
    # Earth radius ≈ 6371 km
    earth_radius_km = 6371
    eps_rad = radius_meters / 1000 / earth_radius_km

    # Apply DBSCAN clustering on unique buyers
    clustering = DBSCAN(
        eps=eps_rad,
        min_samples=min_samples,
        metric='haversine'
    ).fit(coords_rad)

    # Add cluster labels to unique buyers dataframe
    df_unique['cluster_id'] = clustering.labels_

    # Merge cluster_id back to all meeting records based on buyerid
    df_with_clusters = df_original.merge(
        df_unique[['buyerid', 'cluster_id', 'meeting_count']],
        on='buyerid',
        how='left',
        suffixes=('', '_unique')
    )

    # Fill any missing cluster_ids with -1
    df_with_clusters['cluster_id'] = df_with_clusters['cluster_id'].fillna(-1).astype(int)
    df_with_clusters['meeting_count'] = df_with_clusters['meeting_count'].fillna(1).astype(int)

    return df_with_clusters


def calculate_cluster_stats(df):
    """
    Calculate statistics for each cluster based on unique buyers.

    Args:
        df: pandas DataFrame with cluster_id column

    Returns:
        pandas DataFrame: Cluster statistics
    """
    # Filter out noise points (cluster_id = -1)
    clustered = df[df['cluster_id'] >= 0].copy()

    if len(clustered) == 0:
        return pd.DataFrame()

    # Get unique buyers per cluster (deduplicate by buyerid)
    unique_buyers = clustered.drop_duplicates(subset=['buyerid', 'cluster_id'])

    # Group by cluster
    cluster_stats = unique_buyers.groupby('cluster_id').agg({
        'buyerid': 'count',  # Number of unique retailers in cluster
        'traderName': lambda x: x.nunique(),  # Number of unique traders
        'buyerName': lambda x: list(x),  # List of retailer names
        'buyerPhone': lambda x: list(x),  # List of phone numbers
        'currentLatitude': 'mean',  # Center latitude
        'currentLongitude': 'mean',  # Center longitude
    }).reset_index()

    cluster_stats.columns = [
        'cluster_id', 'retailer_count', 'trader_count',
        'retailer_names', 'phone_numbers',
        'center_lat', 'center_lon'
    ]

    return cluster_stats


def calculate_distance_matrix(df, cluster_id):
    """
    Calculate pairwise distances between unique retailers in a cluster.

    Args:
        df: pandas DataFrame
        cluster_id: ID of the cluster to analyze

    Returns:
        pandas DataFrame: Distance matrix
    """
    cluster_data = df[df['cluster_id'] == cluster_id].copy()

    # Get unique buyers only
    cluster_data = cluster_data.sort_values('meetingDate', ascending=False)
    cluster_data = cluster_data.drop_duplicates(subset=['buyerid'], keep='first')

    if len(cluster_data) < 2:
        return pd.DataFrame()

    # Get coordinates
    coords = cluster_data[['buyerName', 'currentLatitude', 'currentLongitude']].values

    # Calculate pairwise distances
    n = len(coords)
    distance_matrix = np.zeros((n, n))

    for i in range(n):
        for j in range(i + 1, n):
            lat1, lon1 = coords[i][1], coords[i][2]
            lat2, lon2 = coords[j][1], coords[j][2]
            distance = geodesic((lat1, lon1), (lat2, lon2)).meters
            distance_matrix[i, j] = distance
            distance_matrix[j, i] = distance

    # Create dataframe
    buyer_names = coords[:, 0]
    distance_df = pd.DataFrame(
        distance_matrix,
        index=buyer_names,
        columns=buyer_names
    )

    return distance_df


def get_cluster_details(df, cluster_id):
    """
    Get detailed information about a specific cluster (unique buyers only).

    Args:
        df: pandas DataFrame
        cluster_id: ID of the cluster to analyze

    Returns:
        pandas DataFrame: Detailed cluster information with unique buyers
    """
    cluster_data = df[df['cluster_id'] == cluster_id].copy()

    # Get unique buyers only (most recent meeting for each)
    cluster_data = cluster_data.sort_values('meetingDate', ascending=False)
    cluster_data = cluster_data.drop_duplicates(subset=['buyerid'], keep='first')

    # Select relevant columns
    detail_columns = [
        'buyerName', 'buyerid', 'buyerPhone', 'traderName', 'traderId',
        'Darkstore', 'meetingDate', 'currentLatitude', 'currentLongitude',
        'selfie', 'verificationDoc', 'remarks', 'meeting_count'
    ]

    available_columns = [col for col in detail_columns if col in cluster_data.columns]
    cluster_details = cluster_data[available_columns].copy()

    return cluster_details


def calculate_cluster_risk_score(df, cluster_stats, similarity_results):
    """
    Calculate risk score for each cluster based on multiple factors.

    Args:
        df: pandas DataFrame with all data
        cluster_stats: DataFrame with cluster statistics
        similarity_results: dict with similarity analysis results

    Returns:
        pandas DataFrame: cluster_stats with added risk_score column
    """
    cluster_stats = cluster_stats.copy()

    # Initialize risk score
    cluster_stats['risk_score'] = 0

    for idx, row in cluster_stats.iterrows():
        cluster_id = row['cluster_id']
        score = 0

        # Factor 1: Number of retailers (more = higher risk)
        retailer_count = row['retailer_count']
        if retailer_count >= 5:
            score += 30
        elif retailer_count >= 3:
            score += 20
        elif retailer_count >= 2:
            score += 10

        # Factor 2: Single trader managing all (higher risk)
        if row['trader_count'] == 1:
            score += 25

        # Factor 3: Name similarity (from similarity_results)
        cluster_key = f"cluster_{cluster_id}"
        if cluster_key in similarity_results:
            name_similarity_count = similarity_results[cluster_key].get('similar_name_pairs', 0)
            score += min(name_similarity_count * 15, 30)

        # Factor 4: Phone duplicates
        phone_list = row['phone_numbers']
        unique_phones = len(set(phone_list))
        if unique_phones < len(phone_list):
            score += 15

        cluster_stats.at[idx, 'risk_score'] = min(score, 100)

    # Categorize risk level
    cluster_stats['risk_level'] = cluster_stats['risk_score'].apply(
        lambda x: 'High' if x >= 60 else ('Medium' if x >= 30 else 'Low')
    )

    return cluster_stats
