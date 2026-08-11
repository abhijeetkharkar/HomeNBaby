#!/usr/bin/env node
/**
 * scripts/make-reminder-zip.js
 * Creates a zip of the reminder Lambda build directory.
 * Usage: node scripts/make-reminder-zip.js <buildDir> <outputZipPath>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildDir = process.argv[2];
const outputZip = process.argv[3];

if (!buildDir || !outputZip) {
  console.error('Usage: node make-reminder-zip.js <buildDir> <outputZipPath>');
  process.exit(1);
}

// Try native zip first (Mac/Linux/WSL), fall back to 7z (common on Windows)
function tryZip() {
  try {
    execSync(`zip -r "${outputZip}" .`, { cwd: buildDir, stdio: 'pipe' });
    return true;
  } catch { /* not available */ }

  try {
    execSync(`7z a -tzip "${outputZip}" .`, { cwd: buildDir, stdio: 'pipe' });
    return true;
  } catch { /* not available */ }

  return false;
}

if (tryZip()) {
  process.exit(0);
}

// Pure Node.js fallback using adm-zip if installed, otherwise manual Buffer approach
try {
  // Try to use the archiver package if present in the project
  const archiverPath = path.join(__dirname, '..', 'node_modules', 'archiver');
  if (fs.existsSync(archiverPath)) {
    const archiver = require(archiverPath);
    const output = fs.createWriteStream(outputZip);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(buildDir, false);
    archive.finalize();
    output.on('close', () => process.exit(0));
    output.on('error', (err) => { console.error(err); process.exit(1); });
  } else {
    throw new Error('archiver not found');
  }
} catch {
  // Last resort: PowerShell (Windows) with Windows-style paths
  const winBuildDir = buildDir.replace(/\//g, '\\');
  const winOutputZip = outputZip.replace(/\//g, '\\');
  try {
    execSync(
      `powershell.exe -Command "Add-Type -Assembly System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${winBuildDir}', '${winOutputZip}')"`,
      { stdio: 'pipe' }
    );
    process.exit(0);
  } catch (err) {
    console.error('Could not create zip:', err.message);
    process.exit(1);
  }
}
