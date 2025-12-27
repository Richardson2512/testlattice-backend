# Ghost Tester - Development Startup Script
# This script starts all services for local development

Write-Host "🚀 Starting Ghost Tester Platform..." -ForegroundColor Green
Write-Host ""

# Check if Redis is running (optional, but recommended)
$redisRunning = $false
try {
    $redisTest = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    $redisRunning = $redisTest.TcpTestSucceeded
} catch {
    $redisRunning = $false
}

if (-not $redisRunning) {
    Write-Host "⚠️  Redis is not running on port 6379" -ForegroundColor Yellow
    Write-Host "   Test runs will queue but won't process until Redis is started" -ForegroundColor Yellow
    Write-Host "   To start Redis: docker-compose up -d redis" -ForegroundColor Yellow
    Write-Host ""
}

# Start API Server
Write-Host "📡 Starting API Server (port 3001)..." -ForegroundColor Cyan
$apiProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\api'; Write-Host 'API Server' -ForegroundColor Cyan; npm run dev" -PassThru
Start-Sleep -Seconds 2

# Start Worker Service
Write-Host "⚙️  Starting Worker Service..." -ForegroundColor Cyan
$workerProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\worker'; Write-Host 'Worker Service' -ForegroundColor Cyan; npm run dev" -PassThru
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "🎨 Starting Frontend (port 3000)..." -ForegroundColor Cyan
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/../Rihario-main'; Write-Host 'Frontend (Next.js)' -ForegroundColor Cyan; npm run dev" -PassThru
Start-Sleep -Seconds 5

# Open browser
Write-Host ""
Write-Host "✅ All services starting..." -ForegroundColor Green
Write-Host ""
Write-Host "📱 Opening browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "🎉 Ghost Tester Platform is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor White
Write-Host "  • Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  • API: http://localhost:3001" -ForegroundColor White
Write-Host "  • Health Check: http://localhost:3001/health" -ForegroundColor White
Write-Host ""
Write-Host "Three terminal windows have been opened for each service." -ForegroundColor White
Write-Host "Close them to stop the services." -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to exit this script (services will continue running)" -ForegroundColor Yellow
