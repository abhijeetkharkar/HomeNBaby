const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROFILE = 'admin';
const CLOUDFRONT_ID = 'E2C4ZYW75CTXZT';
const BUCKET = 'tracker.abhijeetkharkar.com';

const projectDir = path.resolve(__dirname, '..');

console.log('Building frontend...');
execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });

if (fs.existsSync(path.join(projectDir, 'favicon.svg'))) {
  fs.copyFileSync(path.join(projectDir, 'favicon.svg'), path.join(projectDir, 'public', 'favicon.svg'));
}

console.log('Uploading assets...');
execSync(`aws s3 sync public/ s3://${BUCKET}/ --profile ${PROFILE} --exclude "index.html" --cache-control "max-age=31536000,public,immutable" --delete --no-progress`, { cwd: projectDir, stdio: 'inherit' });

console.log('Uploading index.html...');
execSync(`aws s3 cp public/index.html s3://${BUCKET}/index.html --profile ${PROFILE} --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"`, { cwd: projectDir, stdio: 'inherit' });

console.log('Invalidating CloudFront...');
execSync(`aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --profile ${PROFILE} --paths "/index.html"`, { cwd: projectDir, stdio: 'inherit' });

console.log('Frontend deployed!');
