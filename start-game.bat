@echo off
rem Double-click this script to launch Blackjack - The Green Room
rem (starts the local game server and opens your browser automatically).
rem Note: keep this file pure ASCII with CRLF line endings so cmd parses it
rem correctly on any system code page.

title Blackjack - The Green Room
cd /d "%~dp0"

rem Probe node; the game requires Node.js 26.x 26.13.1+
rem (the check also fails when node is not on PATH at all)
node -e "const [a,b,c]=process.versions.node.split('.').map(Number);process.exit(Number.isInteger(c)&&(a===26&&(b>13||(b===13&&c>=1)))?0:1)" >nul 2>nul
if errorlevel 1 (
    echo.
    echo [Error] No usable Node.js 26.x 26.13.1+ environment was detected.
    echo Please download and install the LTS version from the official site first:
    echo.
    echo     https://nodejs.org/
    echo.
    echo Opening the download page ...
    start "" "https://nodejs.org/"
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo First run: installing dependencies ^(npm ci^) ...
    call npm ci
    if errorlevel 1 (
        echo.
        echo [Error] Dependency installation failed. Check your network and retry.
        pause
        exit /b 1
    )
)

rem Start the Vite dev server; --open launches the game in your default browser
call npm run dev -- --open

echo.
echo Game server stopped.
pause
