import pandas as pd
import numpy as np
from datetime import datetime

def validate_csv(df):
    """
    Validate that CSV has required columns and proper data types.

    Args:
        df: pandas DataFrame

    Returns:
        tuple: (is_valid, error_message)
    """
    required_columns = [
        'meetingDate', 'Darkstore', 'traderName', 'traderId',
        'buyerName', 'buyerid', 'buyerPhone',
        'currentLatitude', 'currentLongitude',
        'selfie', 'verificationDoc'
    ]

    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        return False, f"Missing required columns: {', '.join(missing_columns)}"

    return True, None


def clean_and_process_data(df):
    """
    Clean and process the uploaded CSV data.

    Args:
        df: pandas DataFrame

    Returns:
        pandas DataFrame: Cleaned data
    """
    df = df.copy()

    # Convert coordinates to numeric, handle errors
    df['currentLatitude'] = pd.to_numeric(df['currentLatitude'], errors='coerce')
    df['currentLongitude'] = pd.to_numeric(df['currentLongitude'], errors='coerce')

    # Remove rows with invalid GPS coordinates
    initial_count = len(df)
    df = df.dropna(subset=['currentLatitude', 'currentLongitude'])
    removed_count = initial_count - len(df)

    if removed_count > 0:
        print(f"Removed {removed_count} rows with invalid GPS coordinates")

    # Validate GPS coordinate ranges
    df = df[
        (df['currentLatitude'].between(-90, 90)) &
        (df['currentLongitude'].between(-180, 180))
    ]

    # Parse meeting date
    df['meetingDate'] = pd.to_datetime(df['meetingDate'], errors='coerce')

    # Clean phone numbers (remove non-digits)
    df['buyerPhone'] = df['buyerPhone'].astype(str).str.replace(r'\D', '', regex=True)

    # Handle NULL/empty selfie and verification doc URLs
    df['selfie'] = df['selfie'].fillna('').astype(str)
    df['verificationDoc'] = df['verificationDoc'].fillna('').astype(str)

    # Remove brackets and quotes from selfie column (handle "[]" cases)
    df['selfie'] = df['selfie'].str.replace(r'[\[\]"\']', '', regex=True)
    df['verificationDoc'] = df['verificationDoc'].str.replace(r'[\[\]"\']', '', regex=True)

    # Clean buyer and trader names
    df['buyerName'] = df['buyerName'].astype(str).str.strip()
    df['traderName'] = df['traderName'].astype(str).str.strip()
    df['Darkstore'] = df['Darkstore'].astype(str).str.strip()

    # Add processed flag
    df['has_valid_gps'] = True
    df['has_selfie'] = df['selfie'].str.len() > 0
    df['has_verification'] = df['verificationDoc'].str.len() > 0

    return df


def get_filter_options(df):
    """
    Extract unique values for filters.

    Args:
        df: pandas DataFrame

    Returns:
        dict: Dictionary with filter options
    """
    return {
        'darkstores': sorted(df['Darkstore'].unique().tolist()),
        'traders': sorted(df['traderName'].unique().tolist()),
        'date_range': (df['meetingDate'].min(), df['meetingDate'].max())
    }


def apply_filters(df, darkstores=None, traders=None, date_range=None):
    """
    Apply filters to the dataframe.

    Args:
        df: pandas DataFrame
        darkstores: list of darkstore names to include
        traders: list of trader names to include
        date_range: tuple of (start_date, end_date)

    Returns:
        pandas DataFrame: Filtered data
    """
    filtered_df = df.copy()

    if darkstores:
        filtered_df = filtered_df[filtered_df['Darkstore'].isin(darkstores)]

    if traders:
        filtered_df = filtered_df[filtered_df['traderName'].isin(traders)]

    if date_range and len(date_range) == 2:
        start_date, end_date = date_range
        filtered_df = filtered_df[
            (filtered_df['meetingDate'] >= pd.Timestamp(start_date)) &
            (filtered_df['meetingDate'] <= pd.Timestamp(end_date))
        ]

    return filtered_df
