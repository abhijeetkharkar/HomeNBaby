param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "plants-api-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistDir = Join-Path $AppRoot "dist"
$ZipFile = Join-Path $DistDir "lambda.zip"

$ProfileArgs = @()
if ($Profile -and $Profile -ne "none" -and $Profile -ne "default-env") {
    $ProfileArgs = @("--profile", $Profile)
}

Write-Host "Bundling Plants API Lambda code..." -ForegroundColor Cyan
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

Push-Location $AppRoot
try {
    $OutJs = Join-Path $DistDir "index.js"
    npx esbuild lambda.js --bundle --platform=node --target=node20 "--outfile=$OutJs"
    if ($LASTEXITCODE -ne 0) { throw "esbuild failed" }
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
$DeployArgs = @(
    "cloudformation", "deploy",
    "--stack-name", $StackName,
    "--template-file", $TemplateFile,
    "--capabilities", "CAPABILITY_IAM", "CAPABILITY_NAMED_IAM",
    "--region", $Region,
    "--no-fail-on-empty-changeset"
)
if ($Params.Count -gt 0) { $DeployArgs += @("--parameter-overrides") + $Params }
aws @DeployArgs @ProfileArgs
if ($LASTEXITCODE -ne 0) { throw "CloudFormation deploy failed" }

Write-Host "Fetching Lambda function name..." -ForegroundColor Cyan
$FunctionName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    @ProfileArgs `
    --query "Stacks[0].Outputs[?OutputKey=='PlantsApiLambdaName'].OutputValue" `
    --output text

Write-Host "Updating Lambda function code for $FunctionName..." -ForegroundColor Cyan
aws lambda update-function-code `
    --function-name $FunctionName `
    --zip-file "fileb://$ZipFile" `
    --region $Region `
    @ProfileArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Lambda code update failed" }

Write-Host "Plants API deployed successfully to https://plantsapi.abhijeetkharkar.com" -ForegroundColor Green
