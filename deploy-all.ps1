$ErrorActionPreference = "Stop"
$env:AWS_REGION="us-east-1"

Write-Host "Building frontend apps..."
npm run build --workspaces --if-present

Write-Host "Bootstrapping and Deploying Core Infra..."
cd packages/core-infra
npx cdk bootstrap --profile admin
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "Deploying API..."
cd apps/api
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "Deploying Reminders..."
cd apps/reminders
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "Deploying Tracker..."
cd apps/tracker
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "Deploying Plants..."
cd apps/plants
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "All deployments finished!"
