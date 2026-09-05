param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "cinema-manager-agent-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"

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

Write-Host "Cinema Manager Agent infrastructure deployed successfully" -ForegroundColor Green
