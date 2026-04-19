/**
 * scripts/make-lambda-zip.js
 * Cross-platform Lambda deployment package builder.
 * Uses archiver for better Windows compatibility.
 *
 * Usage: node scripts/make-lambda-zip.js
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.resolve(__dirname, '..');
const buildDir = path.join(projectDir, 'lambda-build');
const zipPath = path.join(projectDir, 'lambda-deploy.zip');

// Clean up
if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true });
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
fs.mkdirSync(buildDir);

// Copy source files
console.log('  Copying source files...');
['server.js', 'lambda.js', 'package.json'].forEach(f => {
  fs.copyFileSync(path.join(projectDir, f), path.join(buildDir, f));
});

// Install production deps — no platform-specific binaries needed (DynamoDB SDK is pure JS)
console.log('  Installing production deps...');
try {
  execSync('npm install --production --silent', {
    cwd: buildDir,
    stdio: 'inherit',
  });
} catch (e) {
  console.error('npm install failed:', e.message);
  process.exit(1);
}

// Use archiver for reliable cross-platform zipping
console.log('  Zipping...');
try {
  const archiver = require('archiver');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', err => {
    console.error('archiver error:', err);
    process.exit(1);
  });

  output.on('close', () => {
    fs.rmSync(buildDir, { recursive: true });
    const sizeKB = Math.round(fs.statSync(zipPath).size / 1024);
    console.log(`  lambda-deploy.zip ready (${sizeKB} KB)`);
  });

  archive.pipe(output);
  archive.directory(buildDir + path.sep, false);
  archive.finalize();
} catch (e) {
  // Fallback: if archiver not installed, use 7z if available, else error
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('  archiver not found, trying 7z...');
    try {
      execSync(`7z a -tzip "${zipPath}" "${buildDir}\\*"`, { stdio: 'inherit' });
      fs.rmSync(buildDir, { recursive: true });
      const sizeKB = Math.round(fs.statSync(zipPath).size / 1024);
      console.log(`  lambda-deploy.zip ready (${sizeKB} KB)`);
    } catch (e2) {
      console.error('7z also failed. Install 7-Zip or run: npm install archiver');
      process.exit(1);
    }
  } else {
    throw e;
  }
}
