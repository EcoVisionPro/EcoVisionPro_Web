# Create requirements.txt file
requirements_content = '''# JyotiYantra Backend Dependencies
Flask==2.3.3
Flask-CORS==4.0.0
requests==2.31.0
python-dotenv==1.0.0
schedule==1.2.0
gunicorn==21.2.0
'''

# Save requirements.txt
with open('requirements.txt', 'w') as f:
    f.write(requirements_content)

print("✅ Created requirements.txt")

# Create .env.example file
env_example_content = '''# JyotiYantra Backend Configuration
# Copy this file to .env and fill in your actual values

# ThingsBoard Configuration
THINGSBOARD_HOST=localhost
THINGSBOARD_PORT=8080
THINGSBOARD_USERNAME=tenant@thingsboard.org
THINGSBOARD_PASSWORD=tenant

# Device Configuration
DEVICE_ID=your-device-id-here
DEVICE_TOKEN=your-device-access-token-here

# Flask API Security
API_KEY=your-secure-api-key-here

# Solar Panel Configuration
PANEL_AREA=1.5

# Optional: Database Configuration (for future use)
# DATABASE_URL=postgresql://user:password@localhost/jyotiyantra
'''

# Save .env.example
with open('.env.example', 'w') as f:
    f.write(env_example_content)

print("✅ Created .env.example")

# Create a setup script
setup_script_content = '''#!/bin/bash
# JyotiYantra Backend Setup Script

echo "🚀 Setting up JyotiYantra Backend..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Copy environment file
if [ ! -f .env ]; then
    echo "📋 Copying .env.example to .env..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual configuration values!"
else
    echo "✅ .env file already exists"
fi

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file with your ThingsBoard and device configuration"
echo "2. Run: source venv/bin/activate"
echo "3. Run: python app.py"
echo ""
echo "🔗 API Endpoints:"
echo "- Health Check: GET /health"
echo "- Data Ingestion: POST /ingest"
echo "- Query Data: GET /api/data"
'''

# Save setup script
with open('setup.sh', 'w') as f:
    f.write(setup_script_content)

print("✅ Created setup.sh")

# Create a Windows setup script
setup_bat_content = '''@echo off
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
call venv\\Scripts\\activate.bat

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
echo 2. Run: venv\\Scripts\\activate.bat
echo 3. Run: python app.py
echo.
echo 🔗 API Endpoints:
echo - Health Check: GET /health
echo - Data Ingestion: POST /ingest
echo - Query Data: GET /api/data
pause
'''

# Save Windows setup script
with open('setup.bat', 'w') as f:
    f.write(setup_bat_content)

print("✅ Created setup.bat")

print("\n🎉 All backend files created successfully!")