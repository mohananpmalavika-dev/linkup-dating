@echo off
REM Quick Start Script for DatingHub App (Windows)
REM This script sets up and starts both frontend and backend

echo.
echo 🚀 DatingHub App - Quick Start (Windows)
echo =========================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed.
    echo Please download from https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js installed: 
node --version

REM Check PostgreSQL
psql --version >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL is not installed.
    echo Please download from https://www.postgresql.org/download/
    pause
    exit /b 1
)
echo ✓ PostgreSQL installed: 
psql --version
echo.

REM Create database
echo 🗄️  Creating PostgreSQL database...
createdb linkup_dating >nul 2>&1
echo ✓ Database ready
echo.

REM Setup backend
echo ⚙️  Setting up backend...
cd backend
if not exist ".env" (
    copy .env.example .env >nul
    echo ✓ Created .env file
)
call npm install --legacy-peer-deps
echo ✓ Backend dependencies installed
cd ..
echo.

REM Setup frontend
echo ⚙️  Setting up frontend...
call npm install --legacy-peer-deps
echo ✓ Frontend dependencies installed
echo.

REM Start backend in new window
echo 🔧 Starting backend server in new window...
start "DatingHub Backend" cmd /k "cd backend && npm run dev"
echo ✓ Backend starting...
timeout /t 2 >nul
echo.

REM Start frontend in new window
echo 🎨 Starting frontend development server...
start "DatingHub Frontend" cmd /k "npm start"
echo ✓ Frontend starting...
echo.

echo ✅ Everything is starting!
echo =========================================
echo 📱 Frontend: http://localhost:3000
echo 🔌 Backend: http://localhost:5000
echo 📚 API Status: http://localhost:5000/health
echo.
echo ℹ️  Frontend will open automatically
echo Close the console windows to stop the servers
echo.
pause
