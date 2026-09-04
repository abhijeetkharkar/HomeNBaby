param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "reminders-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistDir = Join-Path $AppRoot "dist"
$ZipFile = Join-Path $DistDir "lambda.zip"

Write-Host "Bundling Reminders Lambda code..." -ForegroundColor Cyan
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

Push-Location $AppRoot
try {
    npx esbuild reminder-lambda.js --bundle --platform=node --target=node20 --outfile=(Join-Path $DistDir "index.js")
    Compress-Archive -Path (Join-Path $DistDir "index.js") -DestinationPath $ZipFile -Force
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
    --query "Stacks[0].Outputs[?OutputKey=='ReminderLambdaName'].OutputValue" `
    --output text

Write-Host "Updating Lambda function code for $FunctionName..." -ForegroundColor Cyan
aws lambda update-function-code `
    --function-name $FunctionName `
    --zip-file "fileb://$ZipFile" `
    --region $Region `
    --profile $Profile | Out-Null

Write-Host "Reminders service deployed successfully" -ForegroundColor Green
