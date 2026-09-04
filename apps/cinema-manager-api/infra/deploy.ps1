param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "cinema-manager-api-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$WorkspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$DistDir = Join-Path $WorkspaceRoot "dist\apps\cinema-manager-api"
$ZipFile = Join-Path $DistDir "lambda.zip"

Write-Host "Building Cinema Manager API..." -ForegroundColor Cyan
Push-Location $WorkspaceRoot
try {
    npx nx build cinema-manager-api
    if (Test-Path (Join-Path $DistDir "main.js")) {
        Compress-Archive -Path (Join-Path $DistDir "main.js") -DestinationPath $ZipFile -Force
    }
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

Write-Host "Fetching Lambda function name..." -ForegroundColor Cyan
$FunctionName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='CinemaApiLambdaName'].OutputValue" `
    --output text

if (Test-Path $ZipFile) {
    Write-Host "Updating Lambda function code for $FunctionName..." -ForegroundColor Cyan
    aws lambda update-function-code `
        --function-name $FunctionName `
        --zip-file "fileb://$ZipFile" `
        --region $Region `
        --profile $Profile | Out-Null
}

Write-Host "Cinema Manager API deployed successfully to https://api.cinema.abhijeetkharkar.com" -ForegroundColor Green
