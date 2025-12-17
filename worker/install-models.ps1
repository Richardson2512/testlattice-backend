# Install Ollama Models for TestLattice Worker
# Run this script after installing Ollama from https://ollama.ai/download

Write-Host "Installing Qwen 2.5 Coder models for Unified Brain Service..." -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is installed
$ollamaCheck = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCheck) {
    Write-Host "ERROR: Ollama is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Ollama from: https://ollama.ai/download" -ForegroundColor Yellow
    Write-Host "After installation, restart your terminal and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Ollama found at: $($ollamaCheck.Path)" -ForegroundColor Green
Write-Host ""

# Install Primary Model (7B)
Write-Host "Installing qwen2.5-coder:7b (Primary Model)..." -ForegroundColor Cyan
ollama pull qwen2.5-coder:7b
if ($LASTEXITCODE -eq 0) {
    Write-Host "âœ… qwen2.5-coder:7b installed successfully" -ForegroundColor Green
} else {
    Write-Host "âŒ Failed to install qwen2.5-coder:7b" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install Fallback Model (14B)
Write-Host "Installing qwen2.5-coder:14b (Fallback Model)..." -ForegroundColor Cyan
ollama pull qwen2.5-coder:14b
if ($LASTEXITCODE -eq 0) {
    Write-Host "âœ… qwen2.5-coder:14b installed successfully" -ForegroundColor Green
} else {
    Write-Host "âŒ Failed to install qwen2.5-coder:14b" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Cyan
ollama list | Select-String "qwen2.5-coder"

Write-Host ""
Write-Host "âœ… All models installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  - Primary Model: qwen2.5-coder:7b (fast, efficient)" -ForegroundColor White
Write-Host "  - Fallback Model: qwen2.5-coder:14b (when 7B fails or low confidence)" -ForegroundColor White
Write-Host ""
Write-Host "The Unified Brain Service will automatically:" -ForegroundColor Cyan
Write-Host "  - Use 7B for most tasks (fast)" -ForegroundColor White
Write-Host "  - Fallback to 14B on errors, low confidence, or complex scenarios" -ForegroundColor White
