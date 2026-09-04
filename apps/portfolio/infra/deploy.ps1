param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "portfolio-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "Building Portfolio frontend..." -ForegroundColor Cyan
Push-Location $AppRoot
try {
    npm run build
} finally {
    Pop-Location
}

Write-Host "Deploying CloudFormation stack: $StackName..." -ForegroundColor Cyan
aws cloudformation deploy `
    --stack-name $StackName `
    --template-file $TemplateFile `
    --parameter-overrides file://$ParamFile `
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
    --region $Region `
    --profile $Profile `
    --no-fail-on-empty-changeset

Write-Host "Fetching stack outputs..." -ForegroundColor Cyan
$BucketName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='PortfolioBucketName'].OutputValue" `
    --output text

$DistId = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='PortfolioDistributionId'].OutputValue" `
    --output text

Write-Host "Syncing dist/ to s3://$BucketName..." -ForegroundColor Cyan
aws s3 sync (Join-Path $AppRoot "dist") "s3://$BucketName" --delete --region $Region --profile $Profile

Write-Host "Invalidating CloudFront cache for $DistId..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $DistId --paths "/*" --region $Region --profile $Profile | Out-Null

Write-Host "Portfolio deployed successfully to https://portfolio.abhijeetkharkar.com" -ForegroundColor Green
