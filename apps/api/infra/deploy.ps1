param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "api-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistDir = Join-Path $AppRoot "dist"
$ZipFile = Join-Path $DistDir "lambda.zip"

Write-Host "Bundling API Lambda code..." -ForegroundColor Cyan
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

Push-Location $AppRoot
try {
    $OutJs = Join-Path $DistDir "index.js"
    npx esbuild lambda.js --bundle --platform=node --target=node20 "--outfile=$OutJs"
    Compress-Archive -Path $OutJs -DestinationPath $ZipFile -Force
} finally {
    Pop-Location
}

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

Write-Host "Fetching Lambda function name..." -ForegroundColor Cyan
$FunctionName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='ApiLambdaName'].OutputValue" `
    --output text

Write-Host "Updating Lambda function code for $FunctionName..." -ForegroundColor Cyan
aws lambda update-function-code `
    --function-name $FunctionName `
    --zip-file "fileb://$ZipFile" `
    --region $Region `
    --profile $Profile | Out-Null

Write-Host "API deployed successfully to https://api.abhijeetkharkar.com" -ForegroundColor Green
