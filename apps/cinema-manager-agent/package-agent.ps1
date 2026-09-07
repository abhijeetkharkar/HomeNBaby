param(
    [string]$OutputDir = "dist\cinema-agent-win-x64"
)

$ErrorActionPreference = "Stop"
$AppRoot = Resolve-Path $PSScriptRoot
$WorkspaceRoot = Resolve-Path (Join-Path $AppRoot "../..")
$OutPath = Join-Path $WorkspaceRoot $OutputDir

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Packaging Cinema Manager Agent for Win " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Ensure output directory
if (-not (Test-Path $OutPath)) {
    New-Item -ItemType Directory -Path $OutPath -Force | Out-Null
}

# 2. Bundle with esbuild
Write-Host "[1/3] Bundling TypeScript source..." -ForegroundColor Yellow
$BundleJs = Join-Path $AppRoot "dist\agent.bundle.js"
Push-Location $AppRoot
try {
    npx esbuild src/main.ts --bundle --platform=node --target=node18 "--outfile=$BundleJs"
} finally {
    Pop-Location
}

# 3. Package executable with pkg
Write-Host "[2/3] Compiling standalone Windows .exe..." -ForegroundColor Yellow
$TargetExe = Join-Path $OutPath "cinema-agent.exe"
npx --yes pkg $BundleJs --target node18-win-x64 --output $TargetExe

# 4. Copy configuration & helper scripts
Write-Host "[3/3] Creating configuration and launcher scripts..." -ForegroundColor Yellow
$ConfigSrc = Join-Path $AppRoot "config\service.json"
Copy-Item -Path $ConfigSrc -Destination (Join-Path $OutPath "service.json") -Force

# Create install-service.bat
$InstallBat = @"
@echo off
echo ==============================================
echo Installing Cinema Manager Windows Service...
echo ==============================================
"%~dp0cinema-agent.exe" --install
pause
"@
Set-Content -Path (Join-Path $OutPath "install-service.bat") -Value $InstallBat

# Create uninstall-service.bat
$UninstallBat = @"
@echo off
echo ==============================================
echo Uninstalling Cinema Manager Windows Service...
echo ==============================================
"%~dp0cinema-agent.exe" --uninstall
pause
"@
Set-Content -Path (Join-Path $OutPath "uninstall-service.bat") -Value $UninstallBat

# Create run.bat (Foreground Console Mode)
$RunBat = @"
@echo off
echo Starting Cinema Manager Agent in Console Mode...
"%~dp0cinema-agent.exe"
pause
"@
Set-Content -Path (Join-Path $OutPath "run.bat") -Value $RunBat

# Create README.txt
$Readme = @"
======================================================
  CINEMA MANAGER AGENT (Standalone Windows Distribution)
======================================================

HOW TO RUN:

1. CONFIGURE FOLDERS:
   Open 'service.json' in Notepad and update 'watchPaths' with the 
   folders you want to monitor (e.g. D:\Movies, C:\Users\Downloads).

2. RUN IN CONSOLE (Testing):
   Double-click 'run.bat' or run 'cinema-agent.exe'.

3. RUN AS BACKGROUND WINDOWS SERVICE (Recommended):
   Right-click 'install-service.bat' and select 'Run as administrator'.
   The agent will start automatically in the background and 
   run on system boot.

4. TO UNINSTALL SERVICE:
   Right-click 'uninstall-service.bat' and select 'Run as administrator'.

======================================================
"@
Set-Content -Path (Join-Path $OutPath "README.txt") -Value $Readme

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "  Output Directory: $OutPath" -ForegroundColor Green
Write-Host "  Executable: $TargetExe" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
