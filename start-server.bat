@echo off
echo.
echo  ExchangeWatch LK - Local Development Server
echo  =============================================
echo.
echo  Checking for Python...
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Starting server on http://localhost:8080
    echo  Open your browser to: http://localhost:8080
    echo  Press Ctrl+C to stop.
    echo.
    python -m http.server 8080
) else (
    echo  Python not found. Checking for Node.js...
    node --version >nul 2>&1
    if %errorlevel% == 0 (
        echo  Starting server on http://localhost:8080
        echo  Open your browser to: http://localhost:8080
        echo  Press Ctrl+C to stop.
        echo.
        npx -y serve . --listen 8080
    ) else (
        echo  Neither Python nor Node.js found.
        echo  Please install one of them, or open index.html via VS Code Live Server.
        pause
    )
)
