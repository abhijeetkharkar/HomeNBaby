const { execSync } = require('child_process');

try {
  console.log('Deploying lambda...');
  execSync('aws lambda update-function-code --function-name tracker-api --zip-file fileb://tracker-api-deploy.zip --region us-east-1 --profile admin', {
    stdio: 'inherit'
  });
  console.log('Successfully deployed lambda.');
} catch (e) {
  console.error('Failed to deploy lambda', e);
}
