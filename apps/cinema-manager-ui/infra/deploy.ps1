param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "cinema-manager-ui-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"
$WorkspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$DistDir = Join-Path $WorkspaceRoot "dist\apps\cinema-manager-ui"

Write-Host "Building Cinema Manager UI (Angular)..." -ForegroundColor Cyan
Push-Location $WorkspaceRoot
try {
    npx nx build cinema-manager-ui
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

Write-Host "Fetching stack outputs..." -ForegroundColor Cyan
$BucketName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='CinemaUiBucketName'].OutputValue" `
    --output text

$DistId = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[?OutputKey=='CinemaUiDistributionId'].OutputValue" `
    --output text

Write-Host "Syncing dist/apps/cinema-manager-ui to s3://$BucketName..." -ForegroundColor Cyan
aws s3 sync $DistDir "s3://$BucketName" --delete --region $Region --profile $Profile

Write-Host "Invalidating CloudFront cache for $DistId..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $DistId --paths "/*" --region $Region --profile $Profile | Out-Null

Write-Host "Cinema Manager UI deployed successfully to https://cinema.abhijeetkharkar.com" -ForegroundColor Green
