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

# 3.1 Embed Favicon Icon and set GUI Subsystem (windowless)
Write-Host "[2.5/3] Embedding favicon icon and configuring windowless subsystem..." -ForegroundColor Yellow
$FaviconIco = Join-Path $WorkspaceRoot "apps\cinema-manager-ui\public\favicon.ico"
$PostProcessScript = @"
const ResEdit = require('resedit');
const fs = require('fs');

const targetExe = process.argv[2];
const iconPath = process.argv[3];

if (fs.existsSync(targetExe) && fs.existsSync(iconPath)) {
  const exeBuffer = fs.readFileSync(targetExe);
  const exe = ResEdit.NtExecutable.from(exeBuffer);
  const res = ResEdit.NtExecutableResource.from(exe);
  // Replace icon with web UI favicon
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1,
    1033,
    iconFile.icons.map(item => item.data)
  );

  // Set PE VersionInfo strings so Windows Task Manager shows 'Cinema Manager Agent' instead of 'Node.js JavaScript Runtime'
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  let vi = viList[0];
  if (!vi) {
    vi = ResEdit.Resource.VersionInfo.createEmpty();
  }
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Cinema Manager Agent',
    ProductName: 'Cinema Manager',
    CompanyName: 'Abhijeet Kharkar',
    OriginalFilename: 'cinema-agent.exe',
    InternalName: 'cinema-agent.exe',
    LegalCopyright: 'Copyright (c) Abhijeet Kharkar. All rights reserved.'
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  let updatedBuf = Buffer.from(exe.generate());

  // Set PE Subsystem to 2 (IMAGE_SUBSYSTEM_WINDOWS_GUI) for silent, windowless background run
  const peOffset = updatedBuf.readUInt32LE(0x3c);
  const magic = updatedBuf.readUInt16LE(peOffset + 24);
  const subsystemOffset = peOffset + (magic === 0x20b ? 92 : 68);
  updatedBuf.writeUInt16LE(2, subsystemOffset);

  fs.writeFileSync(targetExe, updatedBuf);
  console.log('Successfully embedded favicon icon, updated VersionInfo to "Cinema Manager Agent", and set GUI windowless subsystem!');
}
"@
$PostJs = Join-Path $AppRoot "dist\postprocess-exe.js"
Set-Content -Path $PostJs -Value $PostProcessScript
Push-Location $AppRoot
try {
    node dist/postprocess-exe.js "$TargetExe" "$FaviconIco"
} finally {
    Pop-Location
    Remove-Item $PostJs -ErrorAction SilentlyContinue
}

# 4. Copy configuration & helper scripts
Write-Host "[3/3] Creating configuration and launcher scripts..." -ForegroundColor Yellow
$ConfigSrc = Join-Path $AppRoot "config\service.json"
$ConfigDest = Join-Path $OutPath "service.json"
Copy-Item -Path $ConfigSrc -Destination $ConfigDest -Force

# Create install-service.bat
$InstallBat = @"
@echo off
echo ==============================================
echo Installing Cinema Manager Desktop Companion...
echo ==============================================
"%~dp0cinema-agent.exe" --install
start "" "%~dp0cinema-agent.exe"
echo.
echo ==============================================
echo [SUCCESS] Cinema Manager Agent installed!
echo The agent is running silently in the background
echo and will start automatically whenever you log in.
echo ==============================================
pause
"@
Set-Content -Path (Join-Path $OutPath "install-service.bat") -Value $InstallBat

# Create uninstall-service.bat
$UninstallBat = @"
@echo off
echo ==============================================
echo Uninstalling Cinema Manager Desktop Companion...
echo ==============================================
"%~dp0cinema-agent.exe" --uninstall
echo.
echo ==============================================
echo [SUCCESS] Cinema Manager Agent uninstalled.
echo ==============================================
pause
"@
Set-Content -Path (Join-Path $OutPath "uninstall-service.bat") -Value $UninstallBat

# Create run.bat (Foreground Console Mode)
$RunBat = @"
@echo off
echo Starting Cinema Manager Desktop Companion in Console Mode...
"%~dp0cinema-agent.exe"
pause
"@
Set-Content -Path (Join-Path $OutPath "run.bat") -Value $RunBat

# Create README.txt
$Readme = @"
======================================================
  CINEMA MANAGER AGENT (Desktop Companion)
======================================================

QUICK START:

1. RUN AS BACKGROUND SERVICE (Recommended):
   Double-click 'install-service.bat'.
   The agent will configure auto-start on logon and begin 
   running quietly in the background.

2. FOREGROUND / TESTING MODE:
   Double-click 'run.bat' or 'cinema-agent.exe'.

3. CONNECT WITH WEB APP:
   Open https://cinema.abhijeetkharkar.com
   The onboarding wizard will detect this agent automatically 
   and link your media library.

4. TO UNINSTALL:
   Double-click 'uninstall-service.bat'.
======================================================
"@
Set-Content -Path (Join-Path $OutPath "README.txt") -Value $Readme

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "  Output Directory: $OutPath" -ForegroundColor Green
Write-Host "  Executable: $TargetExe" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
