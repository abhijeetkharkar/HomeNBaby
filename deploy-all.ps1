$ErrorActionPreference = "Stop"
$env:AWS_REGION="us-east-1"

Write-Host "Building frontend apps with Nx..."
npx nx run-many -t build

Write-Host "Bootstrapping and Deploying Core Infra..."
cd libs/core-infra
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

Write-Host "Deploying Baby Tracker..."
cd apps/baby-tracker
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "Deploying Plants..."
cd apps/plants
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "Deploying Portfolio..."
cd apps/portfolio
npx cdk deploy --require-approval never --profile admin
cd ../..

Write-Host "All deployments finished!"
