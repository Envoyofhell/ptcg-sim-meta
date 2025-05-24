# ===================================================================
# File: scripts/start-raid-system.ps1  
# Purpose: Start PTCG Raid System for development and testing
# Version: 1.0.0
# Author: PTCG Sim Meta Team
#
# Description:
#   PowerShell script to start the raid server and open the client
#   in the default browser for easy testing and development.
#
# Usage:
#   .\scripts\start-raid-system.ps1
#   .\scripts\start-raid-system.ps1 -Legacy    # Use legacy HTML
#   .\scripts\start-raid-system.ps1 -Debug     # Enable debug mode
#
# Requirements:
#   - Node.js installed
#   - PowerShell 5.0+
#   - Default browser configured
# ===================================================================

param(
    [switch]$Legacy,    # Use legacy HTML file
    [switch]$Debug,     # Enable debug mode
    [switch]$NoOpen     # Don't open browser
)

# Configuration
$ServerPath = "server"
$ServerScript = "raid-test-server-enhanced.js"
$ClientPath = "client"
$ModularHtml = "raid-test-modular.html"
$LegacyHtml = "raid-test.html"
$ServerPort = 4000

# Colors for output
$Green = "Green"
$Yellow = "Yellow"  
$Red = "Red"
$Cyan = "Cyan"

# Header
Write-Host "🚀 PTCG Raid System Startup Script v1.0.0" -ForegroundColor $Cyan
Write-Host "=" * 50 -ForegroundColor $Cyan

# Check if Node.js is installed
Write-Host "🔍 Checking Node.js installation..." -ForegroundColor $Yellow
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor $Green
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH!" -ForegroundColor $Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor $Yellow
    exit 1
}

# Check server directory
Write-Host "📁 Checking server directory..." -ForegroundColor $Yellow
if (Test-Path $ServerPath) {
    Write-Host "✅ Server directory found" -ForegroundColor $Green
} else {
    Write-Host "❌ Server directory not found: $ServerPath" -ForegroundColor $Red
    exit 1
}

# Check server script
$serverScriptPath = Join-Path $ServerPath $ServerScript
Write-Host "📄 Checking server script..." -ForegroundColor $Yellow
if (Test-Path $serverScriptPath) {
    Write-Host "✅ Server script found: $serverScriptPath" -ForegroundColor $Green
} else {
    Write-Host "❌ Server script not found: $serverScriptPath" -ForegroundColor $Red
    exit 1
}

# Check client files
Write-Host "🌐 Checking client files..." -ForegroundColor $Yellow
$htmlFile = if ($Legacy) { $LegacyHtml } else { $ModularHtml }
$clientHtmlPath = Join-Path $ClientPath $htmlFile

if (Test-Path $clientHtmlPath) {
    Write-Host "✅ Client HTML found: $clientHtmlPath" -ForegroundColor $Green
} else {
    Write-Host "❌ Client HTML not found: $clientHtmlPath" -ForegroundColor $Red
    Write-Host "Available HTML files:" -ForegroundColor $Yellow
    Get-ChildItem -Path $ClientPath -Filter "*.html" | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor $Yellow
    }
    exit 1
}

# Kill any existing server processes
Write-Host "🔄 Checking for existing server processes..." -ForegroundColor $Yellow
$existingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -eq "node" -and $_.Path -like "*raid*"
}

if ($existingProcesses) {
    Write-Host "⚠️ Found existing Node.js processes, stopping them..." -ForegroundColor $Yellow
    $existingProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "✅ Existing processes stopped" -ForegroundColor $Green
}

# Start the server
Write-Host "🚀 Starting raid server..." -ForegroundColor $Yellow
Write-Host "Server: $serverScriptPath" -ForegroundColor $Cyan
Write-Host "Port: $ServerPort" -ForegroundColor $Cyan

$serverJob = Start-Job -ScriptBlock {
    param($serverPath, $serverScript)
    Set-Location $serverPath
    node $serverScript
} -ArgumentList (Resolve-Path $ServerPath), $ServerScript

# Wait for server to start
Write-Host "⏳ Waiting for server to start..." -ForegroundColor $Yellow
Start-Sleep -Seconds 3

# Check if server is running
$serverRunning = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$ServerPort" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $serverRunning = $true
            break
        }
    } catch {
        # Server not ready yet
    }
    Start-Sleep -Seconds 1
}

if ($serverRunning) {
    Write-Host "✅ Server is running on http://localhost:$ServerPort" -ForegroundColor $Green
} else {
    Write-Host "❌ Server failed to start or is not responding" -ForegroundColor $Red
    Write-Host "Checking server job output..." -ForegroundColor $Yellow
    Receive-Job -Job $serverJob
    exit 1
}

# Build client URL
$baseUrl = "http://localhost:$ServerPort/$htmlFile"
$urlParams = @()

if ($Debug) {
    $urlParams += "debug=true"
}

if ($urlParams.Count -gt 0) {
    $clientUrl = "$baseUrl?" + ($urlParams -join "&")
} else {
    $clientUrl = $baseUrl
}

# Display information
Write-Host "=" * 50 -ForegroundColor $Cyan
Write-Host "🎮 PTCG Raid System Ready!" -ForegroundColor $Green
Write-Host "=" * 50 -ForegroundColor $Cyan
Write-Host "Server URL: http://localhost:$ServerPort" -ForegroundColor $Cyan
Write-Host "Client URL: $clientUrl" -ForegroundColor $Cyan
Write-Host "HTML File: $htmlFile" -ForegroundColor $Cyan
Write-Host "Debug Mode: $(if ($Debug) { 'Enabled' } else { 'Disabled' })" -ForegroundColor $Cyan
Write-Host "=" * 50 -ForegroundColor $Cyan

# Open browser
if (-not $NoOpen) {
    Write-Host "🌐 Opening browser..." -ForegroundColor $Yellow
    try {
        Start-Process $clientUrl
        Write-Host "✅ Browser opened successfully" -ForegroundColor $Green
    } catch {
        Write-Host "⚠️ Could not open browser automatically" -ForegroundColor $Yellow
        Write-Host "Please open: $clientUrl" -ForegroundColor $Cyan
    }
} else {
    Write-Host "📋 Browser auto-open disabled" -ForegroundColor $Yellow
    Write-Host "Manual URL: $clientUrl" -ForegroundColor $Cyan
}

# Instructions
Write-Host ""
Write-Host "📋 Quick Actions:" -ForegroundColor $Yellow
Write-Host "  • Create Raid: Click 'Create New Raid'" -ForegroundColor $Cyan
Write-Host "  • Join Raid: Enter Raid ID and click 'Join Existing Raid'" -ForegroundColor $Cyan
Write-Host "  • Test Multiplayer: Click '🧪 Test Multiplayer'" -ForegroundColor $Cyan
Write-Host "  • Debug Panel: Press Shift+F12 or click 🐞" -ForegroundColor $Cyan
Write-Host ""
Write-Host "⚠️ Press Ctrl+C to stop the server" -ForegroundColor $Yellow
Write-Host ""

# Keep script running and monitor server
try {
    while ($true) {
        $jobState = Get-Job -Id $serverJob.Id | Select-Object -ExpandProperty State
        
        if ($jobState -eq "Completed" -or $jobState -eq "Failed") {
            Write-Host "❌ Server job ended unexpectedly" -ForegroundColor $Red
            Write-Host "Job output:" -ForegroundColor $Yellow
            Receive-Job -Job $serverJob
            break
        }
        
        Start-Sleep -Seconds 5
    }
} catch {
    Write-Host "🛑 Stopping server..." -ForegroundColor $Yellow
} finally {
    # Cleanup
    if ($serverJob) {
        Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
    }
    
    # Kill any remaining node processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -eq "node"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Host "✅ Cleanup complete" -ForegroundColor $Green
}

# ===================================================================
# END OF FILE: scripts/start-raid-system.ps1
#
# Notes:
#   - Run from project root directory
#   - Automatically handles server startup and browser opening
#   - Includes error checking and cleanup
#   - Supports both legacy and modular versions
#   - Can be extended for additional features
# =================================================================== 