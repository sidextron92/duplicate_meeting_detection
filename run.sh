#!/bin/bash

# Fraud Detection Dashboard - Run Script

echo "Starting Fraud Detection Dashboard..."
echo ""
echo "The app will open in your browser at http://localhost:8501"
echo "Press Ctrl+C to stop the server"
echo ""

# Activate virtual environment and run Streamlit app
source venv/bin/activate
streamlit run app.py
