import pandas as pd
from rapidfuzz import fuzz
from itertools import combinations


def calculate_name_similarity(name1, name2):
    """
    Calculate similarity between two retailer names using fuzzy matching.

    Args:
        name1: First retailer name
        name2: Second retailer name

    Returns:
        float: Similarity score (0-100)
    """
    if pd.isna(name1) or pd.isna(name2):
        return 0

    name1 = str(name1).lower().strip()
    name2 = str(name2).lower().strip()

    # Use token_sort_ratio for better handling of word order differences
    return fuzz.token_sort_ratio(name1, name2)


def analyze_cluster_similarity(df, cluster_id, name_threshold=90):
    """
    Analyze name and phone similarity within a cluster (unique buyers only).

    Args:
        df: pandas DataFrame
        cluster_id: ID of cluster to analyze
        name_threshold: Minimum similarity score to flag (default 90)

    Returns:
        dict: Analysis results with similar pairs and statistics
    """
    cluster_data = df[df['cluster_id'] == cluster_id].copy()

    # Get unique buyers only
    cluster_data = cluster_data.sort_values('meetingDate', ascending=False)
    cluster_data = cluster_data.drop_duplicates(subset=['buyerid'], keep='first')

    if len(cluster_data) < 2:
        return {
            'cluster_id': cluster_id,
            'similar_name_pairs': 0,
            'phone_duplicates': 0,
            'name_pairs': [],
            'phone_groups': [],
            'max_similarity': 0
        }

    results = {
        'cluster_id': cluster_id,
        'name_pairs': [],
        'phone_groups': []
    }

    # Analyze name similarity on unique buyers only
    retailers = cluster_data[['buyerName', 'buyerid', 'buyerPhone']].values

    for i, j in combinations(range(len(retailers)), 2):
        name1, id1, phone1 = retailers[i]
        name2, id2, phone2 = retailers[j]

        similarity = calculate_name_similarity(name1, name2)

        if similarity >= name_threshold:
            results['name_pairs'].append({
                'retailer1': name1,
                'retailer2': name2,
                'id1': id1,
                'id2': id2,
                'similarity': similarity
            })

    # Analyze phone duplicates on unique buyers
    phone_counts = cluster_data.groupby('buyerPhone').agg({
        'buyerName': list,
        'buyerid': list
    }).reset_index()

    phone_duplicates = phone_counts[phone_counts['buyerPhone'].apply(
        lambda x: len(str(x)) > 0 and str(x) != 'nan'
    )]
    phone_duplicates = phone_duplicates[phone_duplicates['buyerName'].apply(len) > 1]

    for _, row in phone_duplicates.iterrows():
        results['phone_groups'].append({
            'phone': row['buyerPhone'],
            'retailers': row['buyerName'],
            'ids': row['buyerid'],
            'count': len(row['buyerName'])
        })

    # Calculate summary statistics
    results['similar_name_pairs'] = len(results['name_pairs'])
    results['phone_duplicates'] = len(results['phone_groups'])
    results['max_similarity'] = max(
        [pair['similarity'] for pair in results['name_pairs']],
        default=0
    )

    return results


def analyze_all_clusters(df, name_threshold=90):
    """
    Analyze similarity for all clusters in the dataframe.

    Args:
        df: pandas DataFrame with cluster_id column
        name_threshold: Minimum similarity score to flag

    Returns:
        dict: Dictionary with results for each cluster
    """
    cluster_ids = df[df['cluster_id'] >= 0]['cluster_id'].unique()

    results = {}
    for cluster_id in cluster_ids:
        cluster_key = f"cluster_{cluster_id}"
        results[cluster_key] = analyze_cluster_similarity(
            df, cluster_id, name_threshold
        )

    return results


def create_similarity_report(similarity_results):
    """
    Create a summary report of similarity findings.

    Args:
        similarity_results: dict from analyze_all_clusters

    Returns:
        pandas DataFrame: Summary report
    """
    report_data = []

    for cluster_key, result in similarity_results.items():
        cluster_id = result['cluster_id']

        if result['similar_name_pairs'] > 0 or result['phone_duplicates'] > 0:
            report_data.append({
                'cluster_id': cluster_id,
                'similar_names_count': result['similar_name_pairs'],
                'phone_duplicates_count': result['phone_duplicates'],
                'max_name_similarity': result['max_similarity'],
                'flagged': True
            })

    if not report_data:
        return pd.DataFrame(columns=[
            'cluster_id', 'similar_names_count', 'phone_duplicates_count',
            'max_name_similarity', 'flagged'
        ])

    return pd.DataFrame(report_data)


def get_similarity_details_for_cluster(similarity_results, cluster_id):
    """
    Get detailed similarity information for a specific cluster.

    Args:
        similarity_results: dict from analyze_all_clusters
        cluster_id: ID of cluster to get details for

    Returns:
        dict: Detailed similarity information
    """
    cluster_key = f"cluster_{cluster_id}"

    if cluster_key not in similarity_results:
        return None

    return similarity_results[cluster_key]


def create_name_similarity_dataframe(similarity_details):
    """
    Convert name similarity pairs to a readable dataframe with buyer IDs.

    Args:
        similarity_details: dict from get_similarity_details_for_cluster

    Returns:
        pandas DataFrame: Name similarity pairs with buyer IDs
    """
    if not similarity_details or not similarity_details['name_pairs']:
        return pd.DataFrame(columns=[
            'Retailer 1', 'Buyer ID 1', 'Retailer 2', 'Buyer ID 2', 'Similarity (%)'
        ])

    pairs_data = []
    for pair in similarity_details['name_pairs']:
        pairs_data.append({
            'Retailer 1': pair['retailer1'],
            'Buyer ID 1': pair['id1'],
            'Retailer 2': pair['retailer2'],
            'Buyer ID 2': pair['id2'],
            'Similarity (%)': round(pair['similarity'], 1)
        })

    return pd.DataFrame(pairs_data)


def create_phone_duplicates_dataframe(similarity_details):
    """
    Convert phone duplicate groups to a readable dataframe.

    Args:
        similarity_details: dict from get_similarity_details_for_cluster

    Returns:
        pandas DataFrame: Phone duplicate groups
    """
    if not similarity_details or not similarity_details['phone_groups']:
        return pd.DataFrame(columns=[
            'Phone Number', 'Retailers Using This Number', 'Count'
        ])

    phone_data = []
    for group in similarity_details['phone_groups']:
        retailers_str = ', '.join(group['retailers'])
        phone_data.append({
            'Phone Number': group['phone'],
            'Retailers Using This Number': retailers_str,
            'Count': group['count']
        })

    return pd.DataFrame(phone_data)
