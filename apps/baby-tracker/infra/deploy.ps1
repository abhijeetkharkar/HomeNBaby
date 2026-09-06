param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "baby-tracker-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "Parsing parameters from $ParamFile..." -ForegroundColor Cyan
$Params = @()
if (Test-Path $ParamFile) {
    $paramObj = Get-Content $ParamFile -Raw | ConvertFrom-Json
    foreach ($prop in $paramObj.PSObject.Properties) {
        $Params += "$($prop.Name)=$($prop.Value)"
    }
}

Write-Host "Deploying CloudFormation stack: $StackName..." -ForegroundColor Cyan
if ($Params.Count -gt 0) {
    aws cloudformation deploy `
        --stack-name $StackName `
        --template-file $TemplateFile `
        --parameter-overrides @Params `
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
        --region $Region `
        --profile $Profile `
        --no-fail-on-empty-changeset
} else {
    aws cloudformation deploy `
        --stack-name $StackName `
        --template-file $TemplateFile `
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
        --region $Region `
        --profile $Profile `
        --no-fail-on-empty-changeset
}

Write-Host "Fetching stack outputs..." -ForegroundColor Cyan
$BucketName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='TrackerBucketName'].OutputValue" `
    --output text

$DistId = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='TrackerDistributionId'].OutputValue" `
    --output text

$UserPoolId = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" `
    --output text

$UserPoolClientId = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" `
    --output text

Write-Host "UserPoolId: $UserPoolId" -ForegroundColor Yellow
Write-Host "UserPoolClientId: $UserPoolClientId" -ForegroundColor Yellow

Write-Host "Building Baby Tracker frontend with injected Cognito config..." -ForegroundColor Cyan
$env:VITE_USER_POOL_ID = $UserPoolId
$env:VITE_USER_POOL_CLIENT_ID = $UserPoolClientId
$env:VITE_API_URL = "https://api.abhijeetkharkar.com"

Push-Location $AppRoot
try {
    npm run build
} finally {
    Pop-Location
}

Write-Host "Syncing public/ to s3://$BucketName..." -ForegroundColor Cyan
aws s3 sync (Join-Path $AppRoot "public") "s3://$BucketName" --delete --region $Region --profile $Profile

Write-Host "Invalidating CloudFront cache for $DistId..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $DistId --paths "/*" --region $Region --profile $Profile | Out-Null

Write-Host "Baby Tracker app deployed successfully to https://babytracker.abhijeetkharkar.com" -ForegroundColor Green
