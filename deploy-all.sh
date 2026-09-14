#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-prod}"
REGION="${2:-us-east-1}"
PROFILE="${3:-admin}"

echo -e "\033[0;36m=========================================\033[0m"
echo -e "\033[0;36m  Starting Monorepo Full Deployment      \033[0m"
echo -e "\033[0;36m=========================================\033[0m"

echo -e "\n\033[0;33m[1/7] Deploying Baby Tracker Infrastructure & Frontend...\033[0m"
./apps/baby-tracker/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;33m[2/7] Deploying Plants Infrastructure & Frontend...\033[0m"
./apps/plants/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;33m[3/7] Deploying Shared Backend API (api.abhijeetkharkar.com)...\033[0m"
./apps/api/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;33m[4/7] Deploying Reminders Scheduled Cron...\033[0m"
./apps/reminders/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;33m[5/7] Deploying Portfolio Frontend & Apex Redirect...\033[0m"
./apps/portfolio/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;33m[6/7] Deploying Cinema Manager API & DynamoDB...\033[0m"
./apps/cinema-manager-api/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;33m[7/7] Deploying Cinema Manager UI (cinema.abhijeetkharkar.com)...\033[0m"
./apps/cinema-manager-ui/infra/deploy.sh "$ENVIRONMENT" "$REGION" "$PROFILE"

echo -e "\n\033[0;32m=========================================\033[0m"
echo -e "\033[0;32m  All Applications & Infrastructure Live!\033[0m"
echo -e "\033[0;32m=========================================\033[0m"
