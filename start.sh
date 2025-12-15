#!/bin/bash

# Start script for deployment
echo "Starting Fraud Detection Dashboard..."

# Set Streamlit configuration
export STREAMLIT_SERVER_PORT=${PORT:-8501}
export STREAMLIT_SERVER_ADDRESS=0.0.0.0
export STREAMLIT_SERVER_HEADLESS=true

# Run Streamlit
streamlit run app.py \
  --server.port $STREAMLIT_SERVER_PORT \
  --server.address $STREAMLIT_SERVER_ADDRESS \
  --server.headless true \
  --server.enableCORS false \
  --server.enableXsrfProtection false \
  --browser.gatherUsageStats false
