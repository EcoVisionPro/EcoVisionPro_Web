@echo off
REM JyotiYantra Backend Setup Script for Windows

echo 🚀 Setting up JyotiYantra Backend...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8+ first.
    pause
    exit /b 1
)

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Copy environment file
if not exist .env (
    echo 📋 Copying .env.example to .env...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your actual configuration values!
) else (
    echo ✅ .env file already exists
)

echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Edit .env file with your ThingsBoard and device configuration
echo 2. Run: venv\Scripts\activate.bat
echo 3. Run: python app.py
echo.
echo 🔗 API Endpoints:
echo - Health Check: GET /health
echo - Data Ingestion: POST /ingest
echo - Query Data: GET /api/data
pause
