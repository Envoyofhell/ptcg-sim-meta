# ===================================================================
# File: scripts/open-modular-raid.ps1
# Purpose: Open the modular PTCG Raid System in browser
# Version: 1.0.0
# Usage: .\scripts\open-modular-raid.ps1
# ===================================================================

$modularUrl = "http://localhost:4000/raid-test-modular.html"

Write-Host "🚀 Opening PTCG Raid System - Modular Edition" -ForegroundColor Green
Write-Host "URL: $modularUrl" -ForegroundColor Cyan

# Check if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is running" -ForegroundColor Green
        
        # Open the modular version
        Start-Process $modularUrl
        Write-Host "🌐 Opened modular raid system in browser" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "📋 Important Notes:" -ForegroundColor Yellow
        Write-Host "  • Clear browser cache if you see issues" -ForegroundColor White
        Write-Host "  • This is the MODULAR version with separate CSS/JS files" -ForegroundColor White
        Write-Host "  • All buttons should be functional now" -ForegroundColor White
    } else {
        throw "Server returned status code: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Server is not running on port 4000" -ForegroundColor Red
    Write-Host "Please start the server first:" -ForegroundColor Yellow
    Write-Host "  cd server" -ForegroundColor White
    Write-Host "  node raid-test-server-enhanced.js" -ForegroundColor White
} 