# Deployment Guide

This Streamlit app can be deployed on various Python-compatible platforms. **Vercel is NOT recommended** as it's designed for Node.js apps.

## ✅ Recommended: Streamlit Community Cloud (FREE)

### Steps:

1. **Go to Streamlit Cloud**
   - Visit: https://share.streamlit.io/
   - Sign in with your GitHub account

2. **Deploy New App**
   - Click "New app" button
   - Select repository: `sidextron92/duplicate_meeting_detection`
   - Branch: `main`
   - Main file path: `app.py`

3. **Configure Settings** (Optional)
   - Set Python version: 3.9+ (auto-detected from requirements.txt)
   - No secrets needed for basic deployment

4. **Deploy!**
   - Click "Deploy"
   - Wait 2-5 minutes for deployment
   - Your app will be live at: `https://[your-app-name].streamlit.app`

### Advantages:
- ✅ FREE forever
- ✅ Built specifically for Streamlit
- ✅ Automatic SSL/HTTPS
- ✅ Auto-redeploy on git push
- ✅ 1GB resources included

---

## Alternative 1: Hugging Face Spaces (FREE)

### Steps:

1. **Create Space**
   - Go to: https://huggingface.co/spaces
   - Click "Create new Space"
   - Select "Streamlit" SDK

2. **Upload Code**
   ```bash
   git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/fraud-detection
   git push hf main
   ```

3. **Files Needed** (already included):
   - `app.py`
   - `requirements.txt`
   - `.streamlit/config.toml`

---

## Alternative 2: Railway.app

### Steps:

1. **Create Account**
   - Visit: https://railway.app/
   - Sign in with GitHub

2. **Deploy from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose: `sidextron92/duplicate_meeting_detection`

3. **Add Start Command**
   - In Railway settings, add:
   ```
   streamlit run app.py --server.port $PORT --server.address 0.0.0.0
   ```

4. **Set Environment Variables**
   ```
   PORT=8501
   ```

---

## Alternative 3: Render.com (FREE Tier)

### Steps:

1. **Create Web Service**
   - Go to: https://render.com/
   - Click "New" → "Web Service"
   - Connect GitHub repo

2. **Configuration**
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `streamlit run app.py --server.port $PORT --server.address 0.0.0.0`
   - **Environment:** Python 3

---

## ⚠️ Why Not Vercel?

Vercel is optimized for:
- Next.js / React
- Node.js serverless functions
- Static sites

It does NOT support:
- ❌ Python long-running processes
- ❌ Streamlit's websocket connections
- ❌ Python dependencies efficiently

---

## Local Deployment (Development)

```bash
# Clone repository
git clone https://github.com/sidextron92/duplicate_meeting_detection.git
cd duplicate_meeting_detection

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run app
streamlit run app.py
```

Access at: http://localhost:8501

---

## Production Deployment Checklist

- [ ] Update `meeting_data_raw.csv` with actual data or implement CSV upload only
- [ ] Set appropriate memory limits (app uses ~500MB with large datasets)
- [ ] Enable authentication if needed (Streamlit supports basic auth)
- [ ] Configure HTTPS (automatic on Streamlit Cloud)
- [ ] Set up monitoring/logging
- [ ] Consider CDN for static assets (images)

---

## Troubleshooting

### Issue: "Module not found"
**Solution:** Ensure all dependencies are in `requirements.txt`

### Issue: "Memory limit exceeded"
**Solution:**
- Filter data before uploading
- Use Streamlit Cloud's paid tier (more resources)
- Optimize clustering algorithm

### Issue: "App crashes on large CSV"
**Solution:**
- Limit CSV size to < 10MB
- Implement pagination
- Add data preprocessing

---

## Recommended: Streamlit Community Cloud

For this app, **Streamlit Community Cloud** is the best choice:
- Free and easy
- No configuration needed
- Built for Streamlit apps
- Automatic HTTPS
- Great performance

**Deploy now:** https://share.streamlit.io/
