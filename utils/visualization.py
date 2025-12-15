import folium
from folium import plugins
import pandas as pd
import plotly.express as px


def create_cluster_map(df, cluster_stats):
    """
    Create an interactive Folium map showing clusters only (no individual retailer markers).
    Clicking on a cluster shows detailed side-by-side retailer information.

    Args:
        df: pandas DataFrame with all meeting data
        cluster_stats: DataFrame with cluster statistics and risk scores

    Returns:
        folium.Map: Interactive map object
    """
    # Get unique buyers for clustering
    df_unique = df.drop_duplicates(subset=['buyerid']).copy()

    # Calculate center of map (mean of all coordinates)
    center_lat = df_unique['currentLatitude'].mean()
    center_lon = df_unique['currentLongitude'].mean()

    # Create base map
    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=12,
        tiles='OpenStreetMap'
    )

    # Color mapping for risk levels
    risk_colors = {
        'High': 'red',
        'Medium': 'orange',
        'Low': 'green'
    }

    # Add cluster markers with detailed popups
    for _, cluster in cluster_stats.iterrows():
        cluster_id = cluster['cluster_id']
        risk_level = cluster.get('risk_level', 'Low')
        color = risk_colors.get(risk_level, 'blue')

        # Get unique retailers in this cluster
        cluster_data = df[df['cluster_id'] == cluster_id].copy()
        cluster_data = cluster_data.sort_values('meetingDate', ascending=False)
        cluster_unique = cluster_data.drop_duplicates(subset=['buyerid'], keep='first')

        # Create enhanced popup with horizontal scroll for side-by-side retailer information
        popup_html = f"""
        <div style="width: 100%; max-width: 1400px; font-family: Arial, sans-serif;">
            <div style="background-color: {color}; color: white; padding: 15px; margin: -10px -10px 15px -10px;">
                <h3 style="margin: 0;">Cluster #{cluster_id}</h3>
                <p style="margin: 5px 0 0 0;">
                    <b>Risk Level:</b> {risk_level} |
                    <b>Risk Score:</b> {cluster.get('risk_score', 0):.0f}/100 |
                    <b>Unique Retailers:</b> {cluster['retailer_count']} |
                    <b>Traders:</b> {cluster['trader_count']}
                </p>
            </div>

            <div style="overflow-x: auto; overflow-y: hidden; padding: 10px;">
                <div style="display: flex; flex-direction: row; gap: 15px; width: max-content;">
        """

        # Add each retailer in grid layout
        for idx, retailer in cluster_unique.iterrows():
            meeting_count = retailer.get('meeting_count', 1)
            records_text = f"{meeting_count} record{'s' if meeting_count > 1 else ''}"

            popup_html += f"""
            <div style="border: 2px solid #ddd; border-radius: 8px; padding: 12px; background: #f9f9f9; width: 380px; flex-shrink: 0;">
                <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 2px solid {color}; padding-bottom: 5px;">
                    {retailer['buyerName']}
                </h4>
                <p style="margin: 5px 0; font-size: 12px;"><b>Buyer ID:</b> {retailer['buyerid']}</p>
                <p style="margin: 5px 0; font-size: 12px;"><b>Phone:</b> {retailer['buyerPhone']}</p>
                <p style="margin: 5px 0; font-size: 12px;"><b>Trader:</b> {retailer['traderName']}</p>
                <p style="margin: 5px 0; font-size: 12px;"><b>Darkstore:</b> {retailer['Darkstore']}</p>
                <p style="margin: 5px 0; font-size: 12px;"><b>Latest Meeting:</b> {str(retailer['meetingDate'])[:10]}</p>
                <p style="margin: 5px 0; font-size: 12px; color: #0066cc;"><b>Total Records:</b> {records_text}</p>

                <div style="margin-top: 10px;">
            """

            # Add selfie image if available
            if retailer.get('has_selfie', False) and len(str(retailer['selfie'])) > 10:
                popup_html += f"""
                    <div style="margin-bottom: 8px;">
                        <p style="margin: 5px 0; font-size: 11px; font-weight: bold;">Selfie:</p>
                        <div style="width: 100%; height: 200px; background: #f5f5f5; border-radius: 5px; border: 1px solid #ccc; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                            <img src="{retailer['selfie']}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                        </div>
                    </div>
                """
            else:
                popup_html += """
                    <div style="margin-bottom: 8px;">
                        <p style="margin: 5px 0; font-size: 11px; font-weight: bold;">Selfie:</p>
                        <div style="width: 100%; height: 200px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 11px; color: #999; border: 1px solid #ccc;">No selfie</div>
                    </div>
                """

            # Add verification doc if available
            if retailer.get('has_verification', False) and len(str(retailer['verificationDoc'])) > 10:
                popup_html += f"""
                    <div>
                        <p style="margin: 5px 0; font-size: 11px; font-weight: bold;">Verification Doc:</p>
                        <div style="width: 100%; height: 200px; background: #f5f5f5; border-radius: 5px; border: 1px solid #ccc; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                            <img src="{retailer['verificationDoc']}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                        </div>
                    </div>
                """
            else:
                popup_html += """
                    <div>
                        <p style="margin: 5px 0; font-size: 11px; font-weight: bold;">Verification Doc:</p>
                        <div style="width: 100%; height: 200px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 11px; color: #999; border: 1px solid #ccc;">No document</div>
                    </div>
                """

            popup_html += """
                </div>
            </div>
            """

        popup_html += """
                </div>
            </div>
        </div>
        """

        # Add cluster marker (larger, more visible)
        folium.CircleMarker(
            location=[cluster['center_lat'], cluster['center_lon']],
            radius=20,
            color=color,
            fill=True,
            fillColor=color,
            fillOpacity=0.6,
            weight=3,
            popup=folium.Popup(popup_html, max_width=1420),
            tooltip=f"🔍 Cluster #{cluster_id} - {risk_level} Risk ({cluster['retailer_count']} retailers)"
        ).add_to(m)

    # Add layer control
    folium.LayerControl().add_to(m)

    return m


def create_risk_distribution_chart(cluster_stats):
    """
    Create a bar chart showing risk level distribution.

    Args:
        cluster_stats: DataFrame with cluster statistics

    Returns:
        plotly figure
    """
    if len(cluster_stats) == 0:
        return None

    risk_counts = cluster_stats['risk_level'].value_counts().reset_index()
    risk_counts.columns = ['Risk Level', 'Count']

    # Define color mapping
    color_map = {
        'High': '#FF4444',
        'Medium': '#FFA500',
        'Low': '#44FF44'
    }

    fig = px.bar(
        risk_counts,
        x='Risk Level',
        y='Count',
        title='Cluster Risk Distribution',
        color='Risk Level',
        color_discrete_map=color_map,
        text='Count'
    )

    fig.update_traces(textposition='outside')
    fig.update_layout(
        showlegend=False,
        height=300,
        xaxis_title='Risk Level',
        yaxis_title='Number of Clusters'
    )

    return fig


def create_cluster_size_chart(cluster_stats):
    """
    Create a histogram showing cluster sizes.

    Args:
        cluster_stats: DataFrame with cluster statistics

    Returns:
        plotly figure
    """
    if len(cluster_stats) == 0:
        return None

    fig = px.histogram(
        cluster_stats,
        x='retailer_count',
        title='Cluster Size Distribution',
        labels={'retailer_count': 'Number of Retailers in Cluster'},
        nbins=20
    )

    fig.update_layout(
        height=300,
        xaxis_title='Number of Retailers per Cluster',
        yaxis_title='Frequency',
        showlegend=False
    )

    return fig


def create_trader_analysis_chart(df):
    """
    Create a bar chart showing traders with most clusters.

    Args:
        df: DataFrame with cluster data

    Returns:
        plotly figure
    """
    if len(df[df['cluster_id'] >= 0]) == 0:
        return None

    # Count clusters per trader
    trader_clusters = df[df['cluster_id'] >= 0].groupby('traderName')['cluster_id'].nunique().reset_index()
    trader_clusters.columns = ['Trader', 'Cluster Count']
    trader_clusters = trader_clusters.sort_values('Cluster Count', ascending=False).head(10)

    fig = px.bar(
        trader_clusters,
        x='Trader',
        y='Cluster Count',
        title='Top 10 Traders by Number of Clusters',
        text='Cluster Count'
    )

    fig.update_traces(textposition='outside')
    fig.update_layout(
        height=350,
        xaxis_title='Trader Name',
        yaxis_title='Number of Clusters',
        showlegend=False,
        xaxis={'tickangle': -45}
    )

    return fig
