@echo off
echo.
echo 🎵 Starting Topia Tune Server...
echo.

REM Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Python found
    echo 🚀 Starting server at http://localhost:8000
    echo.
    echo Press Ctrl+C to stop the server
    echo Open http://localhost:8000 in your browser
    echo.
    python -m http.server 8000
) else (
    echo ❌ Python not found
    echo.
    echo Please install Python or use one of these alternatives:
    echo.
    echo Option 1: Install Python
    echo   https://www.python.org/downloads/
    echo.
    echo Option 2: Use VS Code Live Server
    echo   Install 'Live Server' extension in VS Code
    echo.
    echo Option 3: Use Node.js http-server
    echo   npm install -g http-server
    echo   http-server -p 8000
    echo.
    pause
)
