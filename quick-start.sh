#!/bin/bash

# Quick Start Script for LinkUp Dating App
# This script sets up and starts both frontend and backend

echo "🚀 LinkUp Dating App - Quick Start"
echo "===================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install from https://nodejs.org/"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install from https://www.postgresql.org/download/"
    exit 1
fi

echo "✓ Node.js: $(node --version)"
echo "✓ PostgreSQL: $(psql --version)"
echo ""

# Create database
echo "🗄️  Creating PostgreSQL database..."
createdb linkup_dating 2>/dev/null || echo "  (Database may already exist)"
echo "✓ Database ready"
echo ""

# Setup backend
echo "⚙️  Setting up backend..."
cd backend
cp .env.example .env 2>/dev/null || echo "  .env already exists"
npm install --legacy-peer-deps
echo "✓ Backend dependencies installed"
echo ""

# Setup frontend
echo "⚙️  Setting up frontend..."
cd ..
npm install --legacy-peer-deps
echo "✓ Frontend dependencies installed"
echo ""

# Start backend
echo "🔧 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
echo "✓ Backend running (PID: $BACKEND_PID)"
sleep 2
echo ""

# Start frontend
echo "🎨 Starting frontend development server..."
cd ..
npm start &
FRONTEND_PID=$!
echo "✓ Frontend starting (PID: $FRONTEND_PID)"
echo ""

echo "✅ Everything is running!"
echo "===================================="
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend: http://localhost:5000"
echo "📚 API Docs: http://localhost:5000/health"
echo ""
echo "To stop servers, press Ctrl+C"
echo ""

# Keep script running
wait
