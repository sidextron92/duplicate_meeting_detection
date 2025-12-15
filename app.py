import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from streamlit_folium import st_folium
from io import BytesIO
from PIL import Image
import requests

# Import utility modules
from utils.data_processing import (
    validate_csv, clean_and_process_data,
    get_filter_options, apply_filters
)
from utils.clustering import (
    cluster_by_gps, calculate_cluster_stats,
    calculate_distance_matrix, get_cluster_details,
    calculate_cluster_risk_score
)
from utils.similarity import (
    analyze_all_clusters, create_similarity_report,
    get_similarity_details_for_cluster,
    create_name_similarity_dataframe,
    create_phone_duplicates_dataframe
)
from utils.visualization import (
    create_cluster_map, create_risk_distribution_chart,
    create_cluster_size_chart, create_trader_analysis_chart
)

# Page configuration
st.set_page_config(
    page_title="Fraud Detection Dashboard",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Title and description
st.title("🔍 Retailer Duplicate Account Detection")
st.markdown("""
This dashboard helps identify potential duplicate retailer accounts created by traders to earn fraudulent incentives.
Upload your meeting data CSV to analyze GPS proximity, name similarity, and phone duplicates.
""")

# Initialize session state
if 'data_loaded' not in st.session_state:
    st.session_state.data_loaded = False
if 'df' not in st.session_state:
    st.session_state.df = None
if 'cluster_stats' not in st.session_state:
    st.session_state.cluster_stats = None
if 'similarity_results' not in st.session_state:
    st.session_state.similarity_results = None

# Sidebar - File Upload and Settings
st.sidebar.header("📁 Data Upload")

# Add file uploader with info icon
uploaded_file = st.sidebar.file_uploader(
    "Upload Meeting Data CSV",
    type=['csv'],
    help="Upload CSV file with meeting data including GPS coordinates, trader info, and retailer details"
)

# Add SQL query reference
with st.sidebar.expander("ℹ️ SQL Query Reference"):
    st.markdown("**SQL Query to Generate CSV:**")
    st.code("""SELECT
    DATE_FORMAT(fm.created_at,'%Y-%m-%d') as meetingDate,
    lpa.uniqueId as dsid,
    lpa.city as Darkstore,
    fu.name as traderName,
    fu.fosId as traderId,
    um.companyName as buyerName,
    um.userID as buyerid,
    um.companyPhone buyerPhone,
    fm.created_at as meetingTime,
    fm.remarks,
    fm.currentLatitude,
    fm.currentLongitude,
    GROUP_CONCAT(DISTINCT o.skOrderID) as todayOrders,
    JSON_UNQUOTE(JSON_EXTRACT(fm.metaData,'$.images')) as selfie,
    round(fm.distance,0) as distancemtr,
    um.created_at as buyerRegistrationDate,
    um.orderVerifyDoc as verificationDoc
FROM fos_meetings fm
LEFT JOIN orders o
    ON o.userID = fm.buyerId
    AND date_format(o.created_at,'%Y-%m-%d') = date_format(fm.created_at,'%Y-%m-%d')
    AND DATE_FORMAT(o.created_at,'%Y%m')=202512
INNER JOIN user_master um ON um.userID = fm.buyerId
INNER JOIN fos_users fu ON fu.fosId=fm.fosId
INNER JOIN lp_address lpa ON lpa.uniqueId = fu.dsId
WHERE DATE_FORMAT(fm.created_at,'%Y%m')=202512
GROUP BY fm.buyerid, DATE_FORMAT(fm.created_at,'%Y%m%d')
ORDER BY meetingDate;""", language="sql")
    st.caption("Use this query to extract meeting data from your database")

# Load default CSV if available and no file uploaded
if uploaded_file is None and not st.session_state.data_loaded:
    try:
        default_csv = '/Users/bijnis/Documents/Projects/fraud_meetings_dash/meeting_data_raw.csv'
        uploaded_file = default_csv
        st.sidebar.info("📂 Using default CSV file: meeting_data_raw.csv")
    except:
        pass

# Process uploaded file
if uploaded_file is not None:
    try:
        # Read CSV
        if isinstance(uploaded_file, str):
            df_raw = pd.read_csv(uploaded_file)
        else:
            df_raw = pd.read_csv(uploaded_file)

        # Validate CSV
        is_valid, error_msg = validate_csv(df_raw)

        if not is_valid:
            st.error(f"❌ Invalid CSV file: {error_msg}")
        else:
            # Clean and process data
            with st.spinner("Processing data..."):
                df_processed = clean_and_process_data(df_raw)

                st.session_state.df_raw = df_processed
                st.session_state.data_loaded = True

                st.sidebar.success(f"✅ Loaded {len(df_processed)} meeting records")

    except Exception as e:
        st.error(f"❌ Error loading file: {str(e)}")

# Show filters and analysis only if data is loaded
if st.session_state.data_loaded:
    df = st.session_state.df_raw.copy()

    # Sidebar - Clustering Settings
    st.sidebar.header("⚙️ Clustering Settings")

    radius_meters = st.sidebar.slider(
        "Clustering Radius (meters)",
        min_value=5,
        max_value=100,
        value=10,
        step=5,
        help="Retailers within this radius will be grouped as potential duplicates"
    )

    min_samples = st.sidebar.number_input(
        "Minimum Retailers per Cluster",
        min_value=2,
        max_value=10,
        value=2,
        help="Minimum number of retailers to form a cluster"
    )

    name_similarity_threshold = st.sidebar.slider(
        "Name Similarity Threshold (%)",
        min_value=50,
        max_value=100,
        value=90,
        help="Minimum similarity score to flag retailer names as duplicates (90%+ recommended)"
    )

    # Sidebar - Filters
    st.sidebar.header("🔎 Filters")

    filter_options = get_filter_options(df)

    # Darkstore filter
    darkstore_filter = st.sidebar.multiselect(
        "Select Darkstores",
        options=filter_options['darkstores'],
        default=None,
        help="Filter by darkstore name"
    )

    # Trader filter
    trader_filter = st.sidebar.multiselect(
        "Select Traders",
        options=filter_options['traders'],
        default=None,
        help="Filter by trader name"
    )

    # Date filter
    if pd.notna(filter_options['date_range'][0]) and pd.notna(filter_options['date_range'][1]):
        date_col1, date_col2 = st.sidebar.columns(2)
        with date_col1:
            start_date = st.date_input(
                "Start Date",
                value=filter_options['date_range'][0],
                min_value=filter_options['date_range'][0],
                max_value=filter_options['date_range'][1]
            )
        with date_col2:
            end_date = st.date_input(
                "End Date",
                value=filter_options['date_range'][1],
                min_value=filter_options['date_range'][0],
                max_value=filter_options['date_range'][1]
            )
        date_filter = (start_date, end_date)
    else:
        date_filter = None

    # Apply filters
    df_filtered = apply_filters(
        df,
        darkstores=darkstore_filter if darkstore_filter else None,
        traders=trader_filter if trader_filter else None,
        date_range=date_filter
    )

    # Run Analysis Button
    if st.sidebar.button("🚀 Run Analysis", type="primary"):
        with st.spinner("Analyzing data... This may take a moment."):
            # Perform clustering
            df_clustered = cluster_by_gps(
                df_filtered,
                radius_meters=radius_meters,
                min_samples=min_samples
            )

            # Calculate cluster statistics
            cluster_stats = calculate_cluster_stats(df_clustered)

            # Analyze similarity
            similarity_results = analyze_all_clusters(
                df_clustered,
                name_threshold=name_similarity_threshold
            )

            # Calculate risk scores
            if len(cluster_stats) > 0:
                cluster_stats = calculate_cluster_risk_score(
                    df_clustered,
                    cluster_stats,
                    similarity_results
                )

            # Store in session state
            st.session_state.df = df_clustered
            st.session_state.cluster_stats = cluster_stats
            st.session_state.similarity_results = similarity_results

            st.sidebar.success("✅ Analysis complete!")

    # Display results if analysis has been run
    if st.session_state.df is not None:
        df = st.session_state.df
        cluster_stats = st.session_state.cluster_stats
        similarity_results = st.session_state.similarity_results

        # Summary Metrics
        st.header("📊 Summary Statistics")

        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            unique_retailers = df['buyerid'].nunique()
            st.metric("Unique Retailers", unique_retailers)

        with col2:
            clusters_found = len(cluster_stats) if len(cluster_stats) > 0 else 0
            st.metric("Clusters Found", clusters_found)

        with col3:
            if len(cluster_stats) > 0:
                high_risk = len(cluster_stats[cluster_stats['risk_level'] == 'High'])
            else:
                high_risk = 0
            st.metric("High Risk Clusters", high_risk, delta_color="inverse")

        with col4:
            if len(df[df['cluster_id'] >= 0]) > 0:
                clustered_retailers = df[df['cluster_id'] >= 0]['buyerid'].nunique()
            else:
                clustered_retailers = 0
            st.metric("Unique Retailers in Clusters", clustered_retailers)

        with col5:
            unique_traders = df[df['cluster_id'] >= 0]['traderName'].nunique() if len(df[df['cluster_id'] >= 0]) > 0 else 0
            st.metric("Traders Involved", unique_traders)

        # Display charts
        if len(cluster_stats) > 0:
            st.header("📈 Analysis Charts")

            chart_col1, chart_col2 = st.columns(2)

            with chart_col1:
                risk_chart = create_risk_distribution_chart(cluster_stats)
                if risk_chart:
                    st.plotly_chart(risk_chart, use_container_width=True)

            with chart_col2:
                size_chart = create_cluster_size_chart(cluster_stats)
                if size_chart:
                    st.plotly_chart(size_chart, use_container_width=True)

            trader_chart = create_trader_analysis_chart(df)
            if trader_chart:
                st.plotly_chart(trader_chart, use_container_width=True)

        # Interactive Map (Full Screen)
        st.header("🗺️ Cluster Map")

        if len(cluster_stats) > 0:
            st.info("💡 Click on any cluster marker to see side-by-side retailer information with images and meeting counts")
            cluster_map = create_cluster_map(df, cluster_stats)
            map_data = st_folium(cluster_map, width=None, height=800)

            # Check if a marker was clicked on the map
            if map_data and map_data.get('last_object_clicked'):
                clicked_location = map_data['last_object_clicked']
                # Find which cluster was clicked based on coordinates
                for _, cluster in cluster_stats.iterrows():
                    if (abs(cluster['center_lat'] - clicked_location['lat']) < 0.0001 and
                        abs(cluster['center_lon'] - clicked_location['lng']) < 0.0001):
                        st.session_state.selected_cluster_id = int(cluster['cluster_id'])
                        break
        else:
            st.info("ℹ️ No clusters found with the current settings. Try adjusting the clustering radius or filters.")

        # Cluster Details Table
        st.header("📋 Cluster Details")

        if len(cluster_stats) > 0:
            st.info("💡 Tip: Click on any row in the table below to view detailed analysis of that cluster")

            # Add risk level filtering
            risk_filter = st.multiselect(
                "Filter by Risk Level",
                options=['High', 'Medium', 'Low'],
                default=['High', 'Medium', 'Low']
            )

            filtered_clusters = cluster_stats[cluster_stats['risk_level'].isin(risk_filter)]

            # Add column for map location
            display_data = filtered_clusters[['cluster_id', 'retailer_count', 'trader_count', 'risk_score', 'risk_level']].copy()
            display_data = display_data.sort_values('risk_score', ascending=False)

            # Add coordinates column for reference
            display_data = display_data.merge(
                filtered_clusters[['cluster_id', 'center_lat', 'center_lon']],
                on='cluster_id',
                how='left'
            )

            # Format coordinates for display
            display_data['location'] = display_data.apply(
                lambda x: f"({x['center_lat']:.5f}, {x['center_lon']:.5f})",
                axis=1
            )

            # Display cluster summary table with clickable selection
            final_display_cols = ['cluster_id', 'retailer_count', 'trader_count', 'risk_score', 'risk_level', 'location']

            event = st.dataframe(
                display_data[final_display_cols],
                use_container_width=True,
                hide_index=True,
                on_select="rerun",
                selection_mode="single-row",
                column_config={
                    "cluster_id": st.column_config.NumberColumn("Cluster ID", help="Click on any row to view cluster details"),
                    "retailer_count": "Retailers",
                    "trader_count": "Traders",
                    "risk_score": st.column_config.NumberColumn("Risk Score", format="%.0f"),
                    "risk_level": "Risk Level",
                    "location": "GPS Location"
                }
            )

            # Check if a row was selected in the table
            if event.selection.rows:
                selected_row_index = event.selection.rows[0]
                selected_cluster = display_data.iloc[selected_row_index]['cluster_id']
                st.session_state.selected_cluster_id = int(selected_cluster)

            # Cluster Detail View
            st.divider()
            st.subheader("🔍 Detailed Cluster Analysis")

            # Get selected cluster from session state
            selected_cluster = st.session_state.get('selected_cluster_id', None)

            if selected_cluster is not None and selected_cluster in filtered_clusters['cluster_id'].values:
                # Get cluster info
                cluster_info = filtered_clusters[filtered_clusters['cluster_id'] == selected_cluster].iloc[0]
                risk_level = cluster_info['risk_level']
                risk_score = cluster_info.get('risk_score', 0)

                # Color for risk level
                risk_colors = {'High': '#FF4444', 'Medium': '#FFA500', 'Low': '#44FF44'}
                color = risk_colors.get(risk_level, '#0066cc')

                # Header with risk info
                st.markdown(f"""
                <div style="background-color: {color}; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                    <h2 style="margin: 0;">🔍 Cluster #{selected_cluster} Details</h2>
                    <p style="margin: 10px 0 0 0; font-size: 16px;">
                        <b>Risk Level:</b> {risk_level} |
                        <b>Risk Score:</b> {risk_score:.0f}/100 |
                        <b>Unique Retailers:</b> {cluster_info['retailer_count']} |
                        <b>Traders:</b> {cluster_info['trader_count']} |
                        <b>Location:</b> ({cluster_info['center_lat']:.5f}, {cluster_info['center_lon']:.5f})
                    </p>
                </div>
                """, unsafe_allow_html=True)

                # Get cluster details
                cluster_details = get_cluster_details(df, selected_cluster)

                # Detailed data table
                st.write(f"#### 📋 Retailers in Cluster #{selected_cluster}")
                st.dataframe(
                    cluster_details,
                    use_container_width=True,
                    hide_index=True,
                    key=f"cluster_details_{selected_cluster}"
                )

                # Similarity Analysis
                similarity_details = get_similarity_details_for_cluster(
                    similarity_results,
                    selected_cluster
                )

                if similarity_details:
                    st.write(f"#### 📝 Name Similarity Analysis (Cluster #{selected_cluster})")
                    name_sim_df = create_name_similarity_dataframe(similarity_details)
                    if len(name_sim_df) > 0:
                        st.dataframe(
                            name_sim_df,
                            use_container_width=True,
                            hide_index=True,
                            key=f"similarity_{selected_cluster}"
                        )
                    else:
                        st.info("No similar names found in this cluster (threshold: 90%)")

                # Distance Matrix
                st.write(f"#### 📏 Distance Matrix - Cluster #{selected_cluster} (meters)")
                distance_matrix = calculate_distance_matrix(df, selected_cluster)
                if len(distance_matrix) > 0:
                    st.dataframe(
                        distance_matrix.round(2),
                        use_container_width=True,
                        key=f"distance_matrix_{selected_cluster}"
                    )
            else:
                st.info("👆 Click on any cluster row in the table above or click on a cluster marker on the map to view detailed analysis")

        # Export Section
        st.header("💾 Export Data")

        if len(cluster_stats) > 0:
            # Prepare export data
            export_df = df[df['cluster_id'] >= 0].copy()

            # Merge with cluster stats
            export_df = export_df.merge(
                cluster_stats[['cluster_id', 'risk_score', 'risk_level']],
                on='cluster_id',
                how='left'
            )

            # Create CSV download
            csv_buffer = BytesIO()
            export_df.to_csv(csv_buffer, index=False)
            csv_buffer.seek(0)

            st.download_button(
                label="📥 Download Flagged Clusters (CSV)",
                data=csv_buffer,
                file_name=f"fraud_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv",
                help="Download all retailers in clusters with risk scores and analysis results"
            )

            # Export cluster summary
            summary_csv = BytesIO()
            cluster_stats.to_csv(summary_csv, index=False)
            summary_csv.seek(0)

            st.download_button(
                label="📥 Download Cluster Summary (CSV)",
                data=summary_csv,
                file_name=f"cluster_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv",
                help="Download summary statistics for all clusters"
            )

else:
    # Instructions when no data is loaded
    st.info("""
    ### 📝 Getting Started

    1. Upload your meeting data CSV using the sidebar
    2. Adjust clustering settings and filters as needed
    3. Click "Run Analysis" to detect potential duplicate accounts
    4. Explore the interactive map and cluster details
    5. Export results for further action

    **Required CSV Columns:**
    - meetingDate, Darkstore, traderName, traderId
    - buyerName, buyerid, buyerPhone
    - currentLatitude, currentLongitude
    - selfie, verificationDoc
    """)
