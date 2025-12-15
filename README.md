# Fraud Detection Dashboard

A Streamlit web application to detect duplicate retailer accounts based on GPS proximity, helping identify traders creating fake accounts to earn fraudulent incentives.

## Features

- **CSV Upload**: Upload meeting data with GPS coordinates, trader info, and retailer details
- **Unique Buyer Deduplication**: Automatically treats buyers with the same `buyerid` as one unique retailer (regardless of multiple meeting dates)
- **GPS Clustering**: Automatically groups unique retailers within a configurable radius (default: 10 meters) using DBSCAN algorithm
- **Similarity Analysis**:
  - Fuzzy name matching to detect similar retailer names (90%+ threshold)
  - Phone number duplicate detection
  - Risk scoring based on multiple factors
- **Full-Screen Interactive Map**: Visualize clusters on a large interactive map with color-coded risk levels
- **Enhanced Cluster Popups**:
  - Click any cluster marker to view side-by-side retailer comparison
  - Shows selfie and verification images (full size, no cropping)
  - Displays meeting count for each retailer
  - Horizontal scroll for clusters with many retailers
- **Detailed Cluster Analysis**:
  - View all unique retailers in each cluster
  - Distance matrix between retailers
  - GPS coordinates for easy location reference
- **Filters**: Filter by Darkstore, Trader name, and date range
- **Export**: Download flagged clusters and analysis results to CSV

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
streamlit run app.py
```

The app will open in your default browser at `http://localhost:8501`

## Usage

### 1. Upload Data
- Click "Upload Meeting Data CSV" in the sidebar
- Or the app will automatically use `meeting_data_raw.csv` if available

### 2. Configure Settings
- **Clustering Radius**: Set the distance threshold (default: 10 meters)
- **Minimum Retailers per Cluster**: Minimum number of retailers to form a cluster (default: 2)
- **Name Similarity Threshold**: Percentage threshold for flagging similar names (default: 85%)

### 3. Apply Filters
- Select specific Darkstores
- Select specific Traders
- Choose date range

### 4. Run Analysis
- Click "Run Analysis" button
- View summary statistics and charts
- Explore the interactive cluster map

### 5. Analyze Clusters
- **Click on any cluster row** in the table OR **click on a cluster marker** on the map
- Detailed analysis appears automatically below
- View retailers, name similarity, and distance matrix for the selected cluster

### 6. Export Results
- Download flagged clusters as CSV
- Download cluster summary statistics

## CSV Format

Required columns:
- `meetingDate`: Date of meeting
- `Darkstore`: Darkstore/location name
- `traderName`: Name of the trader
- `traderId`: Trader ID
- `buyerName`: Retailer/buyer name
- `buyerid`: Retailer/buyer ID
- `buyerPhone`: Retailer phone number
- `currentLatitude`: GPS latitude
- `currentLongitude`: GPS longitude
- `selfie`: URL to selfie image
- `verificationDoc`: URL to verification document image

## Project Structure

```
fraud_meetings_dash/
├── app.py                          # Main Streamlit application
├── requirements.txt                # Python dependencies
├── utils/
│   ├── __init__.py
│   ├── clustering.py              # GPS clustering logic (DBSCAN)
│   ├── similarity.py              # Name/phone similarity matching
│   ├── visualization.py           # Map and chart generation
│   └── data_processing.py         # CSV validation and processing
└── meeting_data_raw.csv           # Sample data
```

## Risk Scoring

Clusters are assigned risk scores (0-100) based on:
- **Number of retailers** in cluster (more = higher risk)
- **Single trader** managing all retailers in cluster
- **Name similarity** between retailers
- **Phone number duplicates**

Risk levels:
- **High Risk** (≥60): Immediate investigation recommended
- **Medium Risk** (30-59): Review recommended
- **Low Risk** (<30): Low priority

## Technology Stack

- **Streamlit**: Web framework
- **Pandas/NumPy**: Data processing
- **scikit-learn**: DBSCAN clustering
- **Folium**: Interactive maps
- **RapidFuzz**: Fuzzy string matching
- **Geopy**: Distance calculations
- **Plotly**: Charts and visualizations

## Tips

1. Start with default settings (10m radius, 85% similarity threshold)
2. Adjust clustering radius based on your area (urban vs rural)
3. Focus on High Risk clusters first
4. Use the image comparison feature to visually verify duplicates
5. Export results for sharing with your team or taking action

## License

MIT License
