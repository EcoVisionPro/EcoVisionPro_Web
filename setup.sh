#!/bin/bash
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
