@echo off
echo Starting Ghost Tester Platform...
echo.

REM Start API Server
echo Starting API Server...
start "API Server" cmd /k "cd /d %~dp0api && npm run dev"

REM Wait a bit
timeout /t 2 /nobreak >nul

REM Start Worker Service
echo Starting Worker Service...
start "Worker Service" cmd /k "cd /d %~dp0worker && npm run dev"

REM Wait a bit
timeout /t 2 /nobreak >nul

REM Start Frontend
echo Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

REM Wait for Next.js to compile
timeout /t 8 /nobreak >nul

REM Open browser
echo Opening browser...
start http://localhost:3000

echo.
echo All services started!
echo Frontend: http://localhost:3000
echo API: http://localhost:3001
echo.
pause

