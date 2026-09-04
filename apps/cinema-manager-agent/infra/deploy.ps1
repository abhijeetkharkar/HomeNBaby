param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"
$StackName = "cinema-manager-agent-stack-$Environment"
$TemplateFile = Join-Path $PSScriptRoot "template.yaml"
$ParamFile = Join-Path $PSScriptRoot "parameters\$Environment.json"

Write-Host "Deploying CloudFormation stack: $StackName..." -ForegroundColor Cyan
aws cloudformation deploy `
    --stack-name $StackName `
    --template-file $TemplateFile `
    --parameter-overrides file://$ParamFile `
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
    --region $Region `
    --profile $Profile `
    --no-fail-on-empty-changeset

Write-Host "Cinema Manager Agent infrastructure deployed successfully" -ForegroundColor Green
