#!/bin/bash
# Docker Compose Quick Start Script for Audit Intelligence v2

set -e

echo "🚀 Starting Audit Intelligence v2..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  IMPORTANT: Please edit .env and set JWT_SECRET before production deployment!"
    echo ""
fi

# Check if JWT_SECRET is set
if grep -q "your-very-secure-random-secret-key" .env; then
    echo "⚠️  WARNING: JWT_SECRET is using the default value!"
    echo "⚠️  Please change it in .env before deploying to production!"
    echo ""
fi

# Create storage directories
echo "📁 Creating storage directories..."
mkdir -p storage/projects
mkdir -p storage/cache
mkdir -p storage/backups
echo "✅ Storage directories created"
echo ""

# Build and start containers
echo "🏗️  Building Docker images..."
docker-compose build

echo ""
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check health
echo ""
echo "🔍 Checking service health..."
if curl -f http://localhost:8000/docs > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding"
fi

if curl -f http://localhost:80 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not responding"
fi

echo ""
echo "🎉 Audit Intelligence v2 is running!"
echo ""
echo "📍 Access points:"
echo "   Frontend:  http://localhost:80"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo ""
echo "🔐 Default login:"
echo "   Username:  admin"
echo "   Password:  0000"
echo "   ⚠️  Change password after first login!"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""
