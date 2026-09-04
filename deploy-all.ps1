param(
    [string]$Environment = "prod",
    [string]$Region = "us-east-1",
    [string]$Profile = "admin"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting Monorepo Full Deployment       " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Backend & Data Infrastructure
Write-Host "`n[1/7] Deploying Baby Tracker Infrastructure & Frontend..." -ForegroundColor Yellow
& "apps/baby-tracker/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n[2/7] Deploying Plants Infrastructure & Frontend..." -ForegroundColor Yellow
& "apps/plants/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n[3/7] Deploying Shared Backend API (api.abhijeetkharkar.com)..." -ForegroundColor Yellow
& "apps/api/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n[4/7] Deploying Reminders Scheduled Cron..." -ForegroundColor Yellow
& "apps/reminders/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n[5/7] Deploying Portfolio Frontend & Apex Redirect..." -ForegroundColor Yellow
& "apps/portfolio/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n[6/7] Deploying Cinema Manager API & DynamoDB..." -ForegroundColor Yellow
& "apps/cinema-manager-api/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n[7/7] Deploying Cinema Manager UI (cinema.abhijeetkharkar.com)..." -ForegroundColor Yellow
& "apps/cinema-manager-ui/infra/deploy.ps1" -Environment $Environment -Region $Region -Profile $Profile

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "  All Applications & Infrastructure Live! " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
