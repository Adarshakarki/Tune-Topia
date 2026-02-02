#!/bin/bash

# Simple server start script for Topia Tune

echo "🎵 Starting Topia Tune Server..."
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "✓ Python 3 found"
    echo "🚀 Starting server at http://localhost:8000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo "Open http://localhost:8000 in your browser"
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✓ Python found"
    echo "🚀 Starting server at http://localhost:8000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo "Open http://localhost:8000 in your browser"
    echo ""
    python -m http.server 8000
else
    echo "❌ Python not found"
    echo ""
    echo "Please install Python or use one of these alternatives:"
    echo ""
    echo "Option 1: Install Python"
    echo "  https://www.python.org/downloads/"
    echo ""
    echo "Option 2: Use VS Code Live Server"
    echo "  Install 'Live Server' extension in VS Code"
    echo ""
    echo "Option 3: Use Node.js http-server"
    echo "  npm install -g http-server"
    echo "  http-server -p 8000"
    echo ""
    exit 1
fi
