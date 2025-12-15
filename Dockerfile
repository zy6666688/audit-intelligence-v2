# Audit Intelligence v2 - Dockerfile

# ====================
# Stage 1: Frontend Build
# ====================
FROM node:18-alpine as frontend-builder

WORKDIR /app/frontend

# Copy frontend dependency files
COPY package*.json ./
RUN npm ci

# Copy frontend source code
COPY . .

# Build frontend (output to /app/frontend/dist)
# Note: VITE_API_BASE_URL should be set at build time or runtime. 
# Here we assume it will be served by the same host or configured later.
RUN npm run build


# ====================
# Stage 2: Backend & Runtime
# ====================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (if needed for pandas/numpy/opencv)
# RUN apt-get update && apt-get install -y --no-install-recommends ...

# Copy backend requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ .

# Copy built frontend assets to backend's static files directory (if serving via FastAPI)
# Or keep them separate if using Nginx. Here we demonstrate a simple all-in-one.
# We'll create a 'static' folder in backend to serve frontend files.
COPY --from=frontend-builder /app/frontend/dist /app/static

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV API_BASE_URL="http://localhost:8000"

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
