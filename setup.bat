@echo off
REM LinkUp Setup Script for Windows

echo.
echo ========================================
echo   LinkUp - Android App Setup
echo ========================================
echo.

REM Check Node.js
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download from: https://nodejs.org
    pause
    exit /b 1
)
echo ✓ Node.js is installed

REM Check npm
echo Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    pause
    exit /b 1
)
echo ✓ npm is installed

REM Install dependencies
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo ✓ Dependencies installed

REM Check ANDROID_HOME
echo.
echo Checking Android SDK...
if not defined ANDROID_HOME (
    echo WARNING: ANDROID_HOME is not set!
    echo Please set it in System Environment Variables:
    echo   ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk
) else (
    echo ✓ ANDROID_HOME is set: %ANDROID_HOME%
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Update .env with your backend URL
echo 2. Run: npm run build
echo 3. Run: npx cap add android
echo 4. Run: npm run capacitor:build
echo.
pause
